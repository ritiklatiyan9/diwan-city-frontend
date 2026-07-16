// Self-check for the shared payment enums. No test runner is installed:
//   node src/constants/paymentOptions.check.js
//
// Guards the money-classification path — derivePaymentType() decides whether a
// plot payment books as CASH or BANK, and a silent miscategorisation shows up as
// wrong Cash/Bank totals on the Day Book rather than as an error.
import assert from 'node:assert/strict';
import {
  PAYMENT_FROM_OPTIONS, PAYMENT_MODE_OPTIONS, BANK_TYPE_FROMS, BANK_MODES, derivePaymentType,
} from './paymentOptions.js';

// plot_payments.payment_type CHECK constraint only allows these three.
const VALID_TYPES = ['CASH', 'BANK', 'CHEQUE'];
for (const from of PAYMENT_FROM_OPTIONS) {
  assert.ok(VALID_TYPES.includes(derivePaymentType(from)), `${from} derives an invalid payment_type`);
}

assert.equal(derivePaymentType('CHEQUE'), 'CHEQUE');
assert.equal(derivePaymentType('BANK'), 'BANK');
assert.equal(derivePaymentType('UPI'), 'BANK');
assert.equal(derivePaymentType('CASH'), 'CASH');
assert.equal(derivePaymentType('BOOKING'), 'CASH');
// Unknown / empty must fall back to CASH, never undefined — the backend coerces
// anything outside the enum to CASH anyway, so the UI must agree with it.
assert.equal(derivePaymentType(''), 'CASH');
assert.equal(derivePaymentType(undefined), 'CASH');

// Backend matching is exact-uppercase; a lowercase entry silently buckets to
// 'other' in utils/paymentMode.js and never reaches the Cash/Bank totals.
for (const v of [...PAYMENT_FROM_OPTIONS, ...PAYMENT_MODE_OPTIONS, ...BANK_TYPE_FROMS, ...BANK_MODES]) {
  assert.equal(v, v.toUpperCase().trim(), `${JSON.stringify(v)} must be trimmed UPPERCASE`);
}

// Subset invariants: a bank-ish value must exist in the list it filters.
for (const v of BANK_TYPE_FROMS) assert.ok(PAYMENT_FROM_OPTIONS.includes(v), `${v} missing from PAYMENT_FROM_OPTIONS`);
for (const v of BANK_MODES) assert.ok(PAYMENT_MODE_OPTIONS.includes(v), `${v} missing from PAYMENT_MODE_OPTIONS`);

// No duplicates — a repeated chip renders twice with the same React key.
for (const [name, list] of [['PAYMENT_FROM_OPTIONS', PAYMENT_FROM_OPTIONS], ['PAYMENT_MODE_OPTIONS', PAYMENT_MODE_OPTIONS]]) {
  assert.equal(new Set(list).size, list.length, `${name} has duplicates`);
}

console.log('paymentOptions: all checks passed');
