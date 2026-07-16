// Pricing math for the Add/Edit Plot modal, kept out of the page so it can be
// checked directly (see plotPricing.check.js). Every value here is money that
// drives balance / received / installment figures across the app.

/** Multiply two form strings into a fixed-2 string; '' when either isn't numeric. */
export const mul = (a, b) => {
    const x = parseFloat(a); const y = parseFloat(b);
    return Number.isFinite(x) && Number.isFinite(y) ? String((x * y).toFixed(2)) : '';
};

/**
 * Did a stored value come from something other than its formula (i.e. was it
 * hand-set)? Used to pre-mark fields as manual when an existing plot is opened,
 * so editing an unrelated input can't silently overwrite real data.
 *
 * NOTE the caller must pass the rate that ACTUALLY produced the stored value.
 * For sale_price that is plots.plot_rate (the effective, post-discount rate) —
 * NOT original_plot_rate, or every discounted plot reads as hand-set.
 */
export const diverges = (stored, computed) => {
    const s = parseFloat(stored);
    const c = parseFloat(computed);
    if (!Number.isFinite(s) || s === 0) return false; // nothing stored yet
    if (!Number.isFinite(c)) return true;             // a value exists with no formula behind it
    return Math.abs(s - c) > 0.01;                    // beyond numeric(15,2) rounding
};

/**
 * The sale_price actually persisted on submit.
 *   - a hand-set value wins, including over the discount formula;
 *   - a blank override falls back to the formula (the field is editable now, so
 *     blanking it must not save ₹0 — sale_price drives every balance figure);
 *   - effectiveRate is already original − discount, so this one expression is
 *     correct with and without a discount.
 */
export const resolveSalePrice = ({ manual, salePriceInput, plotSize, effectiveRate }) => {
    const typed = parseFloat(salePriceInput);
    if (manual && Number.isFinite(typed)) return typed;
    const size = parseFloat(plotSize) || 0;
    const rate = parseFloat(effectiveRate) || 0;
    return (size * rate) || (Number.isFinite(typed) ? typed : 0);
};
