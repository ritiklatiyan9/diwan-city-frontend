// Interest math for the Interest Management module.
// Single source of truth — the calculator, the party list and the loan detail
// all read from here so no two screens can disagree about a number.
//
// Self-check (no test runner installed):  node src/utils/interest.check.js

import { addMonths, differenceInCalendarDays, format, parseISO } from 'date-fns';

const DAYS_PER_YEAR = 365;

export const RATE_BASIS = { MONTHLY: 'MONTHLY', YEARLY: 'YEARLY' };
export const METHOD = { SIMPLE: 'SIMPLE', COMPOUND: 'COMPOUND' };
export const COMPOUNDING_PER_YEAR = { MONTHLY: 12, QUARTERLY: 4, YEARLY: 1 };

const num = (v) => {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

/** Parse a 'YYYY-MM-DD' string or a Date/timestamp into a Date at local midnight. */
export const toDate = (value) => {
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    // Postgres DATE columns come back as ISO timestamps; keep only the day part
    // so timezone never shifts a loan by one day.
    return parseISO(value.slice(0, 10));
  }
  return new Date(value);
};

export const toISODate = (value) => format(toDate(value), 'yyyy-MM-dd');

/** Rate normalised to a yearly fraction, e.g. 2%/month → 0.24 */
export const yearlyRateFraction = (rate, rateBasis) =>
  (num(rate) * (rateBasis === RATE_BASIS.MONTHLY ? 12 : 1)) / 100;

/**
 * Growth factor applied to a balance held for `days`.
 *   SIMPLE   → r × t              (interest never earns interest)
 *   COMPOUND → (1 + r/n)^(n × t)  − 1
 *
 * ponytail: compound uses the discrete formula over the exact segment length
 * rather than snapping to calendar compounding dates. Identical for whole
 * periods, off by paise mid-period. Move to period-aligned capitalisation only
 * if a lender ever disputes those paise.
 */
export const growthFactor = ({ rate, rateBasis, method, compounding = 'YEARLY', days }) => {
  const r = yearlyRateFraction(rate, rateBasis);
  const t = num(days) / DAYS_PER_YEAR;
  if (t <= 0 || r <= 0) return 0;
  if (method === METHOD.COMPOUND) {
    const n = COMPOUNDING_PER_YEAR[compounding] ?? 1;
    return Math.pow(1 + r / n, n * t) - 1;
  }
  return r * t;
};

/**
 * Plain interest on a fixed principal held for a whole tenure — the "1L for
 * 1 year at 10%" calculator. No transactions, no reducing balance.
 */
export const projectLoan = ({
  principal,
  rate,
  rateBasis = RATE_BASIS.YEARLY,
  method = METHOD.SIMPLE,
  compounding = 'YEARLY',
  tenureMonths,
  startDate,
}) => {
  const p = num(principal);
  const months = Math.max(0, num(tenureMonths));
  const start = startDate ? toDate(startDate) : new Date();
  const maturity = addMonths(start, months);
  const days = differenceInCalendarDays(maturity, start);

  const interest = p * growthFactor({ rate, rateBasis, method, compounding, days });
  const total = p + interest;

  return {
    principal: p,
    interest,
    total,
    days,
    months,
    startDate: start,
    maturityDate: maturity,
    // Straight-line share of the total interest — what a borrower actually
    // budgets with. For compound loans this is an average, not each month's
    // real charge (early months cost less, later months more).
    perMonth: months > 0 ? interest / months : 0,
    perDay: days > 0 ? interest / days : 0,
  };
};

/**
 * Running-balance accrual across a loan's transactions.
 *
 * Walks events in date order. Between two events, interest accrues on the
 * outstanding balance. A repayment clears accrued interest first, then eats
 * into principal (kind 'AUTO'); 'INTEREST' / 'PRINCIPAL' force one bucket.
 * A transaction on the same side as the loan adds to the principal instead —
 * i.e. borrowing more from the same party under the same terms.
 *
 * Returns everything the UI shows, plus a per-row ledger with the balance
 * after each transaction.
 */
export const computeLoanStatus = (loan, transactions = [], asOn = new Date()) => {
  const direction = loan.direction === 'LENT' ? 'LENT' : 'BORROWED';
  // Money moving toward us on a BORROWED loan is fresh principal; on a LENT
  // loan it is the party repaying us. The mirror holds for OUT.
  const disbursalDirection = direction === 'BORROWED' ? 'IN' : 'OUT';

  const terms = {
    rate: loan.rate,
    rateBasis: loan.rate_basis || RATE_BASIS.YEARLY,
    method: loan.method || METHOD.SIMPLE,
    compounding: loan.compounding || 'YEARLY',
  };

  const start = toDate(loan.start_date);
  const asOnDate = toDate(asOn);
  const maturity = addMonths(start, Math.max(1, num(loan.tenure_months) || 1));

  let principal = num(loan.principal);
  let unpaidInterest = 0;
  let interestAccrued = 0;   // lifetime, including what has been paid off
  let interestPaid = 0;
  let principalRepaid = 0;
  let extraDisbursed = 0;
  let excess = 0;            // paid beyond principal + interest
  let cursor = start;

  const accrueTo = (date) => {
    const days = differenceInCalendarDays(date, cursor);
    if (days <= 0) return 0;
    // SIMPLE charges on principal only; COMPOUND charges on the whole
    // outstanding balance, which is what makes interest earn interest.
    const base = terms.method === METHOD.COMPOUND ? principal + unpaidInterest : principal;
    const gained = Math.max(0, base) * growthFactor({ ...terms, days });
    unpaidInterest += gained;
    interestAccrued += gained;
    cursor = date;
    return gained;
  };

  const ordered = [...transactions]
    .filter((t) => String(t.loan_id) === String(loan.id))
    .sort((a, b) => {
      const d = differenceInCalendarDays(toDate(a.date), toDate(b.date));
      return d !== 0 ? d : num(a.id) - num(b.id);
    });

  const ledger = [];

  for (const txn of ordered) {
    const date = toDate(txn.date);
    // A transaction dated before the loan starts accrues nothing; clamp so it
    // still applies rather than silently rewinding the clock.
    if (differenceInCalendarDays(date, cursor) > 0) accrueTo(date);

    const amount = num(txn.amount);
    let toInterest = 0;
    let toPrincipal = 0;

    if (txn.direction === disbursalDirection) {
      principal += amount;
      extraDisbursed += amount;
    } else if (txn.kind === 'PRINCIPAL') {
      toPrincipal = Math.min(amount, principal);
      principal -= toPrincipal;
      principalRepaid += toPrincipal;
      excess += amount - toPrincipal;
    } else if (txn.kind === 'INTEREST') {
      toInterest = Math.min(amount, unpaidInterest);
      unpaidInterest -= toInterest;
      interestPaid += toInterest;
      // Anything above the interest owed still has to land somewhere.
      const left = amount - toInterest;
      toPrincipal = Math.min(left, principal);
      principal -= toPrincipal;
      principalRepaid += toPrincipal;
      excess += left - toPrincipal;
    } else {
      toInterest = Math.min(amount, unpaidInterest);
      unpaidInterest -= toInterest;
      interestPaid += toInterest;
      const left = amount - toInterest;
      toPrincipal = Math.min(left, principal);
      principal -= toPrincipal;
      principalRepaid += toPrincipal;
      excess += left - toPrincipal;
    }

    ledger.push({
      ...txn,
      isDisbursal: txn.direction === disbursalDirection,
      appliedToInterest: toInterest,
      appliedToPrincipal: toPrincipal,
      principalAfter: principal,
      interestDueAfter: unpaidInterest,
      balanceAfter: principal + unpaidInterest,
    });
  }

  accrueTo(asOnDate);

  const payoff = principal + unpaidInterest;
  const overdue = differenceInCalendarDays(asOnDate, maturity);

  return {
    direction,
    // 'we owe' vs 'they owe' — drives every colour and label in the UI.
    weOwe: direction === 'BORROWED',
    startDate: start,
    maturityDate: maturity,
    asOnDate,
    daysElapsed: Math.max(0, differenceInCalendarDays(asOnDate, start)),
    daysRemaining: -overdue,
    isOverdue: overdue > 0 && payoff > 0.5,
    originalPrincipal: num(loan.principal),
    extraDisbursed,
    principalOutstanding: principal,
    principalRepaid,
    interestAccrued,
    interestPaid,
    interestDue: unpaidInterest,
    excess,
    payoff,
    totalSettled: principalRepaid + interestPaid,
    isSettled: payoff <= 0.5,
    ledger,
    // What the loan would cost end-to-end if left untouched to maturity —
    // the headline the calculator shows.
    scheduled: projectLoan({
      principal: loan.principal,
      ...terms,
      tenureMonths: loan.tenure_months,
      startDate: loan.start_date,
    }),
  };
};

/** Roll several loan statuses into one party-level or site-level summary. */
export const summarise = (statuses = []) =>
  statuses.reduce(
    (acc, s) => {
      const side = s.weOwe ? 'payable' : 'receivable';
      acc[side].principal += s.principalOutstanding;
      acc[side].interest += s.interestDue;
      acc[side].payoff += s.payoff;
      acc[side].count += 1;
      acc.interestPaid += s.weOwe ? s.interestPaid : 0;
      acc.interestEarned += s.weOwe ? 0 : s.interestPaid;
      acc.overdue += s.isOverdue ? 1 : 0;
      return acc;
    },
    {
      payable: { principal: 0, interest: 0, payoff: 0, count: 0 },
      receivable: { principal: 0, interest: 0, payoff: 0, count: 0 },
      interestPaid: 0,
      interestEarned: 0,
      overdue: 0,
    }
  );

// ── Display helpers ──────────────────────────────────────────────────

/** ₹ with Indian grouping, 2 decimals. */
export const inr = (v) =>
  num(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Short Indian form for big headline numbers: 1,00,000 → 1.00 L */
export const inrShort = (v) => {
  const n = num(v);
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e7) return `${sign}${(abs / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `${sign}${(abs / 1e5).toFixed(2)} L`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(1)} K`;
  return `${sign}${abs.toFixed(0)}`;
};

export const fmtDate = (v) => (v ? format(toDate(v), 'dd MMM yyyy') : '—');

/** '1 year 6 months' from a month count — reads better than '18 months'. */
export const humanTenure = (months) => {
  const m = Math.max(0, Math.round(num(months)));
  const y = Math.floor(m / 12);
  const rem = m % 12;
  if (!m) return '—';
  if (!y) return `${m} month${m === 1 ? '' : 's'}`;
  if (!rem) return `${y} year${y === 1 ? '' : 's'}`;
  return `${y}y ${rem}m`;
};

export const rateLabel = (loan) =>
  `${num(loan.rate)}% ${loan.rate_basis === RATE_BASIS.MONTHLY ? 'per month' : 'per year'}`;
