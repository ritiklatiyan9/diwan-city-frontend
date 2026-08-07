// Self-check for the Interest Management math. No test runner is installed:
//   node src/utils/interest.check.js
import assert from 'node:assert/strict';
import {
  projectLoan, computeLoanStatus, summarise, growthFactor, humanTenure, inrShort,
} from './interest.js';

const near = (actual, expected, tol, msg) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${msg}: got ${actual}, want ~${expected}`);

// ── The headline the user asked for: 1L received for 1 year at 10% ──
{
  const r = projectLoan({ principal: 100000, rate: 10, tenureMonths: 12, startDate: '2026-01-01' });
  near(r.interest, 10000, 1, '1L @ 10%/yr for 1 year → ₹10,000 interest');
  near(r.total, 110000, 1, '…and ₹1,10,000 total payable');
  assert.equal(r.days, 365, 'a non-leap year is 365 days');
  near(r.perMonth, 833.33, 0.5, 'monthly share of the interest');
}

// A leap year really is one day more expensive — day-count, not month-count.
{
  const leap = projectLoan({ principal: 100000, rate: 10, tenureMonths: 12, startDate: '2024-01-01' });
  assert.equal(leap.days, 366);
  assert.ok(leap.interest > 10000, 'leap year accrues one extra day');
}

// ── Monthly rate: 2% per month is 24% per year, not 2% ──
{
  const r = projectLoan({ principal: 100000, rate: 2, rateBasis: 'MONTHLY', tenureMonths: 12, startDate: '2026-01-01' });
  near(r.interest, 24000, 1, '2%/month for a year → ₹24,000');
}

// ── Compound beats simple, and matches the textbook formula ──
{
  const simple = projectLoan({ principal: 100000, rate: 10, tenureMonths: 24, startDate: '2026-01-01' });
  const comp = projectLoan({ principal: 100000, rate: 10, method: 'COMPOUND', compounding: 'YEARLY', tenureMonths: 24, startDate: '2026-01-01' });
  near(simple.interest, 20000, 60, '2 years simple → ~₹20,000');
  near(comp.interest, 21000, 120, '2 years compounded yearly → ~₹21,000');
  assert.ok(comp.interest > simple.interest, 'compound must cost more than simple');
}

assert.equal(growthFactor({ rate: 10, days: 365, method: 'SIMPLE' }), 0.1);
assert.equal(growthFactor({ rate: 0, days: 365, method: 'SIMPLE' }), 0, 'a 0% loan accrues nothing');
assert.equal(growthFactor({ rate: 10, days: 0, method: 'SIMPLE' }), 0, 'day zero accrues nothing');
assert.equal(growthFactor({ rate: 10, days: -5, method: 'SIMPLE' }), 0, 'a back-dated txn never rebates interest');

// ── Borrowed 1L @ 12%/yr, untouched for a year ──
const loan = {
  id: 1, direction: 'BORROWED', principal: 100000, rate: 12,
  rate_basis: 'YEARLY', method: 'SIMPLE', start_date: '2026-01-01', tenure_months: 12,
};
{
  const s = computeLoanStatus(loan, [], '2027-01-01');
  near(s.interestDue, 12000, 1, 'a full year of untouched interest');
  near(s.payoff, 112000, 1, 'payoff = principal + accrued interest');
  assert.equal(s.weOwe, true, 'BORROWED means we owe');
  assert.equal(s.interestPaid, 0);
  assert.equal(s.isOverdue, false, 'due exactly at maturity is not yet overdue');
}

// ── Mid-term interest payment: interest clears first, principal untouched ──
{
  const txns = [{ id: 1, loan_id: 1, date: '2026-07-01', direction: 'OUT', amount: 6000, kind: 'AUTO' }];
  const s = computeLoanStatus(loan, txns, '2027-01-01');
  near(s.interestPaid, 5950, 60, 'the mid-year payment lands on interest first');
  // ₹6,000 against ₹5,950.68 of interest owed — only the ₹49 surplus touches principal.
  near(s.principalOutstanding, 99951, 5, 'an interest-sized payment barely dents principal');
  near(s.payoff, 106000, 60, 'a year costs ₹12,000; ₹6,000 is already paid');
  near(s.ledger[0].appliedToInterest, 5950, 5, 'ledger row shows the interest slice');
  near(s.ledger[0].appliedToPrincipal, 49, 5, 'ledger row shows the principal slice');
}

// ── Mid-term principal repayment reduces later interest (reducing balance) ──
{
  const txns = [{ id: 1, loan_id: 1, date: '2026-07-01', direction: 'OUT', amount: 50000, kind: 'AUTO' }];
  const s = computeLoanStatus(loan, txns, '2027-01-01');
  near(s.principalOutstanding, 55950, 60, '₹50k minus the ~₹5,950 interest owed at that date');
  const untouched = computeLoanStatus(loan, [], '2027-01-01');
  assert.ok(s.interestAccrued < untouched.interestAccrued, 'paying down principal must cut the interest bill');
  // ₹5,950 on 1L for 181 days, then ₹3,385 on ₹55,951 for 184 days.
  near(s.interestAccrued, 9335, 5, 'full rate for 6 months, then on the reduced balance');
}

// ── Borrowing MORE from the same party mid-term raises the principal ──
{
  const txns = [{ id: 1, loan_id: 1, date: '2026-07-01', direction: 'IN', amount: 50000, kind: 'AUTO' }];
  const s = computeLoanStatus(loan, txns, '2027-01-01');
  near(s.principalOutstanding, 150000, 1, 'money IN on a BORROWED loan is fresh principal');
  assert.equal(s.extraDisbursed, 50000);
  assert.equal(s.ledger[0].isDisbursal, true);
  near(s.interestAccrued, 15000, 60, '1L for 6 months + 1.5L for 6 months');
}

// The mirror: on a LENT loan it is OUT that adds principal, IN that repays.
{
  const lent = { ...loan, direction: 'LENT' };
  const more = computeLoanStatus(lent, [{ id: 1, loan_id: 1, date: '2026-07-01', direction: 'OUT', amount: 50000, kind: 'AUTO' }], '2027-01-01');
  near(more.principalOutstanding, 150000, 1, 'money OUT on a LENT loan is fresh principal');
  assert.equal(more.weOwe, false, 'LENT means they owe us');

  const repaid = computeLoanStatus(lent, [{ id: 1, loan_id: 1, date: '2026-07-01', direction: 'IN', amount: 50000, kind: 'AUTO' }], '2027-01-01');
  assert.equal(repaid.ledger[0].isDisbursal, false, 'money IN on a LENT loan is a repayment');
  near(repaid.principalOutstanding, 55950, 60, 'the repayment clears interest, then principal');
}

// ── Forced buckets ──
{
  const asPrincipal = computeLoanStatus(loan, [{ id: 1, loan_id: 1, date: '2026-07-01', direction: 'OUT', amount: 20000, kind: 'PRINCIPAL' }], '2027-01-01');
  near(asPrincipal.principalOutstanding, 80000, 1, "kind 'PRINCIPAL' skips the interest bucket entirely");
  assert.equal(asPrincipal.interestPaid, 0);

  const asInterest = computeLoanStatus(loan, [{ id: 1, loan_id: 1, date: '2026-07-01', direction: 'OUT', amount: 20000, kind: 'INTEREST' }], '2027-01-01');
  near(asInterest.interestPaid, 5950, 60, "kind 'INTEREST' takes what interest is owed…");
  near(asInterest.principalOutstanding, 85950, 60, '…and the surplus still reduces principal, never vanishes');
}

// ── Full settlement, and overpayment is reported rather than swallowed ──
{
  const s = computeLoanStatus(loan, [{ id: 1, loan_id: 1, date: '2027-01-01', direction: 'OUT', amount: 112000, kind: 'AUTO' }], '2027-01-01');
  near(s.payoff, 0, 1, 'paying the exact payoff closes the loan');
  assert.equal(s.isSettled, true);
  near(s.excess, 0, 1);

  const over = computeLoanStatus(loan, [{ id: 1, loan_id: 1, date: '2027-01-01', direction: 'OUT', amount: 120000, kind: 'AUTO' }], '2027-01-01');
  near(over.excess, 8000, 1, 'the ₹8,000 overpayment is surfaced, not absorbed');
  assert.ok(over.principalOutstanding >= 0, 'principal never goes negative');
}

// ── Overdue only fires while money is still owed ──
{
  const late = computeLoanStatus(loan, [], '2027-03-01');
  assert.equal(late.isOverdue, true, 'past maturity with a balance is overdue');
  assert.ok(late.daysRemaining < 0);

  const settled = computeLoanStatus(loan, [{ id: 1, loan_id: 1, date: '2026-06-01', direction: 'OUT', amount: 110000, kind: 'AUTO' }], '2027-03-01');
  assert.equal(settled.isOverdue, false, 'a settled loan is never overdue');
}

// ── Transactions belonging to another loan must not leak in ──
{
  const s = computeLoanStatus(loan, [{ id: 9, loan_id: 2, date: '2026-07-01', direction: 'OUT', amount: 50000, kind: 'AUTO' }], '2027-01-01');
  near(s.payoff, 112000, 1, "another loan's payment must not settle this one");
  assert.equal(s.ledger.length, 0);
}

// Out-of-order rows are sorted by date before the walk, so input order can't
// change the answer — a row typed in late must not rewind the interest clock.
{
  const rows = [
    { id: 2, loan_id: 1, date: '2026-09-01', direction: 'OUT', amount: 10000, kind: 'AUTO' },
    { id: 1, loan_id: 1, date: '2026-03-01', direction: 'OUT', amount: 10000, kind: 'AUTO' },
  ];
  const a = computeLoanStatus(loan, rows, '2027-01-01');
  const b = computeLoanStatus(loan, [...rows].reverse(), '2027-01-01');
  near(a.payoff, b.payoff, 0.01, 'result is independent of row order');
  assert.equal(a.ledger[0].id, 1, 'the earlier row is applied first');
}

// ── summarise splits the two sides ──
{
  const s = summarise([
    computeLoanStatus(loan, [], '2027-01-01'),
    computeLoanStatus({ ...loan, id: 2, direction: 'LENT', principal: 50000 }, [], '2027-01-01'),
  ]);
  near(s.payable.payoff, 112000, 1, 'what we owe');
  near(s.receivable.payoff, 56000, 1, 'what is owed to us');
  assert.equal(s.payable.count, 1);
  assert.equal(s.receivable.count, 1);
}

// ── Display helpers ──
assert.equal(humanTenure(12), '1 year');
assert.equal(humanTenure(18), '1y 6m');
assert.equal(humanTenure(6), '6 months');
assert.equal(humanTenure(0), '—');
assert.equal(inrShort(100000), '1.00 L');
assert.equal(inrShort(12500000), '1.25 Cr');
assert.equal(inrShort(-100000), '-1.00 L');

console.log('interest.check.js — all assertions passed');
