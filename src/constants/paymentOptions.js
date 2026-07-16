// Payment enums shared by PlotPayments.jsx (credit), Expenses.jsx (debit) and the
// dashboard Credit/Debit quick-entry modal, so a new mode is added in one place.
//
// Values MUST stay UPPERCASE: the backend stores them verbatim and
// utils/paymentMode.js buckets them by exact uppercase match — a lowercase or
// hyphenated variant silently falls into the 'other' bucket.

/** plot_payments.payment_from — where a plot credit came from. */
export const PAYMENT_FROM_OPTIONS = [
    'BOOKING', 'CASH', 'BANK', 'TRANSFER', 'CHEQUE', 'UPI',
    'NEFT', 'RTGS', 'IMPS', 'ADJUST', 'RETURN', 'REFUND',
];

/** FROM sources that settle through a bank, so payment_type becomes BANK. */
export const BANK_TYPE_FROMS = ['BANK', 'TRANSFER', 'CHEQUE', 'UPI', 'NEFT', 'RTGS', 'IMPS'];

/**
 * plot_payments.payment_type only accepts CASH | BANK | CHEQUE (DB CHECK
 * constraint plot_payments_payment_type_check); the backend silently coerces
 * anything else to CASH, so derive it rather than letting the user pick.
 */
export const derivePaymentType = (from) =>
    from === 'CHEQUE' ? 'CHEQUE' : BANK_TYPE_FROMS.includes(from) ? 'BANK' : 'CASH';

/** expenses.payment_mode — how a debit was paid out. */
export const PAYMENT_MODE_OPTIONS = [
    'CASH', 'UPI', 'CHEQUE', 'BANK', 'TRANSFER', 'NEFT', 'RTGS', 'IMPS', 'ADJUST',
];

/** Modes that carry bank account details (drives the Account No / Branch fields). */
export const BANK_MODES = ['BANK', 'UPI', 'CHEQUE', 'NEFT', 'RTGS', 'IMPS', 'TRANSFER'];
