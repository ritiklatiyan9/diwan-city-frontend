import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '../components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../components/ui/table';
import {
  ArrowLeft, Plus, Edit2, Trash2, Phone, MapPin, Percent, Loader2,
  ArrowDownLeft, ArrowUpRight, AlertTriangle, Calculator, CalendarDays,
  ChevronDown, ChevronRight, CheckCircle2, StickyNote, Receipt, Wallet,
} from 'lucide-react';
import {
  computeLoanStatus, summarise, projectLoan, inr, inrShort,
  fmtDate, humanTenure, rateLabel, toISODate,
} from '../utils/interest';

const today = () => toISODate(new Date());

const EMPTY_LOAN = {
  title: '',
  direction: 'BORROWED',
  principal: '',
  rate: '',
  rate_basis: 'YEARLY',
  method: 'SIMPLE',
  compounding: 'YEARLY',
  start_date: today(),
  tenure_months: '12',
  status: 'ACTIVE',
  note: '',
};

const EMPTY_TXN = {
  date: today(),
  direction: 'OUT',
  amount: '',
  kind: 'AUTO',
  mode: 'CASH',
  reference: '',
  note: '',
};

const MODE_LABEL = { CASH: 'Cash', BANK: 'Bank', UPI: 'UPI', CHEQUE: 'Cheque', OTHER: 'Other' };

const Money = ({ label, value, tone = 'text-slate-800', hint }) => (
  <div className="min-w-0">
    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
    <p className={`text-[15px] font-bold mt-0.5 tabular-nums truncate ${tone}`}>₹{inr(value)}</p>
    {hint && <p className="text-[10px] text-slate-400 mt-0.5 truncate">{hint}</p>}
  </div>
);

const InterestPartyDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentSite, hasPermission } = useAuth();
  const siteId = currentSite?.id;

  const canWrite = hasPermission('interest', 'write');
  const canUpdate = hasPermission('interest', 'update');
  const canDelete = hasPermission('interest', 'delete');

  const [party, setParty] = useState(null);
  const [loans, setLoans] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});

  const [loanDialog, setLoanDialog] = useState(false);
  const [loanForm, setLoanForm] = useState(EMPTY_LOAN);
  const [editingLoanId, setEditingLoanId] = useState(null);

  const [txnDialog, setTxnDialog] = useState(false);
  const [txnForm, setTxnForm] = useState(EMPTY_TXN);
  const [txnLoan, setTxnLoan] = useState(null);
  const [editingTxnId, setEditingTxnId] = useState(null);

  const [saving, setSaving] = useState(false);

  const fetchParty = useCallback(async () => {
    if (!siteId || !id) return;
    setLoading(true);
    try {
      const res = await api.get(`/interest/parties/${id}?site_id=${siteId}`);
      setParty(res.data.party);
      setLoans(res.data.loans || []);
      setTransactions(res.data.transactions || []);
    } catch (err) {
      console.error('Failed to fetch party:', err);
      toast.error(err.response?.data?.message || 'Could not load this party');
      if (err.response?.status === 404) navigate('/interest');
    } finally {
      setLoading(false);
    }
  }, [siteId, id, navigate]);

  useEffect(() => { fetchParty(); }, [fetchParty]);

  const statuses = useMemo(() => {
    const now = new Date();
    return loans.map((loan) => ({ loan, status: computeLoanStatus(loan, transactions, now) }));
  }, [loans, transactions]);

  const totals = useMemo(() => summarise(statuses.map((s) => s.status)), [statuses]);

  // Live preview inside the Add Deal dialog — the "1L for 1 year at 10%" answer,
  // recomputed as the user types.
  const loanPreview = useMemo(
    () => projectLoan({
      principal: loanForm.principal,
      rate: loanForm.rate,
      rateBasis: loanForm.rate_basis,
      method: loanForm.method,
      compounding: loanForm.compounding,
      tenureMonths: parseInt(loanForm.tenure_months, 10) || 0,
      startDate: loanForm.start_date || today(),
    }),
    [loanForm]
  );

  // ── Loan actions ──
  const openCreateLoan = () => { setLoanForm({ ...EMPTY_LOAN, start_date: today() }); setEditingLoanId(null); setLoanDialog(true); };

  const openEditLoan = (loan) => {
    setLoanForm({
      title: loan.title || '',
      direction: loan.direction,
      principal: String(loan.principal ?? ''),
      rate: String(loan.rate ?? ''),
      rate_basis: loan.rate_basis,
      method: loan.method,
      compounding: loan.compounding,
      start_date: toISODate(loan.start_date),
      tenure_months: String(loan.tenure_months ?? '12'),
      status: loan.status,
      note: loan.note || '',
    });
    setEditingLoanId(loan.id);
    setLoanDialog(true);
  };

  const submitLoan = async (e) => {
    e.preventDefault();
    if (!(parseFloat(loanForm.principal) > 0)) return toast.error('Principal must be greater than 0');
    if (!(parseInt(loanForm.tenure_months, 10) > 0)) return toast.error('Tenure must be at least 1 month');
    setSaving(true);
    try {
      const payload = {
        ...loanForm,
        principal: parseFloat(loanForm.principal),
        rate: parseFloat(loanForm.rate) || 0,
        tenure_months: parseInt(loanForm.tenure_months, 10),
        party_id: Number(id),
        site_id: siteId,
      };
      if (editingLoanId) {
        await api.put(`/interest/loans/${editingLoanId}?site_id=${siteId}`, payload);
        toast.success('Deal updated');
      } else {
        await api.post('/interest/loans', payload);
        toast.success('Deal added');
      }
      setLoanDialog(false);
      fetchParty();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save deal');
    } finally {
      setSaving(false);
    }
  };

  const deleteLoan = async (loan) => {
    const count = transactions.filter((t) => t.loan_id === loan.id).length;
    const extra = count > 0 ? `\n\nIts ${count} transaction${count === 1 ? '' : 's'} will be deleted too.` : '';
    if (!window.confirm(`Delete this deal of ₹${inr(loan.principal)}?${extra}`)) return;
    try {
      await api.delete(`/interest/loans/${loan.id}?site_id=${siteId}`);
      toast.success('Deal deleted');
      fetchParty();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not delete deal');
    }
  };

  // ── Transaction actions ──
  const openCreateTxn = (loan) => {
    setTxnLoan(loan);
    // Default to a repayment — the common case. On a BORROWED deal we pay out;
    // on a LENT deal the money comes back in.
    setTxnForm({ ...EMPTY_TXN, date: today(), direction: loan.direction === 'BORROWED' ? 'OUT' : 'IN' });
    setEditingTxnId(null);
    setTxnDialog(true);
  };

  const openEditTxn = (loan, txn) => {
    setTxnLoan(loan);
    setTxnForm({
      date: toISODate(txn.date),
      direction: txn.direction,
      amount: String(txn.amount ?? ''),
      kind: txn.kind,
      mode: txn.mode,
      reference: txn.reference || '',
      note: txn.note || '',
    });
    setEditingTxnId(txn.id);
    setTxnDialog(true);
  };

  const submitTxn = async (e) => {
    e.preventDefault();
    if (!(parseFloat(txnForm.amount) > 0)) return toast.error('Amount must be greater than 0');
    setSaving(true);
    try {
      const payload = {
        ...txnForm,
        amount: parseFloat(txnForm.amount),
        loan_id: txnLoan.id,
        site_id: siteId,
      };
      if (editingTxnId) {
        await api.put(`/interest/transactions/${editingTxnId}?site_id=${siteId}`, payload);
        toast.success('Transaction updated');
      } else {
        await api.post('/interest/transactions', payload);
        toast.success('Transaction added');
        setExpanded((p) => ({ ...p, [txnLoan.id]: true }));
      }
      setTxnDialog(false);
      fetchParty();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save transaction');
    } finally {
      setSaving(false);
    }
  };

  const deleteTxn = async (txn) => {
    if (!window.confirm(`Delete this ₹${inr(txn.amount)} transaction?`)) return;
    try {
      await api.delete(`/interest/transactions/${txn.id}?site_id=${siteId}`);
      toast.success('Transaction deleted');
      fetchParty();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not delete transaction');
    }
  };

  if (!currentSite) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Percent className="w-10 h-10 text-slate-200 mb-3" />
        <p className="text-sm text-slate-500">Select a site first</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!party) return null;

  const txnIsDisbursal = txnLoan
    ? txnForm.direction === (txnLoan.direction === 'BORROWED' ? 'IN' : 'OUT')
    : false;

  return (
    <div className="w-full max-w-full md:max-w-6xl space-y-6">
      {/* Back */}
      <button
        onClick={() => navigate('/interest')}
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-500 hover:text-slate-800 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> All Parties
      </button>

      {/* Party header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-slate-600 text-lg font-bold shrink-0">
            {(party.name || '?').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-slate-900 truncate">{party.name}</h1>
            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
              {party.phone && (
                <span className="text-[12px] text-slate-500 flex items-center gap-1">
                  <Phone className="w-3 h-3 text-slate-400" /> {party.phone}
                </span>
              )}
              {party.address && (
                <span className="text-[12px] text-slate-500 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-slate-400" /> {party.address}
                </span>
              )}
              <span className="text-[12px] text-slate-400">
                {loans.length} deal{loans.length === 1 ? '' : 's'} · {transactions.length} transaction{transactions.length === 1 ? '' : 's'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => navigate('/interest/calculator')} className="text-slate-600">
            <Calculator className="w-4 h-4 mr-1.5" /> Calculator
          </Button>
          {canWrite && (
            <Button size="sm" onClick={openCreateLoan}>
              <Plus className="w-4 h-4 mr-1.5" /> Add Deal
            </Button>
          )}
        </div>
      </div>

      {party.note && (
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 flex items-start gap-2">
          <StickyNote className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
          <p className="text-[12px] text-slate-600 leading-relaxed">{party.note}</p>
        </div>
      )}

      {/* Position summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50 via-rose-50/50 to-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">I Owe Them</p>
              <p className="text-2xl font-extrabold text-rose-700 mt-1.5 tabular-nums leading-none truncate">
                ₹{inrShort(totals.payable.payoff)}
              </p>
              <p className="text-[11px] text-slate-500 mt-1.5 truncate">
                ₹{inrShort(totals.payable.principal)} principal + ₹{inrShort(totals.payable.interest)} interest
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center shrink-0 text-rose-600">
              <ArrowDownLeft className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-emerald-50/50 to-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">They Owe Me</p>
              <p className="text-2xl font-extrabold text-emerald-700 mt-1.5 tabular-nums leading-none truncate">
                ₹{inrShort(totals.receivable.payoff)}
              </p>
              <p className="text-[11px] text-slate-500 mt-1.5 truncate">
                ₹{inrShort(totals.receivable.principal)} principal + ₹{inrShort(totals.receivable.interest)} interest
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0 text-emerald-600">
              <ArrowUpRight className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Interest Paid</p>
              <p className="text-2xl font-extrabold text-slate-800 mt-1.5 tabular-nums leading-none truncate">
                ₹{inrShort(totals.interestPaid)}
              </p>
              <p className="text-[11px] text-slate-500 mt-1.5 truncate">
                ₹{inrShort(totals.interestEarned)} earned from them
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 text-slate-600">
              <Receipt className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className={`rounded-2xl border p-4 ${
          totals.overdue > 0
            ? 'border-amber-200 bg-gradient-to-br from-amber-50 via-amber-50/50 to-white'
            : 'border-slate-200 bg-gradient-to-br from-slate-50 via-white to-white'
        }`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Net Position</p>
              <p className={`text-2xl font-extrabold mt-1.5 tabular-nums leading-none truncate ${
                totals.receivable.payoff >= totals.payable.payoff ? 'text-emerald-700' : 'text-rose-700'
              }`}>
                ₹{inrShort(Math.abs(totals.receivable.payoff - totals.payable.payoff))}
              </p>
              <p className="text-[11px] text-slate-500 mt-1.5 truncate">
                {totals.overdue > 0
                  ? `${totals.overdue} deal${totals.overdue === 1 ? '' : 's'} past maturity`
                  : totals.receivable.payoff >= totals.payable.payoff ? 'In your favour' : 'Against you'}
              </p>
            </div>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              totals.overdue > 0 ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-600'
            }`}>
              {totals.overdue > 0 ? <AlertTriangle className="w-5 h-5" /> : <Wallet className="w-5 h-5" />}
            </div>
          </div>
        </div>
      </div>

      {/* Deals */}
      {statuses.length === 0 ? (
        <Card className="shadow-none border-slate-200">
          <CardContent className="text-center py-16 px-4">
            <Percent className="w-8 h-8 text-slate-200 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No deals with {party.name} yet</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Add the amount, the rate and the period — interest is tracked from there
            </p>
            {canWrite && (
              <Button size="sm" className="mt-4" onClick={openCreateLoan}>
                <Plus className="w-4 h-4 mr-1.5" /> Add First Deal
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {statuses.map(({ loan, status }) => {
            const isOpen = !!expanded[loan.id];
            const borrowed = loan.direction === 'BORROWED';
            const tone = borrowed
              ? { text: 'text-rose-700', soft: 'bg-rose-50 text-rose-700 border-rose-200', bar: 'bg-rose-500', icon: 'bg-rose-100 text-rose-600' }
              : { text: 'text-emerald-700', soft: 'bg-emerald-50 text-emerald-700 border-emerald-200', bar: 'bg-emerald-500', icon: 'bg-emerald-100 text-emerald-600' };
            const totalDue = status.principalRepaid + status.interestPaid + status.payoff;
            const settledPct = totalDue > 0 ? Math.min(100, ((status.principalRepaid + status.interestPaid) / totalDue) * 100) : 0;
            const rows = status.ledger;

            return (
              <Card key={loan.id} className="shadow-none border-slate-200 overflow-hidden">
                <CardContent className="p-0">
                  {/* Deal header */}
                  <div className="p-4 space-y-3.5">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-start gap-3 min-w-0">
                        <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${tone.icon}`}>
                          {borrowed ? <ArrowDownLeft className="w-4.5 h-4.5" /> : <ArrowUpRight className="w-4.5 h-4.5" />}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-[15px] font-semibold text-slate-900">
                              ₹{inr(loan.principal)}
                            </p>
                            <Badge variant="outline" className={`text-[10px] ${tone.soft}`}>
                              {borrowed ? 'Money Received' : 'Money Given'}
                            </Badge>
                            {status.isSettled && (
                              <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-600 border-slate-200">
                                <CheckCircle2 className="w-2.5 h-2.5 mr-1" /> Settled
                              </Badge>
                            )}
                            {status.isOverdue && (
                              <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                                <AlertTriangle className="w-2.5 h-2.5 mr-1" /> {Math.abs(status.daysRemaining)}d overdue
                              </Badge>
                            )}
                            {loan.status === 'CLOSED' && (
                              <Badge variant="outline" className="text-[10px] bg-slate-100 text-slate-500 border-slate-200">Closed</Badge>
                            )}
                          </div>
                          <p className="text-[12px] text-slate-500 mt-1">
                            {loan.title ? `${loan.title} · ` : ''}
                            {rateLabel(loan)} · {loan.method === 'COMPOUND' ? `Compound (${loan.compounding.toLowerCase()})` : 'Simple'} · {humanTenure(loan.tenure_months)}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                            <CalendarDays className="w-3 h-3" />
                            {fmtDate(status.startDate)} → {fmtDate(status.maturityDate)}
                            {!status.isSettled && status.daysRemaining >= 0 && ` · ${status.daysRemaining} days left`}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {canWrite && (
                          <Button size="sm" variant="outline" onClick={() => openCreateTxn(loan)} className="h-8 text-[12px]">
                            <Plus className="w-3.5 h-3.5 mr-1" /> Transaction
                          </Button>
                        )}
                        {canUpdate && (
                          <Button variant="ghost" size="sm" onClick={() => openEditLoan(loan)} className="h-8 w-8 p-0 text-slate-400 hover:text-slate-700" title="Edit deal">
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button variant="ghost" size="sm" onClick={() => deleteLoan(loan)} className="h-8 w-8 p-0 text-slate-400 hover:text-red-600" title="Delete deal">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Live position */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                      <Money
                        label="Principal Left"
                        value={status.principalOutstanding}
                        hint={status.principalRepaid > 0 ? `₹${inrShort(status.principalRepaid)} repaid` : `of ₹${inrShort(status.originalPrincipal + status.extraDisbursed)}`}
                      />
                      <Money
                        label="Interest Due"
                        value={status.interestDue}
                        tone={tone.text}
                        hint={`₹${inrShort(status.interestAccrued)} accrued in ${status.daysElapsed}d`}
                      />
                      <Money
                        label={borrowed ? 'Interest Paid' : 'Interest Earned'}
                        value={status.interestPaid}
                        hint={status.interestPaid > 0 ? 'Already settled' : 'Nothing yet'}
                      />
                      <Money
                        label={borrowed ? 'Payoff Today' : 'Recoverable Today'}
                        value={status.payoff}
                        tone={status.isSettled ? 'text-slate-400' : tone.text}
                        hint={status.excess > 0 ? `₹${inrShort(status.excess)} overpaid` : 'Principal + interest due'}
                      />
                    </div>

                    {/* Progress */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">
                          ₹{inr(status.principalRepaid + status.interestPaid)} settled
                        </span>
                        <span className="text-slate-400">{settledPct.toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${tone.bar}`} style={{ width: `${settledPct}%` }} />
                      </div>
                    </div>

                    {/* If untouched to maturity — the calculator answer, in place */}
                    <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 flex items-center gap-3 flex-wrap">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Calculator className="w-3 h-3" /> At maturity, if untouched
                      </span>
                      <span className="text-[12px] text-slate-500">
                        Interest{' '}
                        <strong className={`font-bold tabular-nums ${tone.text}`}>₹{inr(status.scheduled.interest)}</strong>
                      </span>
                      <span className="text-[12px] text-slate-500">
                        Total {borrowed ? 'payable' : 'receivable'}{' '}
                        <strong className="font-bold text-slate-900 tabular-nums">₹{inr(status.scheduled.total)}</strong>
                      </span>
                      <span className="text-[11px] text-slate-400">
                        ≈ ₹{inr(status.scheduled.perMonth)}/month
                      </span>
                    </div>

                    {loan.note && (
                      <p className="text-[11px] text-slate-500 flex items-start gap-1.5">
                        <StickyNote className="w-3 h-3 text-slate-300 shrink-0 mt-0.5" /> {loan.note}
                      </p>
                    )}

                    <button
                      onClick={() => setExpanded((p) => ({ ...p, [loan.id]: !isOpen }))}
                      className="inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-500 hover:text-slate-900 transition-colors"
                    >
                      {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      {rows.length} transaction{rows.length === 1 ? '' : 's'}
                      {rows.length > 0 && !isOpen && ' — show ledger'}
                    </button>
                  </div>

                  {/* Ledger */}
                  {isOpen && (
                    rows.length === 0 ? (
                      <div className="border-t border-slate-100 px-4 py-8 text-center">
                        <p className="text-[13px] text-slate-500">No transactions on this deal yet</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Record what you {borrowed ? 'pay back' : 'get back'} in between — the balance updates itself
                        </p>
                      </div>
                    ) : (
                      <div className="border-t border-slate-100 overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="hover:bg-transparent">
                              <TableHead className="text-xs">Date</TableHead>
                              <TableHead className="text-xs">Type</TableHead>
                              <TableHead className="text-xs text-right">Amount</TableHead>
                              <TableHead className="text-xs text-right">To Interest</TableHead>
                              <TableHead className="text-xs text-right">To Principal</TableHead>
                              <TableHead className="text-xs text-right">Balance After</TableHead>
                              <TableHead className="text-xs">Mode</TableHead>
                              <TableHead className="text-xs text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {rows.map((row) => (
                              <TableRow key={row.id} className="hover:bg-slate-50/80">
                                <TableCell className="text-[13px] text-slate-600 whitespace-nowrap">
                                  {fmtDate(row.date)}
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] ${
                                      row.isDisbursal
                                        ? 'bg-slate-50 text-slate-600 border-slate-200'
                                        : 'bg-blue-50 text-blue-700 border-blue-200'
                                    }`}
                                  >
                                    {row.isDisbursal
                                      ? (borrowed ? 'Borrowed more' : 'Given more')
                                      : (borrowed ? 'Repaid' : 'Received')}
                                  </Badge>
                                  {row.note && (
                                    <p className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[22ch]">{row.note}</p>
                                  )}
                                </TableCell>
                                <TableCell className={`text-sm font-medium text-right tabular-nums ${row.isDisbursal ? 'text-slate-700' : 'text-blue-700'}`}>
                                  ₹{inr(row.amount)}
                                </TableCell>
                                <TableCell className="text-[13px] text-slate-500 text-right tabular-nums">
                                  {row.isDisbursal ? '—' : `₹${inr(row.appliedToInterest)}`}
                                </TableCell>
                                <TableCell className="text-[13px] text-slate-500 text-right tabular-nums">
                                  {row.isDisbursal ? '—' : `₹${inr(row.appliedToPrincipal)}`}
                                </TableCell>
                                <TableCell className="text-sm font-semibold text-slate-800 text-right tabular-nums">
                                  ₹{inr(row.balanceAfter)}
                                </TableCell>
                                <TableCell className="text-[12px] text-slate-500">
                                  {MODE_LABEL[row.mode] || row.mode}
                                  {row.reference && (
                                    <span className="block text-[10px] text-slate-400 truncate max-w-[14ch]">{row.reference}</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    {canUpdate && (
                                      <Button variant="ghost" size="sm" onClick={() => openEditTxn(loan, row)} className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700" title="Edit">
                                        <Edit2 className="w-3.5 h-3.5" />
                                      </Button>
                                    )}
                                    {canDelete && (
                                      <Button variant="ghost" size="sm" onClick={() => deleteTxn(row)} className="h-7 w-7 p-0 text-slate-400 hover:text-red-600" title="Delete">
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </Button>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Add / Edit Deal ── */}
      <Dialog open={loanDialog} onOpenChange={setLoanDialog}>
        <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base font-semibold text-slate-900">
              {editingLoanId ? 'Edit Deal' : 'Add Deal'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Amount, rate and period with {party.name}. The interest is worked out live below.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={submitLoan} className="space-y-4">
            {/* Direction */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'BORROWED', title: 'Money Received', sub: `I borrowed from ${party.name}`, icon: ArrowDownLeft, on: 'border-rose-300 bg-rose-50/70 ring-1 ring-rose-200', iconOn: 'bg-rose-100 text-rose-600', textOn: 'text-rose-800' },
                { value: 'LENT', title: 'Money Given', sub: `I lent to ${party.name}`, icon: ArrowUpRight, on: 'border-emerald-300 bg-emerald-50/70 ring-1 ring-emerald-200', iconOn: 'bg-emerald-100 text-emerald-600', textOn: 'text-emerald-800' },
              ].map((opt) => {
                const active = loanForm.direction === opt.value;
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setLoanForm({ ...loanForm, direction: opt.value })}
                    className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition-colors ${
                      active ? opt.on : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${active ? opt.iconOn : 'bg-slate-100 text-slate-400'}`}>
                      <Icon className="w-4 h-4" />
                    </span>
                    <span className="min-w-0">
                      <span className={`block text-[13px] font-semibold ${active ? opt.textOn : 'text-slate-700'}`}>{opt.title}</span>
                      <span className="block text-[11px] text-slate-500 leading-snug mt-0.5 truncate">{opt.sub}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[11px]">Principal Amount *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₹</span>
                  <Input
                    type="number" min="0" step="0.01" inputMode="decimal"
                    className="h-10 pl-7 text-sm font-medium tabular-nums"
                    placeholder="100000"
                    value={loanForm.principal}
                    onChange={(e) => setLoanForm({ ...loanForm, principal: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px]">Label (optional)</Label>
                <Input
                  className="h-10 text-sm"
                  placeholder="Shop renovation"
                  value={loanForm.title}
                  onChange={(e) => setLoanForm({ ...loanForm, title: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[11px]">Interest Rate *</Label>
                <div className="relative">
                  <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <Input
                    type="number" min="0" step="0.01" inputMode="decimal"
                    className="h-10 pl-8 text-sm font-medium tabular-nums"
                    placeholder="10"
                    value={loanForm.rate}
                    onChange={(e) => setLoanForm({ ...loanForm, rate: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px]">Rate Applies</Label>
                <Select value={loanForm.rate_basis} onValueChange={(v) => setLoanForm({ ...loanForm, rate_basis: v })}>
                  <SelectTrigger className="h-10 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="YEARLY">Per Year</SelectItem>
                    <SelectItem value="MONTHLY">Per Month</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px]">Period (Months) *</Label>
                <Input
                  type="number" min="1" step="1" inputMode="numeric"
                  className="h-10 text-sm font-medium tabular-nums"
                  placeholder="12"
                  value={loanForm.tenure_months}
                  onChange={(e) => setLoanForm({ ...loanForm, tenure_months: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[11px]">Start Date *</Label>
                <Input
                  type="date"
                  className="h-10 text-sm"
                  value={loanForm.start_date}
                  onChange={(e) => setLoanForm({ ...loanForm, start_date: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px]">Interest Type</Label>
                <Select value={loanForm.method} onValueChange={(v) => setLoanForm({ ...loanForm, method: v })}>
                  <SelectTrigger className="h-10 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SIMPLE">Simple</SelectItem>
                    <SelectItem value="COMPOUND">Compound</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px]">{loanForm.method === 'COMPOUND' ? 'Compounded' : 'Status'}</Label>
                {loanForm.method === 'COMPOUND' ? (
                  <Select value={loanForm.compounding} onValueChange={(v) => setLoanForm({ ...loanForm, compounding: v })}>
                    <SelectTrigger className="h-10 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="YEARLY">Yearly</SelectItem>
                      <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                      <SelectItem value="MONTHLY">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Select value={loanForm.status} onValueChange={(v) => setLoanForm({ ...loanForm, status: v })}>
                    <SelectTrigger className="h-10 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="CLOSED">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            {/* Live calculator */}
            <div className={`rounded-xl border p-3.5 ${
              loanForm.direction === 'BORROWED'
                ? 'border-rose-100 bg-gradient-to-br from-rose-50/70 to-white'
                : 'border-emerald-100 bg-gradient-to-br from-emerald-50/70 to-white'
            }`}>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Calculator className="w-3 h-3" /> If held for the full period
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2.5">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Principal</p>
                  <p className="text-[15px] font-bold text-slate-800 mt-0.5 tabular-nums">₹{inr(loanPreview.principal)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                    {loanForm.direction === 'BORROWED' ? 'Interest to Pay' : 'Interest to Earn'}
                  </p>
                  <p className={`text-[15px] font-bold mt-0.5 tabular-nums ${loanForm.direction === 'BORROWED' ? 'text-rose-700' : 'text-emerald-700'}`}>
                    ₹{inr(loanPreview.interest)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                    Total {loanForm.direction === 'BORROWED' ? 'Payable' : 'Receivable'}
                  </p>
                  <p className="text-[15px] font-extrabold text-slate-900 mt-0.5 tabular-nums">₹{inr(loanPreview.total)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Matures On</p>
                  <p className="text-[13px] font-semibold text-slate-700 mt-1">{fmtDate(loanPreview.maturityDate)}</p>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 mt-2.5">
                {loanPreview.days} days · ≈ ₹{inr(loanPreview.perMonth)} interest per month · ₹{inr(loanPreview.perDay)} per day
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px]">Note</Label>
              <Textarea
                className="text-sm min-h-16"
                placeholder="Terms agreed, witnesses, security given…"
                value={loanForm.note}
                onChange={(e) => setLoanForm({ ...loanForm, note: e.target.value })}
              />
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setLoanDialog(false)}>Cancel</Button>
              <Button type="submit" size="sm" disabled={saving}>
                {saving && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                {editingLoanId ? 'Save Changes' : 'Add Deal'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Add / Edit Transaction ── */}
      <Dialog open={txnDialog} onOpenChange={setTxnDialog}>
        <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-lg max-h-[92vh] overflow-y-auto">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base font-semibold text-slate-900">
              {editingTxnId ? 'Edit Transaction' : 'Add Transaction'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              {txnLoan && `On the ₹${inr(txnLoan.principal)} deal at ${rateLabel(txnLoan)}`}
            </DialogDescription>
          </DialogHeader>

          {txnLoan && (
            <form onSubmit={submitTxn} className="space-y-4">
              {/* Which way did the money go */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  {
                    value: txnLoan.direction === 'BORROWED' ? 'OUT' : 'IN',
                    title: txnLoan.direction === 'BORROWED' ? 'I Paid Them' : 'They Paid Me',
                    sub: 'Repayment — clears interest first',
                    icon: ArrowUpRight,
                  },
                  {
                    value: txnLoan.direction === 'BORROWED' ? 'IN' : 'OUT',
                    title: txnLoan.direction === 'BORROWED' ? 'I Took More' : 'I Gave More',
                    sub: 'Adds to the principal',
                    icon: ArrowDownLeft,
                  },
                ].map((opt) => {
                  const active = txnForm.direction === opt.value;
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setTxnForm({ ...txnForm, direction: opt.value })}
                      className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition-colors ${
                        active ? 'border-blue-300 bg-blue-50/70 ring-1 ring-blue-200' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${active ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                        <Icon className="w-4 h-4" />
                      </span>
                      <span className="min-w-0">
                        <span className={`block text-[13px] font-semibold ${active ? 'text-blue-800' : 'text-slate-700'}`}>{opt.title}</span>
                        <span className="block text-[11px] text-slate-500 leading-snug mt-0.5">{opt.sub}</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[11px]">Amount *</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₹</span>
                    <Input
                      autoFocus
                      type="number" min="0" step="0.01" inputMode="decimal"
                      className="h-10 pl-7 text-sm font-medium tabular-nums"
                      placeholder="10000"
                      value={txnForm.amount}
                      onChange={(e) => setTxnForm({ ...txnForm, amount: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px]">Date *</Label>
                  <Input
                    type="date"
                    className="h-10 text-sm"
                    value={txnForm.date}
                    onChange={(e) => setTxnForm({ ...txnForm, date: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {!txnIsDisbursal && (
                  <div className="space-y-1.5">
                    <Label className="text-[11px]">Apply To</Label>
                    <Select value={txnForm.kind} onValueChange={(v) => setTxnForm({ ...txnForm, kind: v })}>
                      <SelectTrigger className="h-10 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AUTO">Interest first, then principal</SelectItem>
                        <SelectItem value="INTEREST">Interest only</SelectItem>
                        <SelectItem value="PRINCIPAL">Principal only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label className="text-[11px]">Payment Mode</Label>
                  <Select value={txnForm.mode} onValueChange={(v) => setTxnForm({ ...txnForm, mode: v })}>
                    <SelectTrigger className="h-10 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(MODE_LABEL).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px]">Reference</Label>
                <Input
                  className="h-10 text-sm"
                  placeholder="Cheque no. / UTR / receipt no."
                  value={txnForm.reference}
                  onChange={(e) => setTxnForm({ ...txnForm, reference: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px]">Note</Label>
                <Textarea
                  className="text-sm min-h-16"
                  placeholder="Anything worth remembering about this payment"
                  value={txnForm.note}
                  onChange={(e) => setTxnForm({ ...txnForm, note: e.target.value })}
                />
              </div>

              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setTxnDialog(false)}>Cancel</Button>
                <Button type="submit" size="sm" disabled={saving}>
                  {saving && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                  {editingTxnId ? 'Save Changes' : 'Add Transaction'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InterestPartyDetail;
