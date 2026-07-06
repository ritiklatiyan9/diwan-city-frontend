import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import * as XLSX from 'xlsx';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Separator } from '../components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../components/ui/collapsible';
import {
  Plus, Edit2, Trash2, AlertCircle, Check, Search, Loader2,
  IndianRupee, ArrowLeft, ChevronDown, Building2,
  Calendar, TrendingDown, ArrowUpRight, ArrowDownRight,
  CreditCard, Banknote, Hash, FileText, User, Briefcase, Tag,
  Filter, X, Download, Printer, Wallet, Landmark, TrendingUp, BarChart3, ArrowUpDown,
} from 'lucide-react';
import VoucherUpload, { VoucherThumbnail } from '../components/VoucherUpload';
import ApprovalStatusBadge from '../components/ApprovalStatusBadge';
import ChequeStatusControl from '../components/ChequeStatusControl';

const todayISO = () => new Date().toISOString().split('T')[0];

const MONTH_NAMES = ['', 'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

const REMARK_OPTIONS = [
  'PLOT ADVANCE', 'SALARY', 'EXPENCE', 'PERSONAL', 'FIRM',
  'REGISTRY', 'COMMISSION', 'LOAN', 'REFUND', 'MISCELLANEOUS',
];

const REMARK_COLORS = {
  'PLOT ADVANCE': 'bg-blue-50 text-blue-700 border-blue-200',
  'SALARY': 'bg-amber-50 text-amber-700 border-amber-200',
  'EXPENCE': 'bg-red-50 text-red-700 border-red-200',
  'PERSONAL': 'bg-purple-50 text-purple-700 border-purple-200',
  'FIRM': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'REGISTRY': 'bg-teal-50 text-teal-700 border-teal-200',
  'COMMISSION': 'bg-orange-50 text-orange-700 border-orange-200',
  'LOAN': 'bg-pink-50 text-pink-700 border-pink-200',
  'REFUND': 'bg-cyan-50 text-cyan-700 border-cyan-200',
  'MISCELLANEOUS': 'bg-slate-50 text-slate-600 border-slate-200',
};

const FirmTransactions = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentSite, isAdmin, canManage, hasPermission } = useAuth();
  const canWrite  = canManage && hasPermission('firm_transactions', 'write');
  const canUpdate = canManage && hasPermission('firm_transactions', 'update');
  const canDelete = canManage && hasPermission('firm_transactions', 'delete');
  const siteId = currentSite?.id;
  const queryFromUrl = useMemo(() => new URLSearchParams(location.search).get('q') || '', [location.search]);

  // ── State ──
  const [firms, setFirms] = useState([]);
  const [selectedFirm, setSelectedFirm] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [firmMeta, setFirmMeta] = useState(null);
  const [remarkBreakdown, setRemarkBreakdown] = useState([]);
  const [nameBreakdown, setNameBreakdown] = useState([]);
  const [autocomplete, setAutocomplete] = useState({ names: [], purposes: [], remarks: [] });
  const [approvers, setApprovers] = useState([]);
  const [loadingFirms, setLoadingFirms] = useState(true);
  const [loadingTxns, setLoadingTxns] = useState(false);

  const [firmDialogOpen, setFirmDialogOpen] = useState(false);
  const [txnDialogOpen, setTxnDialogOpen] = useState(false);
  const [editingFirm, setEditingFirm] = useState(null);
  const [editingTxnId, setEditingTxnId] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [submitting, setSubmitting] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterRemark, setFilterRemark] = useState('all');
  const [filterName, setFilterName] = useState('all');
  const [filterPeriod, setFilterPeriod] = useState('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [breakdownTab, setBreakdownTab] = useState('remark');
  const [sortOrder, setSortOrder] = useState('asc');
  const [cashflowLedgers, setCashflowLedgers] = useState([]);
  const [loadingCfLedgers, setLoadingCfLedgers] = useState(false);

  // Firm form
  const [firmForm, setFirmForm] = useState({
    name: '', account_number: '', bank_name: '', ifsc_code: '', opening_balance: '', notes: '',
  });

  // Transaction form
  const [txnForm, setTxnForm] = useState({
    date: todayISO(),
    payment_mode: 'cash',
    description: '', debit: '', credit: '',
    name: '', purpose: '', remark: '', cheque_no: '', transaction_no: '',
    link_cashflow: false, cf_key: '', ledger_name: '', ledger_type: 'site',
    voucher_url: '',
    assigned_admin_id: null,
  });

  // ── Fetch firms ──
  const fetchFirms = useCallback(async () => {
    if (!siteId) return;
    try {
      setLoadingFirms(true);
      // Watchdog so the spinner can never hang on a stalled request.
      const watchdog = setTimeout(() => setLoadingFirms(false), 15000);
      const res = await api.get(`/firms?site_id=${siteId}`);
      clearTimeout(watchdog);
      setFirms(res.data.firms || []);
    } catch (err) {
      console.error('Failed to fetch firms:', err);
    } finally {
      setLoadingFirms(false);
    }
  }, [siteId]);

  // Background refresh — does NOT toggle the page loader.
  const refreshFirms = useCallback(async () => {
    if (!siteId) return;
    try {
      const res = await api.get(`/firms?site_id=${siteId}`);
      setFirms(res.data.firms || []);
    } catch { /* keep current */ }
  }, [siteId]);

  // ── Fetch transactions for selected firm ──
  const fetchTransactions = useCallback(async () => {
    if (!selectedFirm) return;
    try {
      setLoadingTxns(true);
      const watchdog = setTimeout(() => setLoadingTxns(false), 15000);
      // All 3 reads in PARALLEL (was 2 parallel + 1 nested serial).
      const [txnRes, acRes, cfRes] = await Promise.all([
        api.get(`/firms/transactions/list?firm_id=${selectedFirm.id}`),
        api.get(`/firms/autocomplete?site_id=${siteId}`),
        api.get(`/firms/cashflow-ledgers?site_id=${siteId}`).catch(() => ({ data: { ledgers: [] } })),
      ]);
      clearTimeout(watchdog);
      setCashflowLedgers(cfRes.data.ledgers || []);
      setTransactions(txnRes.data.transactions || []);
      setFirmMeta(txnRes.data.firm || null);
      setRemarkBreakdown(txnRes.data.remarkBreakdown || []);
      setNameBreakdown(txnRes.data.nameBreakdown || []);
      setAutocomplete(acRes.data || { names: [], purposes: [], remarks: [] });
    } catch (err) {
      console.error('Failed to fetch transactions:', err);
    } finally {
      setLoadingTxns(false);
    }
  }, [selectedFirm, siteId]);

  // Background refresh — no loader toggle.
  const refreshTransactions = useCallback(async () => {
    if (!selectedFirm) return;
    try {
      const txnRes = await api.get(`/firms/transactions/list?firm_id=${selectedFirm.id}`);
      setTransactions(txnRes.data.transactions || []);
      setFirmMeta(txnRes.data.firm || null);
      setRemarkBreakdown(txnRes.data.remarkBreakdown || []);
      setNameBreakdown(txnRes.data.nameBreakdown || []);
    } catch { /* keep current */ }
  }, [selectedFirm]);

  useEffect(() => {
    setFirms([]);
    setSelectedFirm(null);
    setTransactions([]);
    setSearchQuery(queryFromUrl);
    setFilterRemark('all');
    setFilterName('all');
    setFilterPeriod('all');
    setFilterDateFrom('');
    setFilterDateTo('');
    fetchFirms();
  }, [fetchFirms, queryFromUrl]);

  useEffect(() => {
    if (!siteId) return;
    api.get(`/admin/approvers?site_id=${siteId}`)
      .then((res) => setApprovers(res.data.approvers || []))
      .catch(() => setApprovers([]));
  }, [siteId]);

  const getAssignedAdminLabel = (entry) => {
    if (entry?.assigned_admin_name) return entry.assigned_admin_name;
    const assignedId = entry?.assigned_admin_id;
    if (!assignedId) return null;
    const approver = approvers.find((a) => String(a.id) === String(assignedId));
    return approver?.full_name || approver?.name || approver?.email || `Admin #${assignedId}`;
  };

  useEffect(() => {
    if (selectedFirm) fetchTransactions();
  }, [fetchTransactions, selectedFirm]);

  // ── Firm form handlers ──
  const resetFirmForm = () => {
    setFirmForm({ name: '', account_number: '', bank_name: '', ifsc_code: '', opening_balance: '', notes: '' });
    setEditingFirm(null);
    setMessage({ type: '', text: '' });
  };

  const handleOpenCreateFirm = () => { resetFirmForm(); setFirmDialogOpen(true); };

  const handleOpenEditFirm = (f) => {
    setFirmForm({
      name: f.name || '',
      account_number: f.account_number || '',
      bank_name: f.bank_name || '',
      ifsc_code: f.ifsc_code || '',
      opening_balance: f.opening_balance ? String(f.opening_balance) : '',
      notes: f.notes || '',
    });
    setEditingFirm(f);
    setFirmDialogOpen(true);
  };

  const handleSubmitFirm = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    const snapshotFirms = firms;
    const targetEditing = editingFirm;
    const isCreate = !targetEditing;

    // Optimistic UI: splice the new/edited firm BEFORE the network call so
    // dialog can close instantly. Snapshot is restored on failure.
    if (isCreate) {
      const tempId = -Date.now();
      setFirms((prev) => [
        {
          id: tempId,
          site_id: siteId,
          name: (firmForm.name || '').toUpperCase(),
          account_number: firmForm.account_number || null,
          bank_name: (firmForm.bank_name || '').toUpperCase() || null,
          ifsc_code: (firmForm.ifsc_code || '').toUpperCase() || null,
          opening_balance: parseFloat(firmForm.opening_balance) || 0,
          notes: firmForm.notes || null,
          total_debit: 0, total_credit: 0, txn_count: 0,
        },
        ...prev,
      ]);
    } else {
      setFirms((prev) => prev.map((f) =>
        f.id === targetEditing.id ? { ...f, ...firmForm, name: (firmForm.name || f.name).toUpperCase() } : f
      ));
      if (selectedFirm?.id === targetEditing.id) {
        setSelectedFirm({ ...selectedFirm, ...firmForm });
      }
    }
    setFirmDialogOpen(false);

    setSubmitting(true);
    try {
      if (targetEditing) {
        await api.put(`/firms/${targetEditing.id}`, firmForm);
        setMessage({ type: 'success', text: 'Firm updated' });
      } else {
        await api.post('/firms', { site_id: siteId, ...firmForm });
        setMessage({ type: 'success', text: 'Firm created' });
      }
      // Reconcile in background — pulls server-computed totals + canonical id.
      refreshFirms();
    } catch (err) {
      setFirms(snapshotFirms); // rollback
      setMessage({ type: 'error', text: err.response?.data?.message || 'Operation failed' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteFirm = async (f) => {
    if (!window.confirm(`Delete "${f.name}"? All transactions will be permanently lost.`)) return;
    // Optimistic removal — instant UI feedback.
    const snapshotFirms = firms;
    setFirms((prev) => prev.filter((x) => x.id !== f.id));
    if (selectedFirm?.id === f.id) { setSelectedFirm(null); setTransactions([]); }
    try {
      await api.delete(`/firms/${f.id}`);
      refreshFirms();
    } catch (err) {
      setFirms(snapshotFirms); // rollback
      console.error('Failed to delete firm:', err);
    }
  };

  // ── Transaction form handlers ──
  const resetTxnForm = () => {
    setTxnForm({
      date: todayISO(),
      payment_mode: 'cash',
      description: '', debit: '', credit: '',
      name: '', purpose: '', remark: '', cheque_no: '', transaction_no: '',
      link_cashflow: false, cf_key: '', ledger_name: '', ledger_type: 'site',
      voucher_url: '',
      assigned_admin_id: null,
    });
    setEditingTxnId(null);
    setMessage({ type: '', text: '' });
  };

  const handleOpenCreateTxn = () => { resetTxnForm(); setTxnDialogOpen(true); };

  const handleOpenEditTxn = (t) => {
    // Find matching CF ledger if this txn is linked
    let cfKey = '';
    if (t.cash_flow_entry_id && t.cf_month && t.cf_year) {
      const match = cashflowLedgers.find(l =>
        (l.ledger_name || '') === (t.cf_ledger_name || '') && l.month == t.cf_month && l.year == t.cf_year
      );
      if (match) cfKey = `${match.id}`;
    }
    setTxnForm({
      date: t.date ? t.date.split('T')[0] : '',
      payment_mode: (t.payment_mode || 'cash').toLowerCase(),
      description: t.description || '',
      debit: t.debit && parseFloat(t.debit) !== 0 ? String(t.debit) : '',
      credit: t.credit && parseFloat(t.credit) !== 0 ? String(t.credit) : '',
      name: t.name || '',
      purpose: t.purpose || '',
      remark: t.remark || '',
      cheque_no: t.cheque_no || '',
      transaction_no: t.transaction_no || '',
      link_cashflow: !!t.cash_flow_entry_id,
      cf_key: cfKey,
      ledger_name: t.cf_ledger_name || '',
      ledger_type: t.cf_ledger_type || 'site',
      voucher_url: t.voucher_url || '',
      assigned_admin_id: t.assigned_admin_id || null,
    });
    setEditingTxnId(t.id);
    setTxnDialogOpen(true);
  };

  const handleSubmitTxn = async (ev) => {
    ev.preventDefault();
    setMessage({ type: '', text: '' });

    const payload = {
      firm_id: selectedFirm.id,
      date: txnForm.date || todayISO(),
      payment_mode: txnForm.payment_mode || 'cash',
      description: txnForm.description,
      debit: parseFloat(txnForm.debit) || 0,
      credit: parseFloat(txnForm.credit) || 0,
      name: txnForm.name,
      purpose: txnForm.purpose,
      remark: txnForm.remark,
      cheque_no: txnForm.cheque_no,
      transaction_no: txnForm.transaction_no,
      voucher_url: txnForm.voucher_url || null,
      assigned_admin_id: txnForm.assigned_admin_id,
      ...(txnForm.link_cashflow && {
        ledger_name: txnForm.ledger_name,
        ledger_type: txnForm.ledger_type,
        ...(txnForm.cf_key && { cash_flow_month_id: parseInt(txnForm.cf_key) }),
      }),
    };

    // ── Optimistic UI: splice the txn BEFORE the network call. ──
    const snapshotTxns = transactions;
    const snapshotFirms = firms;
    const targetEditing = editingTxnId;
    const isCreate = !targetEditing;

    if (isCreate) {
      const tempId = -Date.now();
      setTransactions((prev) => [
        ...prev,
        {
          id: tempId,
          firm_id: selectedFirm.id,
          ...payload,
          status: 'pending',
          cheque_status: payload.payment_mode === 'cheque' ? 'PENDING' : null,
          created_at: new Date().toISOString(),
        },
      ]);
    } else {
      setTransactions((prev) => prev.map((t) => (t.id === targetEditing ? { ...t, ...payload } : t)));
    }

    // Adjust firm card totals locally (debit/credit/txn_count delta).
    const newDebit = parseFloat(payload.debit) || 0;
    const newCredit = parseFloat(payload.credit) || 0;
    let oldDebit = 0, oldCredit = 0;
    if (!isCreate) {
      const prevTxn = snapshotTxns.find((t) => t.id === targetEditing);
      oldDebit = parseFloat(prevTxn?.debit) || 0;
      oldCredit = parseFloat(prevTxn?.credit) || 0;
    }
    setFirms((prev) => prev.map((f) =>
      f.id === selectedFirm.id
        ? {
            ...f,
            total_debit: (parseFloat(f.total_debit) || 0) + (newDebit - oldDebit),
            total_credit: (parseFloat(f.total_credit) || 0) + (newCredit - oldCredit),
            txn_count: (parseInt(f.txn_count) || 0) + (isCreate ? 1 : 0),
          }
        : f
    ));

    setTxnDialogOpen(false);

    setSubmitting(true);
    try {
      if (targetEditing) {
        await api.put(`/firms/transactions/${targetEditing}`, payload);
        setMessage({ type: 'success', text: 'Transaction updated' });
      } else {
        await api.post('/firms/transactions', payload);
        setMessage({ type: 'success', text: 'Transaction added' });
      }
      refreshTransactions();
      refreshFirms();
    } catch (err) {
      setTransactions(snapshotTxns);
      setFirms(snapshotFirms);
      setMessage({ type: 'error', text: err.response?.data?.message || 'Operation failed' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTxn = async (id) => {
    if (!window.confirm('Delete this transaction?')) return;
    // Optimistic removal — instant UI feedback. Roll back on failure.
    const snapshotTxns = transactions;
    const snapshotFirms = firms;
    const removed = transactions.find((t) => t.id === id);
    setTransactions((prev) => prev.filter((t) => t.id !== id));
    if (removed && selectedFirm) {
      const dDebit = parseFloat(removed.debit) || 0;
      const dCredit = parseFloat(removed.credit) || 0;
      setFirms((prev) => prev.map((f) =>
        f.id === selectedFirm.id
          ? {
              ...f,
              total_debit: (parseFloat(f.total_debit) || 0) - dDebit,
              total_credit: (parseFloat(f.total_credit) || 0) - dCredit,
              txn_count: Math.max(0, (parseInt(f.txn_count) || 0) - 1),
            }
          : f
      ));
    }
    try {
      await api.delete(`/firms/transactions/${id}`);
      refreshTransactions();
      refreshFirms();
    } catch (err) {
      setTransactions(snapshotTxns);
      setFirms(snapshotFirms);
      console.error('Failed to delete transaction:', err);
    }
  };

  // ── Period helper ──
  const getDateRange = (period) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const toISO = (d) => d.toISOString().split('T')[0];
    switch (period) {
      case 'today': return { from: toISO(today), to: toISO(today) };
      case 'week': {
        const day = today.getDay();
        const mon = new Date(today);
        mon.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
        return { from: toISO(mon), to: toISO(today) };
      }
      case 'month': {
        const first = new Date(today.getFullYear(), today.getMonth(), 1);
        return { from: toISO(first), to: toISO(today) };
      }
      case 'last_month': {
        const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const last = new Date(today.getFullYear(), today.getMonth(), 0);
        return { from: toISO(first), to: toISO(last) };
      }
      default: return { from: '', to: '' };
    }
  };

  const handlePeriodChange = (period) => {
    setFilterPeriod(period);
    if (period === 'all' || period === 'custom') {
      if (period === 'all') { setFilterDateFrom(''); setFilterDateTo(''); }
    } else {
      const { from, to } = getDateRange(period);
      setFilterDateFrom(from);
      setFilterDateTo(to);
    }
  };

  // ── Unique names from transactions ──
  const uniqueNames = useMemo(() => {
    const names = [...new Set(transactions.map(t => t.name).filter(Boolean))];
    return names.sort();
  }, [transactions]);

  // ── Filtering transactions ──
  const filteredTxns = useMemo(() => {
    let list = transactions;
    // Remark filter
    if (filterRemark !== 'all') {
      list = list.filter(t => (t.remark || 'UNCATEGORIZED') === filterRemark);
    }
    // Name/entity filter
    if (filterName !== 'all') {
      list = list.filter(t => (t.name || '') === filterName);
    }
    // Date range filter
    if (filterDateFrom) {
      list = list.filter(t => t.date && t.date.split('T')[0] >= filterDateFrom);
    }
    if (filterDateTo) {
      list = list.filter(t => t.date && t.date.split('T')[0] <= filterDateTo);
    }
    // Text search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(t =>
        t.description?.toLowerCase().includes(q) ||
        t.name?.toLowerCase().includes(q) ||
        t.purpose?.toLowerCase().includes(q) ||
        t.remark?.toLowerCase().includes(q) ||
        t.cheque_no?.toLowerCase().includes(q) ||
        t.transaction_no?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [transactions, searchQuery, filterRemark, filterName, filterDateFrom, filterDateTo]);

    // Running balance
  const openingBal = parseFloat(firmMeta?.opening_balance) || 0;
  const txnsWithBalance = useMemo(() => {
    let balance = openingBal;
    return filteredTxns.map((t) => {
      balance = balance + (parseFloat(t.credit) || 0) - (parseFloat(t.debit) || 0);
      return { ...t, balance };
    });
  }, [filteredTxns, openingBal]);

  const displayTxns = useMemo(() => {
    if (sortOrder === 'desc') return [...txnsWithBalance].reverse();
    return txnsWithBalance;
  }, [txnsWithBalance, sortOrder]);

  const totalDebit = useMemo(() => transactions.reduce((s, t) => s + (parseFloat(t.debit) || 0), 0), [transactions]);
  const totalCredit = useMemo(() => transactions.reduce((s, t) => s + (parseFloat(t.credit) || 0), 0), [transactions]);
  const closingBal = openingBal + totalCredit - totalDebit;

  const filteredDebit = useMemo(() => filteredTxns.reduce((s, t) => s + (parseFloat(t.debit) || 0), 0), [filteredTxns]);
  const filteredCredit = useMemo(() => filteredTxns.reduce((s, t) => s + (parseFloat(t.credit) || 0), 0), [filteredTxns]);

  const calcModeTotals = (list) => list.reduce((acc, t) => {
    const mode = (t.payment_mode || 'cash').toLowerCase();
    const d = parseFloat(t.debit) || 0;
    const c = parseFloat(t.credit) || 0;
    if (mode === 'cash') {
      acc.cashOut += d;
      acc.cashIn += c;
    } else {
      acc.bankOut += d;
      acc.bankIn += c;
    }
    return acc;
  }, { cashIn: 0, cashOut: 0, bankIn: 0, bankOut: 0 });

  const modeTotals = useMemo(() => calcModeTotals(transactions), [transactions]);
  const filteredModeTotals = useMemo(() => calcModeTotals(filteredTxns), [filteredTxns]);

  const hasActiveFilters = filterRemark !== 'all' || filterName !== 'all' || filterDateFrom || filterDateTo || searchQuery;

  const clearAllFilters = () => {
    setSearchQuery('');
    setFilterRemark('all');
    setFilterName('all');
    setFilterPeriod('all');
    setFilterDateFrom('');
    setFilterDateTo('');
    setSortOrder('asc');
  };

  // ── Download Excel ──
  const downloadExcel = () => {
    const wb = XLSX.utils.book_new();

    // Header rows
    const headerRows = [
      [selectedFirm.name],
      [
        selectedFirm.bank_name ? `Bank: ${selectedFirm.bank_name}` : '',
        selectedFirm.account_number ? `A/C: ${selectedFirm.account_number}` : '',
        selectedFirm.ifsc_code ? `IFSC: ${selectedFirm.ifsc_code}` : '',
      ].filter(Boolean),
      hasActiveFilters
        ? [`Filtered: ${filteredTxns.length} of ${transactions.length} transactions`]
        : [`Total: ${transactions.length} transactions`],
      [],
    ];

    // Column headers
    const colHeaders = ['No', 'Date', 'Description', 'Cheque No', 'Transaction No', 'Debit (₹)', 'Credit (₹)', 'Balance (₹)', 'Name', 'Purpose', 'Remark'];
    headerRows.push(colHeaders);

    // Opening balance row
    headerRows.push(['', '', 'OPENING BALANCE', '', '', '', '', parseFloat(firmMeta?.opening_balance) || 0, '', '', '']);

    // Transaction rows
    const txnRows = txnsWithBalance.map((t, i) => [
      i + 1,
      t.date ? new Date(t.date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '',
      t.description || '',
      t.cheque_no || '',
      t.transaction_no || '',
      parseFloat(t.debit) || '',
      parseFloat(t.credit) || '',
      t.balance,
      t.name || '',
      t.purpose || '',
      t.remark || '',
    ]);

    // Totals row
    const totalsRow = ['', '', `TOTAL (${txnsWithBalance.length} transactions)`, '', '', filteredDebit || totalDebit, filteredCredit || totalCredit, txnsWithBalance.length > 0 ? txnsWithBalance[txnsWithBalance.length - 1].balance : openingBal, '', '', ''];

    const allRows = [...headerRows, ...txnRows, totalsRow];
    const ws = XLSX.utils.aoa_to_sheet(allRows);

    // Column widths
    ws['!cols'] = [
      { wch: 6 },   // No
      { wch: 14 },  // Date
      { wch: 40 },  // Description
      { wch: 16 },  // Cheque No
      { wch: 18 },  // Transaction No
      { wch: 18 },  // Debit
      { wch: 18 },  // Credit
      { wch: 18 },  // Balance
      { wch: 22 },  // Name
      { wch: 28 },  // Purpose
      { wch: 18 },  // Remark
    ];

    // Merge firm name across full width
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 10 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 10 } },
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Transactions');

    const filename = `${selectedFirm.name.replace(/[^a-zA-Z0-9]/g, '_')}_Transactions_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  // ── Print Receipt ──
  const printReceipt = (txn) => {
    const bal = txn.balance;
    const isDebit = parseFloat(txn.debit) > 0;
    const amount = isDebit ? parseFloat(txn.debit) : parseFloat(txn.credit);
    const type = isDebit ? 'DEBIT' : 'CREDIT';
    const typeColor = isDebit ? '#dc2626' : '#059669';

    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Receipt - ${selectedFirm.name}</title>
  <style>
    @page { size: A5; margin: 12mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; background: #fff; padding: 24px; }
    .receipt { max-width: 520px; margin: 0 auto; border: 2px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #0f172a, #1e293b); color: #fff; padding: 20px 24px; text-align: center; }
    .header h1 { font-size: 18px; font-weight: 700; letter-spacing: 1px; }
    .header p { font-size: 11px; color: #94a3b8; margin-top: 4px; }
    .type-badge { display: inline-block; padding: 4px 16px; border-radius: 20px; font-size: 12px; font-weight: 700; letter-spacing: 1px; margin-top: 10px; background: ${typeColor}; color: #fff; }
    .body { padding: 20px 24px; }
    .amount-box { text-align: center; padding: 16px; margin: 0 0 16px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; }
    .amount-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: #64748b; }
    .amount-value { font-size: 28px; font-weight: 800; color: ${typeColor}; margin-top: 4px; font-variant-numeric: tabular-nums; }
    .details { border-top: 1px solid #e2e8f0; }
    .row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f1f5f9; }
    .row:last-child { border-bottom: none; }
    .row-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; font-weight: 600; }
    .row-value { font-size: 13px; font-weight: 600; color: #1e293b; text-align: right; max-width: 60%; }
    .footer { padding: 12px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; }
    .footer p { font-size: 10px; color: #94a3b8; }
    @media print {
      body { padding: 0; }
      .receipt { border: none; }
      .no-print { display: none ; }
    }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <h1>${selectedFirm.name}</h1>
      <p>${[selectedFirm.bank_name, selectedFirm.account_number ? 'A/C: ' + selectedFirm.account_number : ''].filter(Boolean).join(' | ') || currentSite?.name || ''}</p>
      <div class="type-badge">${type} VOUCHER</div>
    </div>
    <div class="body">
      <div class="amount-box">
        <div class="amount-label">${type} Amount</div>
        <div class="amount-value">₹ ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
      </div>
      <div class="details">
        <div class="row">
          <span class="row-label">Date</span>
          <span class="row-value">${txn.date ? new Date(txn.date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}</span>
        </div>
        ${txn.description ? `<div class="row"><span class="row-label">Description</span><span class="row-value">${txn.description}</span></div>` : ''}
        ${txn.cheque_no ? `<div class="row"><span class="row-label">Cheque No</span><span class="row-value">${txn.cheque_no}</span></div>` : ''}
        ${txn.transaction_no ? `<div class="row"><span class="row-label">Transaction No</span><span class="row-value">${txn.transaction_no}</span></div>` : ''}
        ${txn.name ? `<div class="row"><span class="row-label">Name / Party</span><span class="row-value">${txn.name}</span></div>` : ''}
        ${txn.purpose ? `<div class="row"><span class="row-label">Purpose</span><span class="row-value">${txn.purpose}</span></div>` : ''}
        ${txn.remark ? `<div class="row"><span class="row-label">Remark</span><span class="row-value">${txn.remark}</span></div>` : ''}
        <div class="row">
          <span class="row-label">Balance After</span>
          <span class="row-value" style="color: ${bal >= 0 ? '#059669' : '#dc2626'}; font-weight: 700;">₹ ${bal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
      </div>
    </div>
    <div class="footer">
      <p>Generated on ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} &bull; ${currentSite?.name || ''}</p>
    </div>
  </div>
  <div class="no-print" style="text-align:center; margin-top:20px;">
    <button onclick="window.print()" style="padding:10px 32px; font-size:14px; font-weight:600; background:#0f172a; color:#fff; border:none; border-radius:8px; cursor:pointer;">🖨️ Print Receipt</button>
    <button onclick="window.close()" style="padding:10px 32px; font-size:14px; font-weight:600; background:#e2e8f0; color:#475569; border:none; border-radius:8px; cursor:pointer; margin-left:8px;">Close</button>
  </div>
</body>
</html>`;

    const printWindow = window.open('', '_blank', 'width=600,height=700');
    printWindow.document.write(html);
    printWindow.document.close();
  };

  // ── Helpers ──
  const fmt = (val) => {
    const num = parseFloat(val) || 0;
    return num.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  };
  const fmtDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const getRemarkBadge = (remark) => {
    if (!remark) return null;
    const cls = REMARK_COLORS[remark] || 'bg-slate-50 text-slate-600 border-slate-200';
    return (
      <Badge variant="outline" className={`text-[10px] font-medium ${cls}`}>
        {remark}
      </Badge>
    );
  };

  if (!currentSite) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Building2 className="w-10 h-10 text-slate-200 mb-3" />
        <p className="text-sm text-slate-500">Select a site to view firm transactions</p>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════
  //  TRANSACTION DETAIL VIEW (Bank Statement)
  // ═══════════════════════════════════════════════════
  if (selectedFirm) {
    return (
      <div className="w-full max-w-full md:max-w-350 space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => { setSelectedFirm(null); setTransactions([]); clearAllFilters(); }} className="h-8 w-8 p-0">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">{selectedFirm.name}</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                {selectedFirm.bank_name && (
                  <span className="font-medium text-slate-600">{selectedFirm.bank_name}</span>
                )}
                {selectedFirm.account_number && (
                  <span className="text-slate-400"> &middot; A/C: {selectedFirm.account_number}</span>
                )}
                {!selectedFirm.bank_name && !selectedFirm.account_number && (
                  <span>Firm transactions for <span className="font-medium text-slate-700">{currentSite.name}</span></span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={downloadExcel} className="text-xs">
              <Download className="w-3.5 h-3.5 mr-1" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/firm-transactions/history')} className="text-xs">
              <TrendingDown className="w-3.5 h-3.5 mr-1" /> History & Analytics
            </Button>
            {canWrite && (
              <>
               
                <Button size="sm" onClick={handleOpenCreateTxn}>
                  <Plus className="w-4 h-4 mr-1.5" /> Add Transaction
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5">
          <div className="rounded-xl border border-blue-200/70 bg-linear-to-r from-blue-50 to-white px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wider text-blue-500/80 font-semibold flex items-center gap-1">
              <Banknote className="w-3 h-3" /> Opening Balance
            </p>
            <p className="text-lg font-bold text-blue-700 mt-1 tabular-nums">₹{fmt(openingBal)}</p>
          </div>
          <div className="rounded-xl border border-emerald-200/70 bg-linear-to-r from-emerald-50 to-white px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wider text-emerald-500/80 font-semibold flex items-center gap-1">
              <ArrowDownRight className="w-3 h-3" /> Total Credit (In)
            </p>
            <p className="text-lg font-bold text-emerald-700 mt-1 tabular-nums">₹{fmt(totalCredit)}</p>
          </div>
          <div className="rounded-xl border border-red-200/70 bg-linear-to-r from-red-50 to-white px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wider text-red-500/80 font-semibold flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3" /> Total Debit (Out)
            </p>
            <p className="text-lg font-bold text-red-600 mt-1 tabular-nums">₹{fmt(totalDebit)}</p>
          </div>
          <div className={`rounded-xl border-2 px-3 py-2.5 ${
            closingBal >= 0 ? 'border-emerald-300 bg-emerald-50/40' : 'border-red-300 bg-red-50/40'
          }`}>
            <p className={`text-[10px] uppercase tracking-wider font-semibold flex items-center gap-1 ${
              closingBal >= 0 ? 'text-emerald-600' : 'text-red-500'
            }`}>
              <IndianRupee className="w-3 h-3" /> Available Balance
            </p>
            <p className={`text-lg font-bold mt-1 tabular-nums ${closingBal >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
              {closingBal < 0 && '−'}₹{fmt(Math.abs(closingBal))}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-linear-to-r from-slate-50 to-white px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wider text-slate-500/80 font-semibold flex items-center gap-1">
              <BarChart3 className="w-3 h-3" /> Transactions
            </p>
            <p className="text-lg font-bold text-slate-900 mt-1">{transactions.length}</p>
          </div>
        </div>

        {/* Cash & Bank Analytics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Card className={`shadow-none rounded-xl overflow-hidden border-2 ${
            modeTotals.cashIn - modeTotals.cashOut >= 0 ? 'border-amber-200 bg-amber-50/20' : 'border-red-200 bg-red-50/20'
          }`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                    <Wallet className="w-4 h-4 text-orange-500" /> Cash Summary
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Net cash position</p>
                </div>
                {modeTotals.cashIn - modeTotals.cashOut >= 0
                  ? <TrendingUp className="w-5 h-5 text-emerald-500" />
                  : <TrendingDown className="w-5 h-5 text-red-500" />}
              </div>
              <p className={`text-2xl font-bold mt-2 tabular-nums ${
                modeTotals.cashIn - modeTotals.cashOut >= 0 ? 'text-emerald-700' : 'text-red-600'
              }`}>
                {modeTotals.cashIn - modeTotals.cashOut < 0 && '−'}₹{fmt(Math.abs(modeTotals.cashIn - modeTotals.cashOut))}
              </p>
              <div className="flex gap-4 mt-3 pt-3 border-t border-slate-200/60">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase">Cash In</p>
                  <p className="text-sm font-semibold text-emerald-600 tabular-nums">₹{fmt(modeTotals.cashIn)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase">Cash Out</p>
                  <p className="text-sm font-semibold text-red-600 tabular-nums">₹{fmt(modeTotals.cashOut)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={`shadow-none rounded-xl overflow-hidden border-2 ${
            modeTotals.bankIn - modeTotals.bankOut >= 0 ? 'border-blue-200 bg-blue-50/20' : 'border-red-200 bg-red-50/20'
          }`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                    <Landmark className="w-4 h-4 text-blue-500" /> Bank Summary
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Net bank position</p>
                </div>
                {modeTotals.bankIn - modeTotals.bankOut >= 0
                  ? <TrendingUp className="w-5 h-5 text-emerald-500" />
                  : <TrendingDown className="w-5 h-5 text-red-500" />}
              </div>
              <p className={`text-2xl font-bold mt-2 tabular-nums ${
                modeTotals.bankIn - modeTotals.bankOut >= 0 ? 'text-emerald-700' : 'text-red-600'
              }`}>
                {modeTotals.bankIn - modeTotals.bankOut < 0 && '−'}₹{fmt(Math.abs(modeTotals.bankIn - modeTotals.bankOut))}
              </p>
              <div className="flex gap-4 mt-3 pt-3 border-t border-slate-200/60">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase">Bank In</p>
                  <p className="text-sm font-semibold text-emerald-600 tabular-nums">₹{fmt(modeTotals.bankIn)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase">Bank Out</p>
                  <p className="text-sm font-semibold text-red-600 tabular-nums">₹{fmt(modeTotals.bankOut)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Breakdown */}
        {(remarkBreakdown.length > 0 || nameBreakdown.length > 0) && (
          <Collapsible open={breakdownOpen} onOpenChange={setBreakdownOpen}>
            <Card className="shadow-none border-slate-200">
              <CollapsibleTrigger asChild>
                <button className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50/50 transition-colors rounded-lg">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="w-4 h-4 text-slate-400" />
                    <span className="text-sm font-medium text-slate-700">Breakdown</span>
                    <Badge variant="outline" className="text-[10px] ml-1">{remarkBreakdown.length + nameBreakdown.length}</Badge>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${breakdownOpen ? 'rotate-180' : ''}`} />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-4 pb-4">
                  <div className="flex gap-1 mb-3">
                    <button
                      onClick={() => setBreakdownTab('remark')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${breakdownTab === 'remark' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                      <Tag className="w-3 h-3 inline mr-1" /> By Remark
                    </button>
                    <button
                      onClick={() => setBreakdownTab('name')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${breakdownTab === 'name' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                      <User className="w-3 h-3 inline mr-1" /> By Name
                    </button>
                  </div>
                  <Separator className="mb-3" />
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                    {(breakdownTab === 'remark' ? remarkBreakdown : nameBreakdown).map((c) => {
                      const key = breakdownTab === 'remark' ? c.remark : c.name;
                      const isActive = breakdownTab === 'remark'
                        ? filterRemark === key
                        : filterName === key;
                      return (
                        <button
                          key={key}
                          onClick={() => {
                            if (breakdownTab === 'remark') {
                              setFilterRemark(filterRemark === key ? 'all' : key);
                            } else {
                              setFilterName(filterName === key ? 'all' : key);
                            }
                          }}
                          className={`text-left p-2.5 rounded-lg border transition-all ${
                            isActive
                              ? 'border-slate-900 bg-slate-900 text-white'
                              : 'border-slate-150 bg-white hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <p className={`text-xs font-semibold truncate ${isActive ? 'text-white' : 'text-slate-800'}`}>
                            {key}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {parseFloat(c.total_debit) > 0 && (
                              <span className={`text-[10px] ${isActive ? 'text-red-300' : 'text-red-500'}`}>
                                ↑ ₹{fmt(c.total_debit)}
                              </span>
                            )}
                            {parseFloat(c.total_credit) > 0 && (
                              <span className={`text-[10px] ${isActive ? 'text-emerald-300' : 'text-emerald-600'}`}>
                                ↓ ₹{fmt(c.total_credit)}
                              </span>
                            )}
                          </div>
                          <p className={`text-[10px] mt-0.5 ${isActive ? 'text-slate-400' : 'text-slate-400'}`}>
                            {c.entries} entries
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        )}

        {/* Search & Filter Bar */}
        <Card className="shadow-none border-slate-200">
          <CardContent className="p-3 space-y-3">
            {/* Row 1: Period preset buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="w-4 h-4 text-slate-400" />
              {[
                { key: 'all', label: 'All Time' },
                { key: 'today', label: 'Today' },
                { key: 'week', label: 'This Week' },
                { key: 'month', label: 'This Month' },
                { key: 'last_month', label: 'Last Month' },
                { key: 'custom', label: 'Custom Range' },
              ].map((p) => (
                <button
                  key={p.key}
                  onClick={() => handlePeriodChange(p.key)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                    filterPeriod === p.key
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Row 2: Date range + dropdowns + search */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Date From */}
              <div className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <Input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => { setFilterDateFrom(e.target.value); setFilterPeriod('custom'); }}
                  className="h-8 w-36 text-xs"
                  placeholder="From"
                />
              </div>
              <span className="text-xs text-slate-400">to</span>
              <Input
                type="date"
                value={filterDateTo}
                onChange={(e) => { setFilterDateTo(e.target.value); setFilterPeriod('custom'); }}
                className="h-8 w-36 text-xs"
                placeholder="To"
              />

              <Separator orientation="vertical" className="h-6 mx-1" />

              {/* Entity / Name dropdown */}
              <Select value={filterName} onValueChange={setFilterName}>
                <SelectTrigger className="w-40 h-8 text-xs">
                  <SelectValue placeholder="All Names" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Names</SelectItem>
                  {uniqueNames.map((n) => (
                    <SelectItem key={n} value={n}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Remark dropdown */}
              <Select value={filterRemark} onValueChange={setFilterRemark}>
                <SelectTrigger className="w-40 h-8 text-xs">
                  <SelectValue placeholder="All Remarks" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Remarks</SelectItem>
                  {[...new Set([
                    ...REMARK_OPTIONS,
                    ...remarkBreakdown.map(r => r.remark),
                  ])].sort().map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Separator orientation="vertical" className="h-6 mx-1" />

              {/* Sort toggle */}
              <Button
                variant={sortOrder === 'desc' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                className="h-8 text-xs gap-1.5"
                title={sortOrder === 'asc' ? 'Oldest first' : 'Newest first'}
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
                {sortOrder === 'asc' ? 'Oldest First' : 'Newest First'}
              </Button>

              <Separator orientation="vertical" className="h-6 mx-1" />

              {/* Text search */}
              <div className="relative flex-1 min-w-45">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <Input
                  placeholder="Search description, purpose..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-xs"
                />
              </div>
            </div>

            {/* Row 3: Active filter summary */}
            {hasActiveFilters && (
              <div className="flex items-center gap-2 flex-wrap">
                {filterPeriod !== 'all' && filterPeriod !== 'custom' && (
                  <Badge variant="secondary" className="text-xs gap-1">
                    <Calendar className="w-3 h-3" />
                    {filterPeriod === 'today' ? 'Today' : filterPeriod === 'week' ? 'This Week' : filterPeriod === 'month' ? 'This Month' : 'Last Month'}
                    <X className="w-3 h-3 cursor-pointer ml-0.5" onClick={() => handlePeriodChange('all')} />
                  </Badge>
                )}
                {(filterDateFrom || filterDateTo) && filterPeriod === 'custom' && (
                  <Badge variant="secondary" className="text-xs gap-1">
                    <Calendar className="w-3 h-3" />
                    {filterDateFrom || '...'} → {filterDateTo || '...'}
                    <X className="w-3 h-3 cursor-pointer ml-0.5" onClick={() => { setFilterDateFrom(''); setFilterDateTo(''); setFilterPeriod('all'); }} />
                  </Badge>
                )}
                {filterName !== 'all' && (
                  <Badge variant="secondary" className="text-xs gap-1">
                    <User className="w-3 h-3" />
                    {filterName}
                    <X className="w-3 h-3 cursor-pointer ml-0.5" onClick={() => setFilterName('all')} />
                  </Badge>
                )}
                {filterRemark !== 'all' && (
                  <Badge variant="secondary" className="text-xs gap-1">
                    <Tag className="w-3 h-3" />
                    {filterRemark}
                    <X className="w-3 h-3 cursor-pointer ml-0.5" onClick={() => setFilterRemark('all')} />
                  </Badge>
                )}
                {searchQuery && (
                  <Badge variant="secondary" className="text-xs gap-1">
                    <Search className="w-3 h-3" />
                    "{searchQuery}"
                    <X className="w-3 h-3 cursor-pointer ml-0.5" onClick={() => setSearchQuery('')} />
                  </Badge>
                )}

                <Button variant="ghost" size="sm" onClick={clearAllFilters} className="text-xs text-slate-500 h-6 px-2">
                  Clear all
                </Button>

                <span className="text-xs text-slate-400 ml-auto">
                  Showing {filteredTxns.length} of {transactions.length} —
                  Cash In <span className="text-emerald-700 font-medium">₹{fmt(filteredModeTotals.cashIn)}</span>,
                  Cash Out <span className="text-red-600 font-medium">₹{fmt(filteredModeTotals.cashOut)}</span>,
                  Bank In <span className="text-emerald-700 font-medium">₹{fmt(filteredModeTotals.bankIn)}</span>,
                  Bank Out <span className="text-red-600 font-medium">₹{fmt(filteredModeTotals.bankOut)}</span>
                </span>
              </div>
            )}
            {!hasActiveFilters && (
              <div className="flex justify-end">
                <span className="text-xs text-slate-400">
                  {transactions.length} transactions
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Transactions Table */}
        <Card className="shadow-none border-slate-200">
          <CardContent className="p-0">
            {loadingTxns ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
              </div>
            ) : displayTxns.length === 0 ? (
              <div className="text-center py-16">
                <Banknote className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-slate-500">No transactions found</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {transactions.length === 0 ? 'Add the first transaction to this firm' : 'Try a different search or filter'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent bg-slate-50/80">
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-10">#</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-24">
                        <Button variant="ghost" size="sm" onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')} className="h-6 px-1.5 text-xs">
                          Date <ArrowUpDown className="w-3 h-3 ml-1" />
                        </Button>
                      </TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Description</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600 text-right w-24">Cash In</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-red-600 text-right w-24">Cash Out</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600 text-right w-24">Bank In</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-red-600 text-right w-24">Bank Out</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 text-right w-32">Balance</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-36">Name</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-40">Purpose</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-28">Remark</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Assigned To</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-center">Status</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-center">Voucher</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right w-28">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Opening Balance Row */}
                    <TableRow className="bg-blue-50/50 hover:bg-blue-50/70">
                      <TableCell className="text-xs text-slate-400" />
                      <TableCell />
                      <TableCell>
                        <span className="text-sm font-semibold text-blue-700">OPENING BALANCE</span>
                      </TableCell>
                      <TableCell />
                      <TableCell />
                      <TableCell />
                      <TableCell />
                      <TableCell className="text-right">
                        <span className="text-sm font-semibold tabular-nums text-blue-700">
                          {fmt(openingBal)}
                        </span>
                      </TableCell>
                      <TableCell />
                      <TableCell />
                      <TableCell />
                      <TableCell />
                      <TableCell />
                      <TableCell />
                      <TableCell />
                    </TableRow>

                    {displayTxns.map((t, idx) => {
                      const debitAmt = parseFloat(t.debit) || 0;
                      const creditAmt = parseFloat(t.credit) || 0;
                      const paymentMode = (t.payment_mode || 'cash').toLowerCase();
                      const isDebit = debitAmt > 0;
                      const isCredit = creditAmt > 0;
                      const cashIn = paymentMode === 'cash' ? creditAmt : 0;
                      const cashOut = paymentMode === 'cash' ? debitAmt : 0;
                      const bankIn = (paymentMode === 'bank' || paymentMode === 'cheque') ? creditAmt : 0;
                      const bankOut = (paymentMode === 'bank' || paymentMode === 'cheque') ? debitAmt : 0;
                      const isLinkedCF = !!t.cash_flow_entry_id;
                      const isCashflowEntry = !!t.is_cashflow_entry;
                      const rowHighlight = isCashflowEntry ? 'bg-violet-50/40' : isLinkedCF ? 'bg-amber-50/40' : isCredit ? 'bg-emerald-50/30' : '';

                      return (
                        <TableRow key={t.id} className={rowHighlight}>
                          <TableCell className="text-xs text-slate-400 font-mono tabular-nums">{idx + 1}</TableCell>
                          <TableCell className="whitespace-nowrap">
                            <span className="text-sm text-slate-700 tabular-nums">{fmtDate(t.date)}</span>
                          </TableCell>
                          <TableCell>
                            <div className="max-w-xs">
                              <span className="text-sm text-slate-800 line-clamp-2">{t.description}</span>
                              {t.cheque_no && (
                                <span className="text-[10px] text-slate-400 block mt-0.5">Chq: {t.cheque_no}</span>
                              )}
                              <ChequeStatusControl
                                chequeStatus={t.cheque_status}
                                source="firm_transaction"
                                entryId={t.id}
                                isAdmin={isAdmin}
                                onStatusChange={fetchTransactions}
                              />
                              {t.transaction_no && (
                                <span className="text-[10px] text-blue-500 block mt-0.5">Txn: {t.transaction_no}</span>
                              )}
                              {isLinkedCF && (
                                <span className="flex items-center gap-1 mt-0.5 text-[10px] text-amber-700 font-medium">
                                  <IndianRupee className="w-3 h-3" />
                                  Cash Flow: {t.cf_ledger_name || 'Ledger'} ({MONTH_NAMES[t.cf_month]} {t.cf_year})
                                </span>
                              )}
                              {isCashflowEntry && (
                                <span className="flex items-center gap-1 mt-0.5 text-[10px] text-violet-700 font-medium">
                                  <IndianRupee className="w-3 h-3" />
                                  CF Ledger: {t.cf_ledger_name || 'Ledger'} ({MONTH_NAMES[t.cf_month]} {t.cf_year})
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {cashIn > 0 ? (
                              <span className="text-sm font-semibold tabular-nums text-emerald-700">{fmt(cashIn)}</span>
                            ) : (
                              <span className="text-xs text-slate-300">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {cashOut > 0 ? (
                              <span className="text-sm font-semibold tabular-nums text-red-600">{fmt(cashOut)}</span>
                            ) : (
                              <span className="text-xs text-slate-300">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {bankIn > 0 ? (
                              <span className="text-sm font-semibold tabular-nums text-emerald-700">{fmt(bankIn)}</span>
                            ) : (
                              <span className="text-xs text-slate-300">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {bankOut > 0 ? (
                              <span className="text-sm font-semibold tabular-nums text-red-600">{fmt(bankOut)}</span>
                            ) : (
                              <span className="text-xs text-slate-300">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={`text-sm font-medium tabular-nums ${t.balance >= 0 ? 'text-slate-900' : 'text-red-600'}`}>
                              {fmt(t.balance)}
                            </span>
                          </TableCell>
                          <TableCell>
                            {t.name ? (
                              <span className="text-sm font-medium text-slate-700">{t.name}</span>
                            ) : (
                              <span className="text-xs text-slate-300">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {t.purpose ? (
                              <span className="text-xs text-slate-600">{t.purpose}</span>
                            ) : (
                              <span className="text-xs text-slate-300">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {t.remark ? getRemarkBadge(t.remark) : <span className="text-xs text-slate-300">—</span>}
                          </TableCell>
                          <TableCell>
                            {t.assigned_admin_id ? (
                              <span className="inline-flex items-center text-xs font-medium text-purple-700 bg-purple-50 px-2 py-1 rounded-md">
                                {getAssignedAdminLabel(t) || '—'}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-300">Unassigned</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center"><ApprovalStatusBadge status={t.status} /></TableCell>
                          <TableCell className="text-center"><VoucherThumbnail url={t.voucher_url} /></TableCell>
                          {(canUpdate || canDelete) && !isCashflowEntry && (
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-0.5">
                                <Button variant="ghost" size="sm" onClick={() => printReceipt(t)} className="h-7 w-7 p-0 text-slate-400 hover:text-blue-600" title="Print Receipt">
                                  <Printer className="w-3.5 h-3.5" />
                                </Button>
                                {canUpdate && <Button variant="ghost" size="sm" onClick={() => handleOpenEditTxn(t)} className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700">
                                  <Edit2 className="w-3.5 h-3.5" />
                                </Button>}
                                {canDelete && <Button variant="ghost" size="sm" onClick={() => handleDeleteTxn(t.id)} className="h-7 w-7 p-0 text-slate-400 hover:text-red-600">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>}
                              </div>
                            </TableCell>
                          )}
                          {isCashflowEntry && (
                            <TableCell className="text-right">
                              <span className="text-[10px] text-violet-500 italic">via CashFlow</span>
                            </TableCell>
                          )}
                          {!(canUpdate || canDelete) && !isCashflowEntry && (
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm" onClick={() => printReceipt(t)} className="h-7 w-7 p-0 text-slate-400 hover:text-blue-600" title="Print Receipt">
                                <Printer className="w-3.5 h-3.5" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}

                  </TableBody>
                  <tfoot>
                    <TableRow className="border-t-2 border-slate-300 bg-slate-100">
                      <TableCell colSpan={3} className="text-xs font-bold text-slate-900 uppercase py-3">
                        Total ({transactions.length} transactions)
                      </TableCell>
                      <TableCell className="text-right py-3">
                        <span className="text-sm font-bold text-emerald-700 tabular-nums">₹{fmt(modeTotals.cashIn)}</span>
                      </TableCell>
                      <TableCell className="text-right py-3">
                        <span className="text-sm font-bold text-red-600 tabular-nums">₹{fmt(modeTotals.cashOut)}</span>
                      </TableCell>
                      <TableCell className="text-right py-3">
                        <span className="text-sm font-bold text-emerald-700 tabular-nums">₹{fmt(modeTotals.bankIn)}</span>
                      </TableCell>
                      <TableCell className="text-right py-3">
                        <span className="text-sm font-bold text-red-600 tabular-nums">₹{fmt(modeTotals.bankOut)}</span>
                      </TableCell>
                      <TableCell className="text-right py-3">
                        <span className={`text-sm font-bold tabular-nums ${closingBal >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                          {closingBal < 0 && '−'}₹{fmt(Math.abs(closingBal))}
                        </span>
                      </TableCell>
                      <TableCell colSpan={7} className="py-3" />
                    </TableRow>
                  </tfoot>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Transaction Dialog */}
        <Dialog open={txnDialogOpen} onOpenChange={(open) => { setTxnDialogOpen(open); if (!open) resetTxnForm(); }}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-base">{editingTxnId ? 'Edit Transaction' : 'Add Transaction'}</DialogTitle>
              <DialogDescription className="text-sm">
                {editingTxnId ? 'Update transaction details.' : `Add a bank statement entry to ${selectedFirm.name}.`}
              </DialogDescription>
            </DialogHeader>

            {message.text && (
              <div className={`flex gap-2 p-3 rounded-lg text-sm ${
                message.type === 'success'
                  ? 'bg-emerald-50 border border-emerald-100 text-emerald-700'
                  : 'bg-red-50 border border-red-100 text-red-700'
              }`}>
                {message.type === 'success' ? <Check className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
                {message.text}
              </div>
            )}

            <form onSubmit={handleSubmitTxn} className="space-y-4">
              {/* Row 1: Date, Payment Mode, Cheque No, Transaction No */}
              <div className={`grid gap-3 ${txnForm.payment_mode === 'bank' || txnForm.payment_mode === 'cheque' ? 'grid-cols-4' : 'grid-cols-2'}`}>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Date *</Label>
                  <Input
                    type="date"
                    value={txnForm.date}
                    onChange={(ev) => setTxnForm({ ...txnForm, date: ev.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Payment Mode *</Label>
                  <Select value={txnForm.payment_mode} onValueChange={(value) => setTxnForm({ ...txnForm, payment_mode: value, ...(value === 'cash' ? { cheque_no: '', transaction_no: '' } : value === 'cheque' ? { transaction_no: '' } : {}) })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="bank">Bank</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {(txnForm.payment_mode === 'bank' || txnForm.payment_mode === 'cheque') && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Cheque No</Label>
                    <Input
                      placeholder="Cheque number"
                      value={txnForm.cheque_no}
                      onChange={(ev) => setTxnForm({ ...txnForm, cheque_no: ev.target.value })}
                    />
                  </div>
                )}
                {txnForm.payment_mode === 'bank' && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Transaction No / UTR</Label>
                    <Input
                      placeholder="UTR / TXN NO"
                      value={txnForm.transaction_no}
                      onChange={(ev) => setTxnForm({ ...txnForm, transaction_no: ev.target.value.toUpperCase() })}
                    />
                  </div>
                )}
              </div>

              {/* Row 2: Description */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Description *</Label>
                <Textarea
                  placeholder="RTGS/NEFT/UPI transaction details from bank statement..."
                  value={txnForm.description}
                  onChange={(ev) => setTxnForm({ ...txnForm, description: ev.target.value })}
                  required
                  rows={2}
                />
              </div>

              {/* Row 3: Debit, Credit */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium flex items-center gap-1">
                    <ArrowUpRight className="w-3 h-3 text-red-500" /> Debit Amount (₹)
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={txnForm.debit}
                    onChange={(ev) => setTxnForm({ ...txnForm, debit: ev.target.value, credit: '' })}
                    readOnly={!!txnForm.credit}
                    className={txnForm.credit ? 'bg-slate-100 cursor-not-allowed opacity-60' : ''}
                  />
                  <p className="text-[10px] text-slate-400">Money going out</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium flex items-center gap-1">
                    <ArrowDownRight className="w-3 h-3 text-emerald-600" /> Credit Amount (₹)
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={txnForm.credit}
                    onChange={(ev) => setTxnForm({ ...txnForm, credit: ev.target.value, debit: '' })}
                    readOnly={!!txnForm.debit}
                    className={txnForm.debit ? 'bg-slate-100 cursor-not-allowed opacity-60' : ''}
                  />
                  <p className="text-[10px] text-slate-400">Money coming in</p>
                </div>
              </div>

              {/* Row 4: Name, Purpose */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium flex items-center gap-1">
                    <User className="w-3 h-3 text-slate-400" /> Name
                  </Label>
                  <Input
                    placeholder="MANOJ KUMAR, NITU..."
                    value={txnForm.name}
                    onChange={(ev) => setTxnForm({ ...txnForm, name: ev.target.value.toUpperCase() })}
                    list="firm-name-suggestions"
                  />
                  <datalist id="firm-name-suggestions">
                    {autocomplete.names.map((n) => <option key={n} value={n} />)}
                  </datalist>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium flex items-center gap-1">
                    <Briefcase className="w-3 h-3 text-slate-400" /> Purpose
                  </Label>
                  <Input
                    placeholder="IF OF PLOT NO A58, SALARY..."
                    value={txnForm.purpose}
                    onChange={(ev) => setTxnForm({ ...txnForm, purpose: ev.target.value.toUpperCase() })}
                    list="firm-purpose-suggestions"
                  />
                  <datalist id="firm-purpose-suggestions">
                    {autocomplete.purposes.map((p) => <option key={p} value={p} />)}
                  </datalist>
                </div>
              </div>

              {/* Row 5: Remark */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium flex items-center gap-1">
                  <Tag className="w-3 h-3 text-slate-400" /> Remark (Category)
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {REMARK_OPTIONS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setTxnForm({ ...txnForm, remark: txnForm.remark === r ? '' : r })}
                      className={`px-2.5 py-1 text-[11px] font-medium rounded-md border transition-all ${
                        txnForm.remark === r
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : REMARK_COLORS[r] || 'border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <Input
                  placeholder="Or type a custom remark..."
                  value={!REMARK_OPTIONS.includes(txnForm.remark) ? txnForm.remark : ''}
                  onChange={(ev) => setTxnForm({ ...txnForm, remark: ev.target.value.toUpperCase() })}
                  className="mt-1.5"
                  list="firm-remark-suggestions"
                />
                <datalist id="firm-remark-suggestions">
                  {autocomplete.remarks.filter(r => !REMARK_OPTIONS.includes(r)).map((r) => <option key={r} value={r} />)}
                </datalist>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Voucher / Receipt</Label>
                <VoucherUpload
                  value={txnForm.voucher_url}
                  onChange={(url) => setTxnForm({ ...txnForm, voucher_url: url })}
                />
              </div>

              {(isAdmin || canManage) && approvers.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Assign To Admin</Label>
                  <Select
                    value={txnForm.assigned_admin_id?.toString() || '_none'}
                    onValueChange={(val) => setTxnForm({ ...txnForm, assigned_admin_id: val === '_none' ? null : parseInt(val) })}
                  >
                    <SelectTrigger className="h-9 text-sm bg-white">
                      <SelectValue placeholder="Select approver..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">- Auto-assign or no preference -</SelectItem>
                      {approvers.map((app) => (
                        <SelectItem key={app.id} value={app.id.toString()}>
                          {app.full_name || app.name || app.email || `Admin #${app.id}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* ── Cash Flow Integration Section ── */}
              {!editingTxnId && (
                <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/40 p-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold flex items-center gap-1.5 text-amber-800">
                      <IndianRupee className="w-3.5 h-3.5 text-amber-600" />
                      Also record in Cash Flow
                    </Label>
                    <button
                      type="button"
                      onClick={() => setTxnForm({ ...txnForm, link_cashflow: !txnForm.link_cashflow, cf_key: '', ledger_name: '', ledger_type: 'site' })}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${txnForm.link_cashflow ? 'bg-amber-600' : 'bg-slate-300'}`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform shadow-sm ${txnForm.link_cashflow ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                    </button>
                  </div>

                  {txnForm.link_cashflow && (() => {
                    const cfKey = (l) => `${l.id}`;
                    const cfLabel = (l) => l.ledger_name || `${l.ledger_type === 'person' ? 'Person' : 'Site'} Ledger`;
                    const selectedCfLedger = cashflowLedgers.find(l => cfKey(l) === txnForm.cf_key);
                    const selectedCfDisplay = selectedCfLedger
                      ? `${cfLabel(selectedCfLedger)} — ${MONTH_NAMES[selectedCfLedger.month]} ${selectedCfLedger.year}`
                      : null;

                    return (
                      <div className="space-y-3">
                        {/* Ledger Select */}
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-amber-800">Cash Flow Ledger</Label>
                          <Select value={txnForm.cf_key} onValueChange={(v) => {
                            const ledger = cashflowLedgers.find(l => cfKey(l) === v);
                            setTxnForm({
                              ...txnForm,
                              cf_key: v,
                              ledger_name: ledger?.ledger_name || '',
                              ledger_type: ledger?.ledger_type || 'site',
                            });
                          }}>
                            <SelectTrigger className="h-9 text-sm bg-white">
                              <SelectValue placeholder="Select a cash flow ledger…">
                                {selectedCfDisplay && (
                                  <span className="flex items-center gap-2">
                                    <IndianRupee className="w-3.5 h-3.5 text-amber-600" />
                                    <span className="font-medium">{selectedCfDisplay}</span>
                                  </span>
                                )}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {cashflowLedgers.map(l => {
                                const monthLabel = MONTH_NAMES[l.month] || l.month;
                                const displayName = cfLabel(l);
                                return (
                                  <SelectItem key={cfKey(l)} value={cfKey(l)}>
                                    <span className="flex items-center gap-2">
                                      <IndianRupee className="w-3.5 h-3.5 text-amber-600" />
                                      <span className="font-medium">{displayName}</span>
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-semibold">{monthLabel} {l.year}</span>
                                      <span className="text-[10px] text-slate-400">{l.ledger_type === 'person' ? 'Person' : 'Site'}</span>
                                      <span className="text-[10px] text-slate-400 ml-auto">{l.entry_count || 0} entries</span>
                                    </span>
                                  </SelectItem>
                                );
                              })}
                              {cashflowLedgers.length === 0 && (
                                <div className="px-3 py-2 text-xs text-slate-400">No ledgers found. Create one in Cash Flow module first.</div>
                              )}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Manual ledger name input */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-amber-800">Or type new ledger name</Label>
                            <Input
                              value={txnForm.ledger_name}
                              onChange={(e) => setTxnForm({ ...txnForm, ledger_name: e.target.value.toUpperCase(), cf_key: '' })}
                              placeholder="New ledger name…"
                              className="h-9 text-sm bg-white"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-amber-800">Ledger Type</Label>
                            <Select value={txnForm.ledger_type} onValueChange={(v) => setTxnForm({ ...txnForm, ledger_type: v })}>
                              <SelectTrigger className="h-9 text-sm bg-white"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="site">Site Ledger</SelectItem>
                                <SelectItem value="person">Person Ledger</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {/* Info banner */}
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-100/60 border border-amber-200 text-[11px] font-semibold text-amber-700">
                          <IndianRupee className="w-3.5 h-3.5 shrink-0" />
                          {selectedCfLedger
                            ? <>This entry will also appear in Cash Flow → <span className="underline">{cfLabel(selectedCfLedger)}</span> ({MONTH_NAMES[selectedCfLedger.month]} {selectedCfLedger.year})</>
                            : txnForm.ledger_name
                              ? <>This entry will create a new Cash Flow ledger "{txnForm.ledger_name}"</>
                              : <>Select a ledger or type a new one above</>
                          }
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              <DialogFooter>
                <Button type="button" variant="outline" size="sm" onClick={() => setTxnDialogOpen(false)} disabled={submitting}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      {editingTxnId ? 'Updating...' : 'Adding...'}
                    </>
                  ) : (
                    editingTxnId ? 'Update' : 'Add Transaction'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════
  //  FIRMS LIST VIEW
  // ═══════════════════════════════════════════════════
  return (
    <div className="w-full max-w-full md:max-w-7xl space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Firm Transactions</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Bank statement tracking for <span className="font-medium text-slate-700">{currentSite.name}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/firm-transactions/history')}>
            <TrendingDown className="w-4 h-4 mr-1.5" /> History & Analytics
          </Button>
          {canWrite && (
            <Button size="sm" onClick={handleOpenCreateFirm}>
              <Plus className="w-4 h-4 mr-1.5" /> Add Firm
            </Button>
          )}
        </div>
      </div>

      {/* Firms Table */}
      {loadingFirms ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
        </div>
      ) : firms.length === 0 ? (
        <div className="text-center py-16">
          <Building2 className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No firms created yet</p>
          <p className="text-xs text-slate-400 mt-0.5">Create a firm to start tracking bank transactions</p>
        </div>
      ) : (
        <Card className="shadow-none border-slate-200 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/60">
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Firm</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Bank Info</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right">Given (Debit)</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right">Taken (Credit)</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right">Balance</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-center">Txns</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-center">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {firms.map((f) => {
                const fOpening = parseFloat(f.opening_balance) || 0;
                const tDebit = parseFloat(f.total_debit) || 0;
                const tCredit = parseFloat(f.total_credit) || 0;
                const pending = tDebit - tCredit;

                return (
                  <TableRow
                    key={f.id}
                    className="cursor-pointer hover:bg-slate-50/60"
                    onClick={() => navigate(`/firm-transactions/${f.id}`)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-md flex items-center justify-center bg-blue-50">
                          <Building2 className="w-3.5 h-3.5 text-blue-600" />
                        </div>
                        <span className="text-sm font-semibold text-slate-900">{f.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {f.bank_name && <span>{f.bank_name}</span>}
                      {f.account_number && <span>{f.bank_name ? ' · ' : ''}{f.account_number}</span>}
                      {!f.bank_name && !f.account_number && <span className="text-slate-300">—</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-sm font-semibold tabular-nums text-slate-900">₹{fmt(tDebit)}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-sm font-semibold tabular-nums text-slate-900">₹{fmt(tCredit)}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`text-sm font-bold tabular-nums ${fOpening + tCredit - tDebit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                        {fOpening + tCredit - tDebit < 0 && '−'}₹{fmt(Math.abs(fOpening + tCredit - tDebit))}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-xs text-slate-500">{f.txn_count}</span>
                    </TableCell>
                    <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-0.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          onClick={() => navigate(`/firm-transactions/${f.id}`)}
                        >
                          Open
                        </Button>
                        {(canUpdate || canDelete) && (
                          <>
                            {canUpdate && <Button variant="ghost" size="sm" onClick={() => handleOpenEditFirm(f)} className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700">
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>}
                            {canDelete && <Button variant="ghost" size="sm" onClick={() => handleDeleteFirm(f)} className="h-7 w-7 p-0 text-slate-400 hover:text-red-600">
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>}
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            {/* Cumulative Totals */}
            {(() => {
              const cumGiven = firms.reduce((s, f) => s + (parseFloat(f.total_debit) || 0), 0);
              const cumTaken = firms.reduce((s, f) => s + (parseFloat(f.total_credit) || 0), 0);
              const cumPending = cumGiven - cumTaken;
              return (
                <tfoot>
                  <TableRow className="border-t-2 border-slate-300 bg-slate-50">
                    <TableCell className="text-sm font-bold text-slate-900" colSpan={2}>Total</TableCell>
                    <TableCell className="text-right text-sm font-bold tabular-nums text-slate-900">₹{fmt(cumGiven)}</TableCell>
                    <TableCell className="text-right text-sm font-bold tabular-nums text-slate-900">₹{fmt(cumTaken)}</TableCell>
                    <TableCell className="text-right">
                      {(() => {
                        const cumBal = firms.reduce((s, f) => s + (parseFloat(f.opening_balance) || 0) + (parseFloat(f.total_credit) || 0) - (parseFloat(f.total_debit) || 0), 0);
                        return <span className={`text-sm font-bold tabular-nums ${cumBal >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{cumBal < 0 && '−'}₹{fmt(Math.abs(cumBal))}</span>;
                      })()}
                    </TableCell>
                    <TableCell colSpan={2}></TableCell>
                  </TableRow>
                </tfoot>
              );
            })()}
          </Table>
        </Card>
      )}

      {/* Firm Dialog */}
      <Dialog open={firmDialogOpen} onOpenChange={(open) => { setFirmDialogOpen(open); if (!open) resetFirmForm(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">{editingFirm ? 'Edit Firm' : 'Add Firm Account'}</DialogTitle>
            <DialogDescription className="text-sm">
              {editingFirm
                ? 'Update firm details.'
                : 'Set up a firm / bank account to track transactions.'
              }
            </DialogDescription>
          </DialogHeader>

          {message.text && (
            <div className={`flex gap-2 p-3 rounded-lg text-sm ${
              message.type === 'success'
                ? 'bg-emerald-50 border border-emerald-100 text-emerald-700'
                : 'bg-red-50 border border-red-100 text-red-700'
            }`}>
              {message.type === 'success' ? <Check className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
              {message.text}
            </div>
          )}

          <form onSubmit={handleSubmitFirm} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Firm Name *</Label>
              <Input
                placeholder="OM ASSOCIATES, DGFIRM..."
                value={firmForm.name}
                onChange={(ev) => setFirmForm({ ...firmForm, name: ev.target.value.toUpperCase() })}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Bank Name</Label>
                <Input
                  placeholder="HDFC, SBI..."
                  value={firmForm.bank_name}
                  onChange={(ev) => setFirmForm({ ...firmForm, bank_name: ev.target.value.toUpperCase() })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Account Number</Label>
                <Input
                  placeholder="066805005247"
                  value={firmForm.account_number}
                  onChange={(ev) => setFirmForm({ ...firmForm, account_number: ev.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">IFSC Code</Label>
                <Input
                  placeholder="HDFC0001234"
                  value={firmForm.ifsc_code}
                  onChange={(ev) => setFirmForm({ ...firmForm, ifsc_code: ev.target.value.toUpperCase() })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Available Balance (₹) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="315973.62"
                  value={firmForm.opening_balance}
                  onChange={(ev) => setFirmForm({ ...firmForm, opening_balance: ev.target.value })}
                />
                <p className="text-[10px] text-slate-400">Current available balance as per bank statement</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Notes</Label>
              <Textarea
                placeholder="Optional notes about this firm..."
                value={firmForm.notes}
                onChange={(ev) => setFirmForm({ ...firmForm, notes: ev.target.value })}
                rows={2}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setFirmDialogOpen(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    {editingFirm ? 'Updating...' : 'Creating...'}
                  </>
                ) : (
                  editingFirm ? 'Update' : 'Create Firm'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FirmTransactions;
