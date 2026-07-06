import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, ExternalLink, Loader2, Printer, Receipt } from 'lucide-react';
import api from '../api/api';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';

const money = (n) => {
  const num = parseFloat(n) || 0;
  return num.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 0 });
};

const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const fmtDateTime = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const VendorPaymentReceiptPrint = () => {
  const { paymentId } = useParams();
  const [searchParams] = useSearchParams();
  const siteId = searchParams.get('site_id');
  const autoPrint = searchParams.get('autoprint') === '1';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState(null);

  useEffect(() => {
    const fetchReceipt = async () => {
      if (!paymentId || !siteId) {
        setError('Missing payment or site context for receipt.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');
      try {
        const res = await api.get(`/vendors/payments/${paymentId}/receipt`, {
          params: { site_id: siteId },
        });
        setReceipt(res.data.receipt || null);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load vendor receipt.');
        setReceipt(null);
      } finally {
        setLoading(false);
      }
    };

    fetchReceipt();
  }, [paymentId, siteId]);

  useEffect(() => {
    if (!autoPrint || loading || !receipt) return;
    const timer = setTimeout(() => window.print(), 350);
    return () => clearTimeout(timer);
  }, [autoPrint, loading, receipt]);

  const receiptNo = useMemo(() => {
    if (!receipt?.id) return '-';
    return `VP-${String(receipt.id).padStart(6, '0')}`;
  }, [receipt]);

  const backTo = useMemo(() => {
    if (!receipt?.commitment_id) return '/vendors';
    return `/vendors/${receipt.commitment_id}`;
  }, [receipt]);

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white print:min-h-0">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-shell { padding: 0 !important; background: #fff !important; }
          .print-sheet { box-shadow: none !important; border: none !important; border-radius: 0 !important; margin: 0 !important; max-width: none !important; }
          body { background: #fff !important; }
        }
      `}</style>

      <div className="print-shell max-w-4xl mx-auto px-4 py-6">
        {loading ? (
          <div className="bg-white border border-slate-200 rounded-xl p-10 flex items-center justify-center gap-2 text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading receipt...
          </div>
        ) : error ? (
          <div className="bg-white border border-red-200 rounded-xl p-8 text-center">
            <AlertCircle className="w-6 h-6 text-red-500 mx-auto mb-2" />
            <p className="text-sm text-red-700">{error}</p>
            <div className="mt-4">
              <Link to="/vendors" className="text-sm text-slate-700 underline">Go to Vendor Management</Link>
            </div>
          </div>
        ) : receipt ? (
          <div className="print-sheet bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="no-print px-6 py-4 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-slate-700">
                <Receipt className="w-4 h-4" />
                <span className="text-sm font-medium">Online Vendor Receipt</span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link to={backTo}><ArrowLeft className="w-3.5 h-3.5 mr-1.5" />Back</Link>
                </Button>
                <Button size="sm" onClick={() => window.print()}>
                  <Printer className="w-3.5 h-3.5 mr-1.5" />Print
                </Button>
              </div>
            </div>

            <div className="px-7 py-6 border-b border-slate-200 bg-linear-to-br from-slate-50 to-white">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">{receipt.site_name || 'Site Office'}</h1>
                  <p className="text-sm text-slate-600 mt-1">
                    {[receipt.site_address, [receipt.site_city, receipt.site_state].filter(Boolean).join(', ')].filter(Boolean).join(' | ') || 'Vendor receipt document'}
                  </p>
                </div>
                <div className="text-right">
                  <Badge variant="outline" className="text-[10px] uppercase tracking-wide bg-slate-100 text-slate-700 border-slate-200">
                    Vendor Payment
                  </Badge>
                  <p className="text-xs text-slate-500 mt-2">Receipt No: <span className="font-semibold text-slate-700">{receiptNo}</span></p>
                  <p className="text-xs text-slate-500 mt-1">Printed: {fmtDateTime(new Date())}</p>
                </div>
              </div>
            </div>

            <div className="px-7 py-6">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-slate-500">Amount Paid</p>
                  <p className="text-3xl font-bold text-slate-900 mt-1">INR {money(receipt.amount)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] uppercase tracking-wider text-slate-500">Status</p>
                  <p className="text-sm font-semibold uppercase text-slate-700 mt-1">{receipt.status || 'pending'}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4 text-sm">
                <div className="border border-slate-200 rounded-lg p-3"><p className="text-[11px] text-slate-500 uppercase tracking-wider">Vendor Name</p><p className="font-medium text-slate-800 mt-1">{receipt.vendor_name || '—'}</p></div>
                <div className="border border-slate-200 rounded-lg p-3"><p className="text-[11px] text-slate-500 uppercase tracking-wider">Payment Date</p><p className="font-medium text-slate-800 mt-1">{fmtDate(receipt.payment_date)}</p></div>
                <div className="border border-slate-200 rounded-lg p-3"><p className="text-[11px] text-slate-500 uppercase tracking-wider">Work Title</p><p className="font-medium text-slate-800 mt-1">{receipt.work_title || '—'}</p></div>
                <div className="border border-slate-200 rounded-lg p-3"><p className="text-[11px] text-slate-500 uppercase tracking-wider">Head</p><p className="font-medium text-slate-800 mt-1">{receipt.head_name || '—'}</p></div>
                <div className="border border-slate-200 rounded-lg p-3"><p className="text-[11px] text-slate-500 uppercase tracking-wider">Payment Mode</p><p className="font-medium text-slate-800 mt-1 uppercase">{receipt.payment_mode || '—'}</p></div>
                <div className="border border-slate-200 rounded-lg p-3"><p className="text-[11px] text-slate-500 uppercase tracking-wider">Reference No</p><p className="font-medium text-slate-800 mt-1">{receipt.reference_no || '—'}</p></div>
                <div className="border border-slate-200 rounded-lg p-3 md:col-span-2"><p className="text-[11px] text-slate-500 uppercase tracking-wider">Remark / Note</p><p className="font-medium text-slate-800 mt-1">{receipt.note || '—'}</p></div>
                {receipt.voucher_url && (
                  <div className="border border-slate-200 rounded-lg p-3 md:col-span-2">
                    <p className="text-[11px] text-slate-500 uppercase tracking-wider">Voucher</p>
                    <a href={receipt.voucher_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-sm text-slate-700 hover:text-slate-900 underline">
                      <ExternalLink className="w-3.5 h-3.5" /> Open Voucher File
                    </a>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-5 mt-7 text-center text-xs text-slate-500">
                <div className="border-t border-dashed border-slate-300 pt-3">Prepared By</div>
                <div className="border-t border-dashed border-slate-300 pt-3">Authorized Signatory</div>
              </div>

              <p className="text-[11px] text-slate-500 mt-6 border-t border-slate-200 pt-3">
                This is a computer-generated receipt for vendor payment records.
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default VendorPaymentReceiptPrint;
