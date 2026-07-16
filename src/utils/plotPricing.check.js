// Self-check for the Add/Edit Plot pricing math. No test runner is installed:
//   node src/utils/plotPricing.check.js
import assert from 'node:assert/strict';
import { mul, diverges, resolveSalePrice } from './plotPricing.js';

// ── mul ──
assert.equal(mul('100', '5000'), '500000.00');
assert.equal(mul('36.67', '14500'), '531715.00');
assert.equal(mul('', '5000'), '');
assert.equal(mul('100', ''), '');
assert.equal(mul(undefined, undefined), '');

// ── diverges ──
assert.equal(diverges('500000', '500000.00'), false, 'exact match is not manual');
assert.equal(diverges('500000.005', '500000.00'), false, 'within numeric(15,2) rounding');
assert.equal(diverges('450000', '500000.00'), true, 'hand-set value is manual');
assert.equal(diverges('', '500000.00'), false, 'nothing stored yet');
assert.equal(diverges('0', '500000.00'), false, 'zero means unset, not manual');
assert.equal(diverges('450000', ''), true, 'a value with no formula behind it is manual');

// A DISCOUNTED plot must NOT read as hand-set. Regression guard: comparing
// against original_plot_rate (10000) instead of the stored effective rate
// (9500) pinned every discounted plot as manual and froze its Sale Price.
{
  const size = '100', original = '10000', effective = '9500'; // 500/gaz discount
  const stored = '950000';                                    // 100 × 9500
  assert.equal(diverges(stored, mul(size, effective)), false, 'discounted plot is NOT manual');
  assert.equal(diverges(stored, mul(size, original)), true, 'control: the old wrong comparison did flag it');
}

// ── resolveSalePrice ──
const size = '100', rate = '5000';           // effective rate, no discount
const disc = '4500';                         // effective rate with a 500/gaz discount

assert.equal(resolveSalePrice({ manual: false, salePriceInput: '500000', plotSize: size, effectiveRate: rate }), 500000, 'auto, no discount');
assert.equal(resolveSalePrice({ manual: false, salePriceInput: '500000', plotSize: size, effectiveRate: disc }), 450000, 'auto, discount applies');
assert.equal(resolveSalePrice({ manual: true, salePriceInput: '444444', plotSize: size, effectiveRate: rate }), 444444, 'hand-set wins');
assert.equal(resolveSalePrice({ manual: true, salePriceInput: '444444', plotSize: size, effectiveRate: disc }), 444444, 'hand-set wins over the discount formula');

// Regression guard: a blanked override must fall back to the formula, NOT ₹0.
// The no-discount branch is the ONLY one reachable on create, so this was the
// default path, not an edge case.
assert.equal(resolveSalePrice({ manual: true, salePriceInput: '', plotSize: size, effectiveRate: rate }), 500000, 'blank override -> formula (no discount)');
assert.equal(resolveSalePrice({ manual: true, salePriceInput: '', plotSize: size, effectiveRate: disc }), 450000, 'blank override -> formula (discount)');

// Degenerate inputs must not produce NaN — the column is numeric(15,2) NOT NULL.
for (const v of [
  resolveSalePrice({ manual: true, salePriceInput: 'abc', plotSize: '', effectiveRate: '' }),
  resolveSalePrice({ manual: false, salePriceInput: '', plotSize: '', effectiveRate: '' }),
  resolveSalePrice({ manual: false, salePriceInput: 'abc', plotSize: '0', effectiveRate: '0' }),
]) {
  assert.ok(Number.isFinite(v), 'never NaN');
  assert.equal(v, 0);
}
// Size/rate of 0 with a typed value falls back to what the user typed.
assert.equal(resolveSalePrice({ manual: false, salePriceInput: '250000', plotSize: '0', effectiveRate: '0' }), 250000);

console.log('plotPricing: all checks passed');
