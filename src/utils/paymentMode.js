// Canonical payment-mode bucketing used across the Day Book UI.
// Must mirror backend/src/utils/paymentMode.js so the Cash/Bank/Main cards
// tie exactly to what the backend aggregates return.

export const BUCKETS = ['cash', 'bank', 'cheque', 'upi', 'other'];

export function classifyPaymentMode(raw) {
  if (raw === null || raw === undefined) return 'other';
  const s = String(raw).trim().toUpperCase();
  if (!s) return 'other';
  if (s === 'CASH') return 'cash';
  if (s === 'CHEQUE' || s === 'CHQ') return 'cheque';
  if (s === 'UPI' || s === 'GPAY' || s === 'PHONEPE' || s === 'PAYTM') return 'upi';
  if (s === 'BANK' || s === 'NEFT' || s === 'RTGS' || s === 'IMPS' || s === 'ONLINE' || s === 'TRANSFER' || s === 'NET BANKING' || s === 'NETBANKING') return 'bank';
  return 'other';
}

// Labels used for the per-bucket Remaining breakdown on the Main Day Book.
export const BUCKET_LABELS = {
  cash:   'Cash',
  bank:   'Bank',
  cheque: 'Cheque',
  upi:    'UPI',
  other:  'Other',
};
