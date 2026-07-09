import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/api';
import {
  Building2, ShieldCheck, ShieldAlert, Loader2,
  Calendar, CreditCard, User, MapPin, Hash, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';

const RECEIPT_TYPE_LABELS = {
  FRM: 'Farmer Payment',
  VND: 'Vendor Payment',
  PLT: 'Plot Payment',
  CMN: 'Plot Commission',
  EXP: 'Expense Voucher',
  DBK: 'DayBook / Cash Flow Entry',
  IMP: 'Imprest Ledger',
};

const fmtAmount = (v) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(parseFloat(v) || 0);

const fmtDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? String(d) : dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const Row = ({ icon: Icon, label, value }) => {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-slate-100 last:border-0">
      <Icon className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">{label}</p>
        <p className="text-sm font-semibold text-slate-800 truncate">{value}</p>
      </div>
    </div>
  );
};

export const VerifyReceipt = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState('loading'); // loading | valid | invalid | missing
  const [receipt, setReceipt] = useState(null);
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!token) { setStatus('missing'); return; }
    let cancelled = false;
    api.get('/verify-receipt', { params: { token } })
      .then(({ data }) => {
        if (cancelled) return;
        if (data?.valid) {
          setReceipt(data.receipt);
          setStatus('valid');
        } else {
          setReason(data?.message || 'This receipt could not be verified.');
          setStatus('invalid');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setReason(err.response?.data?.message || 'This receipt could not be verified.');
        setStatus('invalid');
      });
    return () => { cancelled = true; };
  }, [token]);

  const partyName = receipt?.pn || receipt?.fn || null;
  const direction = receipt?.dr; // 'IN' | 'OUT'

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Brand header */}
        <div className="flex flex-col items-center mb-6">
          <div className="relative w-14 h-14 rounded-2xl bg-linear-to-br from-indigo-600 via-indigo-500 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/25 ring-1 ring-inset ring-white/25 mb-3">
            <Building2 className="w-7 h-7 text-white drop-shadow-sm" />
          </div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">Diwan City Real Estate</h1>
          <p className="text-xs font-medium text-slate-400 tracking-wide uppercase mt-0.5">Receipt Verification</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {status === 'loading' && (
            <div className="flex flex-col items-center justify-center py-14 px-6">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
              <p className="text-sm text-slate-500">Verifying receipt…</p>
            </div>
          )}

          {status === 'missing' && (
            <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
              <ShieldAlert className="w-10 h-10 text-slate-300 mb-3" />
              <p className="text-sm font-semibold text-slate-700">No verification token provided</p>
              <p className="text-xs text-slate-400 mt-1">Scan the QR code printed on a Diwan City Real Estate receipt.</p>
            </div>
          )}

          {status === 'invalid' && (
            <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
              <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-3">
                <ShieldAlert className="w-7 h-7 text-red-500" />
              </div>
              <p className="text-base font-bold text-red-600">Not Verified</p>
              <p className="text-xs text-slate-500 mt-1.5 max-w-xs">{reason}</p>
              <p className="text-[11px] text-slate-400 mt-3">This receipt does not match Diwan City Real Estate's records.</p>
            </div>
          )}

          {status === 'valid' && receipt && (
            <>
              <div className="flex flex-col items-center justify-center py-6 px-6 bg-emerald-50/60 border-b border-emerald-100">
                <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mb-2.5">
                  <ShieldCheck className="w-7 h-7 text-emerald-600" />
                </div>
                <p className="text-base font-bold text-emerald-700">Verified Receipt</p>
                <p className="text-[11px] text-emerald-600/80 mt-0.5">Genuinely issued by Diwan City Real Estate</p>
              </div>

              <div className="px-6 py-2">
                <Row icon={Hash} label="Receipt Type" value={RECEIPT_TYPE_LABELS[receipt.t] || receipt.t} />
                <Row
                  icon={direction === 'OUT' ? ArrowUpRight : ArrowDownRight}
                  label="Amount"
                  value={`${fmtAmount(receipt.a)}${direction ? ` (${direction === 'OUT' ? 'Debit' : 'Credit'})` : ''}`}
                />
                <Row icon={Calendar} label="Date" value={fmtDate(receipt.d)} />
                <Row icon={CreditCard} label="Payment Mode" value={receipt.pm} />
                <Row icon={User} label="Party" value={partyName} />
                <Row icon={Hash} label="Category / Reference" value={receipt.pl || receipt.rf} />
                <Row
                  icon={MapPin}
                  label="Site"
                  value={[receipt.sn, receipt.sy, receipt.ss].filter(Boolean).join(', ') || null}
                />
                <Row icon={Hash} label="Receipt ID" value={receipt.i} />
              </div>
            </>
          )}
        </div>

        <p className="text-center text-[11px] text-slate-400 mt-5">
          © {new Date().getFullYear()} Diwan City Real Estate — Account Software
        </p>
      </div>
    </div>
  );
};

export default VerifyReceipt;
