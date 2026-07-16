import { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import QRCode from 'qrcode';
import { useQuery, useMutation } from '@apollo/client/react';
import { GET_PLOT_PAGE_DATA, GET_PLOT_PAYMENT_DETAIL, INVALIDATE_PLOT_CACHE } from '../graphql/queries';
import { apolloClient } from '../graphql/client';
import api from '../api/api';
import * as XLSX from 'xlsx';
import UserAvatar from '../components/UserAvatar';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Separator } from '../components/ui/separator';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader,
  DialogTitle, DialogFooter,
} from '../components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../components/ui/table';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '../components/ui/collapsible';
import {
  Popover, PopoverTrigger, PopoverContent,
} from '../components/ui/popover';
import {
  Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem,
} from '../components/ui/command';
import {
  Plus, Edit2, Trash2, AlertCircle, Check, Search, Loader2,
  IndianRupee, ArrowLeft, ChevronDown, Building2, Eye,
  Calendar, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  Banknote, Hash, FileText, User, Tag, Percent,
  Filter, X, Download, Printer, MapPin, Ruler, BarChart3,
  Landmark, Wallet, CircleDollarSign, Camera, Clock, Send, ChevronsUpDown,
  ArrowUpDown, ClipboardList, UserPlus, Handshake,
} from 'lucide-react';
import VoucherUpload, { VoucherThumbnail } from '../components/VoucherUpload';
import ApprovalStatusBadge from '../components/ApprovalStatusBadge';
import ChequeStatusControl from '../components/ChequeStatusControl';

// ── Constants ──
const PAYMENT_FROM_OPTIONS = [
  'BOOKING', 'CASH', 'BANK', 'TRANSFER', 'CHEQUE', 'UPI',
  'NEFT', 'RTGS', 'IMPS', 'ADJUST', 'RETURN', 'REFUND',
];

// FROM modes that count as BANK payment type
const BANK_TYPE_FROMS = ['BANK', 'TRANSFER', 'CHEQUE', 'UPI', 'NEFT', 'RTGS', 'IMPS'];
const derivePaymentType = (from) => from === 'CHEQUE' ? 'CHEQUE' : BANK_TYPE_FROMS.includes(from) ? 'BANK' : 'CASH';

const INTEREST_TYPES = [
  { value: 'per_day', label: 'Per Day' },
  { value: 'per_month', label: 'Per Month' },
  { value: 'per_quarter', label: 'Per Quarter' },
  { value: 'per_year', label: 'Per Year' },
];

const PENALTY_TYPES = [
  { value: 'per_day', label: 'Per Day' },
  { value: 'per_week', label: 'Per Week' },
  { value: 'per_month', label: 'Per Month' },
  { value: 'percentage', label: 'Percentage (%)' },
];

const STATUS_OPTIONS = [
  'COMPANY', 'BOOKED', 'REGISTRY', 'CANCELLATION', 'CANCEL', 'RESALE',
];

const STATUS_COLORS = {
  'COMPANY': 'bg-purple-50 text-purple-700 border-purple-200',
  'CREATED': 'bg-purple-50 text-purple-700 border-purple-200',
  'BOOKED': 'bg-blue-50 text-blue-700 border-blue-200',
  'REGISTRY': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'CANCELLATION': 'bg-rose-50 text-rose-700 border-rose-200',
  'CANCEL': 'bg-red-50 text-red-700 border-red-200',
  'CANCELLED': 'bg-red-50 text-red-700 border-red-200',
  'RESALE': 'bg-violet-50 text-violet-700 border-violet-200',
  'UNDER CANCELLATION': 'bg-rose-50 text-rose-700 border-rose-200',
  'AGREEMENT': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'PENDING PAYMENT': 'bg-orange-50 text-orange-700 border-orange-200',
  'PARTIAL PAYMENT': 'bg-amber-50 text-amber-700 border-amber-200',
  'IN PROGRESS': 'bg-yellow-50 text-yellow-700 border-yellow-200',
  'CONSTRUCTION': 'bg-cyan-50 text-cyan-700 border-cyan-200',
  'POSSESSION': 'bg-teal-50 text-teal-700 border-teal-200',
  'REGISTERED': 'bg-green-50 text-green-700 border-green-200',
  'COMPLETED': 'bg-green-50 text-green-800 border-green-300',
  'HOLD': 'bg-slate-50 text-slate-600 border-slate-200',
  'DISPUTED': 'bg-rose-50 text-rose-700 border-rose-200',
  'TRANSFERRED': 'bg-sky-50 text-sky-700 border-sky-200',
};

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const BLOCK_OPTIONS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));

// Natural sort: splits "A10" into ["A", 10] so A1 < A2 < A10 < A30
const naturalSortPlotNo = (a, b) => {
  const ax = (a || '').match(/([A-Za-z]*)\s*(\d*)(.*)/); 
  const bx = (b || '').match(/([A-Za-z]*)\s*(\d*)(.*)/); 
  const ap = ax[1].toLowerCase(), bp = bx[1].toLowerCase();
  if (ap !== bp) return ap < bp ? -1 : 1;
  const an = ax[2] ? parseInt(ax[2], 10) : 0;
  const bn = bx[2] ? parseInt(bx[2], 10) : 0;
  if (an !== bn) return an - bn;
  return (ax[3] || '').localeCompare(bx[3] || '');
};
const sanitizeBlock = (value) => String(value || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
const extractPlotNumber = (value) => String(value || '').replace(/\D/g, '');
const buildPlotNo = (block, numberPart) => `${sanitizeBlock(block)}${extractPlotNumber(numberPart)}`;
const autoStatusDate = (status, currentDate = '') => {
  if (status === 'COMPANY' || status === 'BOOKED') return currentDate || todayISO();
  return currentDate || '';
};

const getPendingPercent = (plot) => {
  const salePrice = parseFloat(plot?.sale_price) || 0;
  const totalReceived = parseFloat(plot?.total_received) || 0;
  if (salePrice <= 0) return 0;
  const pending = Math.max(0, salePrice - totalReceived);
  return (pending / salePrice) * 100;
};

const FROM_COLORS = {
  'BOOKING': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'CASH': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'BANK': 'bg-blue-50 text-blue-700 border-blue-200',
  'TRANSFER': 'bg-purple-50 text-purple-700 border-purple-200',
  'CHEQUE': 'bg-teal-50 text-teal-700 border-teal-200',
  'UPI': 'bg-green-50 text-green-700 border-green-200',
  'NEFT': 'bg-cyan-50 text-cyan-700 border-cyan-200',
  'RTGS': 'bg-sky-50 text-sky-700 border-sky-200',
  'ADJUST': 'bg-orange-50 text-orange-700 border-orange-200',
  'IMPS': 'bg-amber-50 text-amber-700 border-amber-200',
  'RETURN': 'bg-pink-50 text-pink-700 border-pink-200',
  'REFUND': 'bg-red-50 text-red-700 border-red-200',
};

// Moved outside component for memo row access
const fmt = (val) => {
  const num = parseFloat(val) || 0;
  return num.toLocaleString('en-IN', { maximumFractionDigits: 2 });
};
// Full sum over an explicit plot list — used for the row-selection footer so
// selecting checkboxes recomputes every column (area, rate, sale, received…),
// not just the plot count. Same shape as the `totals` memo below.
const sumPlotTotals = (plots) => {
  let totSize = 0, totRate = 0, totSalePrice = 0, totToRecBank = 0, totToRecCash = 0, totRecBank = 0, totRecCash = 0, totReceived = 0, totPlotComm = 0;
  for (const p of plots) {
    const sp = parseFloat(p.sale_price) || 0;
    const trb = parseFloat(p.to_receive_bank) || 0;
    totSize += parseFloat(p.plot_size) || 0;
    totRate += parseFloat(p.plot_rate) || 0;
    totSalePrice += sp;
    totToRecBank += trb;
    totToRecCash += sp - trb;
    totRecBank += parseFloat(p.received_bank) || 0;
    totRecCash += parseFloat(p.received_cash) || 0;
    totReceived += parseFloat(p.total_received) || 0;
    totPlotComm += parseFloat(p.plot_commission) || 0;
  }
  return { totSize, totRate, totSalePrice, totToRecBank, totToRecCash, totRecBank, totRecCash, totReceived, totPlotComm, totBalBank: totToRecBank - totRecBank, totBalCash: totToRecCash - totRecCash, totNetBal: totSalePrice - totReceived, avgPct: totSalePrice > 0 ? (totReceived / totSalePrice) * 100 : 0, activeCount: plots.length };
};
const fmtDate = (d) => {
  if (!d) return '—';
  // If already a YYYY-MM-DD (or ISO) string, format the date portion directly
  // so we never end up with an "Invalid Date" string when the server hands us
  // a slightly non-standard date (e.g. "2026-04-23" without time). Falling
  // through to new Date(d) would then try to parse the whole string and could
  // return Invalid Date depending on the runtime.
  if (typeof d === 'string') {
    const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  }
  const dt = d instanceof Date ? d : new Date(d);
  if (!dt || Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

// ── Memoized table row ──
const PlotRow = memo(function PlotRow({ row, isSelected, onToggleSelect, onNavigate, canManage, canWrite, canUpdate, canDelete, onBook, onEdit, onDelete }) {
  const { pl, sp, tr, bal, pct, toRecBank, toRecCash, recBank, recCash, balBank, balCash, mTeam } = row;
  return (
    <tr 
      className="group border-b hover:bg-slate-50/50 cursor-pointer"
      onClick={() => onNavigate(pl.id)}
      style={{ contentVisibility: 'auto', containIntrinsicSize: '0 44px' }}
    >
      <td className="text-center sticky left-0 z-10 bg-white px-3 py-2">
        <input type="checkbox"
          checked={isSelected}
          onChange={(e) => { e.stopPropagation(); onToggleSelect(pl.id, e.target.checked); }}
          onClick={(e) => e.stopPropagation()}
          className="w-3.5 h-3.5 rounded border-slate-300 cursor-pointer" />
      </td>
      <td className="sticky left-8 z-10 bg-white px-3 py-2">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold text-blue-700">{pl.plot_no}</span>
          {pl.plot_tag && <Badge variant="outline" className={`text-[9px] leading-none px-1.5 py-0.5 font-bold whitespace-nowrap shrink-0 ${pl.plot_tag === 'OLD' ? 'bg-slate-100 text-slate-500 border-slate-300' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>{pl.plot_tag}</Badge>}
        </div>
      </td>
      <td className="sticky left-24 z-10 bg-white px-3 py-2" style={{boxShadow: '2px 0 4px -1px rgba(0,0,0,0.08)'}}>
        <Badge variant="outline" className={`text-[10px] font-medium ${STATUS_COLORS[pl.status] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>{pl.status}</Badge>
      </td>
      <td className="px-3 py-2"><span className="text-sm text-slate-600">{pl.block || '—'}</span></td>
      <td className="px-3 py-2"><span className="text-sm font-medium text-slate-800">{pl.buyer_name || '—'}</span></td>
      <td className="px-3 py-2"><span className="text-xs text-slate-600 tabular-nums">{pl.plot_size || '—'}</span></td>
      <td className="text-right px-3 py-2"><span className="text-xs text-slate-600 tabular-nums">{pl.plot_rate ? `₹${fmt(pl.plot_rate)}` : '—'}</span></td>
      <td className="text-right px-3 py-2"><span className="text-sm font-semibold text-slate-900 tabular-nums">{sp > 0 ? `₹${fmt(sp)}` : '—'}</span></td>
      <td className="text-right px-3 py-2"><span className="text-xs font-medium text-slate-600 tabular-nums">₹{fmt(toRecBank)}</span></td>
      <td className="text-right px-3 py-2"><span className="text-xs font-medium text-slate-600 tabular-nums">₹{fmt(toRecCash)}</span></td>
      <td className="text-right px-3 py-2"><span className="text-xs font-medium text-green-600 tabular-nums">₹{fmt(recBank)}</span></td>
      <td className="text-right px-3 py-2"><span className={`text-xs font-medium tabular-nums ${balBank < 0 ? 'text-red-600' : balBank > 0 ? 'text-amber-600' : 'text-green-600'}`}>{balBank < 0 ? '-' : ''}₹{fmt(Math.abs(balBank))}</span></td>
      <td className="text-right px-3 py-2"><span className="text-xs font-medium text-green-600 tabular-nums">₹{fmt(recCash)}</span></td>
      <td className="text-right px-3 py-2"><span className={`text-xs font-medium tabular-nums ${balCash < 0 ? 'text-red-600' : balCash > 0 ? 'text-amber-600' : 'text-green-600'}`}>{balCash < 0 ? '-' : ''}₹{fmt(Math.abs(balCash))}</span></td>
      <td className="text-right px-3 py-2"><span className={`text-sm font-semibold tabular-nums ${pct > 100 ? 'text-red-600' : 'text-green-600'}`}>₹{fmt(tr)}</span></td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${pct > 100 ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
          </div>
          <span className={`text-[11px] font-semibold tabular-nums ${pct > 100 ? 'text-red-700' : 'text-green-700'}`}>{pct.toFixed(1)}%</span>
        </div>
      </td>
      <td className="text-right px-3 py-2">
        <span className={`text-xs font-semibold tabular-nums ${bal < 0 ? 'text-red-600' : bal > 0 ? 'text-slate-900' : 'text-slate-400'}`}>
          {bal < 0 ? `-₹${fmt(Math.abs(bal))}` : bal > 0 ? `₹${fmt(bal)}` : '₹0'}
        </span>
      </td>
      <td className="px-3 py-2"><span className="text-xs text-slate-600">{pl.booking_by || '—'}</span></td>
      <td className="text-right px-3 py-2"><span className="text-xs font-medium text-amber-700 tabular-nums">{parseFloat(pl.plot_commission) ? `₹${fmt(pl.plot_commission)}` : '—'}</span></td>
      <td className="px-3 py-2">
        {mTeam ? <Badge variant="outline" className="text-[10px] font-semibold bg-indigo-50 text-indigo-700 border-indigo-200">{mTeam}</Badge> : <span className="text-xs text-slate-300">—</span>}
      </td>
      <td className="px-3 py-2"><span className="text-xs text-slate-500 tabular-nums">{pl.booking_date ? fmtDate(pl.booking_date) : '—'}</span></td>
      <td className="text-right px-3 py-2">
        <div className="flex items-center justify-end gap-0.5">
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onNavigate(pl.id); }} className="h-7 w-7 p-0 text-slate-400 hover:text-blue-600" title="View Details">
            <Eye className="w-3.5 h-3.5" />
          </Button>
          {canManage && (
            <>
              {canWrite && pl.status !== 'BOOKED' && (
                <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); onBook(pl); }} className="h-7 px-2 text-[11px] border-slate-200 text-slate-700 hover:bg-slate-50" title="Book Plot">
                  Book Plot
                </Button>
              )}
              {canUpdate ? (
                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onEdit(pl); }} className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700" title="Edit Plot">
                  <Edit2 className="w-3.5 h-3.5" />
                </Button>
              ) : (
                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onEdit(pl); }} className="h-7 w-7 p-0 text-amber-500 hover:text-amber-700" title="Request Edit">
                  <Edit2 className="w-3.5 h-3.5" />
                </Button>
              )}
              {canDelete && (
                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onDelete(pl); }} className="h-7 w-7 p-0 text-slate-400 hover:text-red-600">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              )}
            </>
          )}
        </div>
      </td>
    </tr>
  );
});

const PlotPayments = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentSite, isAdmin, canManage, hasPermission, user } = useAuth();
  const siteId = currentSite?.id;
  const canWrite = canManage && hasPermission('plot_payments', 'write');
  const canUpdate = canManage && hasPermission('plot_payments', 'update');
  const canDelete = canManage && hasPermission('plot_payments', 'delete');
  const queryFromUrl = useMemo(() => new URLSearchParams(location.search).get('q') || '', [location.search]);

  // ── State ──
  // GraphQL for plots + autocomplete (replaces fetchPlots REST calls)
  const { data: pageData, loading: loadingPlots, refetch: refetchPlots } = useQuery(GET_PLOT_PAGE_DATA, {
    variables: { siteId: String(siteId) },
    skip: !siteId,
    fetchPolicy: 'cache-and-network',
    nextFetchPolicy: 'cache-first',
  });
  const plots = pageData?.plotPageData?.plots || [];
  const autocomplete = pageData?.plotPageData?.autocomplete || { buyerNames: [], paymentFroms: [], bankDetails: [], narrations: [], receivedBys: [], bookedBys: [], members: [] };

  const [selectedPlot, setSelectedPlot] = useState(null);

  // GraphQL for payment detail (replaces fetchPayments REST calls)
  const { data: detailData, loading: loadingPaymentDetail, refetch: refetchDetail } = useQuery(GET_PLOT_PAYMENT_DETAIL, {
    variables: { plotId: String(selectedPlot?.id), siteId: String(siteId) },
    skip: !selectedPlot?.id || !siteId,
    fetchPolicy: 'cache-and-network',
  });
  const payments = detailData?.plotPaymentDetail?.payments || [];
  const plotMeta = detailData?.plotPaymentDetail?.plot || null;
  const fromBreakdown = detailData?.plotPaymentDetail?.fromBreakdown || [];
  const receivedByBreakdown = detailData?.plotPaymentDetail?.receivedByBreakdown || [];
  const installments = detailData?.plotPaymentDetail?.installments || [];
  const loadingPayments = loadingPaymentDetail && !!selectedPlot;
  const loadingInstallments = loadingPaymentDetail && !!selectedPlot;

  const [invalidatePlotCache] = useMutation(INVALIDATE_PLOT_CACHE);

  const [approvers, setApprovers] = useState([]);

  // Plot selection for printing
  const [selectedPlotIds, setSelectedPlotIds] = useState(new Set());

  // Payment selection for printing statement
  const [selectedPayIds, setSelectedPayIds] = useState(new Set());

  // Searchable dropdown state for Buyer Name / Booking By
  const [buyerOpen, setBuyerOpen] = useState(false);
  const [bookingByOpen, setBookingByOpen] = useState(false);
  const [buyerSearch, setBuyerSearch] = useState('');
  const [bookingBySearch, setBookingBySearch] = useState('');

  // Searchable dropdown state for Payment modal Buyer Name / Booked By
  const [payBuyerOpen, setPayBuyerOpen] = useState(false);
  const [payBookedByOpen, setPayBookedByOpen] = useState(false);
  const [payBuyerSearch, setPayBuyerSearch] = useState('');
  const [payBookedBySearch, setPayBookedBySearch] = useState('');

  const filteredBookedByMembers = useMemo(() => {
    const q = (payBookedBySearch || '').trim().toLowerCase();
    const members = autocomplete?.members || [];
    if (!q) return members;
    const filtered = members.filter(m =>
      m.name?.toLowerCase().includes(q) || (m.phone || '').includes(q)
    );
    return [...filtered].sort((a, b) => {
      const aStart = a.name?.toLowerCase().startsWith(q) ? 0 : 1;
      const bStart = b.name?.toLowerCase().startsWith(q) ? 0 : 1;
      return aStart - bStart;
    });
  }, [payBookedBySearch, autocomplete?.members]);

  // Searchable dropdown state for Book Plot modal
  const [bookBuyerOpen, setBookBuyerOpen] = useState(false);
  const [bookBookingByOpen, setBookBookingByOpen] = useState(false);
  const [bookBuyerSearch, setBookBuyerSearch] = useState('');
  const [bookBookingBySearch, setBookBookingBySearch] = useState('');

  const [plotDialogOpen, setPlotDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [bookPlotDialogOpen, setBookPlotDialogOpen] = useState(false);
  const [editingPlot, setEditingPlot] = useState(null);
  const [editingPaymentId, setEditingPaymentId] = useState(null);
  const [bookingPlot, setBookingPlot] = useState(null);
  const [bookPlotForm, setBookPlotForm] = useState({
    buyer_name: '',
    booking_by: '',
    installments_enabled: false,
    interest_enabled: false,
    interest_rate: '',
    interest_type: 'per_month',
    grace_period_days: '15',
    installments: [{ installment_name: 'Installment 1', amount: '', due_date: '' }],
  });
  const [savingInstallmentSettings, setSavingInstallmentSettings] = useState(false);
  const [detailInstallmentSettings, setDetailInstallmentSettings] = useState({
    interest_enabled: false,
    interest_rate: '',
    interest_type: 'per_month',
    grace_period_days: '15',
  });
  const [message, setMessage] = useState({ type: '', text: '' });
  const [submitting, setSubmitting] = useState(false);

  // Edit request (sub-admin proof photo)
  const [proofPhoto, setProofPhoto] = useState(null);
  const [proofPreview, setProofPreview] = useState(null);
  const [editRequestPending, setEditRequestPending] = useState(false);

  const handleProofPhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setProofPhoto(file);
      setProofPreview(URL.createObjectURL(file));
    }
  };

  const clearProofPhoto = () => {
    setProofPhoto(null);
    if (proofPreview) URL.revokeObjectURL(proofPreview);
    setProofPreview(null);
  };

  // Plot list filters – restore from sessionStorage so they persist across navigation
  const _savedFilters = useMemo(() => {
    try { return JSON.parse(sessionStorage.getItem('plotPaymentFilters') || '{}'); } catch { return {}; }
  }, []);
  const [listSearch, setListSearch] = useState(_savedFilters.listSearch || '');
  const [debouncedSearch, setDebouncedSearch] = useState(_savedFilters.listSearch || '');
  const [filterBookingBy, setFilterBookingBy] = useState(_savedFilters.filterBookingBy || 'all');
  const [filterStatus, setFilterStatus] = useState(_savedFilters.filterStatus || 'all');
  const [filterTeam, setFilterTeam] = useState(_savedFilters.filterTeam || 'all');
  const [filterMemberTeam, setFilterMemberTeam] = useState(_savedFilters.filterMemberTeam || 'all');
  const [filterPending, setFilterPending] = useState(_savedFilters.filterPending || 'all');
  const [customPendingMin, setCustomPendingMin] = useState(_savedFilters.customPendingMin || '');
  const [customPendingMax, setCustomPendingMax] = useState(_savedFilters.customPendingMax || '');
  const [sortBy, setSortBy] = useState(_savedFilters.sortBy || 'plot_no');
  const [includeOldInTotals, setIncludeOldInTotals] = useState(true);
  const [filterBookingByOpen, setFilterBookingByOpen] = useState(false);
  const [filterBookingBySearch, setFilterBookingBySearch] = useState('');

  // Payment detail filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterFrom, setFilterFrom] = useState('all');
  const [filterPeriod, setFilterPeriod] = useState('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [sortOrderPay, setSortOrderPay] = useState('desc');
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [breakdownTab, setBreakdownTab] = useState('from');

  // Persist plot list filters to sessionStorage
  useEffect(() => {
    sessionStorage.setItem('plotPaymentFilters', JSON.stringify({
      listSearch, filterBookingBy, filterStatus, filterTeam, filterMemberTeam, filterPending,
      customPendingMin, customPendingMax, sortBy,
    }));
  }, [listSearch, filterBookingBy, filterStatus, filterTeam, filterMemberTeam, filterPending, customPendingMin, customPendingMax, sortBy]);

  useEffect(() => {
    if (queryFromUrl) setListSearch(queryFromUrl);
  }, [queryFromUrl]);

  // Debounce search to avoid filtering on every keystroke
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(listSearch), 200);
    return () => clearTimeout(t);
  }, [listSearch]);

  // Plot form
  const [plotForm, setPlotForm] = useState({
    plot_no: '', block: '', buyer_name: '', plot_size: '', plot_size_mtr: '', plot_rate: '',
    sale_price: '', company_price: '', party_price: '', registry_area: '', circle_rate: '', to_receive_bank: '',
    first_installment: '', booking_by: '', booking_date: todayISO(), status: 'COMPANY', notes: '',
    team: '',
    commission_enabled: false, commission_type: 'PERCENTAGE', commission_value: '',
    commission_rate: '', plot_commission: '',
    assigned_admin_id: null,
  });
  const [duplicateWarning, setDuplicateWarning] = useState(null); // { duplicates, normalizedPlot }

  // ── Registry sub-form (shown when plot status = REGISTRY) ──
  const [regForm, setRegForm] = useState({
    registry_date: todayISO(), registry_payment: '', farmer_name: '', seller_name: '', firm_name: '', notes: '',
  });
  const [registryAutocomplete, setRegistryAutocomplete] = useState({ firmNames: [], clientUsers: [] });
  const [farmerUserSearch, setFarmerUserSearch] = useState('');
  const [sellerUserSearch, setSellerUserSearch] = useState('');

  const filteredFarmerUsers = useMemo(() => {
    const q = (farmerUserSearch || '').trim().toLowerCase();
    const users = registryAutocomplete.clientUsers || [];
    if (!q) return users;
    return users.filter((u) =>
      String(u.name || '').toLowerCase().includes(q) ||
      String(u.phone || '').toLowerCase().includes(q)
    );
  }, [registryAutocomplete.clientUsers, farmerUserSearch]);

  const filteredSellerUsers = useMemo(() => {
    const q = (sellerUserSearch || '').trim().toLowerCase();
    const users = registryAutocomplete.clientUsers || [];
    if (!q) return users;
    return users.filter((u) =>
      String(u.name || '').toLowerCase().includes(q) ||
      String(u.phone || '').toLowerCase().includes(q)
    );
  }, [registryAutocomplete.clientUsers, sellerUserSearch]);

  // Sq Yards ↔ Sq Meters conversion factor
  const SQ_YARD_TO_SQ_MTR = 0.8364;

  // Skip auto-compute on first render after loading edit data (preserves prefilled values)
  const skipAutoCompute = useRef(false);

  // Auto-compute: Sale Price, Plot Commission, Bank Amount (single merged effect)
  useEffect(() => {
    if (skipAutoCompute.current) { skipAutoCompute.current = false; return; }
    const updates = {};
    const size = parseFloat(plotForm.plot_size);
    const rate = parseFloat(plotForm.plot_rate);
    const computedSale = Number.isFinite(size) && Number.isFinite(rate) ? String((size * rate).toFixed(2)) : '';
    if (plotForm.sale_price !== computedSale) updates.sale_price = computedSale;
    const cRate = parseFloat(plotForm.commission_rate);
    const computedComm = Number.isFinite(size) && Number.isFinite(cRate) ? String((size * cRate).toFixed(2)) : '';
    if (plotForm.plot_commission !== computedComm) updates.plot_commission = computedComm;
    const sizeMtr = parseFloat(plotForm.plot_size_mtr);
    const circleRate = parseFloat(plotForm.circle_rate);
    const computedBank = Number.isFinite(sizeMtr) && Number.isFinite(circleRate) ? String((circleRate * sizeMtr).toFixed(2)) : '';
    if (plotForm.to_receive_bank !== computedBank) updates.to_receive_bank = computedBank;
    if (Object.keys(updates).length > 0) setPlotForm((prev) => ({ ...prev, ...updates }));
  }, [plotForm.plot_size, plotForm.plot_rate, plotForm.plot_size_mtr, plotForm.circle_rate, plotForm.commission_rate]);

  // Payment form
  const [payMode, setPayMode] = useState('receive'); // 'receive' | 'refund'
  const [payForm, setPayForm] = useState({
    date: todayISO(),
    payment_from: 'CASH', payment_type: 'CASH', bank_details: '', narration: '',
    buyer_name: '', booked_by: '', amount: '', cheque_no: '',
    voucher_url: '',
    assigned_admin_id: null,
  });

  // ── Fetch Approvers (Admins + site sub-admins) ──
  const fetchApprovers = useCallback(async () => {
    try {
      const url = siteId ? `/admin/approvers?site_id=${siteId}` : '/admin/approvers';
      const res = await api.get(url);
      setApprovers(res.data.approvers || []);
    } catch (err) {
      console.error('Failed to fetch approvers:', err);
    }
  }, [siteId]);

  // ── Fetch registry autocomplete (firms, client users) for registry sub-form ──
  const fetchRegistryAutocomplete = useCallback(async () => {
    if (!siteId) return;
    try {
      const res = await api.get(`/registries/autocomplete?site_id=${siteId}`);
      setRegistryAutocomplete({
        firmNames: res.data?.firmNames || [],
        clientUsers: res.data?.clientUsers || [],
      });
    } catch (err) {
      console.error('Failed to fetch registry autocomplete:', err);
    }
  }, [siteId]);

  // Fetch registry autocomplete when status changes to REGISTRY
  useEffect(() => {
    if (plotForm.status === 'REGISTRY' && plotDialogOpen) {
      fetchRegistryAutocomplete();
    }
  }, [plotForm.status, plotDialogOpen, fetchRegistryAutocomplete]);

  // ── Fetch plots (GraphQL-backed refetch helper) ──
  const fetchPlots = useCallback(async () => {
    if (!siteId) return;
    // Invalidate Redis cache then refetch from GraphQL
    try { await invalidatePlotCache({ variables: { siteId: String(siteId) } }); } catch {}
    await refetchPlots();
  }, [siteId, refetchPlots, invalidatePlotCache]);

  // ── Fetch payments for selected plot (GraphQL-backed refetch helper) ──
  const fetchPayments = useCallback(async () => {
    if (!selectedPlot) return;
    await refetchDetail();
  }, [selectedPlot, refetchDetail]);

  useEffect(() => {
    setSelectedPlot(null);
    clearDetailFilters();
    fetchApprovers();
  }, [siteId, fetchApprovers]);

  // GraphQL auto-fetches when selectedPlot changes via useQuery skip condition

  useEffect(() => {
    const p = plotMeta || selectedPlot;
    if (!p) return;
    setDetailInstallmentSettings({
      interest_enabled: !!p.interest_enabled,
      interest_rate: p.interest_rate != null ? String(p.interest_rate) : '',
      interest_type: p.interest_type || 'per_month',
      grace_period_days: p.grace_period_days != null ? String(p.grace_period_days) : '15',
    });
  }, [plotMeta, selectedPlot]);

  // ── Plot form handlers ──
  const resetPlotForm = () => {
    setPlotForm({
      plot_no: '', block: '', buyer_name: '', plot_size: '', plot_size_mtr: '', plot_rate: '',
      sale_price: '', company_price: '', party_price: '', registry_area: '', circle_rate: '', to_receive_bank: '',
      first_installment: '', booking_by: '', booking_date: todayISO(), status: 'COMPANY', notes: '',
      team: '',
      commission_enabled: false, commission_type: 'PERCENTAGE', commission_value: '',
      commission_rate: '', plot_commission: '',
      assigned_admin_id: null,
      original_plot_rate: '', discount_rate: '',
    });
    setRegForm({ registry_date: todayISO(), registry_payment: '', farmer_name: '', seller_name: '', firm_name: '', notes: '' });
    setFarmerUserSearch('');
    setSellerUserSearch('');
    setEditingPlot(null);
    setMessage({ type: '', text: '' });
    clearProofPhoto();
  };

  const handleOpenCreatePlot = () => { resetPlotForm(); setPlotDialogOpen(true); };

  // Stable row callbacks for memoized PlotRow
  const handleRowNavigate = useCallback((id) => navigate(`/plot-payments/${id}`), [navigate]);
  const handleRowToggleSelect = useCallback((id, checked) => {
    setSelectedPlotIds(prev => { const next = new Set(prev); if (checked) next.add(id); else next.delete(id); return next; });
  }, []);

  // Auto-open Add Plot dialog when navigated with ?action=create-plot
  useEffect(() => {
    const action = new URLSearchParams(location.search).get('action');
    if (action === 'create-plot' && !loadingPlots && canManage) {
      handleOpenCreatePlot();
      // Clean the URL param so it doesn't re-trigger
      navigate('/plot-payments', { replace: true });
    }
  }, [location.search, loadingPlots, canManage]);

  const handleOpenEditPlot = (p) => {
    const block = sanitizeBlock(p.block || String(p.plot_no || '').replace(/[^A-Za-z]/g, ''));
    const numberPart = extractPlotNumber(p.plot_no || '');
    skipAutoCompute.current = true;
    setPlotForm({
      plot_no: buildPlotNo(block, numberPart), block, buyer_name: p.buyer_name || '',
      plot_size: p.plot_size ? String(p.plot_size) : '',
      plot_size_mtr: p.plot_size_mtr ? String(p.plot_size_mtr) : '',
      plot_rate: (parseFloat(p.original_plot_rate) > 0 ? String(p.original_plot_rate) : '') || (p.plot_rate ? String(p.plot_rate) : ''),
      sale_price: p.sale_price ? String(p.sale_price) : '',
      company_price: parseFloat(p.company_price) > 0 ? String(p.company_price) : '',
      party_price: parseFloat(p.party_price) > 0 ? String(p.party_price) : '',
      registry_area: p.registry_area ? String(p.registry_area) : '',
      circle_rate: p.circle_rate ? String(p.circle_rate) : '',
      to_receive_bank: p.to_receive_bank ? String(p.to_receive_bank) : '',
      first_installment: p.first_installment ? String(p.first_installment) : '',
      booking_by: p.booking_by || '', booking_date: p.booking_date ? p.booking_date.split('T')[0] : autoStatusDate(p.status || 'COMPANY'),
      status: p.status || 'COMPANY', notes: p.notes || '',
      team: p.team || '',
      commission_enabled: !!p.commission_enabled,
      commission_type: (p.commission_type || 'PERCENTAGE').toUpperCase(),
      commission_value: p.commission_value != null ? String(p.commission_value) : '',
      commission_rate: p.commission_rate ? String(p.commission_rate) : '',
      plot_commission: p.plot_commission ? String(p.plot_commission) : '',
      assigned_admin_id: p.assigned_admin_id || null,
      original_plot_rate: p.original_plot_rate ? String(p.original_plot_rate) : '',
      discount_rate: p.discount_rate ? String(p.discount_rate) : '',
    });
    setEditingPlot(p);
    setPlotDialogOpen(true);
  };

  const handleSubmitPlot = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    setSubmitting(true);
    const normalizedBlock = sanitizeBlock(plotForm.block);
    const normalizedNumber = extractPlotNumber(plotForm.plot_no);
    if (!normalizedBlock) {
      setMessage({ type: 'error', text: 'Please select a block (A-Z)' });
      setSubmitting(false);
      return;
    }
    if (!normalizedNumber) {
      setMessage({ type: 'error', text: 'Please enter a plot number' });
      setSubmitting(false);
      return;
    }
    try {
      const discountVal = parseFloat(plotForm.discount_rate) || 0;
      const origRate = parseFloat(plotForm.plot_rate) || 0;
      const effectivePlotRate = origRate - discountVal;
      const plotSize = parseFloat(plotForm.plot_size) || 0;
      const discountedSalePrice = discountVal > 0 ? plotSize * effectivePlotRate : parseFloat(plotForm.sale_price) || 0;
      const normalizedPlot = {
        ...plotForm,
        block: normalizedBlock,
        plot_no: buildPlotNo(normalizedBlock, normalizedNumber),
        commission_enabled: !!plotForm.commission_enabled,
        commission_type: String(plotForm.commission_type || 'PERCENTAGE').toUpperCase(),
        commission_value: parseFloat(plotForm.commission_value) || 0,
        commission_rate: parseFloat(plotForm.commission_rate) || 0,
        plot_commission: parseFloat(plotForm.plot_commission) || 0,
        plot_size_mtr: parseFloat(plotForm.plot_size_mtr) || 0,
        booking_date: plotForm.booking_date || todayISO(),
        discount_rate: discountVal,
        original_plot_rate: origRate,
        plot_rate: discountVal > 0 ? effectivePlotRate : origRate,
        sale_price: discountedSalePrice,
        company_price: parseFloat(plotForm.company_price) || 0,
        party_price: parseFloat(plotForm.party_price) || 0,
      };

      // Attach registry fields when status is REGISTRY
      if (plotForm.status === 'REGISTRY') {
        normalizedPlot.registry_fields = {
          registry_date: regForm.registry_date || null,
          registry_payment: regForm.registry_payment || 0,
          farmer_name: regForm.farmer_name || null,
          seller_name: regForm.seller_name || null,
          firm_name: regForm.firm_name || null,
          notes: regForm.notes || null,
        };
      }

      // Sub-admin without update permission → send edit request
      if (editingPlot && !canUpdate) {
        const fd = new FormData();
        fd.append('module', 'plot');
        fd.append('record_id', editingPlot.id);
        fd.append('proposed_data', JSON.stringify({ ...normalizedPlot, assigned_admin_id: normalizedPlot.assigned_admin_id }));
        if (proofPhoto) fd.append('proof_photo', proofPhoto);
        await api.post('/edit-requests', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        setMessage({ type: 'success', text: 'Edit request submitted for approval' });
        setEditRequestPending(true);
        setPlotDialogOpen(false);
      } else if (editingPlot) {
        const { data: resData } = await api.put(`/plots/${editingPlot.id}`, normalizedPlot);
        const msgParts = ['Plot updated'];
        if (resData?.auto_registry && !resData.auto_registry.already_existed) {
          msgParts.push('— Registry entry auto-created in Plot Registry');
        }
        setMessage({ type: 'success', text: msgParts.join(' ') });
        // Close dialog instantly; reconcile in background.
        setPlotDialogOpen(false);
        if (selectedPlot?.id === editingPlot.id) {
          setSelectedPlot({ ...selectedPlot, ...normalizedPlot });
        }
        fetchPlots();
      } else {
        try {
          const { data: resData } = await api.post('/plots', { site_id: siteId, ...normalizedPlot });
          const msgParts = ['Plot created'];
          if (resData?.auto_registry && !resData.auto_registry.already_existed) {
            msgParts.push('— Registry entry auto-created in Plot Registry');
          }
          setMessage({ type: 'success', text: msgParts.join(' ') });
          setPlotDialogOpen(false);
          fetchPlots();
        } catch (dupErr) {
          if (dupErr.response?.status === 409 && dupErr.response?.data?.canOverride) {
            // RESALE duplicate — show confirmation
            setDuplicateWarning({ duplicates: dupErr.response.data.duplicates, normalizedPlot });
            setSubmitting(false);
            return;
          }
          throw dupErr;
        }
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Operation failed' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDuplicate = async () => {
    if (!duplicateWarning) return;
    setSubmitting(true);
    try {
      await api.post('/plots', { site_id: siteId, ...duplicateWarning.normalizedPlot, force_duplicate: true });
      setMessage({ type: 'success', text: 'Plot created (previous marked as OLD)' });
      setDuplicateWarning(null);
      setPlotDialogOpen(false);
      fetchPlots();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Operation failed' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePlot = async (p) => {
    if (!window.confirm(`Delete plot "${p.plot_no}"? All payments will be permanently lost.`)) return;
    // Optimistic removal — instant UI feedback. Roll back on failure via fetchPlots.
    if (selectedPlot?.id === p.id) { setSelectedPlot(null); }
    try {
      await api.delete(`/plots/${p.id}`);
      fetchPlots();
    } catch (err) {
      console.error('Failed to delete plot:', err);
      fetchPlots(); // restore real state
    }
  };

  const handleOpenBookPlot = (plot) => {
    setBookingPlot(plot);
    setBookPlotForm({
      buyer_name: plot?.buyer_name || '',
      booking_by: plot?.booking_by || '',
      discount_rate: '',
      installments_enabled: !!plot?.installments_enabled,
      interest_enabled: !!plot?.interest_enabled,
      interest_rate: plot?.interest_rate != null ? String(plot.interest_rate) : '',
      interest_type: plot?.interest_type || 'per_month',
      grace_period_days: plot?.grace_period_days != null ? String(plot.grace_period_days) : '15',
      penalty_enabled: !!plot?.penalty_enabled,
      penalty_rate: plot?.penalty_rate != null ? String(plot.penalty_rate) : '',
      penalty_type: plot?.penalty_type || 'per_day',
      free_to_sale_days: plot?.free_to_sale_days != null ? String(plot.free_to_sale_days) : '0',
      installments: [{ installment_name: 'Installment 1', amount: '', due_date: '' }],
    });
    setBookPlotDialogOpen(true);
  };

  const addBookInstallmentRow = () => {
    setBookPlotForm((prev) => {
      const last = prev.installments[prev.installments.length - 1];
      let nextDate = '';
      if (last?.due_date) {
        const d = new Date(last.due_date);
        d.setMonth(d.getMonth() + 1);
        nextDate = d.toISOString().split('T')[0];
      }
      return {
        ...prev,
        installments: [...prev.installments, { installment_name: `Installment ${prev.installments.length + 1}`, amount: '', due_date: nextDate }],
      };
    });
  };

  const removeBookInstallmentRow = (idx) => {
    setBookPlotForm((prev) => ({
      ...prev,
      installments: prev.installments.filter((_, i) => i !== idx),
    }));
  };

  const updateBookInstallmentRow = (idx, field, value) => {
    setBookPlotForm((prev) => ({
      ...prev,
      installments: prev.installments.map((row, i) => (i === idx ? { ...row, [field]: value } : row)),
    }));
  };

  const handleSubmitBookPlot = async (e) => {
    e.preventDefault();
    if (!bookingPlot?.id) return;
    if (!bookPlotForm.buyer_name) {
      setMessage({ type: 'error', text: 'Please select a member for Buyer Name' });
      return;
    }
    try {
      setSubmitting(true);
      setMessage({ type: '', text: '' });

      // Calculate effective rate / sale_price / commission after discount
      const origRate = parseFloat(bookingPlot.plot_rate) || 0;
      const discount = parseFloat(bookPlotForm.discount_rate) || 0;
      const effectiveRate = origRate - discount;
      const plotSize = parseFloat(bookingPlot.plot_size) || 0;
      const commRate = parseFloat(bookingPlot.commission_rate) || 0;
      const newSalePrice = plotSize * effectiveRate;
      const newCommission = plotSize * commRate;

      const bookPayload = {
        buyer_name: bookPlotForm.buyer_name,
        booking_by: bookPlotForm.booking_by || null,
        status: 'BOOKED',
        booking_date: todayISO(),
        // rate discount fields
        original_plot_rate: origRate,
        discount_rate: discount,
        plot_rate: effectiveRate,
        sale_price: newSalePrice,
        plot_commission: newCommission,
        // enable commission auto-creation
        commission_enabled: newCommission > 0,
      };

      const bookingRes = await api.put(`/plots/${bookingPlot.id}`, bookPayload);

      await api.put(`/plots/${bookingPlot.id}/installment-settings`, {
        installments_enabled: !!bookPlotForm.installments_enabled,
        interest_enabled: !!bookPlotForm.interest_enabled,
        interest_rate: parseFloat(bookPlotForm.interest_rate) || 0,
        interest_type: bookPlotForm.interest_type || 'per_month',
        grace_period_days: Math.max(0, parseInt(bookPlotForm.grace_period_days) || 0),
        penalty_enabled: !!bookPlotForm.penalty_enabled,
        penalty_rate: parseFloat(bookPlotForm.penalty_rate) || 0,
        penalty_type: bookPlotForm.penalty_type || 'per_day',
        free_to_sale_days: Math.max(0, parseInt(bookPlotForm.free_to_sale_days) || 0),
      });

      if (bookPlotForm.installments_enabled) {
        const validInstallments = (bookPlotForm.installments || []).filter((row) => row.amount && row.due_date);
        if (validInstallments.length > 0) {
          await api.post(`/plots/${bookingPlot.id}/installments`, {
            installments: validInstallments.map((row, idx) => ({
              installment_name: row.installment_name || `Installment ${idx + 1}`,
              amount: row.amount,
              due_date: row.due_date,
            })),
          });
        }
      }

      setBookPlotDialogOpen(false);
      setBookingPlot(null);
      if (bookingRes?.data?.auto_commission?.id) {
        setMessage({
          type: 'success',
          text: `Plot booked. Commission file created: #${bookingRes.data.auto_commission.id}`,
        });
      } else {
        setMessage({ type: 'success', text: 'Plot booked successfully' });
      }
      await fetchPlots();
      if (selectedPlot?.id === bookingPlot.id) {
        await fetchPayments();
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to book plot' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveDetailInstallmentSettings = async () => {
    const p = plotMeta || selectedPlot;
    if (!p?.id) return;
    try {
      setSavingInstallmentSettings(true);
      await api.put(`/plots/${p.id}/installment-settings`, {
        interest_enabled: !!detailInstallmentSettings.interest_enabled,
        interest_rate: parseFloat(detailInstallmentSettings.interest_rate) || 0,
        interest_type: detailInstallmentSettings.interest_type || 'per_month',
        grace_period_days: Math.max(0, parseInt(detailInstallmentSettings.grace_period_days) || 0),
      });
      await fetchPayments();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to save installment settings' });
    } finally {
      setSavingInstallmentSettings(false);
    }
  };

  // ── Payment form handlers ──
  const resetPayForm = () => {
    setPayForm({
      date: todayISO(),
      payment_from: 'CASH', payment_type: 'CASH', bank_details: '', narration: '',
      buyer_name: selectedPlot?.buyer_name || '', booked_by: '', amount: '',
      voucher_url: '',
      assigned_admin_id: null,
    });
    setPayMode('receive');
    setEditingPaymentId(null);
    setMessage({ type: '', text: '' });
    clearProofPhoto();
    setPayBuyerSearch('');
    setPayBookedBySearch('');
  };

  const handleOpenCreatePayment = () => { resetPayForm(); setPaymentDialogOpen(true); };

  const handleOpenEditPayment = (p) => {
    const amt = parseFloat(p.amount) || 0;
    setPayMode(amt < 0 ? 'refund' : 'receive');
    setPayForm({
      date: p.date ? p.date.split('T')[0] : '',
      payment_from: p.payment_from || '', payment_type: p.payment_type || 'CASH',
      bank_details: p.bank_details || '',
      narration: p.narration || '',
      buyer_name: p.buyer_name || '', booked_by: p.booked_by || '',
      amount: String(Math.abs(amt)),
      voucher_url: p.voucher_url || '',
      assigned_admin_id: p.assigned_admin_id || null,
    });
    setEditingPaymentId(p.id);
    setPaymentDialogOpen(true);
  };

  const handleSubmitPayment = async (ev) => {
    ev.preventDefault();
    setMessage({ type: '', text: '' });
    setSubmitting(true);
    try {
      const rawAmt = Math.abs(parseFloat(payForm.amount) || 0);
      const payload = {
        plot_id: selectedPlot.id,
        date: editingPaymentId ? (payForm.date || todayISO()) : todayISO(),
        payment_from: payForm.payment_from,
        payment_type: payForm.payment_type,
        bank_details: payForm.bank_details,
        narration: payForm.narration,
        buyer_name: payForm.buyer_name,
        booked_by: payForm.booked_by,
        amount: payMode === 'refund' ? -rawAmt : rawAmt,
        cheque_no: payForm.payment_from === 'CHEQUE' ? (payForm.cheque_no || null) : null,
        voucher_url: payForm.voucher_url || null,
        assigned_admin_id: payForm.assigned_admin_id,
      };
      // Sub-admin without update permission → send edit request
      if (editingPaymentId && !canUpdate) {
        const fd = new FormData();
        fd.append('module', 'plot_payment');
        fd.append('record_id', editingPaymentId);
        fd.append('proposed_data', JSON.stringify(payload));
        if (proofPhoto) fd.append('proof_photo', proofPhoto);
        await api.post('/edit-requests', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        setMessage({ type: 'success', text: 'Edit request submitted for approval' });
        setEditRequestPending(true);
        setPaymentDialogOpen(false);
      } else if (editingPaymentId) {
        await api.put(`/plots/payments/${editingPaymentId}`, payload);
        setMessage({ type: 'success', text: 'Payment updated' });
        // Close dialog instantly; reconcile in background.
        setPaymentDialogOpen(false);
        fetchPayments();
        fetchPlots();
      } else {
        await api.post('/plots/payments', payload);
        setMessage({ type: 'success', text: 'Payment added' });
        setPaymentDialogOpen(false);
        fetchPayments();
        fetchPlots();
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Operation failed' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePayment = async (id) => {
    if (!window.confirm('Delete this payment?')) return;
    try {
      await api.delete(`/plots/payments/${id}`);
      // Background reconcile — both list views update without blocking.
      fetchPayments();
      fetchPlots();
    } catch (err) {
      console.error('Failed to delete payment:', err);
    }
  };

  // ── Period helpers ──
  const getDateRange = (period) => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const toISO = (d) => d.toISOString().split('T')[0];
    switch (period) {
      case 'today': return { from: toISO(today), to: toISO(today) };
      case 'week': { const d = today.getDay(); const m = new Date(today); m.setDate(today.getDate() - (d === 0 ? 6 : d - 1)); return { from: toISO(m), to: toISO(today) }; }
      case 'month': { const f = new Date(today.getFullYear(), today.getMonth(), 1); return { from: toISO(f), to: toISO(today) }; }
      case 'last_month': { const f = new Date(today.getFullYear(), today.getMonth() - 1, 1); const l = new Date(today.getFullYear(), today.getMonth(), 0); return { from: toISO(f), to: toISO(l) }; }
      default: return { from: '', to: '' };
    }
  };

  const handlePeriodChange = (period) => {
    setFilterPeriod(period);
    if (period === 'all' || period === 'custom') {
      if (period === 'all') { setFilterDateFrom(''); setFilterDateTo(''); }
    } else {
      const { from, to } = getDateRange(period);
      setFilterDateFrom(from); setFilterDateTo(to);
    }
  };

  const clearDetailFilters = () => {
    setSearchQuery(''); setFilterFrom('all'); setFilterPeriod('all');
    setFilterDateFrom(''); setFilterDateTo('');
  };

  // ── Member team lookup (must be before filteredPlots) ──
  const memberTeamMap = useMemo(() => {
    const map = {};
    (autocomplete.members || []).forEach(m => {
      if (m.name && m.team) map[m.name] = m.team;
    });
    return map;
  }, [autocomplete]);

  const uniqueMemberTeams = useMemo(() => {
    return [...new Set((autocomplete.members || []).map(m => m.team).filter(Boolean))].sort();
  }, [autocomplete]);

  // ── Filtering ──
  const filteredPlots = useMemo(() => {
    let list = plots;
    if (filterStatus !== 'all') list = list.filter(p => p.status === filterStatus);
    if (filterBookingBy !== 'all') list = list.filter(p => p.booking_by === filterBookingBy || (p.payment_booked_bys || '').toUpperCase().includes(filterBookingBy.toUpperCase()));
    if (filterTeam !== 'all') list = list.filter(p => (p.team || '') === filterTeam);
    if (filterMemberTeam !== 'all') list = list.filter(p => {
      // Match booking_by, buyer_name, or payment_buyer_names to members with this team
      const bookingTeam = memberTeamMap[p.booking_by] || '';
      if (bookingTeam === filterMemberTeam) return true;
      const buyerTeam = memberTeamMap[p.buyer_name] || '';
      if (buyerTeam === filterMemberTeam) return true;
      // Also check payment buyer names (comma-separated)
      const payBuyers = (p.payment_buyer_names || '').split(',').map(n => n.trim());
      return payBuyers.some(name => memberTeamMap[name] === filterMemberTeam);
    });
    if (filterPending !== 'all') {
      list = list.filter((p) => {
        const pendingPct = getPendingPercent(p);
        if (filterPending === '25') return pendingPct >= 25;
        if (filterPending === '50') return pendingPct >= 50;
        if (filterPending === '75') return pendingPct >= 75;
        if (filterPending === '100') return pendingPct >= 99.999;
        if (filterPending === 'custom') {
          const min = customPendingMin === '' ? null : parseFloat(customPendingMin);
          const max = customPendingMax === '' ? null : parseFloat(customPendingMax);
          if (Number.isFinite(min) && pendingPct < min) return false;
          if (Number.isFinite(max) && pendingPct > max) return false;
          return true;
        }
        return true;
      });
    }
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter(p =>
        p.plot_no?.toLowerCase().includes(q) ||
        p.buyer_name?.toLowerCase().includes(q) ||
        p.booking_by?.toLowerCase().includes(q) ||
        p.block?.toLowerCase().includes(q) ||
        p.team?.toLowerCase().includes(q) ||
        p.payment_buyer_names?.toLowerCase().includes(q) ||
        p.payment_booked_bys?.toLowerCase().includes(q)
      );
    }
    // Single-pass sort: natural plot_no + date + search relevance combined
    const searchQ = debouncedSearch ? debouncedSearch.toLowerCase() : '';
    list = [...list].sort((a, b) => {
      // Search relevance takes priority when searching
      if (searchQ) {
        const aPlot = (a.plot_no || '').toLowerCase();
        const bPlot = (b.plot_no || '').toLowerCase();
        const aRank = aPlot === searchQ ? 0 : aPlot.startsWith(searchQ) ? 1 : 2;
        const bRank = bPlot === searchQ ? 0 : bPlot.startsWith(searchQ) ? 1 : 2;
        if (aRank !== bRank) return aRank - bRank;
      }
      if (sortBy === 'date_desc') {
        const da = a.booking_date || ''; const db = b.booking_date || '';
        return db.localeCompare(da) || naturalSortPlotNo(a.plot_no, b.plot_no);
      }
      if (sortBy === 'date_asc') {
        const da = a.booking_date || ''; const db = b.booking_date || '';
        return da.localeCompare(db) || naturalSortPlotNo(a.plot_no, b.plot_no);
      }
      return naturalSortPlotNo(a.plot_no, b.plot_no);
    });
    return list;
  }, [plots, debouncedSearch, filterStatus, filterBookingBy, filterTeam, filterMemberTeam, memberTeamMap, filterPending, customPendingMin, customPendingMax, sortBy]);

  // ── Pre-computed row data (avoids per-render parseFloat in JSX) ──
  const rowData = useMemo(() => filteredPlots.map(pl => {
    const sp = parseFloat(pl.sale_price) || 0;
    const tr = parseFloat(pl.total_received) || 0;
    const toRecBank = parseFloat(pl.to_receive_bank) || 0;
    const recBank = parseFloat(pl.received_bank) || 0;
    const recCash = parseFloat(pl.received_cash) || 0;
    const toRecCash = sp - toRecBank;
    const mTeam = memberTeamMap[pl.booking_by] || memberTeamMap[pl.buyer_name] || '';
    return { pl, sp, tr, bal: sp - tr, pct: sp > 0 ? (tr / sp) * 100 : 0, toRecBank, toRecCash, recBank, recCash, balBank: toRecBank - recBank, balCash: toRecCash - recCash, mTeam };
  }), [filteredPlots, memberTeamMap]);

  // ── OLD-tag check: case-insensitive so 'OLD', 'old', 'Old' all match.
  // Mirrors the dashboard Registry Payments card so both views bucket plots
  // the same way (data can have inconsistent casing after migrations / imports).
  const isOldPlot = (p) => String(p?.plot_tag || '').trim().toUpperCase() === 'OLD';

  // ── Memoized totals (single pass instead of 12 reduces) — exclude OLD (resold) plots ──
  const totals = useMemo(() => {
    let totSize = 0, totRate = 0, totSalePrice = 0, totToRecBank = 0, totToRecCash = 0, totRecBank = 0, totRecCash = 0, totReceived = 0, totPlotComm = 0, activeCount = 0;
    for (const p of filteredPlots) {
      if (isOldPlot(p)) continue; // skip resold/old plots from totals
      activeCount++;
      const sp = parseFloat(p.sale_price) || 0;
      const trb = parseFloat(p.to_receive_bank) || 0;
      totSize += parseFloat(p.plot_size) || 0;
      totRate += parseFloat(p.plot_rate) || 0;
      totSalePrice += sp;
      totToRecBank += trb;
      totToRecCash += sp - trb;
      totRecBank += parseFloat(p.received_bank) || 0;
      totRecCash += parseFloat(p.received_cash) || 0;
      totReceived += parseFloat(p.total_received) || 0;
      totPlotComm += parseFloat(p.plot_commission) || 0;
    }
    return { totSize, totRate, totSalePrice, totToRecBank, totToRecCash, totRecBank, totRecCash, totReceived, totPlotComm, totBalBank: totToRecBank - totRecBank, totBalCash: totToRecCash - totRecCash, totNetBal: totSalePrice - totReceived, avgPct: totSalePrice > 0 ? (totReceived / totSalePrice) * 100 : 0, activeCount };
  }, [filteredPlots]);

  // ── Totals including OLD plots — OLD plots only add received amounts (bank/cash/total).
  // Deal-specific fields (size, rate, sale price, to-receive, commission, balance, %)
  // are excluded for OLD plots because those transactions are closed/resold.
  const totalsAll = useMemo(() => {
    let totSize = 0, totRate = 0, totSalePrice = 0, totToRecBank = 0, totToRecCash = 0, totRecBank = 0, totRecCash = 0, totReceived = 0, totPlotComm = 0;
    const allCount = filteredPlots.length;
    for (const p of filteredPlots) {
      const isOld = isOldPlot(p);
      const sp = parseFloat(p.sale_price) || 0;
      const trb = parseFloat(p.to_receive_bank) || 0;
      // Deal-size/value fields: skip for OLD plots (closed deals, physical area same plot)
      if (!isOld) {
        totSize += parseFloat(p.plot_size) || 0;
        totRate += parseFloat(p.plot_rate) || 0;
        totSalePrice += sp;
        totToRecBank += trb;
        totToRecCash += sp - trb;
        totPlotComm += parseFloat(p.plot_commission) || 0;
      }
      // Received amounts: always include — actual money received is a financial fact
      totRecBank += parseFloat(p.received_bank) || 0;
      totRecCash += parseFloat(p.received_cash) || 0;
      totReceived += parseFloat(p.total_received) || 0;
    }
    return { totSize, totRate, totSalePrice, totToRecBank, totToRecCash, totRecBank, totRecCash, totReceived, totPlotComm, totBalBank: totToRecBank - totRecBank, totBalCash: totToRecCash - totRecCash, totNetBal: totSalePrice - totReceived, avgPct: totSalePrice > 0 ? (totReceived / totSalePrice) * 100 : 0, activeCount: allCount };
  }, [filteredPlots]);

  // When rows are checkbox-selected, the footer sums ONLY those rows (all columns).
  const selectedTotals = useMemo(() => {
    if (selectedPlotIds.size === 0) return null;
    return sumPlotTotals(filteredPlots.filter((p) => selectedPlotIds.has(p.id)));
  }, [filteredPlots, selectedPlotIds]);

  const displayTotals = selectedTotals || (includeOldInTotals ? totalsAll : totals);
  const oldCount = filteredPlots.filter(isOldPlot).length;

  // ── Scroll container ref ──
  const tableContainerRef = useRef(null);

  // Auto-scroll to top of table when search changes
  const prevSearchRef = useRef(debouncedSearch);
  useEffect(() => {
    if (debouncedSearch !== prevSearchRef.current) {
      prevSearchRef.current = debouncedSearch;
      if (debouncedSearch && tableContainerRef.current) {
        tableContainerRef.current.scrollTop = 0;
      }
    }
  }, [debouncedSearch]);

  const filteredPayments = useMemo(() => {
    let list = payments;
    if (filterFrom !== 'all') list = list.filter(p => (p.payment_from || '') === filterFrom);
    if (filterDateFrom) list = list.filter(p => p.date && p.date.split('T')[0] >= filterDateFrom);
    if (filterDateTo) list = list.filter(p => p.date && p.date.split('T')[0] <= filterDateTo);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p =>
        p.payment_from?.toLowerCase().includes(q) ||
        p.bank_details?.toLowerCase().includes(q) ||
        p.narration?.toLowerCase().includes(q) ||
        p.received_by?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [payments, searchQuery, filterFrom, filterDateFrom, filterDateTo]);

  // Running balance (cumulative received) — exclude bounced/returned cheques
  const isActive = (p) => !p.cheque_status || !['BOUNCED', 'RETURNED'].includes(p.cheque_status);

  const paymentsWithBalance = useMemo(() => {
    // 1. Sort ascending to calculate cumulative balance correctly
    const sortedAsc = [...filteredPayments].sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : 0;
      const db = b.date ? new Date(b.date).getTime() : 0;
      return da - db || (a.id - b.id);
    });

    let cumulative = 0;
    const withCumulative = sortedAsc.map((p) => {
      if (isActive(p)) cumulative += parseFloat(p.amount) || 0;
      return { ...p, cumulative };
    });

    // 2. Return in requested display order
    if (sortOrderPay === 'desc') {
      return withCumulative.reverse();
    }
    return withCumulative;
  }, [filteredPayments, sortOrderPay]);

  // Totals — exclude bounced/returned cheques
  const salePrice = parseFloat(plotMeta?.sale_price) || 0;
  const totalReceived = useMemo(() => payments.filter(isActive).reduce((s, p) => s + (parseFloat(p.amount) || 0), 0), [payments]);
  const balance = salePrice - totalReceived;
  const pctReceived = salePrice > 0 ? ((totalReceived / salePrice) * 100) : 0;
  const filteredTotal = useMemo(() => filteredPayments.filter(isActive).reduce((s, p) => s + (parseFloat(p.amount) || 0), 0), [filteredPayments]);
  const hasActiveDetailFilters = filterFrom !== 'all' || filterDateFrom || filterDateTo || searchQuery;

  // Bank / Cash split
  const registryArea = parseFloat(plotMeta?.registry_area) || 0;
  const circleRate = parseFloat(plotMeta?.circle_rate) || 0;
  const toReceive = registryArea * circleRate; // Column G: computed
  const toReceiveBank = parseFloat(plotMeta?.to_receive_bank) || 0; // Column H: stored
  const toReceiveCash = salePrice - toReceiveBank; // Column I: computed
  const receivedBank = parseFloat(plotMeta?.received_bank) || 0; // Column K: aggregated
  const receivedCash = parseFloat(plotMeta?.received_cash) || 0; // Column M: aggregated
  const balanceBank = toReceiveBank - receivedBank; // Column L
  const balanceCash = toReceiveCash - receivedCash; // Column N
  const firstInstallment = parseFloat(plotMeta?.first_installment) || 0; // Column Q
  const balanceFirstInstallment = firstInstallment - totalReceived; // Column R

  // Unique values for plot list filters — show ALL members + any payment-level booked_by
  const uniqueBookingBys = useMemo(() => {
    const names = new Set();
    plots.forEach(p => { if (p.booking_by) names.add(p.booking_by); });
    (autocomplete.bookedBys || []).forEach(n => { if (n) names.add(n); });
    (autocomplete.members || []).forEach(m => { if (m.name) names.add(m.name); });
    return [...names].sort();
  }, [plots, autocomplete]);

  // Members lookup for phone display in filter
  const memberPhoneMap = useMemo(() => {
    const map = {};
    (autocomplete.members || []).forEach(m => { if (m.name) map[m.name] = m.phone || ''; });
    return map;
  }, [autocomplete]);

  const uniqueTeams = useMemo(() => {
    return [...new Set(plots.map(p => p.team).filter(Boolean))].sort();
  }, [plots]);

  // ── Helpers ──
  const getAssignedAdminLabel = (record) => {
    if (!record.assigned_admin_id) return null;
    const admin = approvers.find((a) => a.id === record.assigned_admin_id);
    if (!admin) return `Admin #${record.assigned_admin_id}`;
    return admin.full_name || admin.name || admin.email;
  };

  const getStatusBadge = (status) => {
    const cls = STATUS_COLORS[status] || 'bg-slate-50 text-slate-600 border-slate-200';
    return <Badge variant="outline" className={`text-[10px] font-medium ${cls}`}>{status}</Badge>;
  };

  const getFromBadge = (from) => {
    if (!from) return null;
    const cls = FROM_COLORS[from] || 'bg-slate-50 text-slate-600 border-slate-200';
    return <Badge variant="outline" className={`text-[10px] font-medium ${cls}`}>{from}</Badge>;
  };

  // ── Download Excel ──
  const downloadExcel = () => {
    const wb = XLSX.utils.book_new();
    const p = plotMeta || selectedPlot;

    const headerRows = [
      [`PLOT ${p.plot_no}${p.block ? ' - Block ' + p.block : ''} — ${p.buyer_name || 'N/A'}`],
      [`Sale Price: ₹${fmt(salePrice)}  |  To Receive Bank: ₹${fmt(toReceiveBank)}  |  To Receive Cash: ₹${fmt(toReceiveCash)}`],
      [`Received Bank: ₹${fmt(receivedBank)}  |  Received Cash: ₹${fmt(receivedCash)}  |  Total Received: ₹${fmt(totalReceived)}  |  Balance: ₹${fmt(balance)}  |  ${pctReceived.toFixed(2)}% Received`],
      [`Booking By: ${p.booking_by || 'N/A'}  |  Size: ${p.plot_size || '-'}  |  Rate: ${p.plot_rate || '-'}  |  Registry Area: ${p.registry_area || '-'}  |  Circle Rate: ${p.circle_rate || '-'}  |  Status: ${p.status || '-'}`],
      [],
    ];

    const colHeaders = ['No', 'Date', 'FROM', 'Type', 'Bank Details', 'Narration', 'Received By', 'Buyer', 'Booked By', 'Amount (₹)', 'Cumulative (₹)'];
    headerRows.push(colHeaders);

    let cumulative = 0;
    const txnRows = payments.map((t, i) => {
      if (isActive(t)) cumulative += parseFloat(t.amount) || 0;
      return [
        i + 1,
        t.date ? new Date(t.date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '',
        t.payment_from || '',
        t.payment_type || 'CASH',
        t.bank_details || '',
        t.narration || '',
        t.received_by || '',
        t.buyer_name || '',
        t.booked_by || '',
        parseFloat(t.amount) || 0,
        cumulative,
      ];
    });

    const totalsRow = ['', '', '', '', '', '', '', '', 'TOTAL', totalReceived, ''];
    const allRows = [...headerRows, ...txnRows, totalsRow];
    const ws = XLSX.utils.aoa_to_sheet(allRows);

    ws['!cols'] = [
      { wch: 6 }, { wch: 14 }, { wch: 16 }, { wch: 10 }, { wch: 20 },
      { wch: 28 }, { wch: 22 }, { wch: 20 }, { wch: 20 }, { wch: 18 }, { wch: 18 },
    ];
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 10 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 10 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 10 } },
      { s: { r: 3, c: 0 }, e: { r: 3, c: 10 } },
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Payments');
    const filename = `Plot_${(p.plot_no || '').replace(/[^a-zA-Z0-9]/g, '_')}_Payments_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  // ── Download All Plots Excel ──
  const downloadAllPlotsExcel = () => {
    const wb = XLSX.utils.book_new();
    const headerRows = [
      [`Plot Payments — ${currentSite?.name || ''}`],
      [`Total Plots: ${filteredPlots.length}`],
      [],
    ];
    const colHeaders = ['No', 'Plot No', 'Tag', 'Status', 'Block', 'Buyer Name', 'Size (Gaz)', 'Size (Mtr)', 'Rate', 'Sale Price (₹)', 'Comm Rate', 'Plot Commission (₹)', 'Circle Rate', 'To Rec Bank (₹)', 'To Rec Cash (₹)', 'Rec Bank (₹)', 'Bal Bank (₹)', 'Rec Cash (₹)', 'Bal Cash (₹)', 'Total Received (₹)', 'Balance (₹)', '% Received', '1st Install (₹)', 'Booking By', 'Team', 'Booking Date', 'Payments'];
    headerRows.push(colHeaders);

    const rows = filteredPlots.map((p, i) => {
      const sp = parseFloat(p.sale_price) || 0;
      const tr = parseFloat(p.total_received) || 0;
      const bal = sp - tr;
      const pct = sp > 0 ? ((tr / sp) * 100).toFixed(2) + '%' : '0%';
      const toRecBank = parseFloat(p.to_receive_bank) || 0;
      const toRecCash = sp - toRecBank;
      const recBank = parseFloat(p.received_bank) || 0;
      const recCash = parseFloat(p.received_cash) || 0;
      const balBank = toRecBank - recBank;
      const balCash = toRecCash - recCash;
      const firstInst = parseFloat(p.first_installment) || 0;
      const commRate = parseFloat(p.commission_rate) || 0;
      const plotComm = parseFloat(p.plot_commission) || 0;
      return [
        i + 1, p.plot_no, p.plot_tag || '', p.status || '', p.block || '', p.buyer_name || '',
        p.plot_size || '', p.plot_size_mtr || '', p.plot_rate || '', sp, commRate, plotComm,
        p.circle_rate || '', toRecBank, toRecCash,
        recBank, balBank, recCash, balCash,
        tr, bal, pct, firstInst,
        p.booking_by || '', p.team || '', p.booking_date ? new Date(p.booking_date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '', p.payment_count || 0,
      ];
    });

    const allRows = [...headerRows, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(allRows);
    ws['!cols'] = [
      { wch: 6 }, { wch: 10 }, { wch: 8 }, { wch: 12 }, { wch: 8 }, { wch: 22 }, { wch: 10 }, { wch: 10 },
      { wch: 16 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
      { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
      { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 14 }, { wch: 20 }, { wch: 8 }, { wch: 14 }, { wch: 10 },
    ];
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 26 } },
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'All Plots');
    XLSX.writeFile(wb, `Plot_Payments_${currentSite?.name?.replace(/[^a-zA-Z0-9]/g, '_') || 'export'}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // ── Print All / Selected Plots as PDF ──
  const printSelectedPlots = () => {
    const plotsToPrint = selectedPlotIds.size > 0
      ? filteredPlots.filter(p => selectedPlotIds.has(p.id))
      : filteredPlots;

    if (plotsToPrint.length === 0) return;

    const activePlots = plotsToPrint.filter(p => !isOldPlot(p));
    const grandTotalSize = activePlots.reduce((s, p) => s + (parseFloat(p.plot_size) || 0), 0);
    const grandTotalSizeMtr = activePlots.reduce((s, p) => s + (parseFloat(p.plot_size_mtr) || 0), 0);
    const grandTotalSP = activePlots.reduce((s, p) => s + (parseFloat(p.sale_price) || 0), 0);
    const grandTotalRec = activePlots.reduce((s, p) => s + (parseFloat(p.total_received) || 0), 0);
    const grandBalance = grandTotalSP - grandTotalRec;
    const grandToRecBank = activePlots.reduce((s, p) => s + (parseFloat(p.to_receive_bank) || 0), 0);
    const grandToRecCash = activePlots.reduce((s, p) => {
      const sp = parseFloat(p.sale_price) || 0;
      const trb = parseFloat(p.to_receive_bank) || 0;
      return s + (sp - trb);
    }, 0);
    const grandRecBank = activePlots.reduce((s, p) => s + (parseFloat(p.received_bank) || 0), 0);
    const grandRecCash = activePlots.reduce((s, p) => s + (parseFloat(p.received_cash) || 0), 0);
    const grandBalBank = grandToRecBank - grandRecBank;
    const grandBalCash = grandToRecCash - grandRecCash;

    const rows = plotsToPrint.map((p, i) => {
      const sp = parseFloat(p.sale_price) || 0;
      const tr = parseFloat(p.total_received) || 0;
      const bal = sp - tr;
      const pct = sp > 0 ? ((tr / sp) * 100).toFixed(1) + '%' : '0%';
      const toRecBank = parseFloat(p.to_receive_bank) || 0;
      const toRecCash = sp - toRecBank;
      const recBank = parseFloat(p.received_bank) || 0;
      const recCash = parseFloat(p.received_cash) || 0;
      const balBank = toRecBank - recBank;
      const balCash = toRecCash - recCash;
      return `<tr>
        <td style="text-align:center">${i + 1}</td>
        <td><strong>${p.plot_no || ''}</strong>${p.plot_tag ? ` <span style="font-size:9px;padding:1px 4px;border-radius:3px;background:${p.plot_tag === 'OLD' ? '#f1f5f9' : '#d1fae5'};color:${p.plot_tag === 'OLD' ? '#64748b' : '#065f46'}">${p.plot_tag}</span>` : ''}</td>
        <td><span style="padding:2px 8px;border-radius:4px;font-size:10px;background:${p.status === 'REGISTRY' ? '#d1fae5' : p.status === 'CANCELLED' ? '#fee2e2' : p.status === 'RESALE' ? '#fef3c7' : '#dbeafe'};color:${p.status === 'REGISTRY' ? '#065f46' : p.status === 'CANCELLED' ? '#991b1b' : p.status === 'RESALE' ? '#92400e' : '#1e40af'}">${p.status || ''}</span></td>
        <td>${p.block || ''}</td>
        <td>${p.buyer_name || '—'}</td>
        <td style="text-align:right">${p.plot_size || '—'}</td>
        <td style="text-align:right">${p.plot_size_mtr || '—'}</td>
        <td style="text-align:right">${sp > 0 ? '₹' + sp.toLocaleString('en-IN') : '—'}</td>
        <td style="text-align:right">₹${toRecBank.toLocaleString('en-IN')}</td>
        <td style="text-align:right">₹${toRecCash.toLocaleString('en-IN')}</td>
        <td style="text-align:right">₹${recBank.toLocaleString('en-IN')}</td>
        <td style="text-align:right;color:${balBank <= 0 ? '#059669' : '#dc2626'}">₹${balBank.toLocaleString('en-IN')}</td>
        <td style="text-align:right">₹${recCash.toLocaleString('en-IN')}</td>
        <td style="text-align:right;color:${balCash <= 0 ? '#059669' : '#dc2626'}">₹${balCash.toLocaleString('en-IN')}</td>
        <td style="text-align:right"><strong>₹${tr.toLocaleString('en-IN')}</strong></td>
        <td style="text-align:center">${pct}</td>
        <td>${p.booking_by || '—'}</td>
        <td>${p.team || '—'}</td>
        <td>${p.booking_date ? new Date(p.booking_date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}</td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html><head><title>Plot Payments - ${currentSite?.name || ''}</title>
<style>
  @page { size: A3 landscape; margin: 10mm; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Segoe UI',Arial,sans-serif; color:#1e293b; background:#fff; padding:16px; font-size:11px; }
  h1 { font-size:18px; margin-bottom:4px; }
  .sub { color:#64748b; font-size:12px; margin-bottom:12px; }
  table { width:100%; border-collapse:collapse; font-size:10px; }
  th { background:#f1f5f9; padding:6px 8px; text-align:left; font-weight:700; font-size:9px; text-transform:uppercase; letter-spacing:0.5px; color:#475569; border-bottom:2px solid #e2e8f0; }
  td { padding:5px 8px; border-bottom:1px solid #f1f5f9; }
  tr:hover { background:#f8fafc; }
  .totals td { font-weight:700; background:#f1f5f9; border-top:2px solid #e2e8f0; }
  .footer { margin-top:16px; text-align:center; color:#94a3b8; font-size:10px; }
  @media print { body { padding:0; } .no-print { display:none !important; } }
</style>
</head><body>
  <h1>${currentSite?.name || 'Plot Payments'}</h1>
  <div class="sub">${activePlots.length} plots${activePlots.length < plotsToPrint.length ? ` (${plotsToPrint.length - activePlots.length} old excluded)` : ''} · Generated on ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}</div>
  <table>
    <thead><tr>
      <th>#</th><th>Plot No</th><th>Status</th><th>Block</th><th>Buyer Name</th><th style="text-align:right">Size (Gaz)</th><th style="text-align:right">Size (Mtr)</th>
      <th style="text-align:right">Sale Price</th>
      <th style="text-align:right">To Rec Bank</th><th style="text-align:right">To Rec Cash</th>
      <th style="text-align:right">Rec Bank</th><th style="text-align:right">Bal Bank</th>
      <th style="text-align:right">Rec Cash</th><th style="text-align:right">Bal Cash</th>
      <th style="text-align:right">Total Rec</th><th style="text-align:center">%</th>
      <th>Booking By</th><th>Team</th><th>Date</th>
    </tr></thead>
    <tbody>${rows}
      <tr class="totals">
        <td colspan="5" style="text-align:right;font-size:9px;letter-spacing:0.5px;text-transform:uppercase;">TOTAL (${activePlots.length} plots${activePlots.length < plotsToPrint.length ? ', ' + (plotsToPrint.length - activePlots.length) + ' old excluded' : ''})</td>
        <td style="text-align:right">${grandTotalSize.toLocaleString('en-IN')}</td>
        <td style="text-align:right">${grandTotalSizeMtr.toLocaleString('en-IN')}</td>
        <td style="text-align:right">₹${grandTotalSP.toLocaleString('en-IN')}</td>
        <td style="text-align:right">₹${grandToRecBank.toLocaleString('en-IN')}</td>
        <td style="text-align:right">₹${grandToRecCash.toLocaleString('en-IN')}</td>
        <td style="text-align:right">₹${grandRecBank.toLocaleString('en-IN')}</td>
        <td style="text-align:right;color:${grandBalBank <= 0 ? '#059669' : '#dc2626'}">₹${grandBalBank.toLocaleString('en-IN')}</td>
        <td style="text-align:right">₹${grandRecCash.toLocaleString('en-IN')}</td>
        <td style="text-align:right;color:${grandBalCash <= 0 ? '#059669' : '#dc2626'}">₹${grandBalCash.toLocaleString('en-IN')}</td>
        <td style="text-align:right">₹${grandTotalRec.toLocaleString('en-IN')}</td>
        <td style="text-align:center">${grandTotalSP > 0 ? ((grandTotalRec / grandTotalSP) * 100).toFixed(1) + '%' : '0%'}</td>
        <td colspan="3" style="text-align:right;color:${grandBalance <= 0 ? '#059669' : '#dc2626'}">Bal: ₹${grandBalance.toLocaleString('en-IN')}</td>
      </tr>
    </tbody>
  </table>
  <div class="footer">Generated on ${new Date().toLocaleString('en-IN')} · ${currentSite?.name || ''}</div>
  <div class="no-print" style="text-align:center;margin-top:20px;">
    <button onclick="window.print()" style="padding:10px 32px;font-size:14px;font-weight:600;background:#0f172a;color:#fff;border:none;border-radius:8px;cursor:pointer;">Print</button>
    <button onclick="window.close()" style="padding:10px 32px;font-size:14px;font-weight:600;background:#e2e8f0;color:#475569;border:none;border-radius:8px;cursor:pointer;margin-left:8px;">Close</button>
  </div>
</body></html>`;

    const printWindow = window.open('', '_blank', 'width=1200,height=800');
    printWindow.document.write(html);
    printWindow.document.close();
  };

  // ── Print Receipt (farmer-style two-copy layout) ──
  const printReceipt = async (pay) => {
    const plot = plotMeta || selectedPlot;
    const amt = parseFloat(pay.amount) || 0;
    const isNegative = amt < 0;
    const absAmt = Math.abs(amt);
    const fromMode = String(pay.payment_from || '').toUpperCase();
    const isRefundEntry = fromMode === 'REFUND';
    const amountColor = isRefundEntry ? '#ca8a04' : (isNegative ? '#dc2626' : '#059669');
    const siteName = (currentSite?.name || 'ALLOTMENT DIVISION').toUpperCase();
    const siteAddr = [currentSite?.address, currentSite?.city, currentSite?.state].filter(Boolean).join(', ').toUpperCase();
    const fmtINR = (v) => parseFloat(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 });
    const payDate = pay.date ? new Date(pay.date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
    const printedAt = new Date().toLocaleString('en-IN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
    const isCash = pay.payment_from?.toUpperCase() === 'CASH';
    const signerName = user?.full_name || user?.name || '';

    let qrDataUrl = null;
    if (pay.verifyUrl) {
      try {
        qrDataUrl = await QRCode.toDataURL(pay.verifyUrl, {
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
            <p>${siteAddr || 'ESTABLISHED REAL PROPERTY DIVISION'}</p>
          </div>
          <div class="doc-type"><h2>Plot Payment Receipt</h2></div>
          <div class="meta-info">
            <div class="meta-item"><b>Ref:</b> ACK-${pay.id}</div>
            <div class="meta-item"><b>Date:</b> ${payDate}</div>
          </div>
          <div class="kv-qr-wrap">
            <div class="kv-section">
              <div class="kv-row"><div class="k">Received From</div><div class="c">:</div><div class="v">${(plot?.buyer_name || 'UNDEFINED ENTITY').toUpperCase()}</div></div>
              ${plot?.plot_no ? `<div class="kv-row"><div class="k">For Plot No</div><div class="c">:</div><div class="v">${String(plot.plot_no).toUpperCase()}</div></div>` : ''}
              <div class="kv-row"><div class="k">Amount</div><div class="c">:</div><div class="v" style="color:${amountColor}">RS ${isNegative ? '-' : ''}${fmtINR(absAmt)}/-</div></div>
              <div class="kv-row"><div class="k">Payment Mode</div><div class="c">:</div><div class="v">${(pay.payment_from || 'LIQUID ASSETS').toUpperCase()}</div></div>
            </div>
            ${qrSection}
          </div>
          <div class="settlement-title">Payment Details:</div>
          <table class="data-table">
            <tr><th>S.No.</th><td>#${pay.id}</td></tr>
            <tr><th>Date</th><td>${payDate || '—'}</td></tr>
            <tr><th>Method of Remittance</th><td>${(pay.payment_from || 'LIQUID ASSETS').toUpperCase()}</td></tr>
            ${pay.bank_details ? `<tr><th>Instrument Particulars</th><td>${String(pay.bank_details).toUpperCase()}</td></tr>` : ''}
            ${pay.received_by ? `<tr><th>Authenticated By</th><td>${String(pay.received_by).toUpperCase()}</td></tr>` : ''}
            <tr><th>Allocation Site</th><td>${siteName}</td></tr>
            <tr><th>Amount</th><td style="color:${amountColor}">RS ${isNegative ? '-' : ''}${fmtINR(absAmt)}/-</td></tr>
          </table>
          ${isCash ? '<div class="bank-proviso">STATUTORY PROVISO: Cash received exclusively as a temporary custodian on behalf of our designated banking institution for immediate reconciliation and ledger entry.</div>' : ''}
          <div class="footer">
            <div class="sig-box"><div class="sig-line">Signature of the Remitter</div></div>
            <div class="sig-box"><div class="digital-signature">${signerName}</div><div class="sig-line">Authorized Signatory & Seal</div></div>
          </div>
          <div class="print-meta">Printed on: <b>${printedAt}</b></div>
        </div>
      </div>
    `;

    const html = `<!DOCTYPE html>
<html><head>
  <title>PLOT PAYMENT RECEIPT - ${pay.id}</title>
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
    ${receiptBlock('Buyer Copy')}
  </div>
  <div class="no-print" style="position:fixed; bottom: 30px; left:0; right:0; text-align:center; z-index:1000;">
    <button onclick="(async () => { try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch(e){} window.print(); })()" style="padding:12px 50px; font-size:15px; font-weight:700; background:#0f172a; color:#fff; border:none; border-radius:10px; cursor:pointer; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.2);">EXECUTE PRINT (A4)</button>
    <button onclick="window.close()" style="padding:12px 50px; font-size:15px; font-weight:700; background:#fff; color:#475569; border:1px solid #e2e8f0; border-radius:10px; cursor:pointer; margin-left:15px;">TERMINATE</button>
  </div>
</body></html>`;

    const printWindow = window.open('', '_blank', 'width=1000,height=750');
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const printStatement = () => {
    const plot = plotMeta || selectedPlot;
    const siteName = (currentSite?.name || '').toUpperCase();
    const siteAddr = [currentSite?.address, currentSite?.city, currentSite?.state].filter(Boolean).join(', ').toUpperCase();
    const fmtINR = (v) => parseFloat(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 });
    const selected = selectedPayIds.size > 0
      ? paymentsWithBalance.filter(p => selectedPayIds.has(p.id))
      : paymentsWithBalance;
    if (selected.length === 0) return;

    const grandTotal = selected.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
    const salePrice = parseFloat(plot.sale_price || 0);
    const balanceAmt = salePrice - grandTotal;
    const grandTotalSign = grandTotal < 0 ? '-' : '';
    const balanceSign = balanceAmt < 0 ? '-' : '';
    const balanceColor = balanceAmt >= 0 ? '#059669' : '#dc2626';

    const html = `<!DOCTYPE html>
<html>
<head>
  <title>STATEMENT OF ACCOUNT - ${plot.plot_no}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Inter:wght@400;500;600;700&display=swap');
    
    @page { size: A4 portrait; margin: 10mm; }
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: 'Inter', sans-serif; color: #1e293b; background: #f8fafc; padding: 15mm 0; display: flex; justify-content: center; }
    
    .document {
      background: white;
      width: 210mm;
      min-height: 297mm;
      padding: 15mm;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
      border: 1px solid #e2e8f0;
      position: relative;
    }

    .header { text-align: center; margin-bottom: 10mm; border-bottom: 3px double #0f172a; padding-bottom: 8mm; }
    .header h1 { font-family: 'Cinzel', serif; font-size: 28px; color: #0f172a; text-transform: uppercase; letter-spacing: 2px; }
    .header p { font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 600; margin-top: 4px; }
    
    .stmt-title { text-align: center; margin-bottom: 8mm; font-family: 'Cinzel', serif; font-size: 16px; color: #64748b; text-decoration: underline; text-underline-offset: 4px; letter-spacing: 4px; text-transform: uppercase; }

    .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4mm; margin-bottom: 8mm; background: #f8fafc; padding: 4mm; border: 1px solid #e2e8f0; border-radius: 4px; }
    .info-item { display: flex; flex-direction: column; }
    .info-lbl { font-size: 9px; text-transform: uppercase; color: #94a3b8; font-weight: 700; margin-bottom: 1px; }
    .info-val { font-size: 12px; font-weight: 700; color: #0f172a; }

    table { width: 100%; border-collapse: collapse; margin-bottom: 10mm; font-size: 11px; }
    th { background: #f1f5f9; padding: 3mm 2mm; text-align: left; text-transform: uppercase; font-size: 9px; font-weight: 800; color: #475569; border: 1px solid #cbd5e1; }
    td { padding: 3mm 2mm; border: 1px solid #e2e8f0; color: #334155; }
    tr:nth-child(even) { background: #fbfcfd; }

    .total-row td { background: #f8fafc; font-weight: 800; border-top: 2px solid #0f172a; font-size: 12px; color: #0f172a; }
    .bal-row td { background: #fff; font-weight: 800; font-size: 13px; }

    .footer { margin-top: 15mm; padding-top: 10mm; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8; }

    @media print {
      body { background: white; padding: 0; }
      .document { box-shadow: none; border: none; width: 100%; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="document">
    <div class="header">
      <h1>${siteName}</h1>
      <p>${siteAddr || 'STATUTORY REAL PROPERTY DIVISION'}</p>
    </div>

    <div class="stmt-title">Statement of Account</div>

    <div class="info-grid">
      <div class="info-item"><div class="info-lbl">Plot Identifier</div><div class="info-val">${plot.plot_no}${plot.block ? ' (Block ' + plot.block + ')' : ''}</div></div>
      <div class="info-item"><div class="info-lbl">Primary Allottee</div><div class="info-val">${(plot.buyer_name || 'UNDEFINED').toUpperCase()}</div></div>
      <div class="info-item"><div class="info-lbl">Allotment Date</div><div class="info-val">${new Date(plot.booking_date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}</div></div>
      <div class="info-item"><div class="info-lbl">Total Consideration</div><div class="info-val">₹${fmtINR(salePrice)}</div></div>
      <div class="info-item"><div class="info-lbl">Aggregated Credits</div><div class="info-val" style="color:${grandTotal < 0 ? '#dc2626' : '#059669'}">${grandTotalSign}₹${fmtINR(Math.abs(grandTotal))}</div></div>
      <div class="info-item"><div class="info-lbl">Outstanding Balance</div><div class="info-val" style="color:${balanceColor}">${balanceSign}₹${fmtINR(Math.abs(balanceAmt))}</div></div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width:30px; text-align:center">#</th>
          <th style="width:80px">Date</th>
          <th style="width:100px">Remitter</th>
          <th style="width:180px">Instrument Details</th>
          <th>Buyer</th>
          <th>Booked By</th>
          <th style="text-align:right">Quantum (₹)</th>
          <th style="text-align:right; width:120px">Cumulative (₹)</th>
        </tr>
      </thead>
      <tbody>
        ${selected.map((pay, idx) => {
          const amt = parseFloat(pay.amount) || 0;
          const currSum = selected.slice(0, idx + 1).reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
          const fromMode = String(pay.payment_from || '').toUpperCase();
          const isRefundEntry = fromMode === 'REFUND';
          const amountColor = isRefundEntry ? '#ca8a04' : (amt < 0 ? '#dc2626' : '#059669');
          const cumulativeColor = currSum < 0 ? '#dc2626' : '#059669';
          return `<tr>
            <td style="text-align:center">${idx + 1}</td>
            <td style="white-space:nowrap">${pay.date ? new Date(pay.date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''}</td>
            <td>${(pay.payment_from || 'LIQUID').toUpperCase()}</td>
            <td style="font-family:monospace; font-size:10px">${(pay.bank_details || 'DIRECT').toUpperCase()}</td>
            <td>${(pay.buyer_name || '').toUpperCase()}</td>
            <td>${(pay.booked_by || '').toUpperCase()}</td>
            <td style="text-align:right; font-weight:700; color:${amountColor}">${amt < 0 ? '-' : ''}${fmtINR(Math.abs(amt))}</td>
            <td style="text-align:right; font-weight:700; color:${cumulativeColor}">${currSum < 0 ? '-' : ''}₹${fmtINR(Math.abs(currSum))}</td>
          </tr>`;
        }).join('')}
        <tr class="total-row">
          <td colspan="6" style="text-align:right">CUMULATIVE REMITTANCE</td>
          <td style="text-align:right; color:${grandTotal < 0 ? '#dc2626' : '#059669'}">${grandTotalSign}₹${fmtINR(Math.abs(grandTotal))}</td>
          <td></td>
        </tr>
        <tr class="bal-row">
          <td colspan="6" style="text-align:right">NET FISCAL LIABILITY</td>
          <td style="text-align:right; color:${balanceColor}">${balanceSign}₹${fmtINR(Math.abs(balanceAmt))}</td>
          <td></td>
        </tr>
      </tbody>
    </table>

    <div class="footer">
      <span>Instrument Generated on ${new Date().toLocaleString('en-IN')}</span>
      <span>${siteName} · Authorized Statement</span>
    </div>
  </div>

  <div class="no-print" style="position:fixed; bottom: 30px; left:0; right:0; text-align:center;">
    <button onclick="window.print()" style="padding:12px 50px; font-size:15px; font-weight:700; background:#0f172a; color:#fff; border:none; border-radius:10px; cursor:pointer; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.2);">
      EXECUTE PRINT (A4)
    </button>
    <button onclick="window.close()" style="padding:12px 50px; font-size:15px; font-weight:700; background:#fff; color:#475569; border:1px solid #e2e8f0; border-radius:10px; cursor:pointer; margin-left:15px;">
      TERMINATE
    </button>
  </div>
</body>
</html>`;

    const w = window.open('', '_blank', 'width=1100,height=700');
    w.document.write(html);
    w.document.close();
  };

    const renderPlotDialog = () => (
        <Dialog open={plotDialogOpen} onOpenChange={(open) => { setPlotDialogOpen(open); if (!open) { resetPlotForm(); setDuplicateWarning(null); } }}>
          <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto p-0 gap-0 border-slate-200">
            <DialogHeader className="px-5 py-4 border-b border-slate-200 bg-white">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${editingPlot && !canUpdate ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                  {editingPlot ? <Edit2 className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
                </div>
                <div>
                  <DialogTitle className="text-base font-semibold text-slate-900">{editingPlot && !canUpdate ? 'Request Plot Edit' : editingPlot ? 'Edit Plot' : 'Add Plot'}</DialogTitle>
                  <DialogDescription className="text-sm text-slate-500">
                {editingPlot && !canUpdate ? 'Submit an edit request with proof photo for admin approval.' : editingPlot ? 'Update plot details.' : 'Register a new plot sale / booking.'}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            {message.text && (
              <div className={`flex gap-2 p-3 rounded-lg text-sm ${message.type === 'success'
                ? 'bg-emerald-50 border border-emerald-100 text-emerald-700'
                : 'bg-red-50 border border-red-100 text-red-700'
                }`}>
                {message.type === 'success' ? <Check className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
                {message.text}
              </div>
            )}

            {/* Duplicate Warning */}
            {duplicateWarning && (
              <div className="mx-5 mt-3 p-4 rounded-lg border border-amber-200 bg-amber-50">
                <div className="flex items-start gap-2 mb-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800">Duplicate Plot Found</p>
                    <p className="text-xs text-amber-700 mt-1">
                      This plot number already exists but is marked as <Badge className="text-[10px] bg-orange-100 text-orange-700 border-orange-200 mx-0.5">RESALE</Badge>. 
                      The existing plot will be tagged as <strong>OLD</strong> and the new one as <strong>NEW</strong>.
                    </p>
                  </div>
                </div>
                <div className="space-y-1 mb-3 ml-7">
                  {duplicateWarning.duplicates.map((d) => (
                    <div key={d.id} className="text-xs text-amber-800 flex items-center gap-2">
                      <span className="font-medium">{d.buyer_name || 'N/A'}</span>
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0">{d.status}</Badge>
                      {d.plot_tag && <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-slate-100">{d.plot_tag}</Badge>}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 ml-7">
                  <Button type="button" size="sm" className="h-7 text-xs bg-amber-600 hover:bg-amber-700" onClick={handleConfirmDuplicate} disabled={submitting}>
                    {submitting ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                    Yes, Create New Plot
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => setDuplicateWarning(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            <form
              onSubmit={handleSubmitPlot}
              className="space-y-4 p-5 bg-white [&_label]:text-[11px] [&_label]:font-semibold [&_label]:uppercase [&_label]:tracking-wide [&_label]:text-slate-600 [&_input]:bg-slate-50 [&_input]:border-slate-200 [&_input]:focus-visible:ring-slate-400"
            >
              {/* Row 1: Block, Plot No, Status */}
              <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-blue-600" />
                  <p className="text-xs font-semibold text-slate-700">Plot Basics</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Block *</Label>
                  <Select
                    value={plotForm.block || '_none'}
                    onValueChange={(v) => {
                      const blockOnly = v === '_none' ? '' : sanitizeBlock(v);
                      setPlotForm((prev) => ({
                        ...prev,
                        block: blockOnly,
                        plot_no: buildPlotNo(blockOnly, prev.plot_no),
                      }));
                    }}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select block" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Select block...</SelectItem>
                      {BLOCK_OPTIONS.map((block) => (
                        <SelectItem key={block} value={block}>{block}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Plot No (Numeric) *</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="45"
                    value={extractPlotNumber(plotForm.plot_no)}
                    onChange={(e) => {
                      const numOnly = extractPlotNumber(e.target.value);
                      setPlotForm((prev) => ({ ...prev, plot_no: buildPlotNo(prev.block, numOnly) }));
                    }}
                    required
                  />
                  <p className="text-[10px] text-slate-400">Final plot no: {plotForm.plot_no || '—'}</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Status</Label>
                  <Select
                    value={plotForm.status}
                    onValueChange={(v) => setPlotForm((prev) => ({
                      ...prev,
                      status: v,
                      booking_date: isAdmin
                        ? (prev.booking_date || (v === 'COMPANY' || v === 'BOOKED' ? todayISO() : ''))
                        : autoStatusDate(v, prev.status === v ? prev.booking_date : ''),
                    }))}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper" className="max-h-60">
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                </div>
              </div>

              {/* Row 2: Member Assignment (edit only) */}
              {editingPlot && (
              <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-indigo-600" />
                  <p className="text-xs font-semibold text-slate-700">Member Assignment</p>
                </div>
                {(plotForm.status === 'RESALE' || plotForm.status === 'TRANSFERRED') && (
                  <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                    Status is {plotForm.status}. Buyer and Booking By are kept from previous data — update if needed.
                  </p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Buyer Name</Label>
                  <Popover open={buyerOpen} onOpenChange={setBuyerOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" aria-expanded={buyerOpen}
                        className="w-full justify-between font-normal h-9 text-sm bg-slate-50 border-slate-200 text-slate-700">
                        {plotForm.buyer_name ? (
                          <span className="flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5 text-slate-500" />
                            {plotForm.buyer_name}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-slate-500">
                            <User className="h-3.5 w-3.5" />
                            Select member...
                          </span>
                        )}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search name or phone..." value={buyerSearch} onValueChange={setBuyerSearch} />
                        <CommandList>
                          <CommandEmpty>No member found.</CommandEmpty>
                          <CommandGroup>
                            {(autocomplete.members || []).map((m) => (
                              <CommandItem key={m.name} value={m.name + ' ' + m.phone}
                                onSelect={() => { setPlotForm({ ...plotForm, buyer_name: m.name }); setBuyerOpen(false); setBuyerSearch(''); }}>
                                <Check className={`mr-2 h-4 w-4 ${plotForm.buyer_name === m.name ? 'opacity-100' : 'opacity-0'}`} />
                                <div className="flex flex-col">
                                  <span className="flex items-center gap-1.5"><User className="h-3.5 w-3.5 text-slate-500" />{m.name}</span>
                                  {m.phone && <span className="text-xs text-muted-foreground">{m.phone}</span>}
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Booking By</Label>
                  <Popover open={bookingByOpen} onOpenChange={setBookingByOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" aria-expanded={bookingByOpen}
                        className="w-full justify-between font-normal h-9 text-sm bg-slate-50 border-slate-200 text-slate-700">
                        {plotForm.booking_by ? (
                          <span className="flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5 text-slate-500" />
                            {plotForm.booking_by}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-slate-500">
                            <User className="h-3.5 w-3.5" />
                            Select member...
                          </span>
                        )}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search name or phone..." value={bookingBySearch} onValueChange={setBookingBySearch} />
                        <CommandList>
                          <CommandEmpty>No member found.</CommandEmpty>
                          <CommandGroup>
                            {(autocomplete.members || []).map((m) => (
                              <CommandItem key={m.name} value={m.name + ' ' + m.phone}
                                onSelect={() => { setPlotForm({ ...plotForm, booking_by: m.name }); setBookingByOpen(false); setBookingBySearch(''); }}>
                                <Check className={`mr-2 h-4 w-4 ${plotForm.booking_by === m.name ? 'opacity-100' : 'opacity-0'}`} />
                                <div className="flex flex-col">
                                  <span className="flex items-center gap-1.5"><User className="h-3.5 w-3.5 text-slate-500" />{m.name}</span>
                                  {m.phone && <span className="text-xs text-muted-foreground">{m.phone}</span>}
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                </div>
              </div>
              )}

              {/* Row 3: Size (Gaz & Mtr), Rate, Sale Price, Commission, Bank Amount */}
              <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Ruler className="w-3.5 h-3.5 text-blue-600" />
                  <p className="text-xs font-semibold text-slate-700">Plot Size (Area) *</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Size in Gaz / Sq Yards *</Label>
                  <Input type="number" step="0.01" placeholder="36.67"
                    value={plotForm.plot_size}
                    onChange={(e) => {
                      const gaz = e.target.value;
                      const mtr = gaz ? String((parseFloat(gaz) * SQ_YARD_TO_SQ_MTR).toFixed(2)) : '';
                      setPlotForm((prev) => ({ ...prev, plot_size: gaz, plot_size_mtr: mtr }));
                    }}
                    required />
                  <p className="text-[10px] text-slate-400">Auto fills Mtr if you enter Sq Yards</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Size in Sq Meters (Mtr) *</Label>
                  <Input type="number" step="0.01" placeholder="30.66"
                    value={plotForm.plot_size_mtr}
                    onChange={(e) => {
                      const mtr = e.target.value;
                      const gaz = mtr ? String((parseFloat(mtr) / SQ_YARD_TO_SQ_MTR).toFixed(2)) : '';
                      setPlotForm((prev) => ({ ...prev, plot_size_mtr: mtr, plot_size: gaz }));
                    }}
                    required />
                  <p className="text-[10px] text-slate-400">Auto fills Gaz if you enter Mtr</p>
                </div>
                </div>
              </div>

              {/* Pricing Row 1: Plot Rate & Discount */}
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/30 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <IndianRupee className="w-3.5 h-3.5 text-emerald-600" />
                  <p className="text-xs font-semibold text-emerald-800">Plot Sale Price = Size (Gaz) × Plot Rate</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Plot Rate (₹ per Gaz) *</Label>
                  <Input type="number" step="0.01" placeholder="14500"
                    value={plotForm.plot_rate}
                    onChange={(e) => setPlotForm((prev) => ({ ...prev, plot_rate: e.target.value }))}
                    required />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Sale Price (₹) = Size × Rate</Label>
                  <Input type="number" step="0.01" placeholder="Auto-calculated"
                    value={plotForm.sale_price}
                    readOnly
                    disabled
                    className="bg-emerald-50 font-semibold" />
                  {plotForm.plot_size && plotForm.plot_rate && (
                    <p className="text-[10px] text-emerald-600">Auto: {plotForm.plot_size} × {plotForm.plot_rate} = ₹{plotForm.sale_price}</p>
                  )}
                </div>
                {plotForm.status !== 'COMPANY' && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">{plotForm.status === 'BOOKED' ? 'Booked Date' : 'Status Date'}</Label>
                  <Input
                    type="date"
                    value={plotForm.booking_date || todayISO()}
                    onChange={(e) => setPlotForm((prev) => ({ ...prev, booking_date: e.target.value }))}
                  />
                </div>
                )}
                </div>

                {/* Discount Section */}
                {editingPlot && (() => {
                  const origRate = parseFloat(plotForm.plot_rate) || 0;
                  const discount = parseFloat(plotForm.discount_rate) || 0;
                  const effectiveRate = origRate - discount;
                  const plotSize = parseFloat(plotForm.plot_size) || 0;
                  const originalSalePrice = plotSize * origRate;
                  const newSalePrice = plotSize * effectiveRate;
                  const savingsAmount = originalSalePrice - newSalePrice;
                  const savingsPercent = origRate > 0 ? ((discount / origRate) * 100).toFixed(1) : 0;
                  return (
                    <div className="mt-3 pt-3 border-t border-emerald-200">
                      <div className="flex items-center gap-2 mb-2.5">
                        <Tag className="w-3.5 h-3.5 text-amber-600" />
                        <p className="text-xs font-semibold text-amber-800">Discount & Pricing</p>
                        {discount > 0 && (
                          <Badge className="text-[9px] bg-amber-100 text-amber-700 border-amber-200 ml-auto">
                            {savingsPercent}% off · Save ₹{fmt(savingsAmount)}
                          </Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="space-y-1">
                          <Label className="text-[10px] font-medium text-slate-500">Original Rate</Label>
                          <p className="text-sm font-semibold text-slate-700">₹{fmt(origRate)}</p>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium">Discount (per Gaz)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            max={origRate}
                            value={plotForm.discount_rate}
                            onChange={(e) => setPlotForm((prev) => ({ ...prev, discount_rate: e.target.value }))}
                            className="h-8 text-xs"
                            placeholder="0"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] font-medium text-slate-500">Effective Rate</Label>
                          <p className={`text-sm font-bold ${discount > 0 ? 'text-amber-700' : 'text-slate-700'}`}>
                            ₹{fmt(effectiveRate)}
                            {discount > 0 && <span className="text-[10px] font-normal text-red-500 ml-1">(-₹{fmt(discount)})</span>}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] font-medium text-slate-500">New Sale Price</Label>
                          <p className="text-sm font-bold text-emerald-700">₹{fmt(newSalePrice)}</p>
                          {discount > 0 && (
                            <p className="text-[10px] text-red-500 line-through">₹{fmt(originalSalePrice)}</p>
                          )}
                        </div>
                      </div>
                      {discount > 0 && (
                        <p className="text-[10px] text-amber-700 mt-2">
                          {plotSize} Gaz × ₹{fmt(effectiveRate)} (after ₹{fmt(discount)} discount) = ₹{fmt(newSalePrice)}
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Pricing Row 1b: Company Price vs Party Price (broker margin) */}
              {(() => {
                const company = parseFloat(plotForm.company_price) || 0;
                const party = parseFloat(plotForm.party_price) || 0;
                const margin = party - company;
                const hasBoth = company > 0 && party > 0;
                const marginPct = company > 0 ? ((margin / company) * 100) : 0;
                return (
                  <div className="rounded-lg border border-indigo-200 bg-indigo-50/30 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Handshake className="w-3.5 h-3.5 text-indigo-600" />
                      <p className="text-xs font-semibold text-indigo-800">Company Price vs Party Price (Broker Margin)</p>
                      {hasBoth && (
                        <Badge className={`text-[9px] ml-auto border ${margin >= 0 ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
                          Margin ₹{fmt(Math.abs(margin))}{company > 0 ? ` · ${marginPct >= 0 ? '+' : ''}${marginPct.toFixed(1)}%` : ''}
                        </Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Company Price (₹)</Label>
                        <Input type="number" step="0.01" min="0" placeholder="e.g. 2000000"
                          value={plotForm.company_price}
                          onChange={(e) => setPlotForm((prev) => ({ ...prev, company_price: e.target.value }))} />
                        <p className="text-[10px] text-indigo-500">Price the company/owner sets (given to broker)</p>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Party Price (₹)</Label>
                        <Input type="number" step="0.01" min="0" placeholder="e.g. 2500000"
                          value={plotForm.party_price}
                          onChange={(e) => setPlotForm((prev) => ({ ...prev, party_price: e.target.value }))} />
                        <p className="text-[10px] text-indigo-500">Price broker sells to the client</p>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Broker Margin (₹)</Label>
                        <div className={`h-9 flex items-center px-3 rounded-md border font-semibold text-sm ${hasBoth ? (margin >= 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700') : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                          {hasBoth ? `₹${fmt(margin)}` : '—'}
                        </div>
                        {hasBoth && (
                          <p className="text-[10px] text-indigo-500">₹{fmt(party)} − ₹{fmt(company)} = ₹{fmt(margin)}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Pricing Row 2: Plot Commission = Size (Gaz) × Commission Rate */}
              <div className="rounded-lg border border-amber-200 bg-amber-50/30 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Percent className="w-3.5 h-3.5 text-amber-600" />
                  <p className="text-xs font-semibold text-amber-800">Plot Commission = Size (Gaz) × Commission Rate</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Commission Rate (₹ per Gaz) *</Label>
                  <Input type="number" step="0.01" placeholder="500"
                    value={plotForm.commission_rate}
                    onChange={(e) => setPlotForm({ ...plotForm, commission_rate: e.target.value })}
                    required />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Plot Commission (₹)</Label>
                  <Input type="number" step="0.01" placeholder="Auto-calculated"
                    value={plotForm.plot_commission}
                    readOnly
                    disabled
                    className="bg-amber-50 font-semibold" />
                  {plotForm.plot_size && plotForm.commission_rate && (
                    <p className="text-[10px] text-amber-600">Auto: {plotForm.plot_size} × {plotForm.commission_rate} = ₹{plotForm.plot_commission}</p>
                  )}
                </div>
                </div>
              </div>

              {/* Pricing Row 3: Bank Amount to Be Received = Circle Rate × Size (Mtr) */}
              <div className="rounded-lg border border-blue-200 bg-blue-50/30 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Landmark className="w-3.5 h-3.5 text-blue-600" />
                  <p className="text-xs font-semibold text-blue-800">Bank Amount to Be Received = Circle Rate × Size (Mtr)</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Circle Rate (₹) *</Label>
                  <Input type="number" step="0.01" placeholder="7000"
                    value={plotForm.circle_rate}
                    onChange={(e) => setPlotForm({ ...plotForm, circle_rate: e.target.value })}
                    required />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Bank Amount to Be Received (₹)</Label>
                  <Input type="number" step="0.01" placeholder="Auto-calculated"
                    value={plotForm.to_receive_bank}
                    readOnly
                    disabled
                    className="bg-blue-50 font-semibold" />
                  {plotForm.plot_size_mtr && plotForm.circle_rate && (
                    <p className="text-[10px] text-blue-600">Auto: {plotForm.circle_rate} × {plotForm.plot_size_mtr} = ₹{plotForm.to_receive_bank}</p>
                  )}
                </div>
                </div>
              </div>

              {/* Row 5: Registry & Structuring (edit only) */}
              {editingPlot && (
              <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Landmark className="w-3.5 h-3.5 text-sky-600" />
                  <p className="text-xs font-semibold text-slate-700">Registry & Structuring</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-1 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Registry Area</Label>
                  <Input type="number" step="0.01" placeholder="116.168"
                    value={plotForm.registry_area}
                    onChange={(e) => setPlotForm({ ...plotForm, registry_area: e.target.value })} />
                  <p className="text-[10px] text-slate-400">Circle/Registry area in sq.mt</p>
                </div>
                </div>
              </div>
              )}

              {/* Row 6: Registry Details (shown when status = REGISTRY) */}
              {plotForm.status === 'REGISTRY' && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/30 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <ClipboardList className="w-3.5 h-3.5 text-emerald-600" />
                  <p className="text-xs font-semibold text-emerald-800">Registry Details</p>
                  <span className="text-[10px] text-emerald-600 ml-auto">Registry entry will be auto-created in Plot Registry</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Registry Date</Label>
                    <Input type="date"
                      value={regForm.registry_date}
                      onChange={(e) => setRegForm({ ...regForm, registry_date: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Registry Payment (₹)</Label>
                    <Input type="number" step="0.01" placeholder="1238000"
                      value={regForm.registry_payment}
                      onChange={(e) => setRegForm({ ...regForm, registry_payment: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Firm Name</Label>
                    <Select value={regForm.firm_name || '_none'} onValueChange={(v) => setRegForm({ ...regForm, firm_name: v === '_none' ? '' : v.toUpperCase() })}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Select firm" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">Select firm...</SelectItem>
                        {(registryAutocomplete.firmNames || []).map((name) => (
                          <SelectItem key={name} value={name}>{name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Farmer Name</Label>
                    <Select value={regForm.farmer_name || '_none'} onValueChange={(v) => setRegForm({ ...regForm, farmer_name: v === '_none' ? '' : v.toUpperCase() })}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Select farmer" />
                      </SelectTrigger>
                      <SelectContent>
                        <div className="px-2 pb-2">
                          <Input
                            value={farmerUserSearch}
                            onChange={(e) => setFarmerUserSearch(e.target.value)}
                            placeholder="Search by name or phone"
                            className="h-8 text-xs"
                            onKeyDown={(e) => e.stopPropagation()} />
                        </div>
                        <SelectItem value="_none">Select farmer...</SelectItem>
                        {filteredFarmerUsers.map((u, idx) => (
                          <SelectItem key={`farmer-${idx}-${u.name}`} value={u.name || ''}>{u.phone ? `${u.name} (${u.phone})` : u.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Seller (Client)</Label>
                    <Select value={regForm.seller_name || '_none'} onValueChange={(v) => setRegForm({ ...regForm, seller_name: v === '_none' ? '' : v.toUpperCase() })}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Select seller" />
                      </SelectTrigger>
                      <SelectContent>
                        <div className="px-2 pb-2">
                          <Input
                            value={sellerUserSearch}
                            onChange={(e) => setSellerUserSearch(e.target.value)}
                            placeholder="Search by name or phone"
                            className="h-8 text-xs"
                            onKeyDown={(e) => e.stopPropagation()} />
                        </div>
                        <SelectItem value="_none">Select seller...</SelectItem>
                        {filteredSellerUsers.map((u, idx) => (
                          <SelectItem key={`seller-${idx}-${u.name}`} value={u.name || ''}>{u.phone ? `${u.name} (${u.phone})` : u.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Registry Notes</Label>
                  <Input placeholder="Optional registry notes..."
                    value={regForm.notes}
                    onChange={(e) => setRegForm({ ...regForm, notes: e.target.value })} />
                </div>
              </div>
              )}

              {/* Auto-computed preview */}
              {(plotForm.sale_price || plotForm.plot_commission || plotForm.to_receive_bank) ? (
                <Card className="shadow-none border-slate-200 bg-slate-50">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-5 flex-wrap text-[11px]">
                      {plotForm.sale_price && (
                        <div>
                          <span className="text-slate-500">Sale Price: </span>
                          <span className="font-bold text-emerald-700">₹{fmt(parseFloat(plotForm.sale_price) || 0)}</span>
                        </div>
                      )}
                      {plotForm.plot_commission && (
                        <div>
                          <span className="text-slate-500">Commission: </span>
                          <span className="font-bold text-amber-700">₹{fmt(parseFloat(plotForm.plot_commission) || 0)}</span>
                        </div>
                      )}
                      {plotForm.to_receive_bank && (
                        <div>
                          <span className="text-slate-500">Bank Amount: </span>
                          <span className="font-bold text-blue-700">₹{fmt(parseFloat(plotForm.to_receive_bank) || 0)}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              {/* Row 4: Notes */}
              <div className="space-y-1.5 rounded-lg border border-slate-200 bg-white p-4">
                <Label className="text-xs font-medium">Notes</Label>
                <Textarea placeholder="Optional notes..."
                  value={plotForm.notes}
                  onChange={(e) => setPlotForm({ ...plotForm, notes: e.target.value })}
                  rows={3}
                  className="bg-slate-50 border-slate-200" />
              </div>

              {/* Proof photo for sub-admin edit */}
              {editingPlot && !canUpdate && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Proof Photo (for edit request)</Label>
                  <div className="flex items-center gap-3">
                    <label className="cursor-pointer flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-amber-300 bg-amber-50 hover:bg-amber-100 transition-colors">
                      <Camera className="w-4 h-4 text-amber-600" />
                      <span className="text-xs text-amber-700">{proofPhoto ? proofPhoto.name : 'Upload proof photo'}</span>
                      <input type="file" accept="image/*" className="hidden" onChange={handleProofPhotoChange} />
                    </label>
                    {proofPreview && (
                      <img src={proofPreview} alt="Proof" className="w-12 h-12 rounded-lg object-cover border" />
                    )}
                  </div>
                </div>
              )}

              <DialogFooter className="pt-3 border-t border-slate-200">
                <Button type="button" variant="outline" size="sm" className="border-slate-300" onClick={() => setPlotDialogOpen(false)} disabled={submitting}>Cancel</Button>
                <Button type="submit" size="sm" disabled={submitting}
                  className={editingPlot && !canUpdate ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-slate-900 hover:bg-slate-800 text-white'}
                >
                  {submitting ? (
                    <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />{editingPlot && !canUpdate ? 'Submitting Request...' : editingPlot ? 'Updating...' : 'Creating...'}</>
                  ) : (editingPlot && !canUpdate ? <><Send className="w-3.5 h-3.5 mr-1.5" />Submit Edit Request</> : editingPlot ? 'Update' : 'Create Plot')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
            );

  // ── No site guard ──
  if (!currentSite) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Building2 className="w-10 h-10 text-slate-200 mb-3" />
        <p className="text-sm text-slate-500">Select a site to view plot payments</p>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════
  //  PLOT DETAIL VIEW (Payment History)
  // ═══════════════════════════════════════════════════
  if (selectedPlot) {
    const p = plotMeta || selectedPlot;
    const installmentTotal = installments.reduce((sum, inst) => sum + (parseFloat(inst.amount) || 0), 0);
    const installmentPaid = installments.reduce((sum, inst) => sum + (parseFloat(inst.paid_amount) || 0), 0);
    const installmentRemaining = installments.reduce((sum, inst) => sum + (parseFloat(inst.remaining_amount) || 0), 0);
    const installmentInterestDue = installments.reduce((sum, inst) => sum + (parseFloat(inst.interest_due) || 0), 0);
    const isUnderCancellation = p.status === 'UNDER CANCELLATION' || installments.some((inst) => inst.under_cancellation);

    return (
      <div className="w-full max-w-full md:max-w-350 space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => { setSelectedPlot(null); clearDetailFilters(); }} className="h-8 w-8 p-0">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold text-slate-900">
                  Plot {p.plot_no}{p.block ? ` — Block ${p.block}` : ''}
                </h1>
                {getStatusBadge(p.status)}
              </div>
              <p className="text-sm text-slate-500 mt-0.5">
                {p.buyer_name && <span className="font-medium text-slate-600">{p.buyer_name}</span>}
                {p.booking_by && <span className="text-slate-400"> · Booked by {p.booking_by}</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="ghost" size="sm" onClick={downloadExcel} className="text-slate-400 hover:text-slate-900 h-8 px-2" title="Download Excel">
              <Download className="w-4 h-4" />
            </Button>
            {canManage && (
              <Button variant="outline" size="sm" onClick={() => handleOpenEditPlot(p)} className="text-xs h-8 border-slate-200">
                <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit Plot
              </Button>
            )}
            {!canManage && (
              <Button variant="outline" size="sm" onClick={() => handleOpenEditPlot(p)} className="text-xs h-8 border-amber-200 text-amber-700 hover:bg-amber-50">
                <Edit2 className="w-3.5 h-3.5 mr-1" /> Request Edit
              </Button>
            )}
            
            <div className="h-4 w-[1px] bg-slate-200 mx-1 hidden sm:block" />

            <Button variant="outline" size="sm" onClick={printStatement} className="text-xs h-8 border-blue-200 text-blue-700 hover:bg-blue-50">
              <Printer className="w-3.5 h-3.5 mr-1.5" />
              <span className="hidden sm:inline">{selectedPayIds.size > 0 ? `Print ${selectedPayIds.size} Selected` : 'Print Statement'}</span>
              <span className="sm:hidden">Print</span>
            </Button>
            
            {canManage && (
              <Button size="sm" onClick={handleOpenCreatePayment} className="h-8 shadow-sm">
                <Plus className="w-4 h-4 mr-1.5" /> <span className="hidden sm:inline">Add Payment</span><span className="sm:hidden">Add</span>
              </Button>
            )}
          </div>
        </div>

        {/* Plot Info Strip */}
        <Card className="shadow-none border-slate-200 bg-slate-50/60">
          <CardContent className="p-3">
            <div className="flex items-center gap-6 flex-wrap text-xs">
              <div className="flex items-center gap-1.5">
                <Ruler className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-500">Size:</span>
                <span className="font-semibold text-slate-700">{p.plot_size || '—'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <IndianRupee className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-500">Rate:</span>
                <span className="font-semibold text-slate-700">₹{fmt(p.plot_rate)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Ruler className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-slate-500">Reg. Area:</span>
                <span className="font-semibold text-slate-700">{p.registry_area || '—'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CircleDollarSign className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-slate-500">Circle Rate:</span>
                <span className="font-semibold text-slate-700">₹{fmt(p.circle_rate)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-500">Booked:</span>
                <span className="font-semibold text-slate-700">{fmtDate(p.booking_date)}</span>
              </div>
              {p.team && (
                <div className="flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="text-slate-500">Team:</span>
                  <span className="font-semibold text-indigo-700">{p.team}</span>
                </div>
              )}
              {p.notes && (
                <div className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-slate-500 truncate max-w-xs">{p.notes}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <Card className="shadow-none border-slate-200">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Sale Price</p>
                <div className="w-6 h-6 rounded bg-blue-50 flex items-center justify-center">
                  <IndianRupee className="w-3 h-3 text-blue-600" />
                </div>
              </div>
              <p className="text-lg font-bold text-slate-900 mt-1 whitespace-nowrap">₹{fmt(salePrice)}</p>
            </CardContent>
          </Card>
          <Card className="shadow-none border-slate-200">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Received</p>
                <div className="w-6 h-6 rounded bg-emerald-50 flex items-center justify-center">
                  <ArrowDownRight className="w-3 h-3 text-emerald-600" />
                </div>
              </div>
              <p className="text-lg font-bold text-green-600 mt-1 whitespace-nowrap">₹{fmt(totalReceived)}</p>
            </CardContent>
          </Card>
          <Card className="shadow-none border-slate-200">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Balance</p>
                <div className={`w-6 h-6 rounded flex items-center justify-center ${balance < 0 ? 'bg-red-50' : balance > 0 ? 'bg-amber-50' : 'bg-green-50'}`}>
                  <Banknote className={`w-3 h-3 ${balance < 0 ? 'text-red-500' : balance > 0 ? 'text-amber-500' : 'text-green-500'}`} />
                </div>
              </div>
              <p className={`text-lg font-bold mt-1 whitespace-nowrap ${balance < 0 ? 'text-red-600' : balance > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                {balance < 0 ? '-' : ''}₹{fmt(Math.abs(balance))}
              </p>
            </CardContent>
          </Card>
          <Card className="shadow-none border-slate-200">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">% Recd</p>
                <div className="w-6 h-6 rounded bg-purple-50 flex items-center justify-center">
                  <Percent className="w-3 h-3 text-purple-600" />
                </div>
              </div>
              <p className="text-lg font-bold text-purple-700 mt-1">{pctReceived.toFixed(1)}%</p>
            </CardContent>
          </Card>
          <Card className="shadow-none border-slate-200">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Entries</p>
                <div className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center">
                  <Hash className="w-3 h-3 text-slate-600" />
                </div>
              </div>
              <p className="text-lg font-bold text-slate-900 mt-1">{payments.length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Bank vs Cash Split Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Bank Section */}
          <Card className="shadow-none border-blue-200 bg-blue-50/30">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <Landmark className="w-3.5 h-3.5 text-blue-700" />
                <p className="text-[10px] font-bold text-blue-900 uppercase tracking-widest">Bank Ledger</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <p className="text-[9px] uppercase text-blue-400 font-bold">Planned</p>
                  <p className="text-base font-bold text-blue-800">₹{fmt(toReceiveBank)}</p>
                </div>
                <div>
                  <p className="text-[9px] uppercase text-blue-400 font-bold">Received</p>
                  <p className="text-base font-bold text-green-600">₹{fmt(receivedBank)}</p>
                </div>
                <div>
                  <p className="text-[9px] uppercase text-blue-400 font-bold">Balance</p>
                  <p className={`text-base font-bold ${balanceBank < 0 ? 'text-red-600' : balanceBank > 0 ? 'text-amber-600' : 'text-green-600'}`}>{balanceBank < 0 ? '-' : ''}₹{fmt(Math.abs(balanceBank))}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cash Section */}
          <Card className="shadow-none border-emerald-200 bg-emerald-50/30">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="w-3.5 h-3.5 text-emerald-700" />
                <p className="text-[10px] font-bold text-emerald-900 uppercase tracking-widest">Cash Ledger</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <p className="text-[9px] uppercase text-emerald-400 font-bold">Planned</p>
                  <p className="text-base font-bold text-emerald-800">₹{fmt(toReceiveCash)}</p>
                </div>
                <div>
                  <p className="text-[9px] uppercase text-emerald-400 font-bold">Received</p>
                  <p className="text-base font-bold text-green-600">₹{fmt(receivedCash)}</p>
                </div>
                <div>
                  <p className="text-[9px] uppercase text-emerald-400 font-bold">Balance</p>
                  <p className={`text-base font-bold ${balanceCash < 0 ? 'text-red-600' : balanceCash > 0 ? 'text-amber-600' : 'text-green-600'}`}>{balanceCash < 0 ? '-' : ''}₹{fmt(Math.abs(balanceCash))}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 1st Installment & To Receive (Circle) Strip */}
        {(firstInstallment > 0 || toReceive > 0) && (
          <Card className="shadow-none border-slate-200 bg-slate-50/40">
            <CardContent className="p-3">
              <div className="flex items-center gap-6 flex-wrap text-xs">
                {toReceive > 0 && (
                  <div className="flex items-center gap-1.5">
                    <CircleDollarSign className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-slate-500">To Receive (Area × Circle):</span>
                    <span className="font-bold text-amber-700">₹{fmt(toReceive)}</span>
                  </div>
                )}
                {firstInstallment > 0 && (
                  <>
                    <div className="flex items-center gap-1.5">
                      <Banknote className="w-3.5 h-3.5 text-indigo-500" />
                      <span className="text-slate-500">1st Installment:</span>
                      <span className="font-bold text-indigo-700">₹{fmt(firstInstallment)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Banknote className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-slate-500">Bal. of 1st Inst.:</span>
                      <span className={`font-bold ${balanceFirstInstallment < 0 ? 'text-red-600' : balanceFirstInstallment > 0 ? 'text-amber-600' : 'text-green-600'}`}>{balanceFirstInstallment < 0 ? '-' : ''}₹{fmt(Math.abs(balanceFirstInstallment))}</span>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Installments */}
        <Card className={`shadow-none ${isUnderCancellation ? 'border-rose-300 bg-rose-50/30' : 'border-slate-200'}`}>
          <CardContent className="p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">Installment Plan</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {p.installments_enabled ? `${installments.length} installment(s)` : 'Installments are disabled for this plot'}
                </p>
              </div>
              {isUnderCancellation && (
                <Badge variant="outline" className="text-[10px] font-semibold bg-rose-100 text-rose-700 border-rose-300">
                  UNDER CANCELLATION
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="rounded border border-slate-200 p-2 bg-white">
                <p className="text-[10px] text-slate-400 uppercase">Installment Total</p>
                <p className="text-sm font-bold text-slate-800">₹{fmt(installmentTotal)}</p>
              </div>
              <div className="rounded border border-slate-200 p-2 bg-white">
                <p className="text-[10px] text-slate-400 uppercase">Paid</p>
                <p className="text-sm font-bold text-green-600">₹{fmt(installmentPaid)}</p>
              </div>
              <div className="rounded border border-slate-200 p-2 bg-white">
                <p className="text-[10px] text-slate-400 uppercase">Remaining</p>
                <p className={`text-sm font-bold ${installmentRemaining < 0 ? 'text-red-600' : installmentRemaining > 0 ? 'text-amber-600' : 'text-green-600'}`}>{installmentRemaining < 0 ? '-' : ''}₹{fmt(Math.abs(installmentRemaining))}</p>
              </div>
              <div className="rounded border border-slate-200 p-2 bg-white">
                <p className="text-[10px] text-slate-400 uppercase">Interest Due</p>
                <p className="text-sm font-bold text-amber-700">₹{fmt(installmentInterestDue)}</p>
              </div>
            </div>

            {canManage && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end rounded border border-slate-200 bg-white p-2">
                <div className="space-y-1">
                  <Label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Interest</Label>
                  <Select
                    value={detailInstallmentSettings.interest_enabled ? 'yes' : 'no'}
                    onValueChange={(v) => setDetailInstallmentSettings((prev) => ({ ...prev, interest_enabled: v === 'yes' }))}
                  >
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Enabled</SelectItem>
                      <SelectItem value="no">Disabled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Rate %</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={detailInstallmentSettings.interest_rate}
                    onChange={(e) => setDetailInstallmentSettings((prev) => ({ ...prev, interest_rate: e.target.value }))}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Interest Type</Label>
                  <Select
                    value={detailInstallmentSettings.interest_type}
                    onValueChange={(v) => setDetailInstallmentSettings((prev) => ({ ...prev, interest_type: v }))}
                  >
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {INTEREST_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Bench Period (Days)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={detailInstallmentSettings.grace_period_days}
                    onChange={(e) => setDetailInstallmentSettings((prev) => ({ ...prev, grace_period_days: e.target.value }))}
                    className="h-8 text-xs"
                  />
                </div>
                <Button
                  size="sm"
                  type="button"
                  onClick={handleSaveDetailInstallmentSettings}
                  disabled={savingInstallmentSettings}
                  className="h-8"
                >
                  {savingInstallmentSettings ? <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />Saving</> : 'Save Settings'}
                </Button>
              </div>
            )}

            {loadingInstallments ? (
              <div className="text-xs text-slate-400">Loading installments...</div>
            ) : installments.length === 0 ? (
              <div className="text-xs text-slate-500 border border-dashed border-slate-300 rounded p-3 bg-white">
                No installments created yet for this plot.
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded bg-white">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/70">
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Installment</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Due Date</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right">Amount (₹)</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right">Paid (₹)</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right">Remaining (₹)</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right">Interest %</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right">Interest Due (₹)</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {installments.map((inst) => (
                      <TableRow key={inst.id}>
                        <TableCell className="text-xs font-medium text-slate-700">{inst.installment_name || `Installment ${inst.sort_order}`}</TableCell>
                        <TableCell className="text-xs tabular-nums">{fmtDate(inst.due_date)}</TableCell>
                        <TableCell className="text-xs text-right tabular-nums">₹{fmt(inst.amount)}</TableCell>
                        <TableCell className="text-xs text-right tabular-nums text-green-600">₹{fmt(inst.paid_amount)}</TableCell>
                        <TableCell className={`text-xs text-right tabular-nums ${(parseFloat(inst.remaining_amount) || 0) < 0 ? 'text-red-600' : (parseFloat(inst.remaining_amount) || 0) > 0 ? 'text-amber-600' : 'text-green-600'}`}>₹{fmt(inst.remaining_amount)}</TableCell>
                        <TableCell className="text-xs text-right tabular-nums text-amber-700">{parseFloat(p.interest_rate) || 0}%</TableCell>
                        <TableCell className="text-xs text-right tabular-nums text-amber-700">₹{fmt(inst.interest_due)}</TableCell>
                        <TableCell>
                          {inst.under_cancellation ? (
                            <Badge variant="outline" className="text-[10px] font-semibold bg-rose-100 text-rose-700 border-rose-300">Under Cancellation</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] font-semibold bg-slate-50 text-slate-600 border-slate-200">{String(inst.status || 'pending').replace('_', ' ')}</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Breakdown */}
        {(fromBreakdown.length > 0 || receivedByBreakdown.length > 0) && (
          <Collapsible open={breakdownOpen} onOpenChange={setBreakdownOpen}>
            <Card className="shadow-none border-slate-200">
              <CollapsibleTrigger asChild>
                <button className="w-full flex items-center justify-between p-3 hover:bg-slate-50/80 transition-colors rounded-lg">
                  <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                    <BarChart3 className="w-3.5 h-3.5" /> Breakdown
                  </span>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${breakdownOpen ? 'rotate-180' : ''}`} />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-3 pb-3">
                  <div className="flex items-center gap-1 mb-3">
                    <button
                      onClick={() => setBreakdownTab('from')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${breakdownTab === 'from' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                      <Tag className="w-3 h-3 inline mr-1" /> By Payment Mode
                    </button>
                    <button
                      onClick={() => setBreakdownTab('person')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${breakdownTab === 'person' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                      <User className="w-3 h-3 inline mr-1" /> By Received By
                    </button>
                  </div>
                  <Separator className="mb-3" />
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                    {(breakdownTab === 'from' ? fromBreakdown : receivedByBreakdown).map((c) => {
                      const key = breakdownTab === 'from' ? c.payment_from : c.received_by;
                      const isActive = breakdownTab === 'from'
                        ? filterFrom === key
                        : searchQuery === key;
                      return (
                        <button
                          key={key}
                          onClick={() => {
                            if (breakdownTab === 'from') {
                              setFilterFrom(filterFrom === key ? 'all' : key);
                            } else {
                              setSearchQuery(searchQuery === key ? '' : key);
                            }
                          }}
                          className={`text-left p-2.5 rounded-lg border transition-all ${isActive
                            ? 'border-slate-900 bg-slate-900 text-white'
                            : 'border-slate-150 bg-white hover:border-slate-300 hover:bg-slate-50'
                            }`}
                        >
                          <p className={`text-xs font-semibold truncate ${isActive ? 'text-white' : 'text-slate-800'}`}>{key}</p>
                          <p className={`text-[10px] mt-0.5 ${isActive ? 'text-emerald-300' : 'text-emerald-600'}`}>
                            ₹{fmt(c.total_amount)}
                          </p>
                          <p className={`text-[10px] ${isActive ? 'text-slate-400' : 'text-slate-400'}`}>{c.entries} entries</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        )}

        {/* Filter Bar */}
        <Card className="shadow-none border-slate-200">
          <CardContent className="p-3 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="w-4 h-4 text-slate-400" />
              {[
                { key: 'all', label: 'All Time' },
                { key: 'today', label: 'Today' },
                { key: 'week', label: 'This Week' },
                { key: 'month', label: 'This Month' },
                { key: 'last_month', label: 'Last Month' },
                { key: 'custom', label: 'Custom Range' },
              ].map((pr) => (
                <button
                  key={pr.key}
                  onClick={() => handlePeriodChange(pr.key)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${filterPeriod === pr.key
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                    }`}
                >
                  {pr.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <Input
                  type="date" value={filterDateFrom}
                  onChange={(e) => { setFilterDateFrom(e.target.value); setFilterPeriod('custom'); }}
                  className="h-8 w-36 text-xs"
                />
              </div>
              <span className="text-xs text-slate-400">to</span>
              <Input
                type="date" value={filterDateTo}
                onChange={(e) => { setFilterDateTo(e.target.value); setFilterPeriod('custom'); }}
                className="h-8 w-36 text-xs"
              />

              <Separator orientation="vertical" className="h-6 mx-1" />

              <Select value={filterFrom} onValueChange={setFilterFrom}>
                <SelectTrigger className="w-36 h-8 text-xs">
                  <SelectValue placeholder="All Modes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Modes</SelectItem>
                  {[...new Set([...PAYMENT_FROM_OPTIONS, ...fromBreakdown.map(f => f.payment_from)])].sort().map((f) => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Separator orientation="vertical" className="h-6 mx-1" />

              <div className="relative flex-1 min-w-45">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <Input
                  placeholder="Search narration, received by..."
                  value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-xs"
                />
              </div>
            </div>

            {hasActiveDetailFilters && (
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
                    <Calendar className="w-3 h-3" /> {filterDateFrom || '...'} → {filterDateTo || '...'}
                    <X className="w-3 h-3 cursor-pointer ml-0.5" onClick={() => { setFilterDateFrom(''); setFilterDateTo(''); setFilterPeriod('all'); }} />
                  </Badge>
                )}
                {filterFrom !== 'all' && (
                  <Badge variant="secondary" className="text-xs gap-1">
                    <Tag className="w-3 h-3" /> {filterFrom}
                    <X className="w-3 h-3 cursor-pointer ml-0.5" onClick={() => setFilterFrom('all')} />
                  </Badge>
                )}
                {searchQuery && (
                  <Badge variant="secondary" className="text-xs gap-1">
                    <Search className="w-3 h-3" /> &quot;{searchQuery}&quot;
                    <X className="w-3 h-3 cursor-pointer ml-0.5" onClick={() => setSearchQuery('')} />
                  </Badge>
                )}
                <Button variant="ghost" size="sm" onClick={clearDetailFilters} className="text-xs text-slate-500 h-6 px-2">Clear all</Button>
                <span className="text-xs text-slate-400 ml-auto">
                  Showing {filteredPayments.length} of {payments.length} — Filtered: <span className="text-emerald-600 font-medium">₹{fmt(filteredTotal)}</span>
                </span>
              </div>
            )}
            {!hasActiveDetailFilters && (
              <div className="flex justify-end">
                <span className="text-xs text-slate-400">{payments.length} payments</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payments Table */}
        <Card className="shadow-none border-slate-200">
          <CardContent className="p-0">
            {loadingPayments ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
              </div>
            ) : paymentsWithBalance.length === 0 ? (
              <div className="text-center py-16">
                <Banknote className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-slate-500">No payments found</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {payments.length === 0 ? 'Add the first payment to this plot' : 'Try a different filter'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                      <TableHead className="w-10">
                        <Checkbox
                          checked={selectedPayIds.size === paymentsWithBalance.length && paymentsWithBalance.length > 0}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-10">#</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-28 p-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSortOrderPay(prev => prev === 'asc' ? 'desc' : 'asc')}
                          className="h-full w-full justify-start px-4 hover:bg-slate-100 font-semibold text-[11px] uppercase tracking-wider text-slate-500"
                        >
                          Date <ArrowUpDown className="ml-1 w-3 h-3" />
                        </Button>
                      </TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-28">From</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-24 text-right">Amount (₹)</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-24 text-right">Balance</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-28">Status</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-32">Instrument</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Narration</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-28">Buyer</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-28">Booked By</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-28">Created By</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-24 text-center">Voucher</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-28 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                      {paymentsWithBalance.map((pay, idx) => (
                        <TableRow key={pay.id} className={pay.amount < 0 ? 'bg-red-50/30' : ''}>
                          <TableCell className="w-10">
                            <Checkbox
                              checked={selectedPayIds.has(pay.id)}
                              onCheckedChange={() => toggleSelect(pay.id)}
                            />
                          </TableCell>
                          <TableCell className="text-xs text-slate-400 tabular-nums">{idx + 1}</TableCell>
                          <TableCell className="text-xs font-medium tabular-nums text-nowrap">{fmtDate(pay.date)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-[10px] font-semibold ${FROM_COLORS[pay.payment_from] || 'bg-slate-100'}`}>{pay.payment_from}</Badge>
                            <ChequeStatusControl
                              chequeStatus={pay.cheque_status}
                              source="plot_payment"
                              entryId={pay.id}
                              isAdmin={isAdmin}
                              onStatusChange={fetchPayments}
                            />
                          </TableCell>
                          <TableCell className={`text-sm text-right font-bold tabular-nums ${pay.amount < 0 ? 'text-red-600' : 'text-green-600'}`}>{pay.amount < 0 ? '-' : ''}₹{fmt(Math.abs(pay.amount))}</TableCell>
                          <TableCell className={`text-xs text-right tabular-nums ${pay.runningBalance < 0 ? 'text-red-600' : pay.runningBalance > 0 ? 'text-amber-600' : 'text-green-600'}`}>{pay.runningBalance < 0 ? '-' : ''}₹{fmt(Math.abs(pay.runningBalance))}</TableCell>
                          <TableCell><ApprovalStatusBadge status={pay.status} /></TableCell>
                          <TableCell className="text-[10px] text-slate-500 font-mono truncate max-w-[120px]" title={pay.bank_details}>{pay.bank_details || '—'}</TableCell>
                          <TableCell className="text-xs text-slate-500 truncate max-w-[200px]" title={pay.narration}>{pay.narration || '—'}</TableCell>
                          <TableCell className="text-xs font-medium truncate max-w-[120px]" title={pay.buyer_name}>{pay.buyer_name || '—'}</TableCell>
                          <TableCell className="text-xs font-medium truncate max-w-[120px]" title={pay.booked_by}>{pay.booked_by || '—'}</TableCell>
                          <TableCell>
                            <UserAvatar name={pay.created_by_name} label="Created by" />
                          </TableCell>
                          <TableCell className="text-center">
                            {pay.voucher_url ? <VoucherThumbnail url={pay.voucher_url} /> : <span className="text-xs text-slate-300">—</span>}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="sm" onClick={() => printReceipt(pay)} className="h-7 w-7 p-0 text-slate-400 hover:text-blue-600 hover:bg-blue-50" title="Print Receipt">
                                <Printer className="w-3.5 h-3.5" />
                              </Button>
                              {canManage ? (
                                <>
                                  <Button variant="ghost" size="sm" onClick={() => handleOpenEditPayment(pay)} className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700">
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => handleDeletePayment(pay.id)} className="h-7 w-7 p-0 text-slate-400 hover:text-red-600">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </>
                              ) : (
                                <Button variant="ghost" size="sm" onClick={() => handleOpenEditPayment(pay)} className="h-7 w-7 p-0 text-amber-500 hover:text-amber-700 hover:bg-amber-50" title="Request Edit">
                                  <Edit2 className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}

                      {/* Summary Row */}
                      <TableRow className="bg-slate-50 hover:bg-slate-50 border-t-2 border-slate-200">
                        <TableCell colSpan={4} className="text-xs font-semibold text-slate-600 uppercase tracking-wider px-4">
                          Total ({paymentsWithBalance.length} entries)
                        </TableCell>
                        <TableCell className="text-right px-4">
                          <span className="text-sm font-bold text-slate-900 tabular-nums">₹{fmt(hasActiveDetailFilters ? filteredTotal : totalReceived)}</span>
                        </TableCell>
                        <TableCell colSpan={7} />
                        <TableCell className="text-right px-4">
                           <span className="text-xs text-slate-500 text-nowrap">Bal: <span className={`font-bold ${balance < 0 ? 'text-red-600' : balance > 0 ? 'text-amber-600' : 'text-green-600'}`}>{balance < 0 ? '-' : ''}₹{fmt(Math.abs(balance))}</span></span>
                        </TableCell>
                      </TableRow>

                      {/* % Received Row */}
                      <TableRow className="hover:bg-slate-50/10 bg-slate-50/5">
                        <TableCell colSpan={4} className="text-right px-4">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">% Received</span>
                        </TableCell>
                        <TableCell className="text-right px-4">
                          <span className={`text-sm font-black tabular-nums ${pctReceived >= 100 ? 'text-emerald-700' : pctReceived >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                            {pctReceived.toFixed(2)}%
                          </span>
                        </TableCell>
                        <TableCell colSpan={6} className="px-4">
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden max-w-[200px] ml-auto">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${pctReceived >= 100 ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : pctReceived >= 50 ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]'}`}
                              style={{ width: `${Math.min(pctReceived, 100)}%` }}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Dialog */}
        <Dialog open={paymentDialogOpen} onOpenChange={(open) => { setPaymentDialogOpen(open); if (!open) resetPayForm(); }}>
          <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto">

            {/* ── Colored Header ── */}
            <div className={`-mx-6 -mt-6 px-6 pt-5 pb-4 mb-2 border-b ${payMode === 'refund' ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h2 className={`text-base font-semibold ${payMode === 'refund' ? 'text-red-800' : 'text-emerald-800'}`}>
                    {editingPaymentId && !canUpdate ? 'Request Payment Edit'
                      : editingPaymentId ? 'Edit Payment'
                      : payMode === 'refund' ? '↑ Record Refund'
                      : '↓ Record Payment'}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">
                    {editingPaymentId && !canUpdate
                      ? 'Proof photo required for sub-admin edits'
                      : editingPaymentId
                        ? 'Update payment details'
                        : <>Plot <span className="font-semibold text-slate-700">{selectedPlot.plot_no}</span>{selectedPlot.buyer_name && <span className="text-slate-400"> — {selectedPlot.buyer_name}</span>}</>}
                  </p>
                </div>
                {/* Receive / Refund toggle */}
                {!editingPaymentId && (
                  <div className="flex items-center gap-0.5 p-0.5 bg-white/70 border border-slate-200 rounded-lg shadow-sm shrink-0">
                    <button type="button" onClick={() => setPayMode('receive')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${payMode === 'receive' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                      <ArrowDownRight className="w-3.5 h-3.5" /> Receive
                    </button>
                    <button type="button" onClick={() => setPayMode('refund')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${payMode === 'refund' ? 'bg-red-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                      <ArrowUpRight className="w-3.5 h-3.5" /> Refund
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Alert message */}
            {message.text && (
              <div className={`flex gap-2 p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-emerald-50 border border-emerald-100 text-emerald-700' : 'bg-red-50 border border-red-100 text-red-700'}`}>
                {message.type === 'success' ? <Check className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
                {message.text}
              </div>
            )}

            <form onSubmit={handleSubmitPayment} className="space-y-3">

              {/* ── Section 1: Amount & Date ── */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 space-y-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Amount & Date</p>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-slate-600">Date *</Label>
                    <Input type="date" value={payForm.date}
                      onChange={(e) => setPayForm({ ...payForm, date: e.target.value })}
                      required className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-slate-600">
                      {payMode === 'refund' ? 'Refund Amount (₹) *' : 'Amount (₹) *'}
                    </Label>
                    <div className="relative">
                      <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold ${payMode === 'refund' ? 'text-red-500' : 'text-emerald-600'}`}>
                        {payMode === 'refund' ? '−' : '+'}
                      </span>
                      <Input type="number" step="0.01" min="0" placeholder="0"
                        value={payForm.amount}
                        onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
                        required
                        className={`h-9 pl-7 font-semibold tabular-nums text-sm ${payMode === 'refund' ? 'border-red-200 text-red-700 focus-visible:ring-red-300' : 'border-emerald-200 text-emerald-700 focus-visible:ring-emerald-300'}`} />
                    </div>
                    {payForm.amount && (
                      <p className={`text-[10px] font-semibold ${payMode === 'refund' ? 'text-red-500' : 'text-emerald-600'}`}>
                        {payMode === 'refund' ? '−' : '+'} ₹{fmt(Math.abs(parseFloat(payForm.amount) || 0))}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Section 2: Payment Channel ── */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 space-y-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Payment Channel</p>

                {/* Bank / Cash toggle */}
                <div className="flex gap-1 p-0.5 bg-white border border-slate-200 rounded-lg">
                  <button type="button" onClick={() => setPayForm({ ...payForm, payment_type: 'BANK' })}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-semibold transition-all ${payForm.payment_type === 'BANK' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>
                    <Landmark className="w-3.5 h-3.5" /> Bank
                  </button>
                  <button type="button" onClick={() => setPayForm({ ...payForm, payment_type: 'CASH', payment_from: 'CASH' })}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-semibold transition-all ${payForm.payment_type === 'CASH' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>
                    <Wallet className="w-3.5 h-3.5" /> Cash
                  </button>
                </div>

                {/* Mode chips */}
                <div className="flex flex-wrap gap-1.5">
                  {PAYMENT_FROM_OPTIONS.map((f) => (
                    <button key={f} type="button"
                      onClick={() => {
                        const newFrom = payForm.payment_from === f ? '' : f;
                        setPayForm({ ...payForm, payment_from: newFrom, payment_type: newFrom ? derivePaymentType(newFrom) : payForm.payment_type });
                      }}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-full border transition-all ${payForm.payment_from === f ? 'border-slate-800 bg-slate-800 text-white' : FROM_COLORS[f] || 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>
                      {f}
                    </button>
                  ))}
                </div>

                {/* Cheque / Bank detail fields */}
                {(payForm.payment_from === 'CHEQUE' || (payForm.payment_from !== 'CASH' && payForm.payment_type !== 'CASH')) && (
                  <div className="grid grid-cols-2 gap-2">
                    {payForm.payment_from === 'CHEQUE' && (
                      <div className="space-y-1">
                        <Label className="text-xs font-medium text-slate-600">Cheque No</Label>
                        <Input placeholder="Cheque number" value={payForm.cheque_no}
                          onChange={(e) => setPayForm({ ...payForm, cheque_no: e.target.value })}
                          className="h-9 text-sm" />
                      </div>
                    )}
                    {payForm.payment_from !== 'CASH' && payForm.payment_type !== 'CASH' && (
                      <div className="space-y-1">
                        <Label className="text-xs font-medium text-slate-600">Bank Details</Label>
                        <Input placeholder="SBI-613266 / UNB-037191" value={payForm.bank_details}
                          onChange={(e) => setPayForm({ ...payForm, bank_details: e.target.value.toUpperCase() })}
                          list="pay-bank-suggestions" className="h-9 text-sm" />
                        <datalist id="pay-bank-suggestions">
                          {autocomplete.bankDetails.map((b) => <option key={b} value={b} />)}
                        </datalist>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ── Section 3: Details ── */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 space-y-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Details</p>

                {/* Booked By */}
                <div className="space-y-1 relative">
                  <Label className="text-xs font-medium text-slate-600">Payment Booked By</Label>
                  {!payBookedByOpen ? (
                    <button type="button" onClick={() => setPayBookedByOpen(true)}
                      className="flex items-center justify-between w-full h-9 px-3 text-sm bg-white border border-slate-200 rounded-md hover:border-slate-300 transition-colors">
                      {payForm.booked_by
                        ? <span className="flex items-center gap-1.5 text-slate-800"><User className="h-3.5 w-3.5 text-slate-400" />{payForm.booked_by}</span>
                        : <span className="flex items-center gap-1.5 text-slate-400"><User className="h-3.5 w-3.5" />Select person...</span>}
                      <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-40" />
                    </button>
                  ) : (
                    <div className="border border-blue-300 rounded-lg bg-white shadow-sm overflow-hidden ring-2 ring-blue-100">
                      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 bg-slate-50/60">
                        <Search className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <input
                          autoFocus
                          type="text"
                          placeholder="Search name or phone..."
                          value={payBookedBySearch}
                          onChange={(e) => setPayBookedBySearch(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Escape') { setPayBookedByOpen(false); setPayBookedBySearch(''); } }}
                          className="w-full text-xs bg-transparent outline-none placeholder:text-slate-400"
                        />
                        {payForm.booked_by && (
                          <button type="button" onClick={() => { setPayForm({ ...payForm, booked_by: '' }); setPayBookedBySearch(''); }}
                            className="text-slate-400 hover:text-red-500 shrink-0"><X className="h-3.5 w-3.5" /></button>
                        )}
                        <button type="button" onClick={() => { setPayBookedByOpen(false); setPayBookedBySearch(''); }}
                          className="text-[10px] text-slate-400 hover:text-slate-600 shrink-0 font-medium">ESC</button>
                      </div>
                      <div className="max-h-[180px] overflow-y-auto overscroll-contain">
                        {filteredBookedByMembers.length === 0 ? (
                          <p className="text-xs text-slate-400 text-center py-4">No member found</p>
                        ) : (
                          filteredBookedByMembers.map((m) => (
                            <button key={m.name} type="button"
                              onClick={() => { setPayForm({ ...payForm, booked_by: m.name }); setPayBookedByOpen(false); setPayBookedBySearch(''); }}
                              className={`flex items-center gap-2 w-full px-3 py-2 text-left transition-colors hover:bg-blue-50 ${payForm.booked_by === m.name ? 'bg-blue-50 border-l-2 border-blue-500' : 'border-l-2 border-transparent'}`}>
                              <div className={`flex items-center justify-center h-6 w-6 rounded-full shrink-0 text-[10px] font-semibold ${payForm.booked_by === m.name ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                                {m.name?.charAt(0)?.toUpperCase()}
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="text-sm text-slate-800 truncate">{m.name}</span>
                                {m.phone && <span className="text-[10px] text-slate-400">{m.phone}</span>}
                              </div>
                              {payForm.booked_by === m.name && <Check className="ml-auto h-3.5 w-3.5 text-blue-600 shrink-0" />}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Narration */}
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-slate-600">Narration</Label>
                  <Textarea placeholder={payMode === 'refund' ? 'REFUND, RETURN A19 DG, TRF TO A38...' : 'REGISTRY, BOOKING, INSTALLMENT...'}
                    value={payForm.narration}
                    onChange={(e) => setPayForm({ ...payForm, narration: e.target.value.toUpperCase() })}
                    rows={2} className="text-sm resize-none" />
                </div>

                {/* Voucher */}
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-slate-600">Voucher / Receipt</Label>
                  <VoucherUpload value={payForm.voucher_url} onChange={(url) => setPayForm({ ...payForm, voucher_url: url })} />
                </div>

                {/* Proof photo for sub-admin edit */}
                {editingPaymentId && !canUpdate && (
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-slate-600">Proof Photo (required for edit request)</Label>
                    <div className="flex items-center gap-3">
                      <label className="cursor-pointer flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-amber-300 bg-amber-50 hover:bg-amber-100 transition-colors">
                        <Camera className="w-4 h-4 text-amber-600" />
                        <span className="text-xs text-amber-700">{proofPhoto ? proofPhoto.name : 'Upload proof photo'}</span>
                        <input type="file" accept="image/*" className="hidden" onChange={handleProofPhotoChange} />
                      </label>
                      {proofPreview && <img src={proofPreview} alt="Proof" className="w-12 h-12 rounded-lg object-cover border" />}
                    </div>
                  </div>
                )}

                {/* Admin Approval */}
                {(isAdmin || canManage) && approvers.length > 0 && (
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-slate-600">Assign For Approval</Label>
                    <Select value={payForm.assigned_admin_id?.toString() || '_none'}
                      onValueChange={(v) => setPayForm({ ...payForm, assigned_admin_id: v === '_none' ? null : parseInt(v) })}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select approver..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">— Auto-assign or none —</SelectItem>
                        {approvers.map((app) => (
                          <SelectItem key={app.id} value={app.id.toString()}>
                            {app.full_name || app.name || app.email || `Admin #${app.id}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 pt-1">
                <Button type="button" variant="outline" size="sm" onClick={() => setPaymentDialogOpen(false)} disabled={submitting}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={submitting}
                  className={`min-w-[150px] ${editingPaymentId && !canUpdate ? 'bg-amber-600 hover:bg-amber-700' : payMode === 'refund' ? 'bg-red-600 hover:bg-red-700' : ''}`}>
                  {submitting ? (
                    <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    {editingPaymentId && !canUpdate ? 'Submitting...' : editingPaymentId ? 'Updating...' : payMode === 'refund' ? 'Recording...' : 'Recording...'}</>
                  ) : (
                    editingPaymentId && !canUpdate ? <><Send className="w-3.5 h-3.5 mr-1.5" />Submit Edit Request</>
                    : editingPaymentId ? 'Update Payment'
                    : payMode === 'refund' ? '↑ Record Refund'
                    : '↓ Record Payment'
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {renderPlotDialog()}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════
  //  PLOTS LIST VIEW
  // ═══════════════════════════════════════════════════
  const chipBase = 'h-7 rounded-full text-xs gap-1.5 font-normal px-3 w-auto transition-colors';
  const chipOn = 'border-primary/30 bg-primary/10 text-primary font-medium';
  const chipOff = 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50';
  return (
    <div className="w-full max-w-full md:max-w-350 space-y-3">
      {/* Header + Filters (redesigned) */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm pt-1 pb-2.5 border-b border-slate-200">
        {/* Row 1 — title + actions */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-sm">
              <MapPin className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-semibold text-slate-900 leading-tight">Plot Payments</h1>
                <Badge variant="secondary" className="h-5 rounded-full px-2 text-[10px] font-medium tabular-nums">{filteredPlots.length} plots</Badge>
              </div>
              <p className="text-[11px] text-slate-500 leading-tight">
                Payment tracking for <span className="font-medium text-slate-700">{currentSite.name}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" onClick={downloadAllPlotsExcel} className="text-xs h-8 rounded-lg" disabled={filteredPlots.length === 0}>
              <Download className="w-3.5 h-3.5 mr-1" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={printSelectedPlots} className="text-xs h-8 rounded-lg" disabled={filteredPlots.length === 0}>
              <Printer className="w-3.5 h-3.5 mr-1" /> {selectedPlotIds.size > 0 ? `Print (${selectedPlotIds.size})` : 'Print All'}
            </Button>
            {canManage && (
              <Button size="sm" onClick={handleOpenCreatePlot} className="h-8 rounded-lg">
                <Plus className="w-4 h-4 mr-1.5" /> Add Plot
              </Button>
            )}
          </div>
        </div>

        {/* Row 2 — filter chips */}
        <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
          <div className="relative w-full sm:w-64 mr-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <Input
              placeholder="Search plots, buyers, booking by…"
              value={listSearch} onChange={(e) => setListSearch(e.target.value)}
              className="pl-8 h-7 text-xs rounded-full bg-slate-50/80 border-slate-200 focus-visible:bg-white"
            />
          </div>
          <Filter className="h-3.5 w-3.5 text-slate-300 hidden sm:block" />
          <Popover open={filterBookingByOpen} onOpenChange={setFilterBookingByOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className={`${chipBase} ${filterBookingBy !== 'all' ? chipOn : chipOff}`}>
                  <User className="h-3 w-3 opacity-60" />
                  {filterBookingBy === 'all' ? 'Booking By' : filterBookingBy}
                  <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-60 p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search name or phone..." value={filterBookingBySearch} onValueChange={setFilterBookingBySearch} className="text-xs h-8" />
                  <CommandList>
                    <CommandEmpty>No match found.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem value="all" onSelect={() => { setFilterBookingBy('all'); setFilterBookingByOpen(false); setFilterBookingBySearch(''); }}>
                        <Check className={`mr-2 h-3.5 w-3.5 ${filterBookingBy === 'all' ? 'opacity-100' : 'opacity-0'}`} />
                        All Booking By
                      </CommandItem>
                      {uniqueBookingBys
                        .map((b) => (
                        <CommandItem key={b} value={b + ' ' + (memberPhoneMap[b] || '')}
                          onSelect={() => { setFilterBookingBy(b); setFilterBookingByOpen(false); setFilterBookingBySearch(''); }}>
                          <Check className={`mr-2 h-3.5 w-3.5 ${filterBookingBy === b ? 'opacity-100' : 'opacity-0'}`} />
                          <div className="flex flex-col">
                            <span className="flex items-center gap-1.5"><User className="h-3 w-3 text-slate-400" />{b}</span>
                            {memberPhoneMap[b] && <span className="text-[10px] text-muted-foreground ml-4">{memberPhoneMap[b]}</span>}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <Select value={filterTeam} onValueChange={setFilterTeam}>
              <SelectTrigger className={`${chipBase} ${filterTeam !== 'all' ? chipOn : chipOff}`}>
                <Hash className="h-3 w-3 opacity-60" />
                <SelectValue placeholder="Teams" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Teams</SelectItem>
                {uniqueTeams.map((t) => (
                  <SelectItem key={t} value={t}>Team {t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {uniqueMemberTeams.length > 0 && (
              <Select value={filterMemberTeam} onValueChange={setFilterMemberTeam}>
                <SelectTrigger className={`${chipBase} ${filterMemberTeam !== 'all' ? chipOn : chipOff}`}>
                  <UserPlus className="h-3 w-3 opacity-60" />
                  <SelectValue placeholder="Member Team" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Member Teams</SelectItem>
                  {uniqueMemberTeams.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className={`${chipBase} ${filterStatus !== 'all' ? chipOn : chipOff}`}>
                <Tag className="h-3 w-3 opacity-60" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent position="popper" className="max-h-60">
                <SelectItem value="all">All Status</SelectItem>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterPending} onValueChange={setFilterPending}>
              <SelectTrigger className={`${chipBase} ${filterPending !== 'all' ? chipOn : chipOff}`}>
                <Percent className="h-3 w-3 opacity-60" />
                <SelectValue placeholder="Pending %" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Pending %</SelectItem>
                <SelectItem value="25">Pending {'>='} 25%</SelectItem>
                <SelectItem value="50">Pending {'>='} 50%</SelectItem>
                <SelectItem value="75">Pending {'>='} 75%</SelectItem>
                <SelectItem value="100">Pending = 100%</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>
            {filterPending === 'custom' && (
              <>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  placeholder="Min %"
                  value={customPendingMin}
                  onChange={(e) => setCustomPendingMin(e.target.value)}
                  className="w-20 h-7 text-xs rounded-full"
                />
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  placeholder="Max %"
                  value={customPendingMax}
                  onChange={(e) => setCustomPendingMax(e.target.value)}
                  className="w-20 h-7 text-xs rounded-full"
                />
              </>
            )}
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className={`${chipBase} ${chipOff}`}>
                <ArrowUpDown className="h-3 w-3 opacity-60" />
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date_desc">Date (Newest)</SelectItem>
                <SelectItem value="date_asc">Date (Oldest)</SelectItem>
                <SelectItem value="plot_no">Plot No</SelectItem>
              </SelectContent>
            </Select>
            {(listSearch || filterBookingBy !== 'all' || filterStatus !== 'all' || filterTeam !== 'all' || filterMemberTeam !== 'all' || filterPending !== 'all' || customPendingMin || customPendingMax) && (
              <Button variant="ghost" size="sm" onClick={() => { setListSearch(''); setFilterBookingBy('all'); setFilterStatus('all'); setFilterTeam('all'); setFilterMemberTeam('all'); setFilterPending('all'); setCustomPendingMin(''); setCustomPendingMax(''); }} className="h-7 rounded-full px-2.5 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-50">
                <X className="w-3 h-3 mr-1" /> Clear
              </Button>
            )}
          </div>
        </div>

      {/* Plots Table */}
      {loadingPlots ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
        </div>
      ) : filteredPlots.length === 0 ? (
        <div className="text-center py-16">
          <MapPin className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-sm text-slate-500">{plots.length === 0 ? 'No plots created yet' : 'No plots match your filters'}</p>
          <p className="text-xs text-slate-400 mt-0.5">{plots.length === 0 ? 'Create a plot to start tracking payments' : 'Try different search criteria'}</p>
        </div>
      ) : (
        <Card className="shadow-none border-slate-200">
          <CardContent className="p-0">
            <div ref={tableContainerRef} className="overflow-auto relative z-0 will-change-scroll" style={{ maxHeight: 'calc(100vh - 180px)', WebkitOverflowScrolling: 'touch' }}>
              <table className="w-full caption-bottom text-sm border-collapse">
                <thead className="sticky top-0 z-30 bg-slate-50" style={{ boxShadow: '0 1px 0 0 #e2e8f0' }}>
                  <tr>
                    <th className="w-8 text-center sticky left-0 z-40 bg-slate-50 px-3 py-2">
                      <input type="checkbox"
                        checked={filteredPlots.length > 0 && selectedPlotIds.size === filteredPlots.length}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedPlotIds(new Set(filteredPlots.map(p => p.id)));
                          else setSelectedPlotIds(new Set());
                        }}
                        className="w-3.5 h-3.5 rounded border-slate-300 cursor-pointer" />
                    </th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-16 sticky left-8 z-40 bg-slate-50 px-3 py-2 text-left">Plot No</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-24 sticky left-24 z-40 bg-slate-50 px-3 py-2 text-left" style={{boxShadow: '2px 0 4px -1px rgba(0,0,0,0.08)'}}>Status</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-14 px-3 py-2 text-left">Block</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-left">Buyer Name</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-16 px-3 py-2 text-left">Size</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right w-20 px-3 py-2">Rate</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right w-28 px-3 py-2">Sale Price</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right w-24 px-3 py-2">To Rec Bank</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right w-24 px-3 py-2">To Rec Cash</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right w-28 px-3 py-2">Received Bank</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right w-24 px-3 py-2">Bal Bank</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right w-28 px-3 py-2">Received Cash</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right w-24 px-3 py-2">Bal Cash</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right w-28 px-3 py-2">Received</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-20 px-3 py-2 text-left">% Rec</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right w-28 px-3 py-2">Remaining</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-32 px-3 py-2 text-left">Booking By</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right w-28 px-3 py-2">Plot Comm</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-14 px-3 py-2 text-left">Team</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-28 p-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSortBy(prev => prev === 'date_desc' ? 'date_asc' : 'date_desc');
                        }}
                        className="h-full w-full justify-start px-4 hover:bg-slate-100 font-semibold text-[11px] uppercase tracking-wider text-slate-500"
                      >
                        Date <ArrowUpDown className="ml-1 w-3 h-3" />
                      </Button>
                    </th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right w-28 px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rowData.map((row) => (
                    <PlotRow
                      key={row.pl.id}
                      row={row}
                      isSelected={selectedPlotIds.has(row.pl.id)}
                      onToggleSelect={handleRowToggleSelect}
                      onNavigate={handleRowNavigate}
                      canManage={canManage}
                      canWrite={canWrite}
                      canUpdate={canUpdate}
                      canDelete={canDelete}
                      onBook={handleOpenBookPlot}
                      onEdit={handleOpenEditPlot}
                      onDelete={handleDeletePlot}
                    />
                  ))}
                </tbody>
                <tfoot className="sticky bottom-0 z-30 bg-slate-50" style={{ boxShadow: '0 -1px 0 0 #e2e8f0' }}>
                  <tr>
                        <td className="px-3 py-2" />
                        <td colSpan={4} className="px-3 py-2">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                              {selectedTotals ? 'Selected' : 'Total'} ({displayTotals.activeCount} plots)
                            </span>
                            {!selectedTotals && oldCount > 0 && (
                              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={includeOldInTotals}
                                  onChange={(e) => setIncludeOldInTotals(e.target.checked)}
                                  className="h-3 w-3 rounded accent-indigo-600 cursor-pointer"
                                />
                                <span className="text-[10px] text-slate-500 font-medium">
                                  incl. {oldCount} old plot{oldCount > 1 ? 's' : ''}
                                </span>
                              </label>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <span className="text-xs font-bold text-slate-700 tabular-nums">{fmt(displayTotals.totSize)}</span>
                        </td>
                        <td className="text-right px-3 py-2">
                          <span className="text-xs font-bold text-slate-700 tabular-nums">₹{fmt(displayTotals.totRate)}</span>
                        </td>
                        <td className="text-right px-3 py-2">
                          <span className="text-sm font-bold text-slate-900 tabular-nums">₹{fmt(displayTotals.totSalePrice)}</span>
                        </td>
                        <td className="text-right px-3 py-2">
                          <span className="text-xs font-bold text-slate-700 tabular-nums">₹{fmt(displayTotals.totToRecBank)}</span>
                        </td>
                        <td className="text-right px-3 py-2">
                          <span className="text-xs font-bold text-slate-700 tabular-nums">₹{fmt(displayTotals.totToRecCash)}</span>
                        </td>
                        <td className="text-right px-3 py-2">
                          <span className="text-xs font-bold text-green-600 tabular-nums">₹{fmt(displayTotals.totRecBank)}</span>
                        </td>
                        <td className="text-right px-3 py-2">
                          <span className={`text-xs font-bold tabular-nums ${displayTotals.totBalBank < 0 ? 'text-red-600' : displayTotals.totBalBank > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                            {displayTotals.totBalBank < 0 ? '-' : ''}₹{fmt(Math.abs(displayTotals.totBalBank))}
                          </span>
                        </td>
                        <td className="text-right px-3 py-2">
                          <span className="text-xs font-bold text-green-600 tabular-nums">₹{fmt(displayTotals.totRecCash)}</span>
                        </td>
                        <td className="text-right px-3 py-2">
                          <span className={`text-xs font-bold tabular-nums ${displayTotals.totBalCash < 0 ? 'text-red-600' : displayTotals.totBalCash > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                            {displayTotals.totBalCash < 0 ? '-' : ''}₹{fmt(Math.abs(displayTotals.totBalCash))}
                          </span>
                        </td>
                        <td className="text-right px-3 py-2">
                          <span className="text-sm font-bold text-green-600 tabular-nums">₹{fmt(displayTotals.totReceived)}</span>
                        </td>
                        <td className="px-3 py-2">
                          <span className={`text-[11px] font-bold tabular-nums ${displayTotals.avgPct > 100 ? 'text-red-700' : displayTotals.avgPct === 100 ? 'text-green-700' : 'text-yellow-600'}`}>
                            {displayTotals.avgPct.toFixed(1)}%
                          </span>
                        </td>
                        <td className="text-right px-3 py-2">
                          <span className={`text-xs font-bold tabular-nums ${displayTotals.totNetBal < 0 ? 'text-red-600' : displayTotals.totNetBal > 0 ? 'text-slate-900' : 'text-slate-400'}`}>
                            {displayTotals.totNetBal < 0 ? `-₹${fmt(Math.abs(displayTotals.totNetBal))}` : `₹${fmt(displayTotals.totNetBal)}`}
                          </span>
                        </td>
                        <td className="px-3 py-2" />
                        <td className="text-right px-3 py-2">
                          <span className="text-xs font-bold text-amber-700 tabular-nums">₹{fmt(displayTotals.totPlotComm)}</span>
                        </td>
                        <td colSpan={3} className="px-3 py-2" />
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={bookPlotDialogOpen} onOpenChange={(open) => { setBookPlotDialogOpen(open); if (!open) { setBookingPlot(null); setBookBuyerSearch(''); setBookBookingBySearch(''); } }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-0">
          <DialogHeader className="px-6 pt-5 pb-3 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center justify-between w-full gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <MapPin className="w-4.5 h-4.5 text-indigo-600" />
                </div>
                <div>
                  <DialogTitle className="text-base font-semibold">Book Plot {bookingPlot?.plot_no || ''}</DialogTitle>
                  <DialogDescription className="text-xs mt-0.5">
                    Assign buyer details and mark as BOOKED
                    {bookingPlot?.sale_price != null ? ` · Plot Price: ₹${fmt(bookingPlot.sale_price)}` : ''}
                  </DialogDescription>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setBookPlotDialogOpen(false);
                  navigate('/register-user');
                }}
                className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 border-blue-200 hover:bg-blue-50 shrink-0"
              >
                <UserPlus className="w-4 h-4" />
                Register User
              </Button>
            </div>
          </DialogHeader>
          <form onSubmit={handleSubmitBookPlot} className="px-6 py-4 space-y-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
              <div className="flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-indigo-600" />
                <p className="text-xs font-semibold text-slate-700">Member Assignment</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Buyer Name *</Label>
                  <Popover open={bookBuyerOpen} onOpenChange={setBookBuyerOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" aria-expanded={bookBuyerOpen}
                        className="w-full justify-between font-normal h-9 text-sm bg-slate-50 border-slate-200 text-slate-700">
                        {bookPlotForm.buyer_name ? (
                          <span className="flex items-center gap-1.5 truncate">
                            <User className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                            {bookPlotForm.buyer_name}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-slate-400">
                            <User className="h-3.5 w-3.5" /> Select member...
                          </span>
                        )}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search name or phone..." value={bookBuyerSearch} onValueChange={setBookBuyerSearch} />
                        <CommandList>
                          <CommandEmpty>No member found.</CommandEmpty>
                          <CommandGroup>
                            {(autocomplete.members || []).map((m) => (
                              <CommandItem key={`bk-buyer-${m.id || m.name}`} value={m.name + ' ' + (m.phone || '')}
                                onSelect={() => { setBookPlotForm(prev => ({ ...prev, buyer_name: m.name })); setBookBuyerOpen(false); setBookBuyerSearch(''); }}>
                                <Check className={`mr-2 h-4 w-4 ${bookPlotForm.buyer_name === m.name ? 'opacity-100' : 'opacity-0'}`} />
                                <div className="flex flex-col">
                                  <span className="flex items-center gap-1.5"><User className="h-3.5 w-3.5 text-slate-500" />{m.name}</span>
                                  {m.phone && <span className="text-xs text-muted-foreground">{m.phone}</span>}
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Booking By</Label>
                  <Popover open={bookBookingByOpen} onOpenChange={setBookBookingByOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" aria-expanded={bookBookingByOpen}
                        className="w-full justify-between font-normal h-9 text-sm bg-slate-50 border-slate-200 text-slate-700">
                        {bookPlotForm.booking_by ? (
                          <span className="flex items-center gap-1.5 truncate">
                            <User className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                            {bookPlotForm.booking_by}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-slate-400">
                            <User className="h-3.5 w-3.5" /> Select member...
                          </span>
                        )}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search name or phone..." value={bookBookingBySearch} onValueChange={setBookBookingBySearch} />
                        <CommandList>
                          <CommandEmpty>No member found.</CommandEmpty>
                          <CommandGroup>
                            {(autocomplete.members || []).map((m) => (
                              <CommandItem key={`bk-by-${m.id || m.name}`} value={m.name + ' ' + (m.phone || '')}
                                onSelect={() => { setBookPlotForm(prev => ({ ...prev, booking_by: m.name })); setBookBookingByOpen(false); setBookBookingBySearch(''); }}>
                                <Check className={`mr-2 h-4 w-4 ${bookPlotForm.booking_by === m.name ? 'opacity-100' : 'opacity-0'}`} />
                                <div className="flex flex-col">
                                  <span className="flex items-center gap-1.5"><User className="h-3.5 w-3.5 text-slate-500" />{m.name}</span>
                                  {m.phone && <span className="text-xs text-muted-foreground">{m.phone}</span>}
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>

            {/* Discount & Commission Summary */}
            {(() => {
              const origRate = parseFloat(bookingPlot?.plot_rate) || 0;
              const discount = parseFloat(bookPlotForm.discount_rate) || 0;
              const effectiveRate = origRate - discount;
              const plotSize = parseFloat(bookingPlot?.plot_size) || 0;
              const commRate = parseFloat(bookingPlot?.commission_rate) || 0;
              const newSalePrice = plotSize * effectiveRate;
              const newCommission = plotSize * commRate;
              return (
                <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <IndianRupee className="w-3.5 h-3.5 text-amber-600" />
                    <p className="text-xs font-semibold text-amber-800">Discount & Pricing</p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-medium text-slate-500">Original Rate</Label>
                      <p className="text-sm font-semibold text-slate-700">₹{fmt(origRate)}</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Discount (per Gaz)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={bookPlotForm.discount_rate}
                        onChange={(e) => setBookPlotForm((prev) => ({ ...prev, discount_rate: e.target.value }))}
                        className="h-8 text-xs"
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-medium text-slate-500">Booking Rate</Label>
                      <p className={`text-sm font-bold ${discount > 0 ? 'text-amber-700' : 'text-slate-700'}`}>
                        ₹{fmt(effectiveRate)}
                        {discount > 0 && <span className="text-[10px] font-normal text-red-500 ml-1">(-₹{fmt(discount)})</span>}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-medium text-slate-500">New Sale Price</Label>
                      <p className="text-sm font-bold text-blue-700">₹{fmt(newSalePrice)}</p>
                    </div>
                  </div>
                  {newCommission > 0 && (
                    <div className="pt-2 border-t border-amber-200 flex items-center justify-between">
                      <div className="text-xs text-slate-600">
                        <span className="font-medium">Commission:</span> {fmt(plotSize)} Gaz × ₹{fmt(commRate)} = <span className="font-bold text-amber-700">₹{fmt(newCommission)}</span>
                        {bookPlotForm.booking_by && <span className="ml-2 text-slate-500">→ {bookPlotForm.booking_by}</span>}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-700">Installment Options</p>
                <Select
                  value={bookPlotForm.installments_enabled ? 'yes' : 'no'}
                  onValueChange={(v) => setBookPlotForm((prev) => ({ ...prev, installments_enabled: v === 'yes' }))}
                >
                  <SelectTrigger className="h-8 w-44 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no">No Installment</SelectItem>
                    <SelectItem value="yes">Under Installment</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {bookPlotForm.installments_enabled && (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Interest</Label>
                      <Select
                        value={bookPlotForm.interest_enabled ? 'yes' : 'no'}
                        onValueChange={(v) => setBookPlotForm((prev) => ({ ...prev, interest_enabled: v === 'yes' }))}
                      >
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="yes">Enabled</SelectItem>
                          <SelectItem value="no">Disabled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Interest %</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={bookPlotForm.interest_rate}
                        onChange={(e) => setBookPlotForm((prev) => ({ ...prev, interest_rate: e.target.value }))}
                        className="h-8 text-xs"
                        placeholder="18"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Interest Type</Label>
                      <Select
                        value={bookPlotForm.interest_type}
                        onValueChange={(v) => setBookPlotForm((prev) => ({ ...prev, interest_type: v }))}
                      >
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {INTEREST_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Bench Period (Days)</Label>
                      <Input
                        type="number"
                        min="0"
                        value={bookPlotForm.grace_period_days}
                        onChange={(e) => setBookPlotForm((prev) => ({ ...prev, grace_period_days: e.target.value }))}
                        className="h-8 text-xs"
                        placeholder="15"
                      />
                    </div>
                  </div>

                  {/* Penalty & Free-to-Sale */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Penalty</Label>
                      <Select
                        value={bookPlotForm.penalty_enabled ? 'yes' : 'no'}
                        onValueChange={(v) => setBookPlotForm((prev) => ({ ...prev, penalty_enabled: v === 'yes' }))}
                      >
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="yes">Enabled</SelectItem>
                          <SelectItem value="no">Disabled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Penalty Rate (₹)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={bookPlotForm.penalty_rate}
                        onChange={(e) => setBookPlotForm((prev) => ({ ...prev, penalty_rate: e.target.value }))}
                        className="h-8 text-xs"
                        placeholder="0"
                        disabled={!bookPlotForm.penalty_enabled}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Penalty Type</Label>
                      <Select
                        value={bookPlotForm.penalty_type}
                        onValueChange={(v) => setBookPlotForm((prev) => ({ ...prev, penalty_type: v }))}
                        disabled={!bookPlotForm.penalty_enabled}
                      >
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PENALTY_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium">Free to Sale (Days)</Label>
                      <Input
                        type="number"
                        min="0"
                        value={bookPlotForm.free_to_sale_days}
                        onChange={(e) => setBookPlotForm((prev) => ({ ...prev, free_to_sale_days: e.target.value }))}
                        className="h-8 text-xs"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 border rounded border-slate-200 p-3 bg-slate-50/50">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-slate-700">Installments</p>
                      <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={addBookInstallmentRow}>
                        <Plus className="w-3.5 h-3.5 mr-1" /> Add Installment
                      </Button>
                    </div>
                    {(() => {
                      const origRate = parseFloat(bookingPlot?.plot_rate) || 0;
                      const disc = parseFloat(bookPlotForm.discount_rate) || 0;
                      const plotSz = parseFloat(bookingPlot?.plot_size) || 0;
                      const totalSale = plotSz * (origRate - disc);
                      const totalAllocated = bookPlotForm.installments.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
                      const remaining = totalSale - totalAllocated;
                      return (
                        <div className="flex flex-wrap items-center gap-3 text-[11px] bg-blue-50 border border-blue-200 rounded-md px-3 py-1.5">
                          <span className="text-slate-600">Sale Price: <span className="font-bold text-slate-800">₹{fmt(totalSale)}</span></span>
                          <span className="text-slate-400">|</span>
                          <span className="text-slate-600">Allocated: <span className="font-bold text-blue-700">₹{fmt(totalAllocated)}</span></span>
                          <span className="text-slate-400">|</span>
                          <span className={remaining < 0 ? 'text-red-600 font-bold' : remaining === 0 ? 'text-emerald-600 font-bold' : 'text-amber-600 font-bold'}>
                            Remaining: ₹{fmt(remaining)}
                          </span>
                        </div>
                      );
                    })()}
                    {bookPlotForm.installments.map((row, idx) => (
                      <div key={`book-inst-${idx}`} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                        <div className="sm:col-span-4 space-y-1">
                          <Label className="text-[10px] font-medium">Name</Label>
                          <Input
                            value={row.installment_name}
                            onChange={(e) => updateBookInstallmentRow(idx, 'installment_name', e.target.value)}
                            placeholder={`Installment ${idx + 1}`}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="sm:col-span-3 space-y-1">
                          <Label className="text-[10px] font-medium">Amount (₹)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={row.amount}
                            onChange={(e) => updateBookInstallmentRow(idx, 'amount', e.target.value)}
                            className="h-8 text-xs"
                            placeholder="50000"
                          />
                        </div>
                        <div className="sm:col-span-4 space-y-1">
                          <Label className="text-[10px] font-medium">Due Date</Label>
                          <Input
                            type="date"
                            value={row.due_date}
                            onChange={(e) => updateBookInstallmentRow(idx, 'due_date', e.target.value)}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="sm:col-span-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-slate-400 hover:text-red-600"
                            onClick={() => removeBookInstallmentRow(idx)}
                            disabled={bookPlotForm.installments.length === 1}
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <DialogFooter className="px-6 py-4 border-t border-slate-100 bg-slate-50/30">
              <Button type="button" variant="outline" onClick={() => setBookPlotDialogOpen(false)} disabled={submitting}>Cancel</Button>
              <Button type="submit" disabled={submitting} className="bg-slate-900 hover:bg-slate-800 text-white">
                {submitting ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Booking...</> : 'Book Plot'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {renderPlotDialog()}
    </div>
  );
};

export default PlotPayments;
