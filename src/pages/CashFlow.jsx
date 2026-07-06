import { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import QRCode from 'qrcode';
import UserAvatar from '../components/UserAvatar';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Checkbox } from '../components/ui/checkbox';
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
  Plus, Edit2, Trash2, AlertCircle, Check, Search, Loader2,
  IndianRupee, ArrowLeft, Lock, Unlock,
  Printer, ArrowUp, ArrowDown, ArrowUpDown, User, Building2, ArrowUpRight, ArrowDownRight,
  BarChart3, Wallet, Landmark, TrendingUp, TrendingDown,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import VoucherUpload, { VoucherThumbnail } from '../components/VoucherUpload';
import ApprovalStatusBadge from '../components/ApprovalStatusBadge';
import ChequeStatusControl from '../components/ChequeStatusControl';

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const todayISO = () => new Date().toISOString().split('T')[0];

const CashFlow = () => {
  const navigate = useNavigate();
  const { ledgerId } = useParams();
  const { currentSite, isAdmin, canManage, hasPermission, user } = useAuth();
  const canWrite  = canManage && hasPermission('cashflow', 'write');
  const canUpdate = canManage && hasPermission('cashflow', 'update');
  const canDelete = canManage && hasPermission('cashflow', 'delete');
  const siteId = currentSite?.id;
  const location = useLocation();
  const queryFromUrl = useMemo(() => new URLSearchParams(location.search).get('q') || '', [location.search]);

  // ── State ──
  const [ledgers, setLedgers] = useState([]);
  const [selectedLedger, setSelectedLedger] = useState(null);
  const [entries, setEntries] = useState([]);
  const [firms, setFirms] = useState([]);
  const [categories, setCategories] = useState([]);
  const [autocomplete, setAutocomplete] = useState([]);
  const [approvers, setApprovers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingFirms, setLoadingFirms] = useState(false);

  const [entryDialogOpen, setEntryDialogOpen] = useState(false);
  const [ledgerDialogOpen, setLedgerDialogOpen] = useState(false);
  const [analyticsDialogOpen, setAnalyticsDialogOpen] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [submitting, setSubmitting] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('asc');

  // Ledger form (for creating new person ledger)
  const [ledgerForm, setLedgerForm] = useState({
    ledger_name: '',
  });

  // Entry form
  const [entryForm, setEntryForm] = useState({
    date: todayISO(),
    particular: '',
    debit: '',
    credit: '',
    remarks: '',
    cash_type: 'cash',
    voucher_url: '',
    is_firm_transaction: false,
    from_firm_id: '',
    to_mode: 'name',
    to_firm_id: '',
    to_name: '',
    assigned_admin_id: null,
  });

  const fetchFirms = useCallback(async () => {
    if (!siteId) return;
    try {
      setLoadingFirms(true);
      const res = await api.get(`/cashflow/firms?site_id=${siteId}`);
      setFirms(res.data.firms || []);
    } catch {
      setFirms([]);
    } finally {
      setLoadingFirms(false);
    }
  }, [siteId]);

  // ── Fetch person-wise ledgers ──
  const fetchLedgers = useCallback(async () => {
    if (!siteId) return;
    try {
      setLoading(true);
      // Watchdog so the spinner can never hang on a stalled request.
      const watchdog = setTimeout(() => setLoading(false), 15000);
      const res = await api.get(`/cashflow/months?site_id=${siteId}`);
      clearTimeout(watchdog);
      // Get all ledgers and filter for person-based only
      const allLedgers = res.data.months || [];
      const personLedgers = allLedgers.filter(m => m.ledger_type === 'person');
      setLedgers(personLedgers);
    } catch (err) {
      console.error('Failed to fetch ledgers:', err);
      setLedgers([]);
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  // Background refresh for ledgers (no loader toggle).
  const refreshLedgers = useCallback(async () => {
    if (!siteId) return;
    try {
      const res = await api.get(`/cashflow/months?site_id=${siteId}`);
      const personLedgers = (res.data.months || []).filter((m) => m.ledger_type === 'person');
      setLedgers(personLedgers);
    } catch { /* keep current */ }
  }, [siteId]);

  // ── Fetch entries for selected ledger ──
  const fetchEntries = useCallback(async () => {
    if (!selectedLedger) return;
    try {
      setLoading(true);
      const watchdog = setTimeout(() => setLoading(false), 15000);
      const [entriesRes, acRes] = await Promise.all([
        api.get(`/cashflow/entries?month_id=${selectedLedger.id}`),
        api.get(`/cashflow/autocomplete?site_id=${siteId}`),
      ]);
      clearTimeout(watchdog);
      setEntries(entriesRes.data.entries || []);
      setCategories(entriesRes.data.categories || []);
      setAutocomplete(acRes.data.particulars || []);
    } catch (err) {
      console.error('Failed to fetch entries:', err);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [selectedLedger, siteId]);

  // Background refresh — does NOT toggle the page loader.
  const refreshEntries = useCallback(async () => {
    if (!selectedLedger) return;
    try {
      const res = await api.get(`/cashflow/entries?month_id=${selectedLedger.id}`);
      setEntries(res.data.entries || []);
      setCategories(res.data.categories || []);
    } catch { /* keep current */ }
  }, [selectedLedger]);

  useEffect(() => {
    setEntries([]);
    setSearchQuery(queryFromUrl);
    fetchLedgers();
    fetchFirms();
  }, [fetchLedgers, fetchFirms, queryFromUrl]);

  useEffect(() => {
    const q = queryFromUrl.trim().toLowerCase();
    if (!q || !ledgers.length) return;

    const exact = ledgers.find((l) => (l.ledger_name || '').toLowerCase() === q);
    const partial = ledgers.find((l) => (l.ledger_name || '').toLowerCase().includes(q));
    const matched = exact || partial;

    if (matched) {
      setSelectedLedger((prev) => (prev?.id === matched.id ? prev : matched));
    }
  }, [queryFromUrl, ledgers]);

  useEffect(() => {
    if (!ledgers.length) return;
    if (!ledgerId) {
      setSelectedLedger(null);
      return;
    }

    const matched = ledgers.find((l) => String(l.id) === String(ledgerId));
    if (matched) {
      setSelectedLedger((prev) => (prev?.id === matched.id ? prev : matched));
    }
  }, [ledgerId, ledgers]);

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
    if (selectedLedger) fetchEntries();
  }, [selectedLedger, fetchEntries]);

  // ── Ledger form handlers ──
  const resetLedgerForm = () => {
    setLedgerForm({
      ledger_name: '',
    });
    setMessage({ type: '', text: '' });
  };

  const handleOpenCreateLedger = () => {
    resetLedgerForm();
    setLedgerDialogOpen(true);
  };

  const handleSubmitLedger = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    if (!ledgerForm.ledger_name.trim()) {
      setMessage({ type: 'error', text: 'Please enter person/entity name' });
      return;
    }

    setSubmitting(true);
    try {
      const currentDate = new Date();
      const payload = {
        site_id: siteId,
        month: currentDate.getMonth() + 1,
        year: currentDate.getFullYear(),
        opening_balance: 0,
        notes: '',
        ledger_type: 'person',
        ledger_name: ledgerForm.ledger_name.toUpperCase(),
      };
      const { data } = await api.post('/cashflow/months', payload);
      // Optimistic prepend — close dialog instantly; refresh in background.
      if (data?.month) {
        setLedgers((prev) => [
          {
            ...data.month,
            total_debit: 0, total_credit: 0,
            cash_given: 0, cash_received: 0,
            bank_given: 0, bank_received: 0,
            entry_count: 0,
          },
          ...prev,
        ]);
      }
      setMessage({ type: 'success', text: 'Person ledger created. You can now add entries from any date.' });
      setLedgerDialogOpen(false);
      refreshLedgers(); // reconcile with server-computed totals
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to create ledger' });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Entry form handlers ──
  const resetEntryForm = () => {
    setEntryForm({
      date: todayISO(),
      particular: '',
      debit: '',
      credit: '',
      remarks: '',
      cash_type: 'cash',
      voucher_url: '',
      is_firm_transaction: false,
      from_firm_id: '',
      to_mode: 'name',
      to_firm_id: '',
      to_name: '',
      assigned_admin_id: null,
    });
    setEditingEntryId(null);
    setMessage({ type: '', text: '' });
  };

  const handleOpenCreateEntry = () => {
    resetEntryForm();
    setEntryDialogOpen(true);
  };

  const handleOpenEditEntry = (e) => {
    setEntryForm({
      date: e.date ? e.date.split('T')[0] : '',
      particular: e.particular || '',
      debit: e.debit && parseFloat(e.debit) !== 0 ? String(e.debit) : '',
      credit: e.credit && parseFloat(e.credit) !== 0 ? String(e.credit) : '',
      remarks: e.remarks || '',
      cash_type: e.cash_type || 'cash',
      voucher_url: e.voucher_url || '',
      is_firm_transaction: !!e.is_firm_transaction,
      from_firm_id: e.from_firm_id ? String(e.from_firm_id) : '',
      to_mode: e.to_firm_id ? 'firm' : 'name',
      to_firm_id: e.to_firm_id ? String(e.to_firm_id) : '',
      to_name: e.to_name || '',
      assigned_admin_id: e.assigned_admin_id || null,
    });
    setEditingEntryId(e.id);
    setEntryDialogOpen(true);
  };

  const handleDebitChange = (value) => {
    const amount = parseFloat(value);
    setEntryForm((prev) => ({
      ...prev,
      debit: value,
      // Keep debit/credit mutually exclusive in the add/edit form.
      credit: !Number.isNaN(amount) && amount > 0 ? '' : prev.credit,
    }));
  };

  const handleCreditChange = (value) => {
    const amount = parseFloat(value);
    setEntryForm((prev) => ({
      ...prev,
      credit: value,
      // Keep debit/credit mutually exclusive in the add/edit form.
      debit: !Number.isNaN(amount) && amount > 0 ? '' : prev.debit,
    }));
  };

  const handleSubmitEntry = async (ev) => {
    ev.preventDefault();
    setMessage({ type: '', text: '' });

    if (entryForm.is_firm_transaction) {
      if (!entryForm.from_firm_id) {
        setMessage({ type: 'error', text: 'Please select From Firm' });
        return;
      }
      if (entryForm.to_mode === 'firm' && !entryForm.to_firm_id) {
        setMessage({ type: 'error', text: 'Please select To Firm' });
        return;
      }
      if (entryForm.to_mode === 'name' && !entryForm.to_name.trim()) {
        setMessage({ type: 'error', text: 'Please enter To Name' });
        return;
      }
    }

    const currentDate = todayISO();
    const payload = {
      cash_flow_month_id: selectedLedger.id,
      date: entryForm.date || currentDate,
      particular: entryForm.particular,
      debit: parseFloat(entryForm.debit) || 0,
      credit: parseFloat(entryForm.credit) || 0,
      remarks: entryForm.remarks,
      cash_type: entryForm.cash_type,
      cheque_no: entryForm.cash_type === 'cheque' ? (entryForm.cheque_no || null) : null,
      voucher_url: entryForm.voucher_url || null,
      is_firm_transaction: entryForm.is_firm_transaction,
      from_firm_id: entryForm.is_firm_transaction && entryForm.from_firm_id ? parseInt(entryForm.from_firm_id) : null,
      to_firm_id: entryForm.is_firm_transaction && entryForm.to_mode === 'firm' && entryForm.to_firm_id ? parseInt(entryForm.to_firm_id) : null,
      to_name: entryForm.is_firm_transaction && entryForm.to_mode === 'name' ? entryForm.to_name : null,
      assigned_admin_id: entryForm.assigned_admin_id,
    };

    // ── Optimistic UI: splice the entry locally BEFORE the network call ──
    // The list and the current ledger card update instantly. Snapshot is
    // restored on failure.
    const snapshotEntries = entries;
    const snapshotLedgers = ledgers;
    const targetEntryId = editingEntryId;
    const isCreate = !targetEntryId;

    if (isCreate) {
      // Append a temp entry with a negative id; refresh will replace it.
      const tempId = -Date.now();
      const tempEntry = {
        id: tempId,
        cash_flow_month_id: selectedLedger.id,
        site_id: selectedLedger.site_id,
        ...payload,
        status: 'pending',
        cheque_status: payload.cash_type === 'cheque' ? 'PENDING' : null,
        created_at: new Date().toISOString(),
        created_by_name: user?.full_name || user?.name || null,
      };
      setEntries((prev) => [...prev, tempEntry]);
    } else {
      // In-place merge of the new payload into the existing row.
      setEntries((prev) =>
        prev.map((e) => (e.id === targetEntryId ? { ...e, ...payload } : e))
      );
    }

    // Adjust the selected-ledger summary card optimistically.
    if (selectedLedger) {
      const newDebit = parseFloat(payload.debit) || 0;
      const newCredit = parseFloat(payload.credit) || 0;
      let oldDebit = 0, oldCredit = 0, oldCashType = null;
      if (!isCreate) {
        const prevEntry = snapshotEntries.find((e) => e.id === targetEntryId);
        oldDebit = parseFloat(prevEntry?.debit) || 0;
        oldCredit = parseFloat(prevEntry?.credit) || 0;
        oldCashType = prevEntry?.cash_type;
      }
      const debitDelta = newDebit - oldDebit;
      const creditDelta = newCredit - oldCredit;

      setLedgers((prev) => prev.map((l) => {
        if (l.id !== selectedLedger.id) return l;
        const next = {
          ...l,
          total_debit: (parseFloat(l.total_debit) || 0) + debitDelta,
          total_credit: (parseFloat(l.total_credit) || 0) + creditDelta,
          entry_count: (parseInt(l.entry_count) || 0) + (isCreate ? 1 : 0),
        };
        // Adjust cash/bank split. On edit we have to subtract the old entry
        // from its old type then add the new amounts to the new type.
        if (!isCreate && oldCashType === 'cash') {
          next.cash_given = (parseFloat(l.cash_given) || 0) - oldDebit;
          next.cash_received = (parseFloat(l.cash_received) || 0) - oldCredit;
        } else if (!isCreate && oldCashType === 'bank') {
          next.bank_given = (parseFloat(l.bank_given) || 0) - oldDebit;
          next.bank_received = (parseFloat(l.bank_received) || 0) - oldCredit;
        }
        if (payload.cash_type === 'cash') {
          next.cash_given = (parseFloat(next.cash_given || 0)) + newDebit;
          next.cash_received = (parseFloat(next.cash_received || 0)) + newCredit;
        } else if (payload.cash_type === 'bank') {
          next.bank_given = (parseFloat(next.bank_given || 0)) + newDebit;
          next.bank_received = (parseFloat(next.bank_received || 0)) + newCredit;
        }
        return next;
      }));
    }

    setEntryDialogOpen(false);

    setSubmitting(true);
    try {
      if (isCreate) {
        await api.post('/cashflow/entries', payload);
        setMessage({ type: 'success', text: 'Entry added' });
      } else {
        await api.put(`/cashflow/entries/${targetEntryId}`, payload);
        setMessage({ type: 'success', text: 'Entry updated' });
      }
      // Reconcile in the background — pulls server-computed verifyUrl,
      // running balance, etc. and replaces the temp negative-id row.
      refreshEntries();
      refreshLedgers();
    } catch (err) {
      setEntries(snapshotEntries);
      setLedgers(snapshotLedgers);
      setMessage({ type: 'error', text: err.response?.data?.message || 'Operation failed' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEntry = async (id) => {
    if (!window.confirm('Delete this entry?')) return;
    // Optimistic removal — instant UI feedback. Roll back on failure.
    const snapshotEntries = entries;
    const snapshotLedgers = ledgers;
    const removed = entries.find((e) => e.id === id);
    setEntries((prev) => prev.filter((e) => e.id !== id));

    if (removed && selectedLedger) {
      const dDebit = parseFloat(removed.debit) || 0;
      const dCredit = parseFloat(removed.credit) || 0;
      setLedgers((prev) => prev.map((l) => {
        if (l.id !== selectedLedger.id) return l;
        const next = {
          ...l,
          total_debit: (parseFloat(l.total_debit) || 0) - dDebit,
          total_credit: (parseFloat(l.total_credit) || 0) - dCredit,
          entry_count: Math.max(0, (parseInt(l.entry_count) || 0) - 1),
        };
        if (removed.cash_type === 'cash') {
          next.cash_given = (parseFloat(l.cash_given) || 0) - dDebit;
          next.cash_received = (parseFloat(l.cash_received) || 0) - dCredit;
        } else if (removed.cash_type === 'bank') {
          next.bank_given = (parseFloat(l.bank_given) || 0) - dDebit;
          next.bank_received = (parseFloat(l.bank_received) || 0) - dCredit;
        }
        return next;
      }));
    }

    try {
      await api.delete(`/cashflow/entries/${id}`);
      refreshEntries();
      refreshLedgers();
    } catch (err) {
      setEntries(snapshotEntries);
      setLedgers(snapshotLedgers);
      console.error('Failed to delete entry:', err);
    }
  };

  // ── Calculations ──
  const filteredEntries = useMemo(() => {
    let result = entries;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.particular?.toLowerCase().includes(q) ||
          e.remarks?.toLowerCase().includes(q)
      );
    }
    result = [...result].sort((a, b) => {
      const da = new Date(a.date).getTime();
      const db = new Date(b.date).getTime();
      return sortOrder === 'asc' ? da - db : db - da;
    });
    return result;
  }, [entries, searchQuery, sortOrder]);

  // Rejected entries and bounced/returned cheques are displayed in the table
  // but excluded from every sum, running balance and breakdown — otherwise
  // the Total row, Pending figure and per-entry Balance all drift from what
  // the dashboard / Day Book report.
  const countsTowardBalance = (e) => {
    if (e?.status === 'rejected') return false;
    const cs = e?.cheque_status ? String(e.cheque_status).toUpperCase() : null;
    if (cs === 'BOUNCED' || cs === 'RETURNED') return false;
    return true;
  };

  const totalDebit = useMemo(
    () => entries.filter(countsTowardBalance).reduce((s, e) => s + (parseFloat(e.debit) || 0), 0),
    [entries]
  );
  const totalCredit = useMemo(
    () => entries.filter(countsTowardBalance).reduce((s, e) => s + (parseFloat(e.credit) || 0), 0),
    [entries]
  );
  const pending = totalDebit - totalCredit; // Amount pending from person

  const getCashType = (type) => {
    if (!type) return 'bank';
    return String(type).toLowerCase().trim();
  };

  const formatCurrency = (val) => {
    const num = parseFloat(val) || 0;
    return num.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const cashBreakdown = useMemo(() => {
    const normalize = (t) => {
      if (!t) return 'bank';
      return String(t).toLowerCase().trim();
    };
    
    const counted = entries.filter(countsTowardBalance);
    const cashDebit = counted.filter(e => normalize(e.cash_type) === 'cash').reduce((s, e) => s + (parseFloat(e.debit) || 0), 0);
    const cashCredit = counted.filter(e => normalize(e.cash_type) === 'cash').reduce((s, e) => s + (parseFloat(e.credit) || 0), 0);
    const bankDebit = counted.filter(e => normalize(e.cash_type) === 'bank' || normalize(e.cash_type) === 'cheque').reduce((s, e) => s + (parseFloat(e.debit) || 0), 0);
    const bankCredit = counted.filter(e => normalize(e.cash_type) === 'bank' || normalize(e.cash_type) === 'cheque').reduce((s, e) => s + (parseFloat(e.credit) || 0), 0);

    return {
      cashDebit,
      cashCredit,
      bankDebit,
      bankCredit,
      cashEntries: counted.filter(e => normalize(e.cash_type) === 'cash').length,
      bankEntries: counted.filter(e => normalize(e.cash_type) === 'bank' || normalize(e.cash_type) === 'cheque').length,
    };
  }, [entries]);

  const modeChartData = useMemo(() => ([
    {
      name: 'Cash',
      debit: cashBreakdown.cashDebit,
      credit: cashBreakdown.cashCredit,
    },
    {
      name: 'Bank',
      debit: cashBreakdown.bankDebit,
      credit: cashBreakdown.bankCredit,
    },
  ]), [cashBreakdown]);

  const flowPieData = useMemo(() => ([
    { name: 'Given (Debit)', value: totalDebit, color: '#ef4444' },
    { name: 'Returned (Credit)', value: totalCredit, color: '#10b981' },
  ]), [totalDebit, totalCredit]);

  const trendChartData = useMemo(() => {
    const grouped = new Map();
    entries.forEach((entry) => {
      const d = (entry.date || '').toString().split('T')[0] || todayISO();
      if (!grouped.has(d)) grouped.set(d, { date: d, debit: 0, credit: 0 });
      const current = grouped.get(d);
      current.debit += parseFloat(entry.debit) || 0;
      current.credit += parseFloat(entry.credit) || 0;
    });
    return Array.from(grouped.values())
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(-12)
      .map((item) => ({
        ...item,
        label: formatDate(item.date),
      }));
  }, [entries]);

  const cashPending = cashBreakdown.cashDebit - cashBreakdown.cashCredit;
  const bankPending = cashBreakdown.bankDebit - cashBreakdown.bankCredit;

  const entriesWithRunningTotal = useMemo(() => {
    let runningTotal = 0;
    return filteredEntries.map((e) => {
      if (countsTowardBalance(e)) {
        runningTotal += (parseFloat(e.debit) || 0) - (parseFloat(e.credit) || 0);
      }
      return { ...e, runningTotal };
    });
  }, [filteredEntries]);

  // ── Helpers ──
  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const openPrintWindow = (html, title, size = 'width=1100,height=800') => {
    const printWindow = window.open('', '_blank', size);
    if (!printWindow) return;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  // Farmer-style two-copy cash flow entry receipt with embedded QR + print stamp.
  const printEntryReceipt = async (entry) => {
    const debit = parseFloat(entry.debit) || 0;
    const credit = parseFloat(entry.credit) || 0;
    const isCredit = credit > 0;
    const amount = isCredit ? credit : debit;
    const amtColor = isCredit ? '#059669' : '#dc2626';
    const docTitle = isCredit ? 'Cash Flow Credit Receipt' : 'Cash Flow Debit Receipt';
    const mode = getCashType(entry.cash_type) === 'cash' ? 'CASH' : 'BANK';
    const isCash = mode === 'CASH';
    const siteName = (currentSite?.name || 'CASH FLOW').toUpperCase();
    const siteAddr = [currentSite?.address, currentSite?.city, currentSite?.state].filter(Boolean).join(', ').toUpperCase();
    const fmtINR = (v) => parseFloat(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 });
    const payDate = entry.date ? new Date(entry.date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
    const printedAt = new Date().toLocaleString('en-IN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
    const signerName = user?.full_name || user?.name || '';
    const refNo = `CF-${String(entry.id).padStart(5, '0')}`;
    const partyName = entry.to_firm_name || entry.from_firm_name || entry.to_name || entry.particular || '—';
    const partyLabel = isCredit ? 'Received From' : 'Paid To';

    let qrDataUrl = null;
    if (entry.verifyUrl) {
      try {
        qrDataUrl = await QRCode.toDataURL(entry.verifyUrl, {
          width: 640, margin: 2, errorCorrectionLevel: 'M',
          color: { dark: '#000000', light: '#ffffff' },
        });
      } catch { qrDataUrl = null; }
    }
    const qrSection = qrDataUrl
      ? `<div class="qr-section"><img src="${qrDataUrl}" alt="Verify QR" /><div class="qr-label">Scan to verify</div></div>`
      : '';

    const receiptBlock = (copyLabel) => `
      <div class="receipt-copy">
        <div class="copy-label">${copyLabel}</div>
        <div class="border-frame"></div>
        <div class="watermark">${siteName}</div>
        <div class="content">
          <div class="header">
            <h1>${siteName}</h1>
            <p>${siteAddr || (selectedLedger?.ledger_name || 'CASH FLOW LEDGER').toUpperCase()}</p>
          </div>
          <div class="doc-type"><h2>${docTitle}</h2></div>
          <div class="meta-info">
            <div class="meta-item"><b>Ref:</b> ${refNo}</div>
            <div class="meta-item"><b>Date:</b> ${payDate}</div>
          </div>
          <div class="kv-qr-wrap">
            <div class="kv-section">
              <div class="kv-row"><div class="k">${partyLabel}</div><div class="c">:</div><div class="v">${String(partyName).toUpperCase()}</div></div>
              ${entry.particular ? `<div class="kv-row"><div class="k">Particular</div><div class="c">:</div><div class="v">${String(entry.particular).toUpperCase()}</div></div>` : ''}
              <div class="kv-row"><div class="k">Amount</div><div class="c">:</div><div class="v" style="color:${amtColor}">RS ${fmtINR(amount)}/-</div></div>
              <div class="kv-row"><div class="k">Mode</div><div class="c">:</div><div class="v">${mode}</div></div>
              ${selectedLedger?.ledger_name ? `<div class="kv-row"><div class="k">Ledger</div><div class="c">:</div><div class="v">${String(selectedLedger.ledger_name).toUpperCase()}</div></div>` : ''}
            </div>
            ${qrSection}
          </div>
          <div class="settlement-title">${isCredit ? 'Credit' : 'Debit'} Details:</div>
          <table class="data-table">
            <tr><th>S.No.</th><td>${refNo}</td></tr>
            <tr><th>Date</th><td>${payDate || '—'}</td></tr>
            <tr><th>Particular</th><td>${entry.particular ? String(entry.particular).toUpperCase() : '—'}</td></tr>
            <tr><th>Mode</th><td>${mode}</td></tr>
            <tr><th>Debit</th><td style="color:#dc2626">RS ${fmtINR(debit)}/-</td></tr>
            <tr><th>Credit</th><td style="color:#059669">RS ${fmtINR(credit)}/-</td></tr>
            ${entry.from_firm_name ? `<tr><th>From</th><td>${String(entry.from_firm_name).toUpperCase()}</td></tr>` : ''}
            ${entry.to_firm_name || entry.to_name ? `<tr><th>To</th><td>${String(entry.to_firm_name || entry.to_name).toUpperCase()}</td></tr>` : ''}
            ${entry.remarks ? `<tr><th>Remarks</th><td>${entry.remarks}</td></tr>` : ''}
            <tr><th>Status</th><td>${String(entry.status || 'pending').toUpperCase()}</td></tr>
          </table>
          ${isCash ? '<div class="bank-proviso">STATUTORY PROVISO: Cash received exclusively as a temporary custodian on behalf of our designated banking institution for immediate reconciliation and ledger entry.</div>' : ''}
          <div class="footer">
            <div class="sig-box"><div class="sig-line">${isCredit ? 'Payer Signature' : 'Receiver Signature'}</div></div>
            <div class="sig-box"><div class="digital-signature">${signerName}</div><div class="sig-line">Authorized Signatory & Seal</div></div>
          </div>
          <div class="print-meta">Printed on: <b>${printedAt}</b></div>
        </div>
      </div>
    `;

    const html = `<!DOCTYPE html>
<html><head>
  <title>CASH FLOW RECEIPT - ${refNo}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Inter:wght@400;500;600;700&family=Dancing+Script:wght@400;500;600;700&display=swap');
    @page { size: A4 portrait; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', -apple-system, sans-serif; color: #1a1a1a; background: #f1f5f9; display: flex; justify-content: center; padding: 10mm 0; }
    .document { background: #fff; width: 210mm; min-height: 297mm; padding: 8mm 15mm; position: relative; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; display: flex; flex-direction: column; overflow: hidden; }
    .receipt-copy { position: relative; flex: 1; display: flex; flex-direction: column; padding: 3mm 5mm; overflow: hidden; }
    .copy-label { position: absolute; top: 2mm; right: 3mm; font-size: 8px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; }
    .scissor-line { position: relative; border: none; border-top: 1.5px dashed #94a3b8; margin: 2mm 0; overflow: visible; }
    .scissor-line::before { content: '✂'; position: absolute; top: -10px; left: -2px; font-size: 16px; color: #94a3b8; line-height: 1; }
    .border-frame { position: absolute; top: 2mm; left: 2mm; right: 2mm; bottom: 2mm; border: 1px solid #cbd5e1; pointer-events: none; }
    .watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-family: 'Cinzel', serif; font-size: 60px; color: rgba(226,232,240,0.25); font-weight: 700; z-index: 1; pointer-events: none; white-space: nowrap; text-transform: uppercase; }
    .content { position: relative; z-index: 10; flex: 1; display: flex; flex-direction: column; }
    .header { text-align: center; margin-bottom: 2mm; border-bottom: 2px double #0f172a; padding: 2mm 3mm 1.5mm; background: #f0fdf4; border-radius: 4px; }
    .header h1 { font-family: 'Cinzel', serif; font-size: 17px; color: #166534; letter-spacing: 2px; margin-bottom: 1px; text-transform: uppercase; }
    .header p { font-size: 9px; color: #475569; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; max-width: 80%; margin: 0 auto; }
    .doc-type { text-align: center; margin-bottom: 2mm; }
    .doc-type h2 { font-family: 'Cinzel', serif; font-size: 11px; color: #64748b; letter-spacing: 4px; text-transform: uppercase; display: inline-block; padding: 1px 15px; border-bottom: 1px solid #cbd5e1; }
    .meta-info { display: flex; justify-content: space-between; margin-bottom: 2mm; font-size: 10px; padding: 0 3mm; }
    .meta-item b { color: #64748b; font-size: 8px; text-transform: uppercase; margin-right: 3px; }
    .kv-qr-wrap { display: flex; align-items: flex-start; gap: 4mm; padding: 0 3mm; margin-bottom: 2mm; }
    .kv-section { flex: 1; min-width: 0; }
    .kv-row { display: grid; grid-template-columns: 44% 4% 52%; gap: 1px; align-items: baseline; margin: 1mm 0; font-size: 10px; }
    .kv-row .k { color: #0f172a; font-weight: 600; } .kv-row .c { text-align: center; color: #475569; font-weight: 700; } .kv-row .v { color: #0f172a; font-weight: 600; text-transform: uppercase; }
    .qr-section { flex-shrink: 0; display: flex; flex-direction: column; align-items: center; background: #fff; padding: 1.5mm; border: 1px solid #0f172a; border-radius: 3px; }
    .qr-section img { display: block; width: 30mm; height: 30mm; image-rendering: pixelated; image-rendering: crisp-edges; }
    .qr-label { font-size: 7px; color: #166534; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 800; margin-top: 1mm; }
    .settlement-title { margin: 1mm 3mm 0.8mm; font-size: 10px; color: #0f172a; font-weight: 700; }
    .data-table { width: 100%; border-collapse: collapse; margin-bottom: 2mm; }
    .data-table th, .data-table td { border: 1px solid #e2e8f0; padding: 0.8mm 3mm; text-align: left; line-height: 1.25; }
    .data-table th { background: #f8fafc; font-size: 8px; text-transform: uppercase; color: #64748b; width: 35%; }
    .data-table td { font-size: 10px; font-weight: 600; color: #0f172a; }
    .bank-proviso { margin-top: 1mm; padding: 1.8mm 2.5mm; background: #f8fafc; border: 1px solid #e2e8f0; font-size: 8px; font-style: italic; color: #64748b; text-align: center; line-height: 1.4; }
    .footer { flex-shrink: 0; margin-top: auto; display: flex; justify-content: space-between; align-items: flex-end; padding: 3mm 5mm 1mm; }
    .sig-box { text-align: center; width: 55mm; min-height: 14mm; display: flex; flex-direction: column; justify-content: flex-end; }
    .sig-line { border-top: 1.5px solid #0f172a; padding-top: 3px; font-size: 8px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; }
    .digital-signature { font-family: 'Dancing Script', 'Brush Script MT', cursive; font-size: 22px; font-weight: 700; color: #1a237e; margin-bottom: 1px; line-height: 1; height: 8mm; display: flex; align-items: flex-end; justify-content: center; }
    .print-meta { flex-shrink: 0; text-align: center; font-size: 7.5px; color: #64748b; margin-top: 1.5mm; padding: 0.8mm 0 0; border-top: 1px dashed #e2e8f0; letter-spacing: 0.3px; }
    .print-meta b { color: #0f172a; font-weight: 600; }
    @media print { body { background: white; padding: 0; } .document { box-shadow: none !important; border: none !important; width: 210mm; height: 297mm; margin: 0 !important; padding: 8mm 15mm !important; } .receipt-copy { padding: 3mm 5mm !important; } .header { padding: 2mm 3mm !important; margin-bottom: 1.5mm !important; } .header h1 { font-size: 16px !important; } .doc-type { margin-bottom: 1.5mm !important; } .meta-info { margin-bottom: 1.5mm !important; } .kv-qr-wrap { margin-bottom: 1mm !important; } .qr-section img { width: 24mm !important; height: 24mm !important; } .settlement-title { margin: 1mm 3mm 0.5mm !important; } .data-table { margin-bottom: 1.5mm !important; } .data-table th, .data-table td { padding: 0.8mm 3mm !important; } .bank-proviso { margin-top: 1mm !important; padding: 1.5mm 2mm !important; font-size: 7px !important; line-height: 1.35 !important; } .footer { padding: 1.5mm 5mm 0 !important; } .sig-box { min-height: 11mm !important; } .digital-signature { font-size: 18px !important; height: 6mm !important; } .print-meta { margin-top: 0.5mm !important; } .no-print { display: none !important; } }
  </style>
</head>
<body>
  <div class="document">
    ${receiptBlock('Office Copy')}
    <hr class="scissor-line" />
    ${receiptBlock('Party Copy')}
  </div>
  <div class="no-print" style="position:fixed; bottom: 30px; left:0; right:0; text-align:center; z-index:1000;">
    <button onclick="(async () => { try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch(e){} window.print(); })()" style="padding:12px 50px; font-size:15px; font-weight:700; background:#0f172a; color:#fff; border:none; border-radius:10px; cursor:pointer; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.2);">EXECUTE PRINT (A4)</button>
    <button onclick="window.close()" style="padding:12px 50px; font-size:15px; font-weight:700; background:#fff; color:#475569; border:1px solid #e2e8f0; border-radius:10px; cursor:pointer; margin-left:15px;">TERMINATE</button>
  </div>
</body></html>`;

    openPrintWindow(html, docTitle, 'width=1000,height=750');
  };

  const printWholeLedger = () => {
    if (!selectedLedger) return;

    const ledgerTitle = `${selectedLedger.ledger_name} - ${MONTH_NAMES[selectedLedger.month]} ${selectedLedger.year}`;
    const pCashPending = cashBreakdown.cashDebit - cashBreakdown.cashCredit;
    const pBankPending = cashBreakdown.bankDebit - cashBreakdown.bankCredit;

    let runTotal = 0;
    const rows = filteredEntries.map((entry, index) => {
      if (countsTowardBalance(entry)) {
        runTotal += (parseFloat(entry.debit) || 0) - (parseFloat(entry.credit) || 0);
      }
      return `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(formatDate(entry.date))}</td>
        <td>${escapeHtml(entry.particular)}</td>
        <td>${escapeHtml(entry.from_firm_name || '—')}</td>
        <td>${escapeHtml(entry.to_firm_name || entry.to_name || '—')}</td>
        <td>${escapeHtml(getCashType(entry.cash_type) === 'cash' ? 'Cash' : 'Bank')}</td>
        <td>${escapeHtml(entry.cheque_no || '—')}</td>
        <td class="num debit">${parseFloat(entry.debit) > 0 ? '₹' + escapeHtml(formatCurrency(entry.debit)) : '—'}</td>
        <td class="num credit">${parseFloat(entry.credit) > 0 ? '₹' + escapeHtml(formatCurrency(entry.credit)) : '—'}</td>
        <td class="num" style="font-weight:700;color:${runTotal > 0 ? '#b45309' : runTotal < 0 ? '#dc2626' : '#94a3b8'}">${runTotal < 0 ? '−' : ''}₹${escapeHtml(formatCurrency(Math.abs(runTotal)))}</td>
        <td class="num">${getCashType(entry.cash_type) === 'cash' && parseFloat(entry.debit) > 0 ? '₹' + escapeHtml(formatCurrency(entry.debit)) : '—'}</td>
        <td class="num">${getCashType(entry.cash_type) === 'cash' && parseFloat(entry.credit) > 0 ? '₹' + escapeHtml(formatCurrency(entry.credit)) : '—'}</td>
        <td class="num">${getCashType(entry.cash_type) === 'bank' && parseFloat(entry.debit) > 0 ? '₹' + escapeHtml(formatCurrency(entry.debit)) : '—'}</td>
        <td class="num">${getCashType(entry.cash_type) === 'bank' && parseFloat(entry.credit) > 0 ? '₹' + escapeHtml(formatCurrency(entry.credit)) : '—'}</td>
        <td>${escapeHtml(entry.remarks || '—')}</td>
        <td>${escapeHtml(entry.status || 'pending')}</td>
      </tr>`;
    }).join('');

    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>${escapeHtml(ledgerTitle)}</title>
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; color: #0f172a; background: #fff; font-size: 12px; }
    .sheet { max-width: 1400px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 16px; border-bottom: 2px solid #0f172a; margin-bottom: 18px; }
    .header .title { font-size: 22px; font-weight: 800; color: #0f172a; }
    .header .sub { font-size: 11px; color: #64748b; margin-top: 4px; }
    .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; }
    .sum-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; }
    .sum-card .lbl { font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; font-weight: 700; }
    .sum-card .val { font-size: 18px; font-weight: 800; margin-top: 4px; font-variant-numeric: tabular-nums; }
    .analytics-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 18px; }
    .analytics-card { border: 2px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; }
    .analytics-card.cash { border-color: #fbbf24; background: #fffbeb; }
    .analytics-card.bank { border-color: #60a5fa; background: #eff6ff; }
    .analytics-card .card-title { font-size: 13px; font-weight: 700; color: #334155; margin-bottom: 2px; }
    .analytics-card .card-sub { font-size: 10px; color: #94a3b8; }
    .analytics-card .card-value { font-size: 24px; font-weight: 800; margin-top: 6px; font-variant-numeric: tabular-nums; }
    .analytics-card .card-status { font-size: 10px; font-weight: 600; margin-top: 2px; }
    .analytics-card .breakdown { display: flex; gap: 20px; margin-top: 10px; padding-top: 8px; border-top: 1px solid #e2e8f0; }
    .analytics-card .breakdown .item .bl { font-size: 9px; text-transform: uppercase; color: #94a3b8; font-weight: 700; }
    .analytics-card .breakdown .item .bv { font-size: 13px; font-weight: 700; margin-top: 2px; font-variant-numeric: tabular-nums; }
    .amber { color: #b45309; }
    .red { color: #dc2626; }
    .green { color: #059669; }
    .muted { color: #94a3b8; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 0; }
    th, td { border: 1px solid #e2e8f0; padding: 6px 7px; vertical-align: top; }
    th { background: #f1f5f9; text-transform: uppercase; letter-spacing: 0.04em; color: #475569; font-size: 9px; font-weight: 700; }
    th.debit-h { color: #dc2626; }
    th.credit-h { color: #059669; }
    th.balance-h { color: #b45309; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .debit { color: #dc2626; font-weight: 600; }
    .credit { color: #059669; font-weight: 600; }
    tfoot td { background: #f1f5f9; font-weight: 800; border-top: 2px solid #334155; }
    .controls { text-align: center; margin-top: 20px; }
    .btn { padding: 10px 24px; font-size: 13px; font-weight: 700; border-radius: 8px; border: none; cursor: pointer; }
    .btn-print { background: #0f172a; color: white; }
    .btn-close { background: #e2e8f0; color: #334155; margin-left: 8px; }
    @media print { body { padding: 0; } .controls { display: none !important; } }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      <div>
        <div class="title">${escapeHtml(ledgerTitle)}</div>
        <div class="sub">${escapeHtml(currentSite?.name || '')} · Printed on ${escapeHtml(new Date().toLocaleString('en-IN'))}</div>
      </div>
    </div>

    <div class="summary-grid">
      <div class="sum-card"><div class="lbl">Total Given (Debit)</div><div class="val red">₹${escapeHtml(formatCurrency(totalDebit))}</div></div>
      <div class="sum-card"><div class="lbl">Total Returned (Credit)</div><div class="val green">₹${escapeHtml(formatCurrency(totalCredit))}</div></div>
      <div class="sum-card"><div class="lbl">Net Pending</div><div class="val ${pending >= 0 ? 'amber' : 'red'}">${pending < 0 ? '−' : ''}₹${escapeHtml(formatCurrency(Math.abs(pending)))}</div><div style="font-size:10px;color:#64748b;margin-top:2px">${pending >= 0 ? 'To Receive' : 'To Pay'}</div></div>
      <div class="sum-card"><div class="lbl">Entries</div><div class="val">${escapeHtml(String(entries.length))}</div></div>
    </div>

    <div class="analytics-row">
      <div class="analytics-card cash">
        <div class="card-title">💵 To Receive in Cash</div>
        <div class="card-sub">Cash given will return in cash</div>
        <div class="card-value ${pCashPending > 0 ? 'amber' : pCashPending < 0 ? 'red' : 'muted'}">${pCashPending < 0 ? '−' : ''}₹${escapeHtml(formatCurrency(Math.abs(pCashPending)))}</div>
        <div class="card-status ${pCashPending > 0 ? 'amber' : pCashPending < 0 ? 'red' : 'muted'}">${pCashPending > 0 ? 'He needs to pay us' : pCashPending < 0 ? 'We need to pay' : 'Settled'}</div>
        <div class="breakdown">
          <div class="item"><div class="bl">Cash Out</div><div class="bv red">₹${escapeHtml(formatCurrency(cashBreakdown.cashDebit))}</div></div>
          <div class="item"><div class="bl">Cash In</div><div class="bv green">₹${escapeHtml(formatCurrency(cashBreakdown.cashCredit))}</div></div>
        </div>
      </div>
      <div class="analytics-card bank">
        <div class="card-title">🏦 To Receive in Bank</div>
        <div class="card-sub">Bank transfer will return via bank</div>
        <div class="card-value ${pBankPending > 0 ? 'amber' : pBankPending < 0 ? 'red' : 'muted'}">${pBankPending < 0 ? '−' : ''}₹${escapeHtml(formatCurrency(Math.abs(pBankPending)))}</div>
        <div class="card-status ${pBankPending > 0 ? 'amber' : pBankPending < 0 ? 'red' : 'muted'}">${pBankPending > 0 ? 'He needs to pay us' : pBankPending < 0 ? 'We need to pay' : 'Settled'}</div>
        <div class="breakdown">
          <div class="item"><div class="bl">Bank Out</div><div class="bv red">₹${escapeHtml(formatCurrency(cashBreakdown.bankDebit))}</div></div>
          <div class="item"><div class="bl">Bank In</div><div class="bv green">₹${escapeHtml(formatCurrency(cashBreakdown.bankCredit))}</div></div>
        </div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>#</th><th>Date</th><th>Particular</th><th>From Firm</th><th>To</th><th>Type</th><th>Cheque No</th><th class="num debit-h">Debit</th><th class="num credit-h">Credit</th><th class="num balance-h">Balance</th><th class="num">Cash Out</th><th class="num">Cash In</th><th class="num">Bank Out</th><th class="num">Bank In</th><th>Remarks</th><th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="7" style="text-transform:uppercase;font-size:10px">Total</td>
          <td class="num debit">₹${escapeHtml(formatCurrency(totalDebit))}</td>
          <td class="num credit">₹${escapeHtml(formatCurrency(totalCredit))}</td>
          <td class="num" style="color:${pending > 0 ? '#b45309' : pending < 0 ? '#dc2626' : '#94a3b8'}">${pending < 0 ? '−' : ''}₹${escapeHtml(formatCurrency(Math.abs(pending)))}</td>
          <td class="num">₹${escapeHtml(formatCurrency(cashBreakdown.cashDebit))}</td>
          <td class="num">₹${escapeHtml(formatCurrency(cashBreakdown.cashCredit))}</td>
          <td class="num">₹${escapeHtml(formatCurrency(cashBreakdown.bankDebit))}</td>
          <td class="num">₹${escapeHtml(formatCurrency(cashBreakdown.bankCredit))}</td>
          <td colspan="2"></td>
        </tr>
      </tfoot>
    </table>
  </div>
  <div class="controls">
    <button class="btn btn-print" onclick="window.print()">Print Ledger</button>
    <button class="btn btn-close" onclick="window.close()">Close</button>
  </div>
</body>
</html>`;

    openPrintWindow(html, ledgerTitle, 'width=1400,height=900');
  };

  if (!currentSite) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <User className="w-10 h-10 text-slate-200 mb-3" />
        <p className="text-sm text-slate-500">Select a site to view cash flow</p>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════
  //  LEDGER DETAIL VIEW
  // ═══════════════════════════════════════════════════
  if (selectedLedger) {
    return (
      <div className="max-w-7xl space-y-5">
        {/* Header */}
        <div className="rounded-2xl border border-slate-200 bg-linear-to-r from-white via-slate-50 to-sky-50/60 p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <Button variant="ghost" size="sm" onClick={() => { setSelectedLedger(null); setEntries([]); setSearchQuery(''); navigate('/cashflow'); }} className="h-8 w-8 p-0 mt-0.5">
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div>
                <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">{selectedLedger.ledger_name}</h1>
                <p className="text-sm text-slate-500 mt-0.5">
                  {MONTH_NAMES[selectedLedger.month]} {selectedLedger.year} · Person Ledger
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="px-2 py-1 rounded-full text-[10px] font-medium bg-white text-slate-600 border border-slate-200">{entries.length} Entries</span>
                  <span className={`px-2 py-1 rounded-full text-[10px] font-medium border ${selectedLedger.is_locked ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                    {selectedLedger.is_locked ? 'Locked' : 'Active'}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setAnalyticsDialogOpen(true)}>
                <BarChart3 className="w-3.5 h-3.5 mr-1" /> Analytics
              </Button>
              <Button variant="outline" size="sm" onClick={printWholeLedger}>
                <Printer className="w-3.5 h-3.5 mr-1" /> Print Ledger
              </Button>
              {canWrite && !selectedLedger.is_locked && (
                <Button size="sm" onClick={handleOpenCreateEntry}>
                  <Plus className="w-4 h-4 mr-1.5" /> Add Entry
                </Button>
              )}
              {isAdmin && (
                <Button variant="outline" size="sm" onClick={() => {
                  api.put(`/cashflow/months/${selectedLedger.id}`, { is_locked: !selectedLedger.is_locked });
                  setSelectedLedger({...selectedLedger, is_locked: !selectedLedger.is_locked});
                  fetchLedgers();
                }}>
                  {selectedLedger.is_locked ? <Unlock className="w-3.5 h-3.5 mr-1" /> : <Lock className="w-3.5 h-3.5 mr-1" />}
                  {selectedLedger.is_locked ? 'Unlock' : 'Lock'}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          <div className="rounded-xl border border-red-200/70 bg-linear-to-r from-red-50 to-white px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wider text-red-500/80 font-semibold flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3" /> Total Given (Debit)
            </p>
            <p className="text-lg font-bold text-red-600 mt-1 tabular-nums">₹{formatCurrency(totalDebit)}</p>
          </div>
          <div className="rounded-xl border border-emerald-200/70 bg-linear-to-r from-emerald-50 to-white px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wider text-emerald-500/80 font-semibold flex items-center gap-1">
              <ArrowDownRight className="w-3 h-3" /> Total Returned (Credit)
            </p>
            <p className="text-lg font-bold text-emerald-700 mt-1 tabular-nums">₹{formatCurrency(totalCredit)}</p>
          </div>
          <div className="rounded-xl border border-amber-200/70 bg-linear-to-r from-amber-50 to-white px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wider text-amber-500/80 font-semibold flex items-center gap-1">
              <IndianRupee className="w-3 h-3" /> Net Pending
            </p>
            <p className={`text-lg font-bold mt-1 tabular-nums ${pending >= 0 ? 'text-amber-700' : 'text-red-600'}`}>
              {pending < 0 && '−'}₹{formatCurrency(Math.abs(pending))}
            </p>
            <p className="text-[10px] mt-0.5 text-slate-500">{pending >= 0 ? 'To Receive' : 'To Pay'}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-linear-to-r from-slate-50 to-white px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wider text-slate-500/80 font-semibold flex items-center gap-1">
              <BarChart3 className="w-3 h-3" /> Entries
            </p>
            <p className="text-lg font-bold text-slate-900 mt-1">{entries.length}</p>
          </div>
        </div>

        {/* To Receive Analytics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Card className={`shadow-none rounded-xl overflow-hidden border-2 ${
            cashPending > 0 ? 'border-amber-300 bg-amber-50/30' : cashPending < 0 ? 'border-red-300 bg-red-50/30' : 'border-slate-200 bg-slate-50/30'
          }`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                    <Wallet className="w-4 h-4 text-orange-500" /> To Receive in Cash
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Cash given will return in cash</p>
                </div>
                {cashPending > 0 ? <TrendingUp className="w-5 h-5 text-amber-500" /> : cashPending < 0 ? <TrendingDown className="w-5 h-5 text-red-500" /> : null}
              </div>
              <p className={`text-2xl font-bold mt-2 tabular-nums ${
                cashPending > 0 ? 'text-amber-700' : cashPending < 0 ? 'text-red-600' : 'text-slate-400'
              }`}>
                {cashPending < 0 && '−'}₹{formatCurrency(Math.abs(cashPending))}
              </p>
              <p className={`text-[11px] font-medium mt-1 ${
                cashPending > 0 ? 'text-amber-600' : cashPending < 0 ? 'text-red-500' : 'text-slate-400'
              }`}>
                {cashPending > 0 ? 'He needs to pay us' : cashPending < 0 ? 'We need to pay' : 'Settled'}
              </p>
              <div className="flex gap-4 mt-3 pt-3 border-t border-slate-200/60">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase">Cash Out</p>
                  <p className="text-sm font-semibold text-red-600 tabular-nums">₹{formatCurrency(cashBreakdown.cashDebit)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase">Cash In</p>
                  <p className="text-sm font-semibold text-emerald-600 tabular-nums">₹{formatCurrency(cashBreakdown.cashCredit)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={`shadow-none rounded-xl overflow-hidden border-2 ${
            bankPending > 0 ? 'border-amber-300 bg-amber-50/30' : bankPending < 0 ? 'border-red-300 bg-red-50/30' : 'border-slate-200 bg-slate-50/30'
          }`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                    <Landmark className="w-4 h-4 text-blue-500" /> To Receive in Bank
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Bank transfer will return via bank</p>
                </div>
                {bankPending > 0 ? <TrendingUp className="w-5 h-5 text-amber-500" /> : bankPending < 0 ? <TrendingDown className="w-5 h-5 text-red-500" /> : null}
              </div>
              <p className={`text-2xl font-bold mt-2 tabular-nums ${
                bankPending > 0 ? 'text-amber-700' : bankPending < 0 ? 'text-red-600' : 'text-slate-400'
              }`}>
                {bankPending < 0 && '−'}₹{formatCurrency(Math.abs(bankPending))}
              </p>
              <p className={`text-[11px] font-medium mt-1 ${
                bankPending > 0 ? 'text-amber-600' : bankPending < 0 ? 'text-red-500' : 'text-slate-400'
              }`}>
                {bankPending > 0 ? 'He needs to pay us' : bankPending < 0 ? 'We need to pay' : 'Settled'}
              </p>
              <div className="flex gap-4 mt-3 pt-3 border-t border-slate-200/60">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase">Bank Out</p>
                  <p className="text-sm font-semibold text-red-600 tabular-nums">₹{formatCurrency(cashBreakdown.bankDebit)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase">Bank In</p>
                  <p className="text-sm font-semibold text-emerald-600 tabular-nums">₹{formatCurrency(cashBreakdown.bankCredit)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="rounded-xl border border-slate-200/90 bg-white/80 px-3 py-2.5">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <Input
              placeholder="Search entries..."
              value={searchQuery}
              onChange={(ev) => setSearchQuery(ev.target.value)}
              className="pl-9 h-9 bg-white"
            />
          </div>
        </div>

        {/* Entries Table */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
          </div>
        ) : (
          <Card className="shadow-none border-slate-200/90 rounded-xl overflow-hidden">
            <div className="overflow-auto relative z-0 will-change-scroll" style={{ maxHeight: 'calc(100vh - 300px)', WebkitOverflowScrolling: 'touch' }}>
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-30 bg-slate-50" style={{ boxShadow: '0 1px 0 0 #e2e8f0' }}>
                  <tr>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-24 sticky left-0 z-40 bg-slate-50 px-3 py-2 text-left">
                      <Button variant="ghost" size="sm" onClick={() => setSortOrder(o => o === 'desc' ? 'asc' : 'desc')} className="h-6 px-1.5 text-xs">
                        Date <ArrowUpDown className="w-3 h-3 ml-1" />
                      </Button>
                    </th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-12 sticky left-24 z-40 bg-slate-50 px-3 py-2 text-left" style={{boxShadow: '2px 0 4px -1px rgba(0,0,0,0.08)'}}>#</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-left">Particular</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-40 px-3 py-2 text-left">From Firm</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-40 px-3 py-2 text-left">To</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-16 px-3 py-2 text-center">Type</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-left">Cheque No</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-red-600 px-3 py-2 text-right">Debit (↑)</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600 px-3 py-2 text-right">Credit (↓)</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 px-3 py-2 text-right">Balance</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-right">Cash Out</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-right">Cash In</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-right">Bank Out</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-right">Bank In</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-left">Assigned To</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-left">Created By</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-left">Remarks</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-center">Status</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-center">Voucher</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-right w-24">Actions</th>
                  </tr>
                </thead>
                <tbody>
                {entriesWithRunningTotal.map((e, idx) => (
                  <tr key={e.id} className="border-b hover:bg-slate-50/50" style={{ contentVisibility: 'auto', containIntrinsicSize: '0 44px' }}>
                    <td className="text-xs text-slate-500 sticky left-0 z-10 bg-white px-3 py-2">{formatDate(e.date)}</td>
                    <td className="text-xs text-slate-400 sticky left-24 z-10 bg-white px-3 py-2" style={{boxShadow: '2px 0 4px -1px rgba(0,0,0,0.08)'}}>{idx + 1}</td>
                    <td className="text-sm text-slate-700 px-3 py-2">{e.particular}</td>
                    <td className="px-3 py-2">
                      {e.is_firm_transaction && e.from_firm_name ? (
                        <span className="text-xs font-medium text-blue-700">{e.from_firm_name}</span>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {e.is_firm_transaction ? (
                        <span className="text-xs font-medium text-emerald-700">{e.to_firm_name || e.to_name || '—'}</span>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                    <td className="text-center px-3 py-2">
                      <Badge variant="outline" className={`text-xs ${getCashType(e.cash_type) === 'cash' ? 'bg-orange-50 text-orange-700 border-orange-200' : getCashType(e.cash_type) === 'cheque' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                        {getCashType(e.cash_type) === 'cash' ? '💵 Cash' : getCashType(e.cash_type) === 'cheque' ? '📝 Cheque' : '🏦 Bank'}
                      </Badge>
                      <ChequeStatusControl
                        chequeStatus={e.cheque_status}
                        source="cash_flow_entry"
                        entryId={e.id}
                        isAdmin={isAdmin}
                        onStatusChange={fetchEntries}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-xs font-mono text-slate-600">{e.cheque_no || '—'}</span>
                    </td>
                    <td className="text-right px-3 py-2">
                      {parseFloat(e.debit) > 0 && (
                        <span className="text-sm font-medium tabular-nums text-red-600">{formatCurrency(e.debit)}</span>
                      )}
                    </td>
                    <td className="text-right px-3 py-2">
                      {parseFloat(e.credit) > 0 && (
                        <span className="text-sm font-medium tabular-nums text-emerald-700">{formatCurrency(e.credit)}</span>
                      )}
                    </td>
                    <td className="text-right px-3 py-2">
                      <span className={`text-sm font-bold tabular-nums ${e.runningTotal > 0 ? 'text-amber-700' : e.runningTotal < 0 ? 'text-red-600' : 'text-slate-400'}`}>
                        {e.runningTotal < 0 && '−'}₹{formatCurrency(Math.abs(e.runningTotal))}
                      </span>
                    </td>
                    <td className="text-right px-3 py-2">
                      {getCashType(e.cash_type) === 'cash' && parseFloat(e.debit) > 0 && (
                        <span className="text-sm font-medium tabular-nums text-orange-600">{formatCurrency(e.debit)}</span>
                      )}
                    </td>
                    <td className="text-right px-3 py-2">
                      {getCashType(e.cash_type) === 'cash' && parseFloat(e.credit) > 0 && (
                        <span className="text-sm font-medium tabular-nums text-green-700">{formatCurrency(e.credit)}</span>
                      )}
                    </td>
                    <td className="text-right px-3 py-2">
                      {(getCashType(e.cash_type) === 'bank' || getCashType(e.cash_type) === 'cheque') && parseFloat(e.debit) > 0 && (
                        <span className="text-sm font-medium tabular-nums text-blue-600">{formatCurrency(e.debit)}</span>
                      )}
                    </td>
                    <td className="text-right px-3 py-2">
                      {(getCashType(e.cash_type) === 'bank' || getCashType(e.cash_type) === 'cheque') && parseFloat(e.credit) > 0 && (
                        <span className="text-sm font-medium tabular-nums text-purple-700">{formatCurrency(e.credit)}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {e.assigned_admin_id ? (
                        <span className="inline-flex items-center text-xs font-medium text-purple-700 bg-purple-50 px-2 py-1 rounded-md">
                          {getAssignedAdminLabel(e) || '—'}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300">Unassigned</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <UserAvatar name={e.created_by_name} label="Created by" />
                    </td>
                    <td className="text-xs text-slate-400 px-3 py-2">{e.remarks}</td>
                    <td className="text-center px-3 py-2"><ApprovalStatusBadge status={e.status} /></td>
                    <td className="text-center px-3 py-2"><VoucherThumbnail url={e.voucher_url} /></td>
                    <td className="text-right px-3 py-2">
                      <div className="flex items-center justify-end gap-0.5">
                        <Button variant="ghost" size="sm" onClick={() => printEntryReceipt(e)} className="h-7 w-7 p-0 text-slate-400 hover:text-blue-600">
                          <Printer className="w-3.5 h-3.5" />
                        </Button>
                        {!selectedLedger.is_locked && (canUpdate || canDelete) && (
                          <>
                            {canUpdate && <Button variant="ghost" size="sm" onClick={() => handleOpenEditEntry(e)} className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700">
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>}
                            {canDelete && <Button variant="ghost" size="sm" onClick={() => handleDeleteEntry(e.id)} className="h-7 w-7 p-0 text-slate-400 hover:text-red-600">
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                </tbody>
                <tfoot className="sticky bottom-0 z-30 bg-slate-100" style={{ boxShadow: '0 -1px 0 0 #e2e8f0' }}>
                  <tr className="border-t-2 border-slate-300">
                    <td className="sticky left-0 z-40 bg-slate-100 px-3 py-3 text-xs font-bold text-slate-900 uppercase">Total</td>
                    <td className="sticky left-24 z-40 bg-slate-100 px-3 py-3" style={{boxShadow: '2px 0 4px -1px rgba(0,0,0,0.08)'}}></td>
                    <td className="px-3 py-3" colSpan={5}></td>
                    <td className="text-right px-3 py-3"><span className="text-sm font-bold tabular-nums text-red-600">₹{formatCurrency(totalDebit)}</span></td>
                    <td className="text-right px-3 py-3"><span className="text-sm font-bold tabular-nums text-emerald-700">₹{formatCurrency(totalCredit)}</span></td>
                    <td className="text-right px-3 py-3">
                      <span className={`text-sm font-bold tabular-nums ${pending > 0 ? 'text-amber-700' : pending < 0 ? 'text-red-600' : 'text-slate-400'}`}>
                        {pending < 0 && '−'}₹{formatCurrency(Math.abs(pending))}
                      </span>
                    </td>
                    <td className="text-right px-3 py-3"><span className="text-sm font-bold tabular-nums text-orange-600">₹{formatCurrency(cashBreakdown.cashDebit)}</span></td>
                    <td className="text-right px-3 py-3"><span className="text-sm font-bold tabular-nums text-green-700">₹{formatCurrency(cashBreakdown.cashCredit)}</span></td>
                    <td className="text-right px-3 py-3"><span className="text-sm font-bold tabular-nums text-blue-600">₹{formatCurrency(cashBreakdown.bankDebit)}</span></td>
                    <td className="text-right px-3 py-3"><span className="text-sm font-bold tabular-nums text-purple-700">₹{formatCurrency(cashBreakdown.bankCredit)}</span></td>
                    <td className="px-3 py-3" colSpan={6}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        )}

        {/* Entry Dialog */}
        <Dialog open={entryDialogOpen} onOpenChange={(open) => { setEntryDialogOpen(open); if (!open) resetEntryForm(); }}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-base">{editingEntryId ? 'Edit Entry' : 'Add Entry'}</DialogTitle>
              <DialogDescription className="text-sm">
                {editingEntryId ? 'Update entry details.' : 'Add a new cash flow entry.'}
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

            <form onSubmit={handleSubmitEntry} className="space-y-4">
              {(() => {
                const isCreateMode = !editingEntryId;
                const hasDebitAmount = (parseFloat(entryForm.debit) || 0) > 0;
                const hasCreditAmount = (parseFloat(entryForm.credit) || 0) > 0;

                return (
                  <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Date *</Label>
                  <Input
                    type="date"
                    value={entryForm.date}
                    onChange={(ev) => setEntryForm({ ...entryForm, date: ev.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Particular *</Label>
                  <Input
                    placeholder="Description..."
                    value={entryForm.particular}
                    onChange={(ev) => setEntryForm({ ...entryForm, particular: ev.target.value })}
                    required
                    list="particular-suggestions"
                  />
                  <datalist id="particular-suggestions">
                    {autocomplete.map((p) => (
                      <option key={p} value={p} />
                    ))}
                  </datalist>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Type *</Label>
                <Select value={entryForm.cash_type} onValueChange={(val) => setEntryForm({ ...entryForm, cash_type: val, ...(val === 'cash' ? { cheque_no: '' } : {}) })}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">💵 Cash</SelectItem>
                    <SelectItem value="bank">🏦 Bank</SelectItem>
                    <SelectItem value="cheque">📝 Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {entryForm.cash_type === 'cheque' && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Cheque No</Label>
                  <Input
                    placeholder="Enter cheque number"
                    value={entryForm.cheque_no || ''}
                    onChange={(ev) => setEntryForm({ ...entryForm, cheque_no: ev.target.value })}
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium flex items-center gap-1">
                    <ArrowUpRight className="w-3 h-3 text-red-500" /> Debit (₹)
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={entryForm.debit}
                    onChange={(ev) => handleDebitChange(ev.target.value)}
                    disabled={hasCreditAmount}
                  />
                  <p className="text-[10px] text-slate-400">Money given to person</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium flex items-center gap-1">
                    <ArrowDownRight className="w-3 h-3 text-emerald-600" /> Credit (₹)
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={entryForm.credit}
                    onChange={(ev) => handleCreditChange(ev.target.value)}
                    disabled={hasDebitAmount}
                  />
                  <p className="text-[10px] text-slate-400">Money received from person</p>
                </div>
              </div>
              {(hasDebitAmount || hasCreditAmount) && (
                <p className="text-[10px] text-slate-500 -mt-2">
                  Enter amount in one side only. Clear the current amount to unlock the other field.
                </p>
              )}

              <div className="space-y-2 rounded-lg border border-slate-200 p-3 bg-slate-50/60">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="cf-firm-transaction"
                    checked={entryForm.is_firm_transaction}
                    onCheckedChange={(checked) => setEntryForm({
                      ...entryForm,
                      is_firm_transaction: Boolean(checked),
                      from_firm_id: '',
                      to_mode: 'name',
                      to_firm_id: '',
                      to_name: '',
                    })}
                  />
                  <Label htmlFor="cf-firm-transaction" className="text-xs font-medium cursor-pointer">
                    From Firm
                  </Label>
                </div>

                {entryForm.is_firm_transaction && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">From Firm *</Label>
                      <Select value={entryForm.from_firm_id} onValueChange={(val) => setEntryForm({ ...entryForm, from_firm_id: val })}>
                        <SelectTrigger className="h-9 bg-white">
                          <SelectValue placeholder={loadingFirms ? 'Loading...' : 'Select firm'} />
                        </SelectTrigger>
                        <SelectContent>
                          {firms.map((f) => (
                            <SelectItem key={f.id} value={`${f.id}`}>{f.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">To Type</Label>
                      <Select value={entryForm.to_mode} onValueChange={(val) => setEntryForm({ ...entryForm, to_mode: val, to_firm_id: '', to_name: '' })}>
                        <SelectTrigger className="h-9 bg-white"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="firm">Firm</SelectItem>
                          <SelectItem value="name">Other Name</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {entryForm.to_mode === 'firm' ? (
                      <div className="space-y-1.5 md:col-span-2">
                        <Label className="text-xs font-medium">To Firm *</Label>
                        <Select value={entryForm.to_firm_id} onValueChange={(val) => setEntryForm({ ...entryForm, to_firm_id: val, to_name: '' })}>
                          <SelectTrigger className="h-9 bg-white">
                            <SelectValue placeholder={loadingFirms ? 'Loading...' : 'Select firm'} />
                          </SelectTrigger>
                          <SelectContent>
                            {firms.map((f) => (
                              <SelectItem key={f.id} value={`${f.id}`}>{f.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <div className="space-y-1.5 md:col-span-2">
                        <Label className="text-xs font-medium">To Name *</Label>
                        <Input
                          placeholder="Party name"
                          value={entryForm.to_name}
                          onChange={(ev) => setEntryForm({ ...entryForm, to_name: ev.target.value.toUpperCase(), to_firm_id: '' })}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

                  </>
                );
              })()}

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Remarks</Label>
                <Textarea
                  placeholder="Optional notes..."
                  value={entryForm.remarks}
                  onChange={(ev) => setEntryForm({ ...entryForm, remarks: ev.target.value })}
                  rows={2}
                />
              </div>

              {(isAdmin || canManage) && approvers.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Assign To Admin</Label>
                  <Select
                    value={entryForm.assigned_admin_id?.toString() || '_none'}
                    onValueChange={(val) => setEntryForm({ ...entryForm, assigned_admin_id: val === '_none' ? null : parseInt(val) })}
                  >
                    <SelectTrigger className="h-9 bg-white">
                      <SelectValue placeholder="Select approver..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">- None -</SelectItem>
                      {approvers.map((app) => (
                        <SelectItem key={app.id} value={app.id.toString()}>
                          {app.full_name || app.name || app.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Voucher</Label>
                <VoucherUpload
                  value={entryForm.voucher_url}
                  onChange={(url) => setEntryForm({ ...entryForm, voucher_url: url })}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" size="sm" onClick={() => setEntryDialogOpen(false)} disabled={submitting}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      {editingEntryId ? 'Updating...' : 'Adding...'}
                    </>
                  ) : (
                    editingEntryId ? 'Update' : 'Add Entry'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Analytics Modal */}
        <Dialog open={analyticsDialogOpen} onOpenChange={setAnalyticsDialogOpen}>
          <DialogContent className="sm:max-w-5xl">
            <DialogHeader>
              <DialogTitle className="text-base">Ledger Analytics</DialogTitle>
              <DialogDescription className="text-sm">
                Visual summary for {selectedLedger?.ledger_name} showing debit/credit distribution and recent trend.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="shadow-none border-slate-200 bg-linear-to-br from-slate-50 via-white to-blue-50/40">
                <CardContent className="p-4">
                  <p className="text-sm font-semibold text-slate-700 mb-3">Cash vs Bank</p>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={modeChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                        <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                        <Tooltip formatter={(value) => `₹${formatCurrency(value)}`} />
                        <Legend />
                        <Bar dataKey="debit" name="Debit" fill="#ef4444" radius={[6, 6, 0, 0]} />
                        <Bar dataKey="credit" name="Credit" fill="#10b981" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-none border-slate-200 bg-linear-to-br from-slate-50 via-white to-emerald-50/40">
                <CardContent className="p-4">
                  <p className="text-sm font-semibold text-slate-700 mb-3">Given vs Returned</p>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={flowPieData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={52}
                          outerRadius={88}
                          paddingAngle={2}
                        >
                          {flowPieData.map((item) => (
                            <Cell key={item.name} fill={item.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => `₹${formatCurrency(value)}`} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="shadow-none border-slate-200 bg-linear-to-br from-slate-50 via-white to-indigo-50/40">
              <CardContent className="p-4">
                <p className="text-sm font-semibold text-slate-700 mb-3">Recent Trend (Last 12 Dates)</p>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trendChartData} margin={{ top: 8, right: 8, left: 0, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} angle={-25} textAnchor="end" height={50} interval={0} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                      <Tooltip formatter={(value) => `₹${formatCurrency(value)}`} />
                      <Legend />
                      <Bar dataKey="debit" name="Debit" fill="#f97316" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="credit" name="Credit" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <DialogFooter>
              <Button variant="outline" onClick={() => setAnalyticsDialogOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════
  //  LEDGERS LIST VIEW
  // ═══════════════════════════════════════════════════
  return (
    <div className="w-full max-w-full md:max-w-7xl space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Person-wise Ledgers</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Cash flow ledgers for <span className="font-medium text-slate-700">{currentSite.name}</span>
          </p>
        </div>
        {canWrite && (
          <Button size="sm" onClick={handleOpenCreateLedger}>
            <Plus className="w-4 h-4 mr-1.5" /> New Person Ledger
          </Button>
        )}
      </div>

      {/* Ledger Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
        </div>
      ) : ledgers.length === 0 ? (
        <div className="text-center py-16">
          <User className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No person ledgers created yet</p>
        </div>
      ) : (
        <Card className="shadow-none border-slate-200 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/60">
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Person / Entity</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Reference</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right">Given</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right">Returned</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right">Pending</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right">Cash Given</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right">Cash Recv</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right">Cash Pending</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right">Bank Given</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right">Bank Recv</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right">Bank Pending</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-center">Status</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-center">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ledgers.map((ledger) => {
                const tDebit = parseFloat(ledger.total_debit) || 0;
                const tCredit = parseFloat(ledger.total_credit) || 0;
                const pending = tDebit - tCredit;
                const cashGiven = parseFloat(ledger.cash_given) || 0;
                const cashRecv = parseFloat(ledger.cash_received) || 0;
                const cashPending = cashGiven - cashRecv;
                const bankGiven = parseFloat(ledger.bank_given) || 0;
                const bankRecv = parseFloat(ledger.bank_received) || 0;
                const bankPending = bankGiven - bankRecv;

                return (
                  <TableRow
                    key={ledger.id}
                    className="cursor-pointer hover:bg-slate-50/60"
                    onClick={() => navigate(`/cashflow/${ledger.id}`)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-md flex items-center justify-center bg-blue-50">
                          <User className="w-3.5 h-3.5 text-blue-600" />
                        </div>
                        <span className="text-sm font-semibold text-slate-900">{ledger.ledger_name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {MONTH_NAMES[ledger.month]} {ledger.year} · {ledger.entry_count} entries
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-sm font-semibold tabular-nums text-slate-900">₹{formatCurrency(tDebit)}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-sm font-semibold tabular-nums text-slate-900">₹{formatCurrency(tCredit)}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`text-sm font-bold tabular-nums ${pending < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                        ₹{formatCurrency(Math.abs(pending))}
                      </span>
                      <div className={`text-[10px] ${pending < 0 ? 'text-red-500' : 'text-slate-500'}`}>
                        {pending >= 0 ? 'To Receive' : 'To Give'}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-xs font-medium tabular-nums text-slate-700">₹{formatCurrency(cashGiven)}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-xs font-medium tabular-nums text-slate-700">₹{formatCurrency(cashRecv)}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`text-xs font-semibold tabular-nums ${cashPending < 0 ? 'text-red-600' : cashPending > 0 ? 'text-slate-900' : 'text-slate-400'}`}>
                        {cashPending < 0 ? `-₹${formatCurrency(Math.abs(cashPending))}` : `₹${formatCurrency(cashPending)}`}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-xs font-medium tabular-nums text-slate-700">₹{formatCurrency(bankGiven)}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-xs font-medium tabular-nums text-slate-700">₹{formatCurrency(bankRecv)}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`text-xs font-semibold tabular-nums ${bankPending < 0 ? 'text-red-600' : bankPending > 0 ? 'text-slate-900' : 'text-slate-400'}`}>
                        {bankPending < 0 ? `-₹${formatCurrency(Math.abs(bankPending))}` : `₹${formatCurrency(bankPending)}`}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {ledger.is_locked ? (
                        <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300 bg-amber-50">Locked</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-300 bg-emerald-50">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/cashflow/${ledger.id}`);
                        }}
                      >
                        Open
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            {/* Cumulative Totals */}
            {(() => {
              const cumGiven = ledgers.reduce((s, l) => s + (parseFloat(l.total_debit) || 0), 0);
              const cumReturned = ledgers.reduce((s, l) => s + (parseFloat(l.total_credit) || 0), 0);
              const cumPending = cumGiven - cumReturned;
              const cumCashGiven = ledgers.reduce((s, l) => s + (parseFloat(l.cash_given) || 0), 0);
              const cumCashRecv = ledgers.reduce((s, l) => s + (parseFloat(l.cash_received) || 0), 0);
              const cumCashPending = cumCashGiven - cumCashRecv;
              const cumBankGiven = ledgers.reduce((s, l) => s + (parseFloat(l.bank_given) || 0), 0);
              const cumBankRecv = ledgers.reduce((s, l) => s + (parseFloat(l.bank_received) || 0), 0);
              const cumBankPending = cumBankGiven - cumBankRecv;
              return (
                <tfoot>
                  <tr className="border-t-2 border-slate-300 bg-slate-50">
                    <td className="px-4 py-3 text-sm font-bold text-slate-900" colSpan={2}>Total</td>
                    <td className="px-4 py-3 text-right text-sm font-bold tabular-nums text-slate-900">₹{formatCurrency(cumGiven)}</td>
                    <td className="px-4 py-3 text-right text-sm font-bold tabular-nums text-slate-900">₹{formatCurrency(cumReturned)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-sm font-bold tabular-nums ${cumPending < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                        ₹{formatCurrency(Math.abs(cumPending))}
                      </span>
                      <div className={`text-[10px] ${cumPending < 0 ? 'text-red-500' : 'text-slate-500'}`}>
                        {cumPending >= 0 ? 'To Receive' : 'To Give'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-bold tabular-nums text-slate-900">₹{formatCurrency(cumCashGiven)}</td>
                    <td className="px-4 py-3 text-right text-xs font-bold tabular-nums text-slate-900">₹{formatCurrency(cumCashRecv)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-xs font-bold tabular-nums ${cumCashPending < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                        {cumCashPending < 0 ? `-₹${formatCurrency(Math.abs(cumCashPending))}` : `₹${formatCurrency(cumCashPending)}`}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-bold tabular-nums text-slate-900">₹{formatCurrency(cumBankGiven)}</td>
                    <td className="px-4 py-3 text-right text-xs font-bold tabular-nums text-slate-900">₹{formatCurrency(cumBankRecv)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-xs font-bold tabular-nums ${cumBankPending < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                        {cumBankPending < 0 ? `-₹${formatCurrency(Math.abs(cumBankPending))}` : `₹${formatCurrency(cumBankPending)}`}
                      </span>
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              );
            })()}
          </Table>
        </Card>
      )}

      {/* Ledger Dialog */}
      <Dialog open={ledgerDialogOpen} onOpenChange={(open) => { setLedgerDialogOpen(open); if (!open) resetLedgerForm(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Create Person Ledger</DialogTitle>
            <DialogDescription className="text-sm">
              Create a new ledger for tracking cash flow with a person or entity. You can add entries from any date range to this ledger.
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

          <form onSubmit={handleSubmitLedger} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Person / Entity Name *</Label>
              <Input
                placeholder="e.g., OM ASSOCIATES, RAVI BHAI, KULDEEP MAIN"
                value={ledgerForm.ledger_name}
                onChange={(ev) => setLedgerForm({ ...ledgerForm, ledger_name: ev.target.value.toUpperCase() })}
                required
              />
              <p className="text-[10px] text-slate-400">Enter the name of the person or entity this ledger is for</p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs font-medium text-blue-900 mb-2">ℹ️ How it works:</p>
              <ul className="text-xs text-blue-800 space-y-1">
                <li>• Create a ledger for each person/entity you track</li>
                <li>• Add entries from any date (not limited by month)</li>
                <li>• Track money given (Debit) and returned (Credit)</li>
                <li>• Pending = Total Given - Total Returned</li>
              </ul>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setLedgerDialogOpen(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Ledger'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CashFlow;
