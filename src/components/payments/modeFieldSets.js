// Which extra fields each payment kind asks for. Separate from ModeFields.jsx
// because a file that exports both a component and a constant breaks React Fast
// Refresh (react-refresh/only-export-components).
//
// Render order matters — this is the order the fields appear in the row.
export const MODE_FIELD_SETS = {
  // CASH asks for one typed "Cash Details" value. Not a dropdown: there is no
  // cash-account entity in the schema to pick from, and every module stores it
  // in whichever free-text reference column it already has.
  CASH: ['cash_account'],
  BANK: ['bank_name', 'bank_account', 'branch', 'txn_ref', 'ifsc'],
  // A cheque genuinely has a drawee bank, so CHEQUE keeps bank fields — this is
  // already how Expenses behaves today (CHEQUE is in BANK_MODES).
  CHEQUE: ['cheque_no', 'bank_name', 'bank_account'],
};

export default MODE_FIELD_SETS;
