// The one rule all 8 money modules must agree on: which extra fields a payment
// mode asks for. Isolated in its own file so the rule is greppable and testable
// without mounting a Dialog.
//
// Before this, each page had its own predicate — BANK_MODES.includes(...),
// payment_from !== 'CASH' && payment_type !== 'CASH', ['bank','cheque'].includes(...)
// — and they disagreed, which is how stale bank details ended up on cash rows.
import { Input } from '../ui/input';
import { SearchSelect } from '../ui/search-select';
import { Field } from './Field';
import { MODE_FIELD_SETS } from './modeFieldSets';
import { derivePaymentType } from '../../constants/paymentOptions';

// Which loadSources() key feeds each dropdown. Absent ⇒ plain text input.
// cash_account is deliberately absent: cash details are typed, not picked from a
// list, because there is no cash-account entity in the schema to pick from.
const SOURCE_OF = {
  bank_name: 'bankNames',
  bank_account: 'accountNos',
  branch: 'branches',
};

const DEFAULT_LABEL = {
  cash_account: 'Cash Details',
  bank_name: 'Bank Name',
  bank_account: 'Bank Details',
  branch: 'Branch',
  txn_ref: 'Transaction Ref',
  cheque_no: 'Cheque No',
  ifsc: 'IFSC',
};

const UPPERCASE = new Set(['bank_account', 'branch', 'ifsc', 'txn_ref', 'bank_name']);

// Each canonical field lands in a different column per module, and Postgres
// rejects an over-long value with a 500 rather than a validation error. These are
// the NARROWEST column across all 8 modules, so no adapter can overflow:
//   cash_account/txn_ref -> firm_transactions.transaction_no varchar(50)
//   bank_account -> expenses.account_no varchar(100)
//   bank_name -> plot_commission_payments.bank_name varchar(100)
//   branch -> plot_payments.branch varchar(150) ... capped at 100 for headroom
//   cheque_no -> varchar(50) in every table that has one
// ponytail: one shared cap, not a per-adapter table. Real values are ~25 chars;
// raise it per-adapter only if someone actually hits a limit.
const MAX_LEN = {
  cash_account: 50,
  txn_ref: 50,
  cheque_no: 50,
  bank_name: 100,
  bank_account: 100,
  branch: 100,
  ifsc: 11,
};

export function ModeFields({
  mode,
  kindOverrides,
  allow = [],
  values = {},
  onChange,
  sources = {},
  labels = {},
  disabled = false,
}) {
  const kind = kindOverrides?.[mode] || derivePaymentType(mode);
  const keys = (MODE_FIELD_SETS[kind] || []).filter((k) => allow.includes(k));
  if (!keys.length) return null;

  return (
    <div className="grid grid-cols-12 gap-x-3 gap-y-2.5">
      {keys.map((key) => {
        // A cheque's "bank" is the drawee bank; same column, clearer label.
        const label =
          labels[key] ||
          (kind === 'CHEQUE' && key === 'bank_name' ? 'Drawee Bank' : DEFAULT_LABEL[key]) ||
          key;
        const sourceKey = SOURCE_OF[key];
        const options = sourceKey ? (sources[sourceKey] || []) : null;
        const span = keys.length >= 4 ? 3 : keys.length === 3 ? 4 : 6;

        return (
          <Field key={key} label={label} htmlFor={`pm-${key}`} span={span}>
            {options ? (
              <SearchSelect
                id={`pm-${key}`}
                value={values[key] || null}
                options={options}
                // allowCustom because these lists are autocomplete history, not
                // closed enums — a brand-new bank must still be typeable.
                allowCustom
                disabled={disabled}
                placeholder={`Select ${label.toLowerCase()}…`}
                onChange={(k, opt) => onChange(key, opt ? (opt.label ?? String(k)) : (k ?? ''))}
              />
            ) : (
              <Input
                id={`pm-${key}`}
                className="h-9"
                disabled={disabled}
                maxLength={MAX_LEN[key]}
                value={values[key] || ''}
                onChange={(e) =>
                  onChange(key, UPPERCASE.has(key) ? e.target.value.toUpperCase() : e.target.value)
                }
              />
            )}
          </Field>
        );
      })}
    </div>
  );
}

export default ModeFields;
