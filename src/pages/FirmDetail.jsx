import React, { useState, useEffect, useMemo, useCallback, useRef, useDeferredValue } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useParams, useNavigate } from 'react-router-dom';
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
  Filter, X, Download, Printer, Upload, ArrowLeftRight, ArrowUpDown,
} from 'lucide-react';
import VoucherUpload, { VoucherThumbnail } from '../components/VoucherUpload';
import ApprovalStatusBadge from '../components/ApprovalStatusBadge';

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

const fmt = (n) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const fmtDate = (d) => {
  if (!d) return '—';
  const normalized = normalizeDateKey(d);
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    const [y, m, day] = normalized.split('-');
    return `${day}/${m}/${y}`;
  }
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const normalizeHeader = (key = '') => key.toString().trim().toLowerCase().replace(/[^a-z0-9]/g, '');

const parseAmount = (value) => {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;

  const raw = value.toString().trim();
  if (!raw) return 0;

  const isNegative = raw.includes('(') && raw.includes(')');
  const cleaned = raw.replace(/,/g, '').replace(/[()]/g, '').replace(/\s*(dr|cr)$/i, '').trim();
  const parsed = parseFloat(cleaned);
  if (!Number.isFinite(parsed)) return 0;
  return isNegative ? -parsed : parsed;
};

const parseExcelDateToISO = (value) => {
  if (!value) return todayISO();

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed?.y && parsed?.m && parsed?.d) {
      const month = String(parsed.m).padStart(2, '0');
      const day = String(parsed.d).padStart(2, '0');
      return `${parsed.y}-${month}-${day}`;
    }
  }

  const asText = value.toString().trim();
  const ddmmyyyy = asText.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if (ddmmyyyy) {
    const day = Number(ddmmyyyy[1]);
    const month = Number(ddmmyyyy[2]);
    let year = Number(ddmmyyyy[3]);
    if (year < 100) year += 2000;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  const yyyymmdd = asText.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
  if (yyyymmdd) {
    const year = Number(yyyymmdd[1]);
    const month = Number(yyyymmdd[2]);
    const day = Number(yyyymmdd[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  const asDate = new Date(asText);
  if (!Number.isNaN(asDate.getTime())) {
    const y = asDate.getFullYear();
    const m = String(asDate.getMonth() + 1).padStart(2, '0');
    const d = String(asDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return todayISO();
};

const normalizeDateKey = (value) => {
  if (!value) return '';

  if (typeof value === 'string') {
    const raw = value.trim();
    if (!raw) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) return raw.slice(0, 10);
  }

  return parseExcelDateToISO(value);
};

const normalizeTxnText = (value) => (value || '').toString().trim().replace(/\s+/g, ' ').toUpperCase();

const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;

const buildTxnExactKey = (txn) => {
  return [
    normalizeDateKey(txn.date),
    normalizeTxnText(txn.description),
    round2(txn.debit).toFixed(2),
    round2(txn.credit).toFixed(2),
  ].join('|');
};

const buildTxnBaseKey = (txn) => {
  return [
    normalizeDateKey(txn.date),
    normalizeTxnText(txn.description),
  ].join('|');
};

// ── Virtualized transaction row ───────────────────────────────────────────
// Memoized so it only re-renders when its row data, balance, or capabilities
// change. With virtualization there are typically 25–40 rows live at once,
// so the cumulative React work stays under a millisecond regardless of how
// many txns the firm has.
const TxnRow = React.memo(function TxnRow({
  t, idx, canUpdate, canDelete, onEdit, onDelete,
  fmtDate, fmt, getRemarkBadge,
}) {
  return (
    <tr className="border-b border-slate-100 transition-colors hover:bg-slate-50">
      <td className="p-2 align-middle text-xs text-slate-400 font-mono">{idx + 1}</td>
      <td className="p-2 align-middle text-sm text-slate-700">{fmtDate(t.date)}</td>
      <td className="p-2 align-middle text-sm text-slate-700">{fmtDate(t.date)}</td>
      <td className="p-2 align-middle text-sm text-slate-700 font-mono">{t.cheque_no || '—'}</td>
      <td className="p-2 align-middle text-sm text-slate-800">{t.description}</td>
      <td className="p-2 align-middle text-right text-sm font-semibold text-red-600 tabular-nums">{t.debit ? `₹${fmt(t.debit)}` : '—'}</td>
      <td className="p-2 align-middle text-right text-sm font-semibold text-emerald-700 tabular-nums">{t.credit ? `₹${fmt(t.credit)}` : '—'}</td>
      <td className="p-2 align-middle text-right text-sm font-medium tabular-nums">{fmt(t.balance)}</td>
      <td className="p-2 align-middle text-sm text-slate-700">{t.name || '—'}</td>
      <td className="p-2 align-middle text-sm text-slate-600">{t.purpose || '—'}</td>
      <td className="p-2 align-middle">{t.remark ? getRemarkBadge(t.remark) : '—'}</td>
      <td className="p-2 align-middle text-sm text-slate-600">{t.remark2 || '—'}</td>
      {(canUpdate || canDelete) && (
        <td className="p-2 align-middle text-right">
          <div className="flex items-center justify-end gap-0.5">
            {canUpdate && (
              <Button variant="ghost" size="sm" onClick={() => onEdit(t)} className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700">
                <Edit2 className="w-3.5 h-3.5" />
              </Button>
            )}
            {canDelete && (
              <Button variant="ghost" size="sm" onClick={() => onDelete(t.id)} className="h-7 w-7 p-0 text-slate-400 hover:text-red-600">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </td>
      )}
    </tr>
  );
});

// ── Virtualized table ─────────────────────────────────────────────────────
// Uses @tanstack/react-virtual with the "padding rows" pattern: only ~25–40
// rows are rendered as real DOM nodes at any time, with two spacer <tr>s
// taking up the height of off-screen rows above and below. Native <table>
// column alignment is preserved between thead/tbody/tfoot.
const VirtualizedTxnTable = ({
  filteredTxns, totals,
  canUpdate, canDelete,
  onEdit, onDelete, setSortOrder,
  fmtDate, fmt, getRemarkBadge,
}) => {
  const parentRef = useRef(null);

  const rowVirtualizer = useVirtualizer({
    count: filteredTxns.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,
    overscan: 12,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();
  const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
  const paddingBottom = virtualItems.length > 0 ? totalSize - virtualItems[virtualItems.length - 1].end : 0;

  const colCount = (canUpdate || canDelete) ? 13 : 12;

  return (
    <div ref={parentRef} className="overflow-auto" style={{ maxHeight: '70vh' }}>
      <table className="w-full caption-bottom text-sm">
        <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-sm shadow-[0_1px_0_0_rgba(226,232,240,1)]">
          <tr>
            <th className="h-10 px-2 text-left align-middle text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-8">No</th>
            <th className="h-10 px-2 text-left align-middle text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-24">
              <Button variant="ghost" size="sm" onClick={() => setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))} className="h-6 px-1.5 text-xs">
                Date <ArrowUpDown className="w-3 h-3 ml-1" />
              </Button>
            </th>
            <th className="h-10 px-2 text-left align-middle text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-20">Txn Posted Date</th>
            <th className="h-10 px-2 text-left align-middle text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-24">Cheque Number</th>
            <th className="h-10 px-2 text-left align-middle text-[11px] font-semibold uppercase tracking-wider text-slate-500">Description</th>
            <th className="h-10 px-2 text-right align-middle text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-24">Debit Amount</th>
            <th className="h-10 px-2 text-right align-middle text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-24">Credit Amount</th>
            <th className="h-10 px-2 text-right align-middle text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-24">Available Balance</th>
            <th className="h-10 px-2 text-left align-middle text-[11px] font-semibold uppercase tracking-wider text-slate-500">Name</th>
            <th className="h-10 px-2 text-left align-middle text-[11px] font-semibold uppercase tracking-wider text-slate-500">Purpose</th>
            <th className="h-10 px-2 text-left align-middle text-[11px] font-semibold uppercase tracking-wider text-slate-500">Remark</th>
            <th className="h-10 px-2 text-left align-middle text-[11px] font-semibold uppercase tracking-wider text-slate-500">Remark 2</th>
            {(canUpdate || canDelete) && (
              <th className="h-10 px-2 text-right align-middle text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-20">Actions</th>
            )}
          </tr>
        </thead>
        <tbody>
          {paddingTop > 0 && (
            <tr aria-hidden="true"><td colSpan={colCount} style={{ height: paddingTop, padding: 0, border: 0 }} /></tr>
          )}
          {virtualItems.map((virtualRow) => {
            const t = filteredTxns[virtualRow.index];
            return (
              <TxnRow
                key={t.id}
                t={t}
                idx={virtualRow.index}
                canUpdate={canUpdate}
                canDelete={canDelete}
                onEdit={onEdit}
                onDelete={onDelete}
                fmtDate={fmtDate}
                fmt={fmt}
                getRemarkBadge={getRemarkBadge}
              />
            );
          })}
          {paddingBottom > 0 && (
            <tr aria-hidden="true"><td colSpan={colCount} style={{ height: paddingBottom, padding: 0, border: 0 }} /></tr>
          )}
        </tbody>
        <tfoot className="sticky bottom-0 z-10">
          <tr className="border-t-2 border-slate-300 bg-slate-50">
            <td className="p-2 align-middle text-sm font-bold text-slate-900" colSpan={5}>Total</td>
            <td className="p-2 align-middle text-right text-sm font-bold tabular-nums text-red-600">₹{fmt(totals.cumDebit)}</td>
            <td className="p-2 align-middle text-right text-sm font-bold tabular-nums text-emerald-700">₹{fmt(totals.cumCredit)}</td>
            <td className="p-2 align-middle text-right">
              <span className={`text-sm font-bold tabular-nums ${totals.cumPending < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                {totals.cumPending < 0 && '−'}₹{fmt(Math.abs(totals.cumPending))}
              </span>
            </td>
            <td className="p-2 align-middle" colSpan={(canUpdate || canDelete) ? 5 : 4}></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

const FirmDetail = () => {
  const navigate = useNavigate();
  const { id: firmId } = useParams();
  const { currentSite, sites, isAdmin, canManage, hasPermission } = useAuth();
  const canWrite  = canManage && hasPermission('firm_transactions', 'write');
  const canUpdate = canManage && hasPermission('firm_transactions', 'update');
  const canDelete = canManage && hasPermission('firm_transactions', 'delete');

  const [firm, setFirm] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [remarkBreakdown, setRemarkBreakdown] = useState([]);
  const [nameBreakdown, setNameBreakdown] = useState([]);
  const [autocomplete, setAutocomplete] = useState({ names: [], purposes: [], remarks: [] });
  const [loading, setLoading] = useState(true);
  const [loadingTxns, setLoadingTxns] = useState(false);
  const [approvers, setApprovers] = useState([]);

  const [txnDialogOpen, setTxnDialogOpen] = useState(false);
  const [editingTxnId, setEditingTxnId] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [submitting, setSubmitting] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferSubmitting, setTransferSubmitting] = useState(false);
  const [transferMessage, setTransferMessage] = useState({ type: '', text: '' });
  const [transferTargetFirms, setTransferTargetFirms] = useState([]);
  const [transferTargetLoading, setTransferTargetLoading] = useState(false);
  const [transferForm, setTransferForm] = useState({
    to_site_id: currentSite?.id ? String(currentSite.id) : '',
    to_firm_id: '',
    amount: '',
    payment_mode: 'bank',
    description: '',
    purpose: 'FIRM TO FIRM TRANSFER',
    remark: 'FIRM TO FIRM TRANSFER',
    cheque_no: '',
    assigned_admin_id: null,
  });
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importMessage, setImportMessage] = useState({ type: '', text: '' });
  const [importPreview, setImportPreview] = useState([]);
  const [compareDialogOpen, setCompareDialogOpen] = useState(false);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareMessage, setCompareMessage] = useState({ type: '', text: '' });
  const [comparePreview, setComparePreview] = useState([]);
  const [compareViewMode, setCompareViewMode] = useState('issues');
  const [compareResult, setCompareResult] = useState({
    fileRows: 0,
    validRows: 0,
    skippedRows: 0,
    exactMatches: 0,
    newRows: [],
    amountDiffRows: [],
    missingInFileRows: [],
    comparisonRows: [],
  });

  const COMPARE_RENDER_CAP = 500;
  const compareRowsFiltered = useMemo(() => {
    if (compareViewMode === 'all') return compareResult.comparisonRows;
    return compareResult.comparisonRows.filter((row) => row.status !== 'matched');
  }, [compareResult.comparisonRows, compareViewMode]);
  const compareRowsForDisplay = useMemo(
    () => compareRowsFiltered.slice(0, COMPARE_RENDER_CAP),
    [compareRowsFiltered],
  );
  const compareRowsHidden = compareRowsFiltered.length - compareRowsForDisplay.length;

  const [searchQuery, setSearchQuery] = useState('');
  const [filterRemark, setFilterRemark] = useState('all');
  const [filterRemark2, setFilterRemark2] = useState('all');
  const [filterName, setFilterName] = useState('all');
  const [filterPeriod, setFilterPeriod] = useState('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');
  const [breakdownOpen, setBreakdownOpen] = useState(true);
  const [breakdownTab, setBreakdownTab] = useState('remark');

  const [txnForm, setTxnForm] = useState({
    date: todayISO(),
    payment_mode: 'cash',
    cheque_no: '',
    transaction_no: '',
    description: '',
    debit: '',
    credit: '',
    name: '',
    purpose: '',
    remark: '',
    remark2: '',
    voucher_url: '',
    assigned_admin_id: null,
  });

  // Fetch firm details
  useEffect(() => {
    const fetchFirm = async () => {
      try {
        setLoading(true);
        // Watchdog so the spinner can never hang on a stalled request.
        const watchdog = setTimeout(() => setLoading(false), 15000);
        const res = await api.get(`/firms/${firmId}`);
        clearTimeout(watchdog);
        setFirm(res.data?.firm || res.data || null);
      } catch (error) {
        console.error('Error fetching firm:', error);
      } finally {
        setLoading(false);
      }
    };
    if (firmId) fetchFirm();
  }, [firmId]);

  const fetchTransactions = useCallback(async () => {
    try {
      setLoadingTxns(true);
      const watchdog = setTimeout(() => setLoadingTxns(false), 15000);
      const res = await api.get(`/firms/transactions/list?firm_id=${firmId}`);
      clearTimeout(watchdog);
      setTransactions(res.data.transactions || []);
      // Fallback: transaction list API includes firm metadata; use it if main firm fetch missed shape mapping.
      if (res.data?.firm) {
        setFirm((prev) => {
          if (prev?.name) return prev;
          return { ...(prev || {}), ...(res.data.firm || {}) };
        });
      }
      setRemarkBreakdown(res.data.remarkable || []);
      setNameBreakdown(res.data.nameBreakdown || []);
      setAutocomplete(res.data.autocomplete || { names: [], purposes: [], remarks: [] });
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoadingTxns(false);
    }
  }, [firmId]);

  // Background refresh — does NOT toggle loaders. Used after every mutation
  // so the dialog can close instantly while the list reconciles.
  const refreshTransactions = useCallback(async () => {
    try {
      const res = await api.get(`/firms/transactions/list?firm_id=${firmId}`);
      setTransactions(res.data.transactions || []);
      if (res.data?.firm) {
        setFirm((prev) => ({ ...(prev || {}), ...res.data.firm }));
      }
      setRemarkBreakdown(res.data.remarkable || []);
      setNameBreakdown(res.data.nameBreakdown || []);
    } catch { /* keep current */ }
  }, [firmId]);

  // Fetch transactions
  useEffect(() => {
    if (!firmId) return;
    fetchTransactions();
  }, [firmId, fetchTransactions]);

  useEffect(() => {
    if (!currentSite?.id) {
      setApprovers([]);
      return;
    }
    api.get(`/admin/approvers?site_id=${currentSite.id}`)
      .then((res) => setApprovers(res.data.approvers || []))
      .catch(() => setApprovers([]));
  }, [currentSite?.id]);

  const getAssignedAdminLabel = (entry) => {
    if (entry?.assigned_admin_name) return entry.assigned_admin_name;
    const assignedId = entry?.assigned_admin_id;
    if (!assignedId) return null;
    const approver = approvers.find((a) => String(a.id) === String(assignedId));
    return approver?.full_name || approver?.name || approver?.email || `Admin #${assignedId}`;
  };

  const openingBal = parseFloat(firm?.opening_balance) || 0;
  const totalDebit = transactions.reduce((acc, t) => acc + (parseFloat(t.debit) || 0), 0);
  const totalCredit = transactions.reduce((acc, t) => acc + (parseFloat(t.credit) || 0), 0);
  const closingBal = openingBal + totalCredit - totalDebit;

  const modeTotals = useMemo(() => {
    let cashIn = 0, cashOut = 0, bankIn = 0, bankOut = 0;
    transactions.forEach((t) => {
      const paymentMode = ['bank', 'cheque'].includes((t.payment_mode || 'cash').toLowerCase()) ? 'bank' : 'cash';
      const debitAmt = parseFloat(t.debit) || 0;
      const creditAmt = parseFloat(t.credit) || 0;
      if (paymentMode === 'cash') {
        cashIn += creditAmt;
        cashOut += debitAmt;
      } else {
        bankIn += creditAmt;
        bankOut += debitAmt;
      }
    });
    return { cashIn, cashOut, bankIn, bankOut };
  }, [transactions]);

  const txnsWithBalance = useMemo(() => {
    let runningBal = openingBal;
    return transactions.map((t) => {
      const debitAmt = parseFloat(t.debit) || 0;
      const creditAmt = parseFloat(t.credit) || 0;
      runningBal = runningBal + creditAmt - debitAmt;
      return { ...t, balance: runningBal };
    });
  }, [transactions, openingBal]);

  const uniqueNames = useMemo(() => {
    return [...new Set(transactions.map((t) => t.name).filter((n) => n))].sort();
  }, [transactions]);

  const uniqueRemarks = useMemo(() => {
    return [...new Set(transactions.map((t) => t.remark).filter((r) => r))].sort();
  }, [transactions]);

  const uniqueRemarks2 = useMemo(() => {
    return [...new Set(transactions.map((t) => t.remark2).filter((r) => r))].sort();
  }, [transactions]);

  // useDeferredValue keeps the search input snappy while the heavy filter pass
  // re-runs in a low-priority render. Typing stays at 60fps even for 5k+ rows.
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const filteredTxns = useMemo(() => {
    const q = deferredSearchQuery ? deferredSearchQuery.toLowerCase() : '';
    const dateFromTs = filterDateFrom ? new Date(filterDateFrom).getTime() : null;
    const dateToTs = filterDateTo ? new Date(filterDateTo).getTime() : null;
    const list = txnsWithBalance.filter((t) => {
      if (filterName !== 'all' && t.name !== filterName) return false;
      if (filterRemark !== 'all' && t.remark !== filterRemark) return false;
      if (filterRemark2 !== 'all' && t.remark2 !== filterRemark2) return false;
      if (dateFromTs !== null || dateToTs !== null) {
        const ts = new Date(t.date).getTime();
        if (dateFromTs !== null && ts < dateFromTs) return false;
        if (dateToTs !== null && ts > dateToTs) return false;
      }
      if (q && !t.description?.toLowerCase().includes(q)) return false;
      return true;
    });
    if (sortOrder === 'asc') list.reverse();
    return list;
  }, [txnsWithBalance, filterName, filterRemark, filterRemark2, filterDateFrom, filterDateTo, deferredSearchQuery, sortOrder]);

  const filteredCumulativeTotals = useMemo(() => {
    let cumDebit = 0;
    let cumCredit = 0;
    for (let i = 0; i < filteredTxns.length; i++) {
      const t = filteredTxns[i];
      cumDebit += parseFloat(t.debit) || 0;
      cumCredit += parseFloat(t.credit) || 0;
    }
    return { cumDebit, cumCredit, cumPending: cumCredit - cumDebit };
  }, [filteredTxns]);

  const filteredModeTotals = useMemo(() => {
    let cashIn = 0, cashOut = 0, bankIn = 0, bankOut = 0;
    filteredTxns.forEach((t) => {
      const paymentMode = (t.payment_mode || 'cash').toLowerCase() === 'bank' ? 'bank' : 'cash';
      const debitAmt = parseFloat(t.debit) || 0;
      const creditAmt = parseFloat(t.credit) || 0;
      if (paymentMode === 'cash') {
        cashIn += creditAmt;
        cashOut += debitAmt;
      } else {
        bankIn += creditAmt;
        bankOut += debitAmt;
      }
    });
    return { cashIn, cashOut, bankIn, bankOut };
  }, [filteredTxns]);

  const hasActiveFilters = filterPeriod !== 'all' || filterDateFrom || filterDateTo || filterName !== 'all' || filterRemark !== 'all' || filterRemark2 !== 'all' || searchQuery;

  const handlePeriodChange = (period) => {
    setFilterPeriod(period);
    if (period === 'all') {
      setFilterDateFrom('');
      setFilterDateTo('');
    } else if (period === 'today') {
      const today = todayISO();
      setFilterDateFrom(today);
      setFilterDateTo(today);
    } else if (period === 'week') {
      const today = new Date();
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      setFilterDateFrom(weekAgo.toISOString().split('T')[0]);
      setFilterDateTo(today.toISOString().split('T')[0]);
    } else if (period === 'month') {
      const today = new Date();
      const monthAgo = new Date(today.getFullYear(), today.getMonth(), 1);
      setFilterDateFrom(monthAgo.toISOString().split('T')[0]);
      setFilterDateTo(today.toISOString().split('T')[0]);
    } else if (period === 'last_month') {
      const today = new Date();
      const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastDayOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      setFilterDateFrom(lastMonth.toISOString().split('T')[0]);
      setFilterDateTo(lastDayOfLastMonth.toISOString().split('T')[0]);
    }
  };

  const clearAllFilters = () => {
    setFilterPeriod('all');
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterName('all');
    setFilterRemark('all');
    setFilterRemark2('all');
    setSearchQuery('');
  };

  const resetTxnForm = () => {
    setTxnForm({
      date: todayISO(),
      payment_mode: 'cash',
      cheque_no: '',
      transaction_no: '',
      description: '',
      debit: '',
      credit: '',
      name: '',
      purpose: '',
      remark: '',
      remark2: '',
      voucher_url: '',
      assigned_admin_id: null,
    });
    setEditingTxnId(null);
    setMessage({ type: '', text: '' });
  };

  const handleOpenAddTxn = () => {
    resetTxnForm();
    setTxnDialogOpen(true);
  };

  const resetTransferForm = () => {
    setTransferForm({
      to_site_id: currentSite?.id ? String(currentSite.id) : '',
      to_firm_id: '',
      amount: '',
      payment_mode: 'bank',
      description: '',
      purpose: 'FIRM TO FIRM TRANSFER',
      remark: 'FIRM TO FIRM TRANSFER',
      cheque_no: '',
      assigned_admin_id: null,
    });
    setTransferMessage({ type: '', text: '' });
    setTransferTargetFirms([]);
  };

  const handleOpenFirmTransfer = () => {
    resetTransferForm();
    setTransferDialogOpen(true);
  };

  const handleOpenEditTxn = (data) => {
    setTxnForm({
      ...data,
      date: data?.date ? normalizeDateKey(data.date) : todayISO(),
    });
    setEditingTxnId(data.id);
    setTxnDialogOpen(true);
  };

  const handleSubmitTxn = async (e) => {
    e.preventDefault();
    if (!txnForm.description.trim() || (!txnForm.debit && !txnForm.credit)) {
      setMessage({ type: 'error', text: 'Please fill required fields' });
      return;
    }

    const payload = {
      ...txnForm,
      firm_id: firmId,
      date: editingTxnId ? (txnForm.date || todayISO()) : todayISO(),
    };

    // ── Optimistic UI: splice the txn locally and close the dialog BEFORE
    //    the network call. Snapshot is restored on failure. ──
    const snapshotTxns = transactions;
    const targetEditing = editingTxnId;
    const isCreate = !targetEditing;

    if (isCreate) {
      const tempId = -Date.now();
      setTransactions((prev) => [
        ...prev,
        {
          id: tempId,
          firm_id: firmId,
          ...payload,
          status: 'pending',
          created_at: new Date().toISOString(),
        },
      ]);
    } else {
      setTransactions((prev) => prev.map((t) => (t.id === targetEditing ? { ...t, ...payload } : t)));
    }
    setTxnDialogOpen(false);
    resetTxnForm();

    setSubmitting(true);
    try {
      if (targetEditing) {
        await api.put(`/firms/transactions/${targetEditing}`, payload);
        setMessage({ type: 'success', text: 'Transaction updated!' });
      } else {
        await api.post('/firms/transactions', payload);
        setMessage({ type: 'success', text: 'Transaction added!' });
      }
      // Reconcile in the background — replaces temp negative-id row with the
      // canonical record, refreshes breakdowns + summary.
      refreshTransactions();
    } catch (error) {
      setTransactions(snapshotTxns); // rollback
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to save transaction' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTxn = async (txnId) => {
    if (!window.confirm('Delete this transaction?')) return;
    // Optimistic removal — instant UI feedback. Roll back on failure.
    const snapshotTxns = transactions;
    setTransactions((prev) => prev.filter((t) => t.id !== txnId));
    try {
      await api.delete(`/firms/transactions/${txnId}`);
      refreshTransactions();
    } catch (error) {
      setTransactions(snapshotTxns); // rollback
      console.error('Error deleting transaction:', error);
    }
  };

  useEffect(() => {
    if (!transferDialogOpen || !transferForm.to_site_id) {
      setTransferTargetFirms([]);
      setTransferTargetLoading(false);
      return;
    }

    let cancelled = false;
    const fetchTargetFirms = async () => {
      setTransferTargetLoading(true);
      try {
        const res = await api.get(`/firms?site_id=${transferForm.to_site_id}`);
        const sourceFirmId = String(firm?.id || firmId);
        const targetList = (res.data?.firms || []).filter((f) => String(f.id) !== sourceFirmId);
        if (!cancelled) {
          setTransferTargetFirms(targetList);
          setTransferForm((prev) => {
            if (!prev.to_firm_id) return prev;
            const exists = targetList.some((f) => String(f.id) === String(prev.to_firm_id));
            return exists ? prev : { ...prev, to_firm_id: '' };
          });
        }
      } catch {
        if (!cancelled) setTransferTargetFirms([]);
      } finally {
        if (!cancelled) setTransferTargetLoading(false);
      }
    };

    fetchTargetFirms();
    return () => {
      cancelled = true;
    };
  }, [transferDialogOpen, transferForm.to_site_id, firm?.id, firmId]);

  const handleSubmitFirmTransfer = async (e) => {
    e.preventDefault();
    setTransferMessage({ type: '', text: '' });

    const amt = parseFloat(transferForm.amount) || 0;
    if (!transferForm.to_site_id || !transferForm.to_firm_id || amt <= 0) {
      setTransferMessage({ type: 'error', text: 'Please select target site, target firm, and valid amount.' });
      return;
    }

    setTransferSubmitting(true);
    try {
      await api.post('/firms/transactions/firm-to-firm', {
        from_firm_id: parseInt(firmId),
        to_site_id: parseInt(transferForm.to_site_id),
        to_firm_id: parseInt(transferForm.to_firm_id),
        amount: amt,
        payment_mode: transferForm.payment_mode,
        description: transferForm.description,
        purpose: transferForm.purpose,
        remark: transferForm.remark,
        cheque_no: transferForm.cheque_no,
        assigned_admin_id: transferForm.assigned_admin_id,
      });

      setTransferMessage({
        type: 'success',
        text: 'Firm-to-firm transfer submitted. It is pending until admin approval.',
      });
      // Close dialog instantly; reconcile in the background.
      setTransferDialogOpen(false);
      resetTransferForm();
      refreshTransactions();
    } catch (error) {
      setTransferMessage({ type: 'error', text: error.response?.data?.message || 'Failed to submit transfer request' });
    } finally {
      setTransferSubmitting(false);
    }
  };

  const downloadExcel = () => {
    if (filteredTxns.length === 0) return;
    const data = filteredTxns.map((t, i) => ({
      '#': i + 1,
      'Date': fmtDate(t.date),
      'Cheque Number': t.cheque_no || '',
      'Description': t.description,
      'Cash In': t.payment_mode === 'cash' ? t.credit : '',
      'Cash Out': t.payment_mode === 'cash' ? t.debit : '',
      'Bank In': t.payment_mode === 'bank' ? t.credit : '',
      'Bank Out': t.payment_mode === 'bank' ? t.debit : '',
      'Balance': t.balance,
      'Name': t.name,
      'Purpose': t.purpose,
      'Remark': t.remark,
      'Remark 2': t.remark2 || '',
      'Status': t.status,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
    XLSX.writeFile(wb, `${firm?.name || 'Firm'}_Transactions.xlsx`);
  };

  const downloadImportTemplate = () => {
    const templateData = [
      {
        'No': 1,
        'Value Date': '06/07/2023',
        'Txn Posted Date': '06/07/2023',
        'Cheque Number': '123456',
        'Description': 'Sample bank transaction description',
        'Debit Amount': '',
        'Credit Amount': 1000,
        'Available Balance': 10000,
        'Name': 'CUSTOMER NAME',
        'Purpose': 'TRANSACTION PURPOSE',
        'Remark': 'BANK CHARGES',
        'Remark 2': 'Optional secondary note',
      },
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'FirmTransactions_ImportTemplate.xlsx');
  };

  const printReceipt = (txn) => {
    const content = `
      <div style="font-family: Arial; padding: 20px; max-width: 600px;">
        <h2>${firm?.name || 'Firm'}</h2>
        <p>Bank: ${firm?.bank_name || 'N/A'} | A/C: ${firm?.account_number || 'N/A'}</p>
        <hr/>
        <p><strong>Date:</strong> ${fmtDate(txn.date)}</p>
        <p><strong>Description:</strong> ${txn.description}</p>
        <p><strong>Name:</strong> ${txn.name || 'N/A'}</p>
        <p><strong>Amount:</strong> ${txn.debit ? `₹${fmt(txn.debit)} (Debit)` : `₹${fmt(txn.credit)} (Credit)`}</p>
        <p><strong>Balance:</strong> ₹${fmt(txn.balance || 0)}</p>
      </div>
    `;
    const win = window.open('', '', 'height=600,width=800');
    win.document.write(content);
    win.print();
  };

  const printAllStatements = () => {
    if (!txnsWithBalance.length) return;

    const rowsHtml = txnsWithBalance.map((t, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td>${fmtDate(t.date)}</td>
        <td>${(t.cheque_no || '—').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
        <td>${(t.description || '—').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
        <td class="num">${t.debit ? fmt(t.debit) : '-'}</td>
        <td class="num">${t.credit ? fmt(t.credit) : '-'}</td>
        <td class="num">${fmt(t.balance || 0)}</td>
        <td>${t.name || '—'}</td>
        <td>${t.purpose || '—'}</td>
        <td>${t.remark || '—'}</td>
        <td>${(t.remark2 || '—').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
      </tr>
    `).join('');

    const docHtml = `
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>${(firm?.name || 'Firm').replace(/</g, '&lt;').replace(/>/g, '&gt;')} - Statement</title>
        <style>
          @page { size: A4 portrait; margin: 14mm; }
          body { font-family: "Segoe UI", Arial, sans-serif; color: #0f172a; margin: 0; }
          .page { width: 100%; }
          .header { border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 12px; }
          .title { font-size: 20px; font-weight: 700; margin: 0; }
          .sub { font-size: 12px; color: #334155; margin-top: 4px; }
          .meta { margin-top: 8px; font-size: 11px; color: #475569; }
          .meta span { margin-right: 16px; }
          .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 12px 0; }
          .card { border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px; }
          .card .k { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: .06em; }
          .card .v { font-size: 14px; font-weight: 700; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; table-layout: fixed; }
          th, td { border: 1px solid #cbd5e1; padding: 6px; font-size: 10px; vertical-align: top; word-wrap: break-word; }
          th { background: #f1f5f9; text-align: left; }
          .num { text-align: right; }
          .footer { margin-top: 10px; font-size: 10px; color: #64748b; text-align: right; }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="header">
            <h1 class="title">Firm Statement</h1>
            <div class="sub"><strong>Firm:</strong> ${(firm?.name || 'N/A').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
            <div class="sub"><strong>Bank:</strong> ${(firm?.bank_name || 'N/A').replace(/</g, '&lt;').replace(/>/g, '&gt;')} &nbsp; | &nbsp; <strong>A/C:</strong> ${(firm?.account_number || 'N/A').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
            <div class="meta">
              <span><strong>Generated:</strong> ${new Date().toLocaleString('en-IN')}</span>
              <span><strong>Total Entries:</strong> ${txnsWithBalance.length}</span>
            </div>
          </div>

          <div class="summary">
            <div class="card"><div class="k">Opening Balance</div><div class="v">₹${fmt(openingBal)}</div></div>
            <div class="card"><div class="k">Total Credit</div><div class="v">₹${fmt(totalCredit)}</div></div>
            <div class="card"><div class="k">Total Debit</div><div class="v">₹${fmt(totalDebit)}</div></div>
            <div class="card"><div class="k">Closing Balance</div><div class="v">₹${fmt(closingBal)}</div></div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 3%;">No</th>
                <th style="width: 9%;">Date</th>
                <th style="width: 9%;">Cheque No</th>
                <th style="width: 22%;">Description</th>
                <th style="width: 8%;" class="num">Debit</th>
                <th style="width: 8%;" class="num">Credit</th>
                <th style="width: 9%;" class="num">Balance</th>
                <th style="width: 10%;">Name</th>
                <th style="width: 9%;">Purpose</th>
                <th style="width: 7%;">Remark</th>
                <th style="width: 6%;">Remark 2</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <div class="footer">This is a system generated firm statement.</div>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank', 'height=900,width=1200');
    if (!printWindow) return;
    printWindow.document.open();
    printWindow.document.write(docHtml);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const handleImportFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    setImportMessage({ type: '', text: '' });
    
    // Preview file
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const workbook = XLSX.read(event.target?.result, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        setImportPreview(data.slice(0, 5));
      } catch (err) {
        setImportMessage({ type: 'error', text: 'Failed to read file' });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const parseTransactionFromRow = (row) => {
    const normalized = Object.fromEntries(
      Object.entries(row || {}).map(([k, v]) => [normalizeHeader(k), v]),
    );

    const pick = (...keys) => {
      for (const key of keys) {
        const val = normalized[normalizeHeader(key)];
        if (val !== undefined && val !== null && `${val}`.trim() !== '') return val;
      }
      return '';
    };

    const valueDate = pick('Value Date', 'Date', 'Txn Date', 'Transaction Date');
    const chequeNo = pick('Cheque Number', 'Cheque No', 'Cheque', 'Cheque/Ref No', 'Ref No');
    const description = pick('Description', 'Narration', 'Particulars', 'Remarks');
    const debit = parseAmount(pick('Debit Amount', 'Debit', 'Withdrawal Amount', 'Dr Amount', 'DR'));
    const credit = parseAmount(pick('Credit Amount', 'Credit', 'Deposit Amount', 'Cr Amount', 'CR'));
    const name = pick('Name', 'Party Name', 'Beneficiary Name');
    const purpose = pick('Purpose', 'Transaction Type', 'Type');
    const remark = pick('Remark', 'Category', 'Remarks');
    const remark2 = pick('Remark 2', 'Remark2', 'Secondary Remark', 'Note');

    const debitAmount = debit > 0 ? debit : 0;
    const creditAmount = credit > 0 ? credit : 0;

    return {
      date: parseExcelDateToISO(valueDate),
      payment_mode: 'bank', // Default to bank since these are bank statements
      description: description.toString().trim(),
      debit: debitAmount,
      credit: creditAmount,
      name: name.toString().trim(),
      purpose: purpose.toString().trim(),
      remark: remark.toString().trim(),
      remark2: remark2.toString().trim(),
      voucher_url: '',
      cheque_no: chequeNo.toString().trim(),
    };
  };

  const compareWithCurrentTransactions = (parsedRows, totalRows, skippedRows) => {
    // ── Phase 1: normalize each existing transaction exactly ONCE ──
    const existingNormalized = new Array(transactions.length);
    const existingExactMap = new Map();
    const existingBaseMap = new Map();

    for (let idx = 0; idx < transactions.length; idx++) {
      const t = transactions[idx];
      const normalized = {
        id: t.id,
        index: idx,
        date: parseExcelDateToISO(t.date),
        description: t.description || '',
        debit: parseFloat(t.debit) || 0,
        credit: parseFloat(t.credit) || 0,
        name: t.name || '',
        purpose: t.purpose || '',
        remark: t.remark || '',
      };
      existingNormalized[idx] = normalized;

      const exactKey = buildTxnExactKey(normalized);
      const baseKey = buildTxnBaseKey(normalized);

      let bucket = existingExactMap.get(exactKey);
      if (!bucket) { bucket = []; existingExactMap.set(exactKey, bucket); }
      bucket.push(normalized);

      bucket = existingBaseMap.get(baseKey);
      if (!bucket) { bucket = []; existingBaseMap.set(baseKey, bucket); }
      bucket.push(normalized);
    }

    // ── Phase 2: walk file rows, classify each into matched / amount_diff / missing_in_system ──
    const matchedSystemIndexes = new Set();
    const newRows = [];
    const amountDiffRows = [];
    const comparisonRows = [];
    let exactMatches = 0;

    for (let idx = 0; idx < parsedRows.length; idx++) {
      const row = parsedRows[idx];
      const normalizedRow = {
        ...row,
        date: parseExcelDateToISO(row.date),
        description: row.description || '',
        debit: parseFloat(row.debit) || 0,
        credit: parseFloat(row.credit) || 0,
        name: row.name || '',
        purpose: row.purpose || '',
      };
      const bankRowNo = idx + 1;

      // exact-match path: linear scan of small bucket; first unmatched wins
      const exactBucket = existingExactMap.get(buildTxnExactKey(normalizedRow));
      let matched = null;
      if (exactBucket) {
        for (let j = 0; j < exactBucket.length; j++) {
          if (!matchedSystemIndexes.has(exactBucket[j].index)) { matched = exactBucket[j]; break; }
        }
      }
      if (matched) {
        matchedSystemIndexes.add(matched.index);
        exactMatches++;
        comparisonRows.push({ status: 'matched', bankRowNo, bank: normalizedRow, system: matched });
        continue;
      }

      // amount-diff path: pick closest unmatched candidate by |Δdebit|+|Δcredit|
      const baseBucket = existingBaseMap.get(buildTxnBaseKey(normalizedRow));
      if (baseBucket) {
        const targetDebit = round2(normalizedRow.debit);
        const targetCredit = round2(normalizedRow.credit);
        let best = null;
        let bestDelta = Infinity;
        for (let j = 0; j < baseBucket.length; j++) {
          const c = baseBucket[j];
          if (matchedSystemIndexes.has(c.index)) continue;
          const delta = Math.abs(round2(c.debit) - targetDebit) + Math.abs(round2(c.credit) - targetCredit);
          if (delta < bestDelta) { bestDelta = delta; best = c; }
        }
        if (best) {
          matchedSystemIndexes.add(best.index);
          const debitDiff = round2(normalizedRow.debit) - round2(best.debit);
          const creditDiff = round2(normalizedRow.credit) - round2(best.credit);
          amountDiffRows.push({ rowNo: bankRowNo, bank: normalizedRow, system: best, debitDiff, creditDiff });
          comparisonRows.push({ status: 'amount_diff', bankRowNo, bank: normalizedRow, system: best, debitDiff, creditDiff });
          continue;
        }
      }

      newRows.push({ rowNo: bankRowNo, ...normalizedRow });
      comparisonRows.push({ status: 'missing_in_system', bankRowNo, bank: normalizedRow, system: null });
    }

    // ── Phase 3: missing-in-file — single pass over already-normalized array ──
    const missingInFileRows = [];
    for (let idx = 0; idx < existingNormalized.length; idx++) {
      if (matchedSystemIndexes.has(idx)) continue;
      const systemRow = existingNormalized[idx];
      missingInFileRows.push(systemRow);
      comparisonRows.push({ status: 'missing_in_file', bankRowNo: null, bank: null, system: systemRow });
    }

    const nextResult = {
      fileRows: totalRows,
      validRows: parsedRows.length,
      skippedRows,
      exactMatches,
      newRows,
      amountDiffRows,
      missingInFileRows,
      comparisonRows,
    };

    setCompareResult(nextResult);
    return nextResult;
  };

  const handleCompareFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCompareLoading(true);
    setCompareMessage({ type: '', text: '' });

    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        // Yield to the browser so the loading spinner paints before the
        // synchronous parse + compare blocks the main thread.
        setTimeout(() => {
          const t0 = performance.now();
          try {
            const workbook = XLSX.read(event.target?.result, { type: 'array' });
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const data = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

            if (data.length === 0) {
              setCompareMessage({ type: 'error', text: 'No rows found in selected file' });
              setCompareResult({ fileRows: 0, validRows: 0, skippedRows: 0, exactMatches: 0, newRows: [], amountDiffRows: [], missingInFileRows: [], comparisonRows: [] });
              setComparePreview([]);
              return;
            }

            let skippedRows = 0;
            const parsedRows = [];
            for (let i = 0; i < data.length; i++) {
              const parsed = parseTransactionFromRow(data[i]);
              if (!parsed.description || (!parsed.debit && !parsed.credit)) {
                skippedRows++;
                continue;
              }
              parsedRows.push(parsed);
            }

            setComparePreview(data.slice(0, 5));
            const comparison = compareWithCurrentTransactions(parsedRows, data.length, skippedRows);
            const elapsed = Math.round(performance.now() - t0);
            setCompareMessage({
              type: 'success',
              text: `Compared ${parsedRows.length}/${data.length} rows in ${elapsed}ms. New: ${comparison.newRows.length}, amount diff: ${comparison.amountDiffRows.length}, missing in file: ${comparison.missingInFileRows.length}.`,
            });
          } catch (error) {
            setCompareMessage({ type: 'error', text: 'Failed to parse compare file' });
          } finally {
            setCompareLoading(false);
          }
        }, 0);
      };
      reader.readAsArrayBuffer(file);
    } catch (error) {
      setCompareLoading(false);
      setCompareMessage({ type: 'error', text: 'Failed to read compare file' });
    }
  };

  const handleImportOnlyNewFromCompare = async () => {
    if (!compareResult.newRows.length) {
      setCompareMessage({ type: 'error', text: 'No new rows found to import' });
      return;
    }

    setCompareLoading(true);
    try {
      const payload = compareResult.newRows.map((row) => ({
        firm_id: firmId,
        date: row.date,
        payment_mode: 'bank',
        description: row.description,
        debit: row.debit,
        credit: row.credit,
        name: row.name,
        purpose: row.purpose,
        remark: row.remark || '',
        voucher_url: '',
        cheque_no: '',
      }));

      const response = await api.post('/firms/transactions/bulk', { transactions: payload });
      setCompareMessage({
        type: 'success',
        text: response.data?.message || `Imported ${response.data?.count || 0} new transactions`,
      });
      // Close dialog instantly; reconcile in background.
      setCompareDialogOpen(false);
      setComparePreview([]);
      setCompareResult({ fileRows: 0, validRows: 0, skippedRows: 0, exactMatches: 0, newRows: [], amountDiffRows: [], missingInFileRows: [], comparisonRows: [] });
      setCompareMessage({ type: '', text: '' });
      refreshTransactions();
    } catch (error) {
      setCompareMessage({ type: 'error', text: error.response?.data?.message || 'Failed to import new compare rows' });
    } finally {
      setCompareLoading(false);
    }
  };

  const handleImportSubmit = async () => {
    if (!importFile) {
      setImportMessage({ type: 'error', text: 'Please select a file' });
      return;
    }

    setImportLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const workbook = XLSX.read(event.target?.result, { type: 'array' });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const data = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

          if (data.length === 0) {
            setImportMessage({ type: 'error', text: 'No transactions found in file' });
            setImportLoading(false);
            return;
          }

          // Parse all transactions
          let skippedRows = 0;
          const transactions = data
            .map((row, idx) => {
              try {
                const txn = parseTransactionFromRow(row);
                // Validate
                if (!txn.description || (!txn.debit && !txn.credit)) {
                  skippedRows += 1;
                  return null;
                }
                return { ...txn, firm_id: firmId };
              } catch (err) {
                console.error(`Row ${idx} parse error:`, err);
                skippedRows += 1;
                return null;
              }
            })
            .filter(Boolean);

          if (transactions.length === 0) {
            setImportMessage({ type: 'error', text: 'No valid transactions to import' });
            setImportLoading(false);
            return;
          }

          // Bulk upload
          const response = await api.post('/firms/transactions/bulk', {
            transactions,
          });

          const serverMs = response.data?.elapsedMs;
          setImportMessage({
            type: 'success',
            text: `Imported ${response.data.count || transactions.length}/${data.length} transactions${response.data.duplicateCount ? ` (${response.data.duplicateCount} duplicates skipped)` : ''}${skippedRows ? ` (${skippedRows} skipped in file parsing)` : ''}${serverMs != null ? ` — server ${serverMs}ms` : ''}.`,
          });

          // Close dialog instantly; reconcile in background.
          setImportDialogOpen(false);
          setImportFile(null);
          setImportPreview([]);
          setImportMessage({ type: '', text: '' });
          refreshTransactions();
        } catch (error) {
          setImportMessage({
            type: 'error',
            text: error.response?.data?.message || 'Failed to import transactions',
          });
        } finally {
          setImportLoading(false);
        }
      };
      reader.readAsArrayBuffer(importFile);
    } catch (error) {
      setImportMessage({ type: 'error', text: 'File read error' });
      setImportLoading(false);
    }
  };

  const getRemarkBadge = (remark) => {
    const colors = REMARK_COLORS[remark] || 'bg-slate-50 text-slate-600 border-slate-200';
    return (
      <Badge variant="outline" className={`text-[10px] ${colors}`}>
        {remark}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!firm) {
    return (
      <div className="text-center py-16">
        <Building2 className="w-10 h-10 text-slate-200 mx-auto mb-3" />
        <p className="text-sm text-slate-500">Firm not found</p>
        <Link to="/firm-transactions" className="text-xs text-blue-600 mt-2 hover:underline">← Back to Firms</Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full md:max-w-7xl space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/firm-transactions')} className="h-8 w-8 p-0">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{firm.name}</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {firm.bank_name && <span className="font-medium text-slate-600">{firm.bank_name}</span>}
              {firm.account_number && <span className="text-slate-400"> · A/C: {firm.account_number}</span>}
            </p>
            <p className="text-xs text-slate-500 mt-1">Firm Name: <span className="font-semibold text-slate-700">{firm.name}</span></p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={printAllStatements} className="text-xs">
            <Printer className="w-3.5 h-3.5 mr-1" /> Print Statement
          </Button>
          <Button variant="outline" size="sm" onClick={downloadExcel} className="text-xs">
            <Download className="w-3.5 h-3.5 mr-1" /> Excel
          </Button>
          {canWrite && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setComparePreview([]);
                  setCompareResult({ fileRows: 0, validRows: 0, skippedRows: 0, exactMatches: 0, newRows: [], amountDiffRows: [], missingInFileRows: [], comparisonRows: [] });
                  setCompareMessage({ type: '', text: '' });
                  setCompareViewMode('all');
                  setCompareDialogOpen(true);
                }}
                className="text-xs"
              >
                <ArrowLeftRight className="w-3.5 h-3.5 mr-1" /> Compare
              </Button>
              <Button variant="outline" size="sm" onClick={downloadImportTemplate} className="text-xs">
                <Download className="w-3.5 h-3.5 mr-1" /> Download Template
              </Button>
              <Button variant="outline" size="sm" onClick={() => { setImportFile(null); setImportPreview([]); setImportMessage({ type: '', text: '' }); setImportDialogOpen(true); }} className="text-xs">
                <Upload className="w-3.5 h-3.5 mr-1" /> Import
              </Button>
              <Button variant="outline" size="sm" onClick={handleOpenFirmTransfer} className="text-xs">
                <ArrowLeftRight className="w-3.5 h-3.5 mr-1" /> Firm to Firm
              </Button>
              <Button size="sm" onClick={handleOpenAddTxn}>
                <Plus className="w-4 h-4 mr-1.5" /> Add Transaction
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card className="shadow-none border-slate-200">
          <CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Total Credit</p>
            <p className="text-lg font-bold text-emerald-700 mt-2">₹{fmt(totalCredit)}</p>
          </CardContent>
        </Card>
        <Card className="shadow-none border-slate-200">
          <CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Total Debit</p>
            <p className="text-lg font-bold text-red-600 mt-2">₹{fmt(totalDebit)}</p>
          </CardContent>
        </Card>
        <Card className="shadow-none border-slate-200">
          <CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Available Bal.</p>
            <p className={`text-lg font-bold mt-2 ${closingBal >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
              ₹{fmt(closingBal)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card className="shadow-none border-slate-200">
        <CardContent className="p-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-56">
              <Label className="text-[11px] font-medium text-slate-600">Search description</Label>
              <div className="relative mt-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by description..."
                  className="h-9 pl-8 text-sm"
                />
              </div>
            </div>

            <div className="min-w-44">
              <Label className="text-[11px] font-medium text-slate-600">Period</Label>
              <Select value={filterPeriod} onValueChange={handlePeriodChange}>
                <SelectTrigger className="h-9 text-sm mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">Last 7 days</SelectItem>
                  <SelectItem value="month">This month</SelectItem>
                  <SelectItem value="last_month">Last month</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-[11px] font-medium text-slate-600">From</Label>
              <Input
                type="date"
                value={filterDateFrom}
                onChange={(e) => { setFilterDateFrom(e.target.value); setFilterPeriod('all'); }}
                className="h-9 text-sm mt-1"
              />
            </div>
            <div>
              <Label className="text-[11px] font-medium text-slate-600">To</Label>
              <Input
                type="date"
                value={filterDateTo}
                onChange={(e) => { setFilterDateTo(e.target.value); setFilterPeriod('all'); }}
                className="h-9 text-sm mt-1"
              />
            </div>

            <div className="min-w-48">
              <Label className="text-[11px] font-medium text-slate-600">Name</Label>
              <Select value={filterName} onValueChange={setFilterName}>
                <SelectTrigger className="h-9 text-sm mt-1">
                  <SelectValue placeholder="All names" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All names ({uniqueNames.length})</SelectItem>
                  {uniqueNames.map((n) => (
                    <SelectItem key={n} value={n}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-44">
              <Label className="text-[11px] font-medium text-slate-600">Remark</Label>
              <Select value={filterRemark} onValueChange={setFilterRemark}>
                <SelectTrigger className="h-9 text-sm mt-1">
                  <SelectValue placeholder="All remarks" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All remarks ({uniqueRemarks.length})</SelectItem>
                  {uniqueRemarks.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-44">
              <Label className="text-[11px] font-medium text-slate-600">Remark 2</Label>
              <Select value={filterRemark2} onValueChange={setFilterRemark2}>
                <SelectTrigger className="h-9 text-sm mt-1">
                  <SelectValue placeholder="All remark 2" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All remark 2 ({uniqueRemarks2.length})</SelectItem>
                  {uniqueRemarks2.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {hasActiveFilters && (
              <Button variant="outline" size="sm" onClick={clearAllFilters} className="h-9">
                <X className="w-3.5 h-3.5 mr-1" />
                Clear
              </Button>
            )}
          </div>

          {hasActiveFilters && (
            <div className="mt-2 text-[11px] text-slate-500">
              Showing {filteredTxns.length} of {txnsWithBalance.length} transactions
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card className="shadow-none border-slate-200">
        <CardContent className="p-0">
          {loadingTxns ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
            </div>
          ) : filteredTxns.length === 0 ? (
            <div className="text-center py-16">
              <Banknote className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No transactions found</p>
            </div>
          ) : (
            <VirtualizedTxnTable
              filteredTxns={filteredTxns}
              totals={filteredCumulativeTotals}
              canUpdate={canUpdate}
              canDelete={canDelete}
              onEdit={handleOpenEditTxn}
              onDelete={handleDeleteTxn}
              setSortOrder={setSortOrder}
              fmtDate={fmtDate}
              fmt={fmt}
              getRemarkBadge={getRemarkBadge}
            />
          )}
        </CardContent>
      </Card>

      {/* Transaction Dialog */}
      <Dialog open={txnDialogOpen} onOpenChange={(open) => { setTxnDialogOpen(open); if (!open) resetTxnForm(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTxnId ? 'Edit Transaction' : 'Add Transaction'}</DialogTitle>
            <DialogDescription>{editingTxnId ? 'Update transaction details.' : `Add a transaction to ${firm.name}.`}</DialogDescription>
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
            <div className={`grid gap-3 ${txnForm.payment_mode === 'bank' ? 'grid-cols-4' : 'grid-cols-2'}`}>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{editingTxnId ? 'Date (Read Only)' : 'Date (Auto Today)'}</Label>
                <Input
                  type="date"
                  value={editingTxnId ? (txnForm.date || todayISO()) : todayISO()}
                  readOnly
                  disabled
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Payment Mode *</Label>
                <Select value={txnForm.payment_mode} onValueChange={(value) => setTxnForm({ ...txnForm, payment_mode: value, ...(value === 'cash' ? { cheque_no: '', transaction_no: '' } : {}) })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bank">Bank</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {txnForm.payment_mode === 'bank' && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Cheque No</Label>
                  <Input
                    placeholder="Cheque number"
                    value={txnForm.cheque_no}
                    onChange={(e) => setTxnForm({ ...txnForm, cheque_no: e.target.value })}
                  />
                </div>
              )}
              {txnForm.payment_mode === 'bank' && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Transaction No / UTR</Label>
                  <Input
                    placeholder="UTR / TXN NO"
                    value={txnForm.transaction_no}
                    onChange={(e) => setTxnForm({ ...txnForm, transaction_no: e.target.value.toUpperCase() })}
                  />
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Description *</Label>
              <Textarea placeholder="Transaction details..." value={txnForm.description} onChange={(e) => setTxnForm({ ...txnForm, description: e.target.value })} required rows={2} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Debit (₹)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={txnForm.debit}
                  onChange={(e) => setTxnForm({ ...txnForm, debit: e.target.value, credit: '' })}
                  readOnly={!!txnForm.credit}
                  className={txnForm.credit ? 'bg-slate-100 cursor-not-allowed opacity-60' : ''}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Credit (₹)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={txnForm.credit}
                  onChange={(e) => setTxnForm({ ...txnForm, credit: e.target.value, debit: '' })}
                  readOnly={!!txnForm.debit}
                  className={txnForm.debit ? 'bg-slate-100 cursor-not-allowed opacity-60' : ''}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Name</Label>
                <Input placeholder="Name..." value={txnForm.name} onChange={(e) => setTxnForm({ ...txnForm, name: e.target.value.toUpperCase() })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Purpose</Label>
                <Input placeholder="Purpose..." value={txnForm.purpose} onChange={(e) => setTxnForm({ ...txnForm, purpose: e.target.value.toUpperCase() })} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Remark</Label>
              <div className="flex flex-wrap gap-1">
                {REMARK_OPTIONS.map((r) => (
                  <button key={r} type="button" onClick={() => setTxnForm({ ...txnForm, remark: txnForm.remark === r ? '' : r })} className={`px-2 py-1 text-[11px] font-medium rounded-md border transition-all ${txnForm.remark === r ? 'border-slate-900 bg-slate-900 text-white' : REMARK_COLORS[r]}`}>
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Remark 2</Label>
              <Input
                placeholder="Additional remark..."
                value={txnForm.remark2}
                onChange={(e) => setTxnForm({ ...txnForm, remark2: e.target.value })}
              />
            </div>

            {(isAdmin || canManage) && approvers.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Assign Admin (Approval Owner)</Label>
                <Select
                  value={txnForm.assigned_admin_id?.toString() || '_none'}
                  onValueChange={(val) => setTxnForm({ ...txnForm, assigned_admin_id: val === '_none' ? null : parseInt(val) })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select approver" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Unassigned</SelectItem>
                    {approvers.map((app) => (
                      <SelectItem key={app.id} value={String(app.id)}>{app.full_name || app.name || app.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setTxnDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting}>{submitting ? 'Saving...' : 'Save Transaction'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Import Excel Dialog */}
      <Dialog open={transferDialogOpen} onOpenChange={(open) => { setTransferDialogOpen(open); if (!open) resetTransferForm(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Firm to Firm Transaction</DialogTitle>
            <DialogDescription>
              Transfer amount from this firm to a firm in selected site. Request will remain pending until admin approval.
            </DialogDescription>
          </DialogHeader>

          {transferMessage.text && (
            <div className={`flex gap-2 p-3 rounded-lg text-sm ${
              transferMessage.type === 'success'
                ? 'bg-emerald-50 border border-emerald-100 text-emerald-700'
                : 'bg-red-50 border border-red-100 text-red-700'
            }`}>
              {transferMessage.type === 'success'
                ? <Check className="w-4 h-4 shrink-0 mt-0.5" />
                : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
              {transferMessage.text}
            </div>
          )}

          <form onSubmit={handleSubmitFirmTransfer} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">From Firm</Label>
              <Input value={firm?.name || ''} readOnly disabled />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Target Site *</Label>
                <Select
                  value={transferForm.to_site_id}
                  onValueChange={(value) => setTransferForm((prev) => ({ ...prev, to_site_id: value, to_firm_id: '' }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select site" />
                  </SelectTrigger>
                  <SelectContent>
                    {(sites || []).map((site) => (
                      <SelectItem key={site.id} value={String(site.id)}>{site.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Target Firm *</Label>
                <Select
                  value={transferForm.to_firm_id}
                  onValueChange={(value) => setTransferForm((prev) => ({ ...prev, to_firm_id: value }))}
                  disabled={!transferForm.to_site_id || transferTargetLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={transferTargetLoading ? 'Loading firms...' : 'Select firm'} />
                  </SelectTrigger>
                  <SelectContent>
                    {transferTargetFirms.map((targetFirm) => (
                      <SelectItem key={targetFirm.id} value={String(targetFirm.id)}>{targetFirm.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Amount (₹) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={transferForm.amount}
                  onChange={(e) => setTransferForm((prev) => ({ ...prev, amount: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Payment Mode *</Label>
                <Select
                  value={transferForm.payment_mode}
                  onValueChange={(value) => setTransferForm((prev) => ({ ...prev, payment_mode: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank">Bank</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Description</Label>
              <Textarea
                rows={2}
                placeholder="Optional transfer note"
                value={transferForm.description}
                onChange={(e) => setTransferForm((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Cheque / Ref No</Label>
              <Input
                placeholder="Optional"
                value={transferForm.cheque_no}
                onChange={(e) => setTransferForm((prev) => ({ ...prev, cheque_no: e.target.value }))}
              />
            </div>

            {(isAdmin || canManage) && approvers.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Assign Admin (Approval Owner)</Label>
                <Select
                  value={transferForm.assigned_admin_id?.toString() || '_none'}
                  onValueChange={(val) => setTransferForm((prev) => ({ ...prev, assigned_admin_id: val === '_none' ? null : parseInt(val) }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select approver" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Unassigned</SelectItem>
                    {approvers.map((app) => (
                      <SelectItem key={app.id} value={String(app.id)}>{app.full_name || app.name || app.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setTransferDialogOpen(false)} type="button">Cancel</Button>
              <Button type="submit" disabled={transferSubmitting || transferTargetLoading}>
                {transferSubmitting ? 'Submitting...' : 'Submit for Approval'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Import Excel Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Transactions from Excel</DialogTitle>
            <DialogDescription>Upload an Excel file with the following columns: No, Value Date, Txn Posted Date, Cheque Number, Description, Debit Amount, Credit Amount, Available Balance, Name, Purpose, Remark, Remark 2</DialogDescription>
          </DialogHeader>

          {importMessage.text && (
            <div className={`flex gap-2 p-3 rounded-lg text-sm ${
              importMessage.type === 'success'
                ? 'bg-emerald-50 border border-emerald-100 text-emerald-700'
                : 'bg-red-50 border border-red-100 text-red-700'
            }`}>
              {importMessage.type === 'success' ? <Check className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
              {importMessage.text}
            </div>
          )}

          <div className="space-y-4">
            {/* File Input */}
            <div className="space-y-2">
              <Label htmlFor="excel-file" className="text-sm font-medium">Select Excel File *</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="excel-file"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleImportFileSelect}
                  disabled={importLoading}
                  className="text-sm"
                />
              </div>
              <p className="text-xs text-slate-500">Supported: .xlsx, .xls, .csv</p>
                <Button 
                  size="sm" 
                  variant="secondary"
                  onClick={downloadImportTemplate}
                  className="text-xs h-7"
                >
                  <Download className="w-3 h-3 mr-1" />
                  Download Template
                </Button>
            </div>

            {/* Preview */}
            {importPreview.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Preview (first 5 rows)</Label>
                <div className="border border-slate-200 rounded-lg overflow-x-auto max-h-64 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        {Object.keys(importPreview[0] || {}).map((key) => (
                          <TableHead key={key} className="text-[10px] font-semibold text-slate-600">{key}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importPreview.map((row, idx) => (
                        <TableRow key={idx}>
                          {Object.values(row).map((val, i) => (
                            <TableCell key={i} className="text-[11px] text-slate-700">{val?.toString() || '—'}</TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-800">
                <strong>Note:</strong> The Excel file will be parsed and imported into firm transactions. Make sure column names match exactly. Each transaction must have a description and either a debit or credit amount.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)} disabled={importLoading}>Cancel</Button>
            <Button onClick={handleImportSubmit} disabled={!importFile || importLoading}>
              {importLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Import Transactions
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Compare Excel Dialog */}
      <Dialog open={compareDialogOpen} onOpenChange={setCompareDialogOpen}>
        <DialogContent className="sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Compare Bank File vs Firm Transactions</DialogTitle>
            <DialogDescription>
              Upload latest bank Excel file to find new rows, amount differences, and rows missing in either side.
            </DialogDescription>
          </DialogHeader>

          {compareMessage.text && (
            <div className={`flex gap-2 p-3 rounded-lg text-sm ${
              compareMessage.type === 'success'
                ? 'bg-emerald-50 border border-emerald-100 text-emerald-700'
                : 'bg-red-50 border border-red-100 text-red-700'
            }`}>
              {compareMessage.type === 'success' ? <Check className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
              {compareMessage.text}
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="compare-excel-file" className="text-sm font-medium">Select Bank Excel File *</Label>
              <Input
                id="compare-excel-file"
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleCompareFileSelect}
                disabled={compareLoading}
                className="text-sm"
              />
              <p className="text-xs text-slate-500">Supports up to 500+ rows. Matching is done using date + description + amount + name + purpose.</p>
            </div>

            {(compareResult.fileRows > 0 || comparePreview.length > 0) && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="rounded-md border border-slate-200 p-2">
                  <p className="text-[11px] text-slate-500">Rows in file</p>
                  <p className="text-sm font-semibold text-slate-900">{compareResult.fileRows}</p>
                </div>
                <div className="rounded-md border border-slate-200 p-2">
                  <p className="text-[11px] text-slate-500">Valid parsed</p>
                  <p className="text-sm font-semibold text-slate-900">{compareResult.validRows}</p>
                </div>
                <div className="rounded-md border border-emerald-200 bg-emerald-50 p-2">
                  <p className="text-[11px] text-emerald-700">New in file</p>
                  <p className="text-sm font-semibold text-emerald-700">{compareResult.newRows.length}</p>
                </div>
                <div className="rounded-md border border-amber-200 bg-amber-50 p-2">
                  <p className="text-[11px] text-amber-700">Amount mismatch</p>
                  <p className="text-sm font-semibold text-amber-700">{compareResult.amountDiffRows.length}</p>
                </div>
              </div>
            )}

            {compareResult.comparisonRows.length > 0 && (
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-slate-500">
                  Showing {compareRowsForDisplay.length} of {compareRowsFiltered.length} {compareViewMode === 'issues' ? 'issue' : 'comparison'} rows{compareRowsHidden > 0 ? ` (+${compareRowsHidden} hidden — narrow with filters or export)` : ''}.
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={compareViewMode === 'issues' ? 'default' : 'outline'}
                    className="h-7 text-xs"
                    onClick={() => setCompareViewMode('issues')}
                  >
                    Issues Only
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={compareViewMode === 'all' ? 'default' : 'outline'}
                    className="h-7 text-xs"
                    onClick={() => setCompareViewMode('all')}
                  >
                    All Rows
                  </Button>
                </div>
              </div>
            )}

            {compareResult.comparisonRows.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Before / After Comparison</Label>
                <div className="rounded-lg border border-slate-200 overflow-hidden">
                  <div className="max-h-105 overflow-y-auto">
                    <Table className="table-fixed min-w-240">
                      <TableHeader>
                        <TableRow className="bg-slate-50 hover:bg-slate-50">
                          <TableHead className="w-[44%] text-xs font-semibold text-slate-700">Before (Bank File)</TableHead>
                          <TableHead className="w-[12%] text-center text-xs font-semibold text-slate-500">V/S</TableHead>
                          <TableHead className="w-[44%] text-xs font-semibold text-slate-700">After (System Transactions)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {compareRowsForDisplay.map((row, idx) => {
                      const isAmountDiff = row.status === 'amount_diff';
                      const isMissingInSystem = row.status === 'missing_in_system';
                      const isMissingInFile = row.status === 'missing_in_file';
                      const rowBg = isAmountDiff
                        ? 'bg-amber-50/70'
                        : isMissingInSystem
                          ? 'bg-emerald-50/60'
                          : isMissingInFile
                            ? 'bg-rose-50/60'
                            : 'bg-white';

                      return (
                        <TableRow key={`cmp-${idx}`} className={`${rowBg} align-top hover:${rowBg}`}>
                          <TableCell className="align-top border-r border-slate-200">
                            {row.bank ? (
                              <div className="space-y-1 min-w-0">
                                <p className="text-[11px] text-slate-500">Row {row.bankRowNo || '—'} • {fmtDate(row.bank.date)}</p>
                                <p className="text-xs font-medium text-slate-800 wrap-break-word leading-5">{row.bank.description || '—'}</p>
                                <p className="text-[11px] text-slate-600">Dr ₹{fmt(row.bank.debit)} | Cr ₹{fmt(row.bank.credit)}</p>
                              </div>
                            ) : (
                              <p className="text-xs text-slate-400 italic">No row in bank file</p>
                            )}
                          </TableCell>

                          <TableCell className="align-top border-r border-slate-200 text-center">
                            <div className="flex flex-col items-center justify-start gap-1">
                              <span className="text-[10px] font-semibold text-slate-400 tracking-wider">V/S</span>
                            {isAmountDiff && <Badge className="bg-amber-100 text-amber-800 border-amber-200" variant="outline">Amount Diff</Badge>}
                            {isMissingInSystem && <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200" variant="outline">Missing in System</Badge>}
                            {isMissingInFile && <Badge className="bg-rose-100 text-rose-800 border-rose-200" variant="outline">Missing in File</Badge>}
                            {row.status === 'matched' && <Badge className="bg-slate-100 text-slate-700 border-slate-200" variant="outline">Matched</Badge>}
                            </div>
                          </TableCell>

                          <TableCell className="align-top">
                            {row.system ? (
                              <div className="space-y-1 min-w-0">
                                <p className="text-[11px] text-slate-500">ID {row.system.id || '—'} • {fmtDate(row.system.date)}</p>
                                <p className="text-xs font-medium text-slate-800 wrap-break-word leading-5">{row.system.description || '—'}</p>
                                <p className="text-[11px] text-slate-600">Dr ₹{fmt(row.system.debit)} | Cr ₹{fmt(row.system.credit)}</p>
                              </div>
                            ) : (
                              <p className="text-xs text-slate-400 italic">No matching row in system</p>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCompareDialogOpen(false)} disabled={compareLoading}>Close</Button>
            <Button onClick={handleImportOnlyNewFromCompare} disabled={compareLoading || compareResult.newRows.length === 0}>
              {compareLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Import Only New Rows ({compareResult.newRows.length})
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FirmDetail;
