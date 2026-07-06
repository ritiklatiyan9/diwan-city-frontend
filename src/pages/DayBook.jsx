import { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import { classifyPaymentMode, BUCKETS, BUCKET_LABELS } from '../utils/paymentMode';
import QRCode from 'qrcode';
import ChequeStatusControl from '../components/ChequeStatusControl';
import * as XLSX from 'xlsx';
import { Calendar as ShadCalendar } from '../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { format, parse } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Separator } from '../components/ui/separator';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../components/ui/table';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '../components/ui/tooltip';
import {
  Plus, Edit2, Trash2, AlertCircle, Check, Search, Loader2,
  IndianRupee, ChevronDown, Building2, ArrowUpRight, ArrowDownRight,
  Download, Printer, BookOpen, BarChart3, Hash, MapPin,
  Filter, X, ChevronRight, ChevronLeft, Calendar as CalendarIcon, Activity, Users, FileText,
  Camera, Send, ArrowUpDown,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════ */
const ENTRY_TYPES = ['GENERAL', 'EXPENSE', 'INCOME', 'PAYMENT', 'RECEIPT', 'TRANSFER', 'ADJUSTMENT', 'FARMER PAYMENT', 'PLOT COMMISSION', 'VENDOR PAYMENT', 'PLOT PAYMENT', 'CASH FLOW', 'FIRM TRANSACTION', 'OTHER'];
const PAYMENT_FROM_OPTIONS = [
  'BOOKING', 'CASH', 'BANK', 'TRANSFER', 'CHEQUE', 'UPI',
  'NEFT', 'RTGS', 'ADJUST', 'RETURN', 'REFUND',
];
const BANK_TYPE_FROMS = ['BANK', 'TRANSFER', 'CHEQUE', 'UPI', 'NEFT', 'RTGS'];
const derivePaymentType = (from) => from === 'CHEQUE' ? 'CHEQUE' : BANK_TYPE_FROMS.includes(from) ? 'BANK' : 'CASH';

const FARMER_PAY_MODES = ['CASH', 'RTGS', 'CASH PLOT PAYMENT', 'CASH REFUND PLOT PAYMENT', 'PAY ADVANCE', 'CHEQUE', 'NEFT', 'UPI', 'BANK TRANSFER'];
const PAY_MODES = ['CASH', 'UPI', 'CHEQUE', 'BANK', 'TRANSFER', 'NEFT', 'RTGS', 'IMPS', 'ADJUST'];
const CATEGORIES = [
  'CONSTRUCTION', 'MATERIAL', 'LABOUR', 'TRANSPORT', 'OFFICE', 'SALARY', 'BROKERAGE', 'LEGAL',
  'MAINTENANCE', 'UTILITIES', 'MISC', 'CEMENT', 'SAND', 'STEEL', 'BRICKS', 'PLUMBING', 'ELECTRICAL',
  'PAINTING', 'FLOORING', 'TILES', 'WOOD', 'HARDWARE', 'CARPENTRY', 'WELDING', 'FABRICATION',
  'GLASS', 'ALUMINIUM', 'ROOFING', 'EXCAVATION', 'EARTH WORK', 'BORING', 'WATER SUPPLY', 'DRAINAGE',
  'COMPOUND WALL', 'FENCING', 'GATE', 'ROAD WORK', 'LANDSCAPING', 'ARCHITECT', 'ENGINEER', 'SURVEYOR',
  'CONSULTANT', 'CONTRACTOR', 'GOVERNMENT', 'REGISTRATION', 'STAMP DUTY', 'TAX', 'GST', 'TDS',
  'INSURANCE', 'RENT', 'TELEPHONE', 'INTERNET', 'PETROL', 'DIESEL', 'FOOD', 'REFRESHMENT', 'PRINTING',
  'STATIONERY', 'COURIER', 'ADVANCE', 'DEPOSIT', 'REFUND', 'LOAN', 'EMI', 'INTEREST', 'COMMISSION',
  'MARKETING', 'ADVERTISEMENT', 'SOCIETY', 'DONATION', 'MACHINERY', 'EQUIPMENT', 'VEHICLE',
  'FURNITURE', 'FIXTURE', 'DEMOLITION', 'CLEANING', 'SECURITY', 'MISCELLANEOUS',
];

const MONTH_NAMES = ['', 'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

const TYPE_STYLE = {
  GENERAL: { bg: 'bg-slate-100', text: 'text-slate-700', dot: 'bg-slate-400' },
  EXPENSE: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  INCOME: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  PAYMENT: { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500' },
  RECEIPT: { bg: 'bg-sky-50', text: 'text-sky-700', dot: 'bg-sky-500' },
  TRANSFER: { bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-500' },
  ADJUSTMENT: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  'FARMER PAYMENT': { bg: 'bg-lime-50', text: 'text-lime-700', dot: 'bg-lime-500' },
  'PLOT COMMISSION': { bg: 'bg-teal-50', text: 'text-teal-700', dot: 'bg-teal-500' },
  'VENDOR PAYMENT': { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  'CASH FLOW': { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  'FIRM TRANSACTION': { bg: 'bg-indigo-50', text: 'text-indigo-700', dot: 'bg-indigo-500' },
  'PLOT PAYMENT': { bg: 'bg-pink-50', text: 'text-pink-700', dot: 'bg-pink-500' },
  OTHER: { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' },
};

const MODE_STYLE = {
  CASH: 'bg-green-50 text-green-700 border-green-200',
  UPI: 'bg-blue-50 text-blue-700 border-blue-200',
  CHEQUE: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  BANK: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  TRANSFER: 'bg-purple-50 text-purple-700 border-purple-200',
  NEFT: 'bg-teal-50 text-teal-700 border-teal-200',
  RTGS: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  IMPS: 'bg-orange-50 text-orange-700 border-orange-200',
  ADJUST: 'bg-pink-50 text-pink-700 border-pink-200',
};

/* ═══════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════ */
const fmt = (v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(parseFloat(v) || 0);
const fmtDate = (d) => {
  if (!d || typeof d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return '';
  try { return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(d + 'T00:00:00')); }
  catch { return ''; }
};
const fmtDateLong = (d) => {
  if (!d || typeof d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return '';
  try { return new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(d + 'T00:00:00')); }
  catch { return ''; }
};
const toISO = (d) => { const dt = d instanceof Date ? d : new Date(d); return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`; };
const TODAY = toISO(new Date());

const blankForm = (date) => ({
  date: date || TODAY,
  particular: '', entry_type: 'GENERAL', debit: '', credit: '',
  remarks: '', payment_mode: '', category: '',
  from_entity: '', to_entity: '', account_no: '', branch: '',
  farmer_id: '', interest_rate: '', interest_amount: '', by_note: '',
  plot_no: '', plot_size: '', plot_rate: '', father_name: '', commission_person: '',
  ledger_name: '', ledger_type: 'site', cf_key: '',
  firm_id: '', firm_name: '', firm_purpose: '', firm_remark: '', firm_cheque_no: '',
  pp_plot_id: '', pp_payment_from: '', pp_payment_type: 'CASH', pp_bank_details: '', pp_narration: '', pp_received_by: '', pp_cheque_no: '',
  cheque_no: '',
  assigned_admin_id: null,
});

/* ═══════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════ */
const DayBook = () => {
  const location = useLocation();
  const { currentSite, isAdmin, canManage, hasPermission, user } = useAuth();
  const canWrite  = canManage && hasPermission('daybook', 'write');
  const canUpdate = canManage && hasPermission('daybook', 'update');
  const canDelete = canManage && hasPermission('daybook', 'delete');
  const siteId = currentSite?.id;

  const daybookPreset = useMemo(() => {
    if (location.pathname.startsWith('/daybook/cash')) return 'cash';
    if (location.pathname.startsWith('/daybook/bank')) return 'bank';
    return 'all';
  }, [location.pathname]);

  const daybookTitle = daybookPreset === 'cash' ? 'Cash Day Book' : daybookPreset === 'bank' ? 'Bank Day Book' : 'Day Book';

  /* ── State ── */
  const [entries, setEntries] = useState([]);
  const [summary, setSummary] = useState({ total_debit: 0, total_credit: 0, total_count: 0 });
  const [modeBalance, setModeBalance] = useState(null);
  const [typeBreakdown, setTypeBD] = useState([]);
  const [modeBreakdown, setModeBD] = useState([]);
  const [categoryBreakdown, setCatBD] = useState([]);
  const [autocomplete, setAC] = useState({ particulars: [], fromEntities: [], toEntities: [], paymentModes: [], remarks: [], accountNos: [], branches: [], categories: [] });
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [farmers, setFarmers] = useState([]);
  const [members, setMembers] = useState([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [cashflowLedgers, setCashflowLedgers] = useState([]);
  const [firms, setFirms] = useState([]);
  const [plots, setPlots] = useState([]);
  const [approvers, setApprovers] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(blankForm());
  const [receiptEntry, setReceiptEntry] = useState(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptQr, setReceiptQr] = useState(null);
  const [calendarOpen, setCalendarOpen] = useState(false);

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

  /* ── Selected Date (core concept: Day Book = one day at a time) ── */
  const [selectedDate, setSelectedDate] = useState(TODAY);

  /* filters (within the selected date) */
  const [q, setQ] = useState('');
  const [fType, setFType] = useState('all');
  const [fMode, setFMode] = useState('all');
  const [fCat, setFCat] = useState('all');
  const [sortOrder, setSortOrder] = useState('desc');
  const [showFilters, setShowFilters] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [bdTab, setBdTab] = useState('type');


  /* ── Fetch entries (date-specific – fires on every date change) ── */
  const fetchEntries = useCallback(async () => {
    if (!siteId) return;
    try {
      setLoading(true);
      const { data } = await api.get(`/daybook?site_id=${siteId}&date=${selectedDate}`);
      setEntries(data.entries || []);
      setSummary(data.summary || { total_debit: 0, total_credit: 0, total_count: 0 });
      setTypeBD(data.typeBreakdown || []);
      setModeBD(data.modeBreakdown || []);
      setCatBD(data.categoryBreakdown || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [siteId, selectedDate]);

  /* ── Fetch dropdown data (site-level – only fires on site change) ── */
  const fetchDropdowns = useCallback(async () => {
    if (!siteId) return;
    try {
      const [aRes, fRes, mRes, cfRes, firmRes, plotRes, appRes] = await Promise.all([
        api.get(`/daybook/autocomplete?site_id=${siteId}`),
        api.get(`/daybook/farmers?site_id=${siteId}`),
        api.get(`/daybook/members?site_id=${siteId}`),
        api.get(`/daybook/cashflow-ledgers?site_id=${siteId}`),
        api.get(`/daybook/firms?site_id=${siteId}`),
        api.get(`/daybook/plots?site_id=${siteId}`),
        api.get(`/admin/approvers?site_id=${siteId}`).catch(() => ({ data: { approvers: [] } })),
      ]);
      setAC(aRes.data || { particulars: [], fromEntities: [], toEntities: [], paymentModes: [], remarks: [], accountNos: [], branches: [], categories: [] });
      setFarmers(fRes.data.farmers || []);
      setMembers(mRes.data.members || []);
      setCashflowLedgers(cfRes.data.ledgers || []);
      setFirms(firmRes.data.firms || []);
      setPlots(plotRes.data.plots || []);
      setApprovers(appRes.data.approvers || []);
    } catch (err) { console.error(err); }
  }, [siteId]);



  // Fetch dropdown data once per site
  useEffect(() => { fetchDropdowns(); }, [fetchDropdowns]);

  // Auto-jump to latest date with data when site changes
  useEffect(() => {
    if (!siteId) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get(`/daybook/latest-date?site_id=${siteId}`);
        if (!cancelled && data.latest_date && /^\d{4}-\d{2}-\d{2}$/.test(data.latest_date) && data.latest_date !== TODAY && data.latest_date <= TODAY) {
          setSelectedDate(data.latest_date);
        }
      } catch { /* ignore – will just stay on today */ }
    })();
    return () => { cancelled = true; };
  }, [siteId]);



  const getAssignedAdminLabel = (entry) => {
    if (entry?.assigned_admin_name) return entry.assigned_admin_name;
    const assignedId = entry?.assigned_admin_id;
    if (!assignedId) return null;
    const approver = approvers.find((a) => String(a.id) === String(assignedId));
    return approver?.full_name || approver?.name || approver?.email || `Admin #${assignedId}`;
  };

  // Fetch entries on date or site change
  useEffect(() => {
    setEntries([]); setSummary({ total_debit: 0, total_credit: 0, total_count: 0 });
    clearFilters(); fetchEntries();
  }, [fetchEntries]);

  /* ── Cumulative per-mode balance (fetched on all three routes so the Main
     Day Book's Opening + Remaining sum matches Cash + Bank + Cheque + UPI +
     Other — previously the Main view used a different daily-balance table
     which diverged from mode-balance by several crore). ── */
  useEffect(() => {
    if (!siteId) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get(`/daybook/mode-balance?site_id=${siteId}&date=${selectedDate}`);
        if (!cancelled) setModeBalance(data);
      } catch (err) {
        console.error('[daybook] mode-balance fetch failed:', err);
        if (!cancelled) setModeBalance(null);
      }
    })();
    return () => { cancelled = true; };
  }, [siteId, selectedDate, entries]);

  /* ── Date navigation ── */
  const goDay = (offset) => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + offset);
    setSelectedDate(toISO(d));
  };
  const goToday = () => setSelectedDate(TODAY);
  const isToday = selectedDate === TODAY;

  /* ── Form Helpers ── */
  const resetForm = () => { setForm(blankForm(selectedDate)); setEditingId(null); setMessage({ type: '', text: '' }); clearProofPhoto(); };
  const openCreate = () => { resetForm(); setDialogOpen(true); };
  const isEditingExpense = editingId && typeof editingId === 'string' && editingId.startsWith('expense_');
  const isEditingFarmerPayment = editingId && typeof editingId === 'string' && editingId.startsWith('fp_');
  const isEditingDbFarmerPayment = editingId && typeof editingId === 'number' && form.entry_type === 'FARMER PAYMENT';
  const isEditingCommission = editingId && typeof editingId === 'string' && editingId.startsWith('comm_');
  const isEditingDbCommission = editingId && typeof editingId === 'number' && form.entry_type === 'PLOT COMMISSION';
  const isEditingCashFlow = editingId && typeof editingId === 'string' && editingId.startsWith('cf_');
  const isEditingDbCashFlow = editingId && typeof editingId === 'number' && form.entry_type === 'CASH FLOW';
  const isEditingFirmTxn = editingId && typeof editingId === 'string' && editingId.startsWith('ft_');
  const isEditingDbFirmTxn = editingId && typeof editingId === 'number' && form.entry_type === 'FIRM TRANSACTION';
  const isEditingPlotPayment = editingId && typeof editingId === 'string' && editingId.startsWith('pp_');
  const isEditingDbPlotPayment = editingId && typeof editingId === 'number' && form.entry_type === 'PLOT PAYMENT';
  const openEdit = (e) => {
    setForm({
      date: e.date ? toISO(e.date) : '', particular: e.particular || '',
      entry_type: e.entry_type || 'GENERAL', debit: e.debit ? String(e.debit) : '',
      credit: e.credit ? String(e.credit) : '', remarks: e.remarks || '',
      payment_mode: e.payment_mode || '', category: e.category || '',
      from_entity: e.from_entity || '', to_entity: e.to_entity || '',
      account_no: e.account_no || '', branch: e.branch || '',
      // Farmer payment fields
      farmer_id: e.farmer_id ? String(e.farmer_id) : '',
      interest_rate: e.interest_rate ? String(e.interest_rate) : '',
      interest_amount: e.interest_amount ? String(e.interest_amount) : '',
      by_note: e.by_note || e.commission_by_note || '',
      // Plot commission fields
      plot_no: e.plot_no || '',
      plot_size: e.plot_size || '',
      plot_rate: e.plot_rate || '',
      father_name: e.father_name || '',
      commission_person: e.particular || '',
      // Cash flow fields
      ledger_name: e.ledger_name || '',
      ledger_type: e.ledger_type || 'site',
      cf_key: (() => {
        // Match by ledger_name + month + year to find the cash_flow_months record id
        const match = cashflowLedgers.find(l =>
          (l.ledger_name || '') === (e.ledger_name || '') && l.month == e.cf_month && l.year == e.cf_year
        );
        return match ? `${match.id}` : '';
      })(),
      // Firm transaction fields
      firm_id: e.firm_id ? String(e.firm_id) : '',
      firm_name: e.firm_txn_name || '',
      firm_purpose: e.firm_purpose || '',
      firm_remark: e.firm_remark || '',
      firm_cheque_no: e.firm_cheque_no || '',
      // Plot payment fields
      pp_plot_id: e.pp_plot_id ? String(e.pp_plot_id) : '',
      pp_payment_from: e.pp_payment_from || '',
      pp_payment_type: e.pp_payment_type || 'CASH',
      pp_bank_details: e.pp_bank_details || '',
      pp_narration: e.pp_narration || '',
      pp_received_by: e.pp_received_by || '',
      pp_cheque_no: e.pp_cheque_no || '',
      cheque_no: e.cheque_no || '',
      assigned_admin_id: e.assigned_admin_id || null,
    });
    setEditingId(e.id); setDialogOpen(true);
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault(); setMessage({ type: '', text: '' }); setSubmitting(true);
    try {
      const isFarmerPayment = form.entry_type === 'FARMER PAYMENT';
      const isCommission = form.entry_type === 'PLOT COMMISSION';
      const isCashFlow = form.entry_type === 'CASH FLOW';
      const isFirmTxn = form.entry_type === 'FIRM TRANSACTION';
      const isPlotPayment = form.entry_type === 'PLOT PAYMENT';
      const p = {
        site_id: siteId,
        date: isAdmin ? form.date : (editingId ? form.date : TODAY),
        particular: form.particular,
        entry_type: form.entry_type, debit: parseFloat(form.debit) || 0,
        credit: parseFloat(form.credit) || 0, remarks: form.remarks,
        payment_mode: form.payment_mode, category: form.category,
        from_entity: form.from_entity, to_entity: form.to_entity,
        assigned_admin_id: form.assigned_admin_id,
        account_no: form.account_no, branch: form.branch,
        ...(form.payment_mode === 'CHEQUE' && { cheque_no: form.cheque_no }),
        ...(isFarmerPayment && {
          farmer_id: form.farmer_id,
          interest_rate: parseFloat(form.interest_rate) || 0,
          interest_amount: parseFloat(form.interest_amount) || 0,
          by_note: form.by_note,
        }),
        ...(isCommission && {
          plot_no: form.plot_no,
          plot_size: form.plot_size,
          plot_rate: form.plot_rate,
          father_name: form.father_name,
          by_note: form.by_note,
        }),
        ...(isCashFlow && {
          ledger_name: form.ledger_name,
          ledger_type: form.ledger_type,
          ...(form.cf_key && { cash_flow_month_id: parseInt(form.cf_key) }),
        }),
        ...(isFirmTxn && {
          firm_id: form.firm_id,
          firm_name: form.firm_name,
          firm_purpose: form.firm_purpose,
          firm_remark: form.firm_remark,
          firm_cheque_no: form.firm_cheque_no,
        }),
        ...(isPlotPayment && {
          pp_plot_id: form.pp_plot_id,
          pp_payment_from: form.pp_payment_from,
          pp_payment_type: form.pp_payment_type,
          pp_bank_details: form.pp_bank_details,
          pp_narration: form.pp_narration,
          pp_received_by: form.pp_received_by,
          pp_cheque_no: form.pp_payment_from === 'CHEQUE' ? form.pp_cheque_no : undefined,
        }),
      };
      if (editingId) {
        // ── Sub-admin: send edit request instead of direct update ──
        if (!canUpdate) {
          let module = 'daybook';
          let recordId = editingId;
          if (typeof editingId === 'string') {
            if (editingId.startsWith('cf_')) { module = 'daybook_cashflow'; recordId = editingId.split('_')[1]; }
            else if (editingId.startsWith('ft_')) { module = 'daybook_firm_transaction'; recordId = editingId.split('_')[1]; }
            else if (editingId.startsWith('pp_')) { module = 'daybook_plot_payment'; recordId = editingId.split('_')[1]; }
            else if (editingId.startsWith('comm_')) { module = 'daybook_commission'; recordId = editingId.split('_')[1]; }
            else if (editingId.startsWith('fp_')) { module = 'daybook_farmer_payment'; recordId = editingId.split('_')[1]; }
            else if (editingId.startsWith('expense_')) { module = 'daybook_expense'; recordId = editingId.split('_')[1]; }
          } else if (typeof editingId === 'number') {
            const entry = entries.find(e => e.id === editingId);
            if (isCommission && entry?.commission_id) { module = 'daybook_commission'; recordId = entry.commission_id; }
            else if (isFarmerPayment && entry?.farmer_payment_id) { module = 'daybook_farmer_payment'; recordId = entry.farmer_payment_id; }
            else if (isCashFlow && entry?.cash_flow_entry_id) { module = 'daybook_cashflow'; recordId = entry.cash_flow_entry_id; }
            else if (isFirmTxn && entry?.firm_transaction_id) { module = 'daybook_firm_transaction'; recordId = entry.firm_transaction_id; }
            else if (isPlotPayment && entry?.plot_payment_id) { module = 'daybook_plot_payment'; recordId = entry.plot_payment_id; }
          }
          const fd = new FormData();
          fd.append('module', module);
          fd.append('record_id', String(recordId));
          fd.append('proposed_data', JSON.stringify(p));
          if (proofPhoto) fd.append('proof_photo', proofPhoto);
          await api.post('/edit-requests', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
          setMessage({ type: 'success', text: 'Edit request submitted for admin approval' });
          setEditRequestPending(true);
          setTimeout(() => setDialogOpen(false), 800);
        }
        // ── Admin: direct update ──
        else if (typeof editingId === 'string' && editingId.startsWith('cf_')) {
          const cfId = editingId.split('_')[1];
          await api.put(`/daybook/cashflow-entry/${cfId}`, p);
        }
        // If editing a firm-transaction-sourced entry (from Firm Transactions module)
        else if (typeof editingId === 'string' && editingId.startsWith('ft_')) {
          const ftId = editingId.split('_')[1];
          await api.put(`/daybook/firm-transaction/${ftId}`, p);
        }
        // If editing a plot-payment-sourced entry (from Plot Payments module)
        else if (typeof editingId === 'string' && editingId.startsWith('pp_')) {
          const ppId = editingId.split('_')[1];
          await api.put(`/daybook/plot-payment/${ppId}`, p);
        }
        // If editing a commission-sourced entry (from Commissions module)
        else if (typeof editingId === 'string' && editingId.startsWith('comm_')) {
          const commId = editingId.split('_')[1];
          await api.put(`/daybook/commission/${commId}`, p);
        }
        // If editing a farmer-payment-sourced entry (from Farmer Payments module)
        else if (typeof editingId === 'string' && editingId.startsWith('fp_')) {
          const fpId = editingId.split('_')[1];
          await api.put(`/daybook/farmer-payment/${fpId}`, p);
        }
        // If editing an expense-sourced entry
        else if (typeof editingId === 'string' && editingId.startsWith('expense_')) {
          const expId = editingId.split('_')[1];
          await api.put(`/daybook/expense/${expId}`, p);
        }
        // If editing a daybook entry that is linked to a commission
        else if (typeof editingId === 'number' && isCommission) {
          const entry = entries.find(e => e.id === editingId);
          if (entry?.commission_id) {
            await api.put(`/daybook/commission/${entry.commission_id}`, p);
          } else {
            await api.put(`/daybook/${editingId}`, p);
          }
        }
        // If editing a daybook entry that is linked to a farmer payment
        else if (typeof editingId === 'number' && isFarmerPayment) {
          const entry = entries.find(e => e.id === editingId);
          if (entry?.farmer_payment_id) {
            await api.put(`/daybook/farmer-payment/${entry.farmer_payment_id}`, p);
          } else {
            await api.put(`/daybook/${editingId}`, p);
          }
        }
        // If editing a daybook entry that is linked to a cash flow entry
        else if (typeof editingId === 'number' && isCashFlow) {
          const entry = entries.find(e => e.id === editingId);
          if (entry?.cash_flow_entry_id) {
            await api.put(`/daybook/cashflow-entry/${entry.cash_flow_entry_id}`, p);
          } else {
            await api.put(`/daybook/${editingId}`, p);
          }
        }
        // If editing a daybook entry that is linked to a firm transaction
        else if (typeof editingId === 'number' && isFirmTxn) {
          const entry = entries.find(e => e.id === editingId);
          if (entry?.firm_transaction_id) {
            await api.put(`/daybook/firm-transaction/${entry.firm_transaction_id}`, p);
          } else {
            await api.put(`/daybook/${editingId}`, p);
          }
        }
        // If editing a daybook entry that is linked to a plot payment
        else if (typeof editingId === 'number' && isPlotPayment) {
          const entry = entries.find(e => e.id === editingId);
          if (entry?.plot_payment_id) {
            await api.put(`/daybook/plot-payment/${entry.plot_payment_id}`, p);
          } else {
            await api.put(`/daybook/${editingId}`, p);
          }
        }
        else {
          await api.put(`/daybook/${editingId}`, p);
        }
        if (canUpdate) setMessage({ type: 'success', text: 'Entry updated' });
      } else {
        await api.post('/daybook', p);
        setMessage({ type: 'success', text: isCommission ? 'Commission recorded in Day Book & Plot Commissions' : isFarmerPayment ? 'Farmer payment recorded in Day Book & Farmer Payments' : isCashFlow ? `Cash flow entry recorded in Day Book & "${form.ledger_name}" ledger` : isFirmTxn ? 'Firm transaction recorded in Day Book & Firm Transactions' : isPlotPayment ? 'Plot payment recorded in Day Book & Plot Payments' : 'Entry created' });
      }
      await fetchEntries(); setTimeout(() => setDialogOpen(false), 500);
    } catch (err) { setMessage({ type: 'error', text: err.response?.data?.message || 'Something went wrong' }); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (id, entry) => {
    if (!window.confirm('Delete this entry?')) return;
    try {
      if (typeof id === 'string' && id.startsWith('cf_')) {
        const cfId = id.split('_')[1];
        await api.delete(`/daybook/cashflow-entry/${cfId}`);
      } else if (typeof id === 'string' && id.startsWith('ft_')) {
        const ftId = id.split('_')[1];
        await api.delete(`/daybook/firm-transaction/${ftId}`);
      } else if (typeof id === 'string' && id.startsWith('pp_')) {
        const ppId = id.split('_')[1];
        await api.delete(`/daybook/plot-payment/${ppId}`);
      } else if (typeof id === 'string' && id.startsWith('comm_')) {
        const commId = id.split('_')[1];
        await api.delete(`/daybook/commission/${commId}`);
      } else if (typeof id === 'string' && id.startsWith('fp_')) {
        const fpId = id.split('_')[1];
        await api.delete(`/daybook/farmer-payment/${fpId}`);
      } else if (typeof id === 'string' && id.startsWith('expense_')) {
        const expId = id.split('_')[1];
        await api.delete(`/daybook/expense/${expId}`);
      } else if (entry?.firm_transaction_id) {
        await api.delete(`/daybook/firm-transaction/${entry.firm_transaction_id}`);
      } else if (entry?.plot_payment_id) {
        await api.delete(`/daybook/plot-payment/${entry.plot_payment_id}`);
      } else if (entry?.cash_flow_entry_id) {
        await api.delete(`/daybook/cashflow-entry/${entry.cash_flow_entry_id}`);
      } else if (entry?.commission_id) {
        await api.delete(`/daybook/commission/${entry.commission_id}`);
      } else if (entry?.farmer_payment_id) {
        await api.delete(`/daybook/farmer-payment/${entry.farmer_payment_id}`);
      } else {
        await api.delete(`/daybook/${id}`);
      }
      await fetchEntries();
    } catch (err) { console.error(err); }
  };

  const clearFilters = () => { setQ(''); setFType('all'); setFMode('all'); setFCat('all'); };

  const openReceipt = (e) => { setReceiptEntry(e); setReceiptOpen(true); };

  // Generate QR for the signed verifyUrl whenever a new receipt is opened.
  useEffect(() => {
    let cancelled = false;
    if (!receiptEntry?.verifyUrl) { setReceiptQr(null); return; }
    (async () => {
      try {
        const url = await QRCode.toDataURL(receiptEntry.verifyUrl, {
          width: 640, margin: 2, errorCorrectionLevel: 'M',
          color: { dark: '#000000', light: '#ffffff' },
        });
        if (!cancelled) setReceiptQr(url);
      } catch {
        if (!cancelled) setReceiptQr(null);
      }
    })();
    return () => { cancelled = true; };
  }, [receiptEntry]);

  // Farmer-style two-copy DayBook receipt with embedded QR + print stamp.
  const handlePrintReceipt = async () => {
    const e = receiptEntry;
    if (!e) return;

    const dr = parseFloat(e.debit) || 0;
    const cr = parseFloat(e.credit) || 0;
    const isDebit = dr > 0;
    const amt = isDebit ? dr : cr;
    const amtColor = isDebit ? '#dc2626' : '#059669';
    const siteName = (currentSite?.name || 'DAY BOOK').toUpperCase();
    const siteAddr = [currentSite?.address, currentSite?.city, currentSite?.state].filter(Boolean).join(', ').toUpperCase();
    const fmtINR = (v) => parseFloat(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 });
    const payDate = e.date ? new Date(e.date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
    const printedAt = new Date().toLocaleString('en-IN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
    const isCash = (e.payment_mode || '').toUpperCase() === 'CASH';
    const signerName = user?.full_name || user?.name || '';
    const entryIdStr = typeof e.id === 'string' ? e.id.replace(/\D+/g, '') : String(e.id || '');
    const refNo = `DB-${entryIdStr.padStart(5, '0')}`;
    const partyLine = e.to_entity || e.from_entity || e.farmer_name || e.agent_name || e.particular || '—';
    const party2Label = e.to_entity ? 'To' : (e.from_entity ? 'From' : 'Party');
    const docTitle = `${e.entry_type || 'Transaction'} Receipt`;

    let qrDataUrl = null;
    if (e.verifyUrl) {
      try {
        qrDataUrl = await QRCode.toDataURL(e.verifyUrl, {
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
            <p>${siteAddr || 'PERSONAL LEDGER DIVISION'}</p>
          </div>
          <div class="doc-type"><h2>${docTitle}</h2></div>
          <div class="meta-info">
            <div class="meta-item"><b>Ref:</b> ${refNo}</div>
            <div class="meta-item"><b>Date:</b> ${payDate}</div>
          </div>
          <div class="kv-qr-wrap">
            <div class="kv-section">
              <div class="kv-row"><div class="k">${party2Label}</div><div class="c">:</div><div class="v">${String(partyLine).toUpperCase()}</div></div>
              ${e.particular ? `<div class="kv-row"><div class="k">Particular</div><div class="c">:</div><div class="v">${String(e.particular).toUpperCase()}</div></div>` : ''}
              ${e.category ? `<div class="kv-row"><div class="k">Category</div><div class="c">:</div><div class="v">${String(e.category).toUpperCase()}</div></div>` : ''}
              <div class="kv-row"><div class="k">Amount</div><div class="c">:</div><div class="v" style="color:${amtColor}">RS ${fmtINR(amt)}/-</div></div>
              <div class="kv-row"><div class="k">Payment Mode</div><div class="c">:</div><div class="v">${(e.payment_mode || '—').toUpperCase()}</div></div>
            </div>
            ${qrSection}
          </div>
          <div class="settlement-title">Transaction Details:</div>
          <table class="data-table">
            <tr><th>S.No.</th><td>${refNo}</td></tr>
            <tr><th>Date</th><td>${payDate || '—'}</td></tr>
            <tr><th>Entry Type</th><td>${(e.entry_type || '—').toUpperCase()}</td></tr>
            <tr><th>${isDebit ? 'Debit (Paid)' : 'Credit (Received)'}</th><td style="color:${amtColor}">RS ${fmtINR(amt)}/-</td></tr>
            ${e.plot_no || e.pp_plot_no ? `<tr><th>Plot No</th><td>${e.plot_no || e.pp_plot_no}</td></tr>` : ''}
            ${e.firm_name ? `<tr><th>Firm</th><td>${String(e.firm_name).toUpperCase()}</td></tr>` : ''}
            ${e.account_no ? `<tr><th>Account No</th><td>${e.account_no}</td></tr>` : ''}
            ${e.branch ? `<tr><th>Branch</th><td>${String(e.branch).toUpperCase()}</td></tr>` : ''}
            ${e.remarks ? `<tr><th>Remarks</th><td>${e.remarks}</td></tr>` : ''}
          </table>
          ${isCash ? '<div class="bank-proviso">STATUTORY PROVISO: Cash received exclusively as a temporary custodian on behalf of our designated banking institution for immediate reconciliation and ledger entry.</div>' : ''}
          <div class="footer">
            <div class="sig-box"><div class="sig-line">${isDebit ? 'Receiver Signature' : 'Payer Signature'}</div></div>
            <div class="sig-box"><div class="digital-signature">${signerName}</div><div class="sig-line">Authorized Signatory & Seal</div></div>
          </div>
          <div class="print-meta">Printed on: <b>${printedAt}</b></div>
        </div>
      </div>
    `;

    const html = `<!DOCTYPE html>
<html><head>
  <title>DAYBOOK RECEIPT - ${refNo}</title>
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

    const w = window.open('', '_blank', 'width=1000,height=750');
    w.document.write(html);
    w.document.close();
  };

  /* ── Server already filters by date, entries = day's entries ── */
  const filtered = useMemo(() => {
    let l = entries;
    // /daybook/cash → strictly CASH entries.
    // /daybook/bank → "everything except cash" (bank + cheque + upi + other),
    //                 since any non-cash mode ultimately moves through a bank
    //                 account from the firm's side.
    if (daybookPreset === 'cash') l = l.filter(e => classifyPaymentMode(e.payment_mode) === 'cash');
    if (daybookPreset === 'bank') l = l.filter(e => classifyPaymentMode(e.payment_mode) !== 'cash');
    if (fType !== 'all') l = l.filter(e => e.entry_type === fType);
    if (fMode !== 'all') l = l.filter(e => e.payment_mode === fMode);
    if (fCat !== 'all') l = l.filter(e => e.category === fCat);
    if (q) {
      const s = q.toLowerCase();
      l = l.filter(e => e.particular?.toLowerCase().includes(s) || e.from_entity?.toLowerCase().includes(s) ||
        e.to_entity?.toLowerCase().includes(s) || e.remarks?.toLowerCase().includes(s) || e.category?.toLowerCase().includes(s));
    }
    if (sortOrder === 'asc') l.reverse();
    return l;
  }, [entries, q, fType, fMode, fCat, daybookPreset, sortOrder]);

  const rows = useMemo(() => {
    let c = 0;
    return filtered.map(e => { c += (parseFloat(e.credit) || 0) - (parseFloat(e.debit) || 0); return { ...e, balance: c }; });
  }, [filtered]);

  const hasFilter = fType !== 'all' || fMode !== 'all' || fCat !== 'all' || q;
  const fTotals = useMemo(() => {
    let d = 0, c = 0;
    filtered.forEach(e => { d += parseFloat(e.debit) || 0; c += parseFloat(e.credit) || 0; });
    return { d, c };
  }, [filtered]);

  /* Day totals (server already gives us only this date's entries) */
  const dayTotals = useMemo(() => {
    let d = 0, c = 0;
    entries.forEach(e => { d += parseFloat(e.debit) || 0; c += parseFloat(e.credit) || 0; });
    return { d, c, count: entries.length };
  }, [entries]);
  const net = dayTotals.c - dayTotals.d;

  const uTypes = useMemo(() => [...new Set(entries.map(e => e.entry_type).filter(Boolean))].sort(), [entries]);

  /* entryDates not needed — server filters by date */

  /* ── Export ── */
  const exportXL = () => {
    const d = rows.map(e => ({ Date: fmtDate(e.date), Particular: e.particular || '', Type: e.entry_type || '', Debit: parseFloat(e.debit) || 0, Credit: parseFloat(e.credit) || 0, Balance: e.balance, Mode: e.payment_mode || '', Category: e.category || '', Remarks: e.remarks || '' }));
    const ws = XLSX.utils.json_to_sheet(d); const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Day Book');
    XLSX.writeFile(wb, `DayBook_${currentSite?.name || 'Site'}_${selectedDate}.xlsx`);
  };

  /* ── No site ── */
  if (!siteId) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
          <Building2 className="w-8 h-8 text-slate-300" />
        </div>
        <p className="text-lg font-semibold text-slate-700">No Site Selected</p>
        <p className="text-sm text-slate-400 mt-1">Please select a site from the dropdown</p>
      </div>
    </div>
  );

  /* ═══════════════════════ RENDER ═══════════════════════ */
  return (
    <div className="p-4 sm:p-6 space-y-5">

      {/* ─── Header: everything in one row ─── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left: icon + title */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/25 shrink-0">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight leading-tight">{daybookTitle}</h1>
            <p className="text-[11px] text-slate-500 truncate">{daybookPreset === 'cash' ? 'CASH entries' : daybookPreset === 'bank' ? 'BANK entries' : 'Daily cash & bank working'} &middot; <span className="font-medium text-slate-700">{currentSite?.name}</span> &middot; <span className="text-slate-400">{dayTotals.count} entr{dayTotals.count === 1 ? 'y' : 'ies'}</span></p>
          </div>
        </div>

        {/* Right: date nav + actions — all in one line */}
        <div className="flex items-center gap-1 flex-wrap">
          {/* Date navigation */}
          <Button variant="outline" size="icon" className="h-8 w-8 hover:bg-slate-50" onClick={() => goDay(-1)} title="Previous day">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-8 gap-1.5 text-xs font-semibold px-3 justify-start tabular-nums border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300">
                <CalendarIcon className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="truncate">{selectedDate && /^\d{4}-\d{2}-\d{2}$/.test(selectedDate) ? format(parse(selectedDate, 'yyyy-MM-dd', new Date()), 'dd MMM, EEE') : 'Select date'}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-3 shadow-lg border-slate-200" align="end">
              <div className="space-y-4">
                <ShadCalendar
                  mode="single"
                  selected={selectedDate && /^\d{4}-\d{2}-\d{2}$/.test(selectedDate) ? parse(selectedDate, 'yyyy-MM-dd', new Date()) : new Date()}
                  onSelect={(date) => { if (date) { setSelectedDate(toISO(date)); setCalendarOpen(false); } }}
                  disabled={(date) => date > new Date()}
                  initialFocus
                />
              </div>
            </PopoverContent>
          </Popover>
          <Button variant="outline" size="icon" className="h-8 w-8 hover:bg-slate-50" onClick={() => goDay(1)} title="Next day">
            <ChevronRight className="w-4 h-4" />
          </Button>
          {!isToday && (
            <Button variant="outline" size="sm" onClick={goToday} className="h-8 text-[11px] font-semibold gap-1 px-2.5 text-emerald-700 border-emerald-200 hover:bg-emerald-50">
              Today
            </Button>
          )}

          <Separator orientation="vertical" className="h-6 mx-1 hidden sm:block" />

          {/* Action buttons */}
          <Button variant="outline" size="sm" onClick={exportXL} className="h-8 gap-1.5 text-xs">
            <Download className="w-3.5 h-3.5" /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()} className="h-8 gap-1.5 text-xs">
            <Printer className="w-3.5 h-3.5" /> Print
          </Button>
          <Button size="sm" onClick={openCreate} className="h-8 gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm">
            <Plus className="w-3.5 h-3.5" /> Add Entry
          </Button>
        </div>
      </div>

      {/* ─── Opening + Remaining Balance (all three routes) ─── */}
      <BalanceCards
        isToday={isToday}
        selectedDate={selectedDate}
        mode={daybookPreset}
        modeBalance={modeBalance}
        entries={entries}
      />

      {/* ─── Summary Cards ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard label="Day Debit" value={fmt(dayTotals.d)} color="red" icon={<ArrowUpRight className="w-4 h-4" />} />
        <SummaryCard label="Day Credit" value={fmt(dayTotals.c)} color="emerald" icon={<ArrowDownRight className="w-4 h-4" />} />
        <SummaryCard label="Day Balance" value={fmt(Math.abs(net))} sub={net >= 0 ? 'Surplus' : 'Deficit'} color={net >= 0 ? 'emerald' : 'red'} icon={<IndianRupee className="w-4 h-4" />} />
        <SummaryCard label="Day Entries" value={dayTotals.count} sub={hasFilter && filtered.length !== dayTotals.count ? `${filtered.length} filtered` : fmtDate(selectedDate)} color="violet" icon={<Hash className="w-4 h-4" />} />
      </div>

      {/* ─── Search & Filter Toolbar ─── */}
      <Card className="shadow-sm border-slate-200">
        <CardContent className="p-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search particulars, entities, remarks…"
                value={q} onChange={(e) => setQ(e.target.value)}
                className="pl-9 h-9 text-sm bg-slate-50 border-slate-200"
              />
              {q && <button onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600" /></button>}
            </div>
            <Button variant={showFilters || hasFilter ? 'default' : 'outline'} size="sm" onClick={() => setShowFilters(!showFilters)}
              className={`h-9 gap-1.5 text-xs shrink-0 ${showFilters || hasFilter ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}`}>
              <Filter className="w-3.5 h-3.5" /> Filters
              {hasFilter && <span className="ml-0.5 w-1.5 h-1.5 rounded-full bg-white inline-block" />}
            </Button>
            <Button variant={showAnalytics ? 'default' : 'outline'} size="sm" onClick={() => setShowAnalytics(!showAnalytics)}
              className={`h-9 gap-1.5 text-xs shrink-0 ${showAnalytics ? 'bg-violet-600 hover:bg-violet-700 text-white' : ''}`}>
              <BarChart3 className="w-3.5 h-3.5" /> Analytics
            </Button>
            {hasFilter && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 gap-1 shrink-0">
                <X className="w-3 h-3" /> Clear
              </Button>
            )}
          </div>

          {/* Expanded filters */}
          {showFilters && (
            <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-3 gap-3">
              <FilterSelect label="Entry Type" value={fType} onChange={setFType} allLabel="All Types" options={uTypes} />
              {daybookPreset === 'all' && (
                <FilterSelect label="Payment Mode" value={fMode} onChange={setFMode} allLabel="All Modes" options={PAY_MODES} />
              )}
              <FilterSelect label="Category" value={fCat} onChange={setFCat} allLabel="All Categories" options={CATEGORIES} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Analytics Panel ─── */}
      {showAnalytics && (
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="px-4 pt-4 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Activity className="w-4 h-4 text-violet-500" /> Breakdown Analytics
              </CardTitle>
              <div className="flex bg-slate-100 rounded-lg p-0.5 gap-0.5">
                {[{ k: 'type', l: 'Type' }, { k: 'mode', l: 'Mode' }, { k: 'category', l: 'Category' }].map(t => (
                  <button key={t.k} onClick={() => setBdTab(t.k)}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${bdTab === t.k ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                    {t.l}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-1.5">
              {bdTab === 'type' && typeBreakdown.map((i, x) => <BreakdownRow key={x} label={i.entry_type} count={i.entries} dr={i.total_debit} cr={i.total_credit} badge typeBadge />)}
              {bdTab === 'mode' && modeBreakdown.map((i, x) => <BreakdownRow key={x} label={i.payment_mode} count={i.entries} dr={i.total_debit} cr={i.total_credit} badge />)}
              {bdTab === 'category' && categoryBreakdown.slice(0, 12).map((i, x) => <BreakdownRow key={x} label={i.category} count={i.entries} dr={i.total_debit} cr={i.total_credit} />)}
              {bdTab === 'type' && typeBreakdown.length === 0 && <p className="text-xs text-slate-400 py-4 text-center">No data</p>}
              {bdTab === 'mode' && modeBreakdown.length === 0 && <p className="text-xs text-slate-400 py-4 text-center">No data</p>}
              {bdTab === 'category' && categoryBreakdown.length === 0 && <p className="text-xs text-slate-400 py-4 text-center">No data</p>}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Ledger Table ─── */}
      <Card className="shadow-sm border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200">
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
            {fmtDate(selectedDate)} — Cash Working {hasFilter && <span className="font-normal normal-case text-slate-400">({filtered.length} of {entries.length} entries)</span>}
          </span>
          <div className="hidden sm:flex items-center gap-2 text-[11px]">
            <span className="font-semibold text-red-600 tabular-nums">DR {fmt(fTotals.d)}</span>
            <span className="text-slate-300">|</span>
            <span className="font-semibold text-emerald-600 tabular-nums">CR {fmt(fTotals.c)}</span>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-60">
            <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
          </div>
        ) : rows.length === 0 ? null : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-white hover:bg-white border-b border-slate-200">
                  <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-wider h-9 w-12 text-center">
                    <Button variant="ghost" size="sm" onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')} className="h-6 px-1.5 text-xs">
                      # <ArrowUpDown className="w-3 h-3 ml-1" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-wider h-9 min-w-50">Particulars</TableHead>
                  <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-wider h-9 w-24">Type</TableHead>
                  <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-wider h-9 w-24">Mode</TableHead>
                  <TableHead className="text-[10px] font-bold text-red-500 uppercase tracking-wider h-9 w-28 text-right">Debit (₹)</TableHead>
                  <TableHead className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider h-9 w-28 text-right">Credit (₹)</TableHead>
                  <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-wider h-9 w-30 text-right">Balance (₹)</TableHead>
                  <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-wider h-9 w-36">Assigned To</TableHead>
                  <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-wider h-9 w-20 text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((e, i) => {
                  const dr = parseFloat(e.debit) || 0;
                  const cr = parseFloat(e.credit) || 0;
                  const bal = e.balance;
                  const ts = TYPE_STYLE[e.entry_type] || TYPE_STYLE.GENERAL;
                  const isFromExpense = e.source === 'expense';
                  const isFromFarmerPayment = e.source === 'farmer_payment' || e.source === 'daybook_farmer_payment';
                  const isFromCommission = e.source === 'commission' || e.source === 'daybook_commission';
                  const isFromCashFlow = e.source === 'cashflow' || e.source === 'daybook_cashflow';
                  const isFromFirmTxn = e.source === 'firm_transaction' || e.source === 'daybook_firm_transaction';
                  const isFromPlotPayment = e.source === 'plot_payment' || e.source === 'daybook_plot_payment';
                  return (
                    <TableRow key={e.id} className={`group hover:bg-slate-50/80 transition-colors border-b border-slate-100 ${isFromExpense ? 'bg-blue-50/30' : isFromFarmerPayment ? 'bg-lime-50/30' : isFromCommission ? 'bg-teal-50/30' : isFromCashFlow ? 'bg-amber-50/30' : isFromFirmTxn ? 'bg-indigo-50/30' : isFromPlotPayment ? 'bg-pink-50/30' : ''}`}>
                      <TableCell className="text-center text-[11px] text-slate-400 font-medium py-2.5">{i + 1}</TableCell>
                      <TableCell className="py-2.5">
                        <div>
                          <p className="text-sm font-semibold text-slate-800 leading-tight">{e.particular}</p>
                          {e.farmer_name && (
                            <p className="text-[11px] text-lime-600 font-medium mt-0.5 flex items-center gap-1">
                              <Users className="w-3 h-3" /> {e.farmer_name}
                              {e.interest_amount > 0 && <span className="text-slate-400 ml-1">(Int: {fmt(e.interest_amount)})</span>}
                            </p>
                          )}
                          {e.plot_no && (
                            <p className="text-[11px] text-teal-600 font-medium mt-0.5 flex items-center gap-1">
                              <Hash className="w-3 h-3" /> Plot: {e.plot_no}
                              {e.plot_size && <span className="text-slate-400 ml-1">({e.plot_size})</span>}
                              {e.plot_rate && <span className="text-slate-400 ml-1">@{e.plot_rate}</span>}
                              {e.commission_by_note && <span className="text-slate-400 ml-1">• {e.commission_by_note}</span>}
                            </p>
                          )}
                          {e.father_name && (
                            <p className="text-[10px] text-slate-500 mt-0.5">S/O {e.father_name}</p>
                          )}
                          {e.ledger_name && (
                            <p className="text-[11px] text-amber-600 font-medium mt-0.5 flex items-center gap-1">
                              <IndianRupee className="w-3 h-3" /> Ledger: {e.ledger_name}
                              {e.ledger_type === 'person' && <span className="text-slate-400 ml-1">(Person)</span>}
                            </p>
                          )}
                          {e.firm_name && (
                            <p className="text-[11px] text-indigo-600 font-medium mt-0.5 flex items-center gap-1">
                              <Building2 className="w-3 h-3" /> Firm: {e.firm_name}
                              {e.firm_purpose && <span className="text-slate-400 ml-1">• {e.firm_purpose}</span>}
                              {e.firm_cheque_no && <span className="text-slate-400 ml-1">CHQ: {e.firm_cheque_no}</span>}
                            </p>
                          )}
                          {e.pp_plot_no && (
                            <p className="text-[11px] text-pink-600 font-medium mt-0.5 flex items-center gap-1">
                              <MapPin className="w-3 h-3" /> Plot: {e.pp_plot_no}{e.pp_block ? ` (${e.pp_block})` : ''}
                              {e.pp_buyer_name && <span className="text-slate-500 ml-1">• {e.pp_buyer_name}</span>}
                              {e.pp_payment_from && <span className="text-slate-400 ml-1">via {e.pp_payment_from}</span>}
                              {e.pp_bank_details && <span className="text-slate-400 ml-1">• {e.pp_bank_details}</span>}
                            </p>
                          )}
                          {(e.from_entity || e.to_entity) && !e.farmer_name && (
                            <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                              {e.from_entity && <span>{e.from_entity}</span>}
                              {e.from_entity && e.to_entity && <ChevronRight className="w-3 h-3" />}
                              {e.to_entity && <span>{e.to_entity}</span>}
                            </p>
                          )}
                          {e.remarks && <p className="text-[10px] text-slate-400 italic mt-0.5 truncate max-w-xs">{e.remarks}</p>}
                          {e.category && (
                            <span className="inline-block text-[9px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0 rounded mt-1">{e.category}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-2.5">
                        <div className="flex flex-col items-start gap-1">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${ts.bg} ${ts.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${ts.dot}`} />
                            {e.entry_type}
                          </span>
                          {isFromExpense && (
                            <span className="text-[9px] font-semibold text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0 rounded">
                              Expense
                            </span>
                          )}
                          {isFromFarmerPayment && (
                            <span className="text-[9px] font-semibold text-lime-600 bg-lime-50 border border-lime-200 px-1.5 py-0 rounded">
                              Farmer Payment
                            </span>
                          )}
                          {isFromCommission && (
                            <span className="text-[9px] font-semibold text-teal-600 bg-teal-50 border border-teal-200 px-1.5 py-0 rounded">
                              Commission
                            </span>
                          )}
                          {isFromCashFlow && (
                            <span className="text-[9px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0 rounded">
                              Cash Flow
                            </span>
                          )}
                          {isFromFirmTxn && (
                            <span className="text-[9px] font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 px-1.5 py-0 rounded">
                              Firm Txn
                            </span>
                          )}
                          {isFromPlotPayment && (
                            <span className="text-[9px] font-semibold text-pink-600 bg-pink-50 border border-pink-200 px-1.5 py-0 rounded">
                              Plot Pmt
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-2.5">
                        {e.payment_mode ? (
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${MODE_STYLE[e.payment_mode] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                            {e.payment_mode}
                          </span>
                        ) : <span className="text-slate-300 text-xs">—</span>}
                        <ChequeStatusControl
                          chequeStatus={e.cheque_status}
                          source="daybook"
                          entryId={e.id}
                          isAdmin={isAdmin}
                          onStatusChange={fetchEntries}
                        />
                      </TableCell>
                      <TableCell className="text-right py-2.5 tabular-nums">
                        {dr > 0
                          ? <span className="text-sm font-bold text-red-600">{fmt(dr)}</span>
                          : <span className="text-slate-200">—</span>}
                      </TableCell>
                      <TableCell className="text-right py-2.5 tabular-nums">
                        {cr > 0
                          ? <span className="text-sm font-bold text-emerald-600">{fmt(cr)}</span>
                          : <span className="text-slate-200">—</span>}
                      </TableCell>
                      <TableCell className="text-right py-2.5 tabular-nums">
                        <span className={`text-sm font-bold ${bal > 0 ? 'text-emerald-600' : bal < 0 ? 'text-red-600' : 'text-slate-800'}`}>
                          {bal < 0 && '−'}{bal > 0 && '+'}{fmt(Math.abs(bal))}
                        </span>
                      </TableCell>
                      <TableCell className="py-2.5">
                        <div className="flex flex-col items-start gap-1">
                          {e.assigned_admin_id ? (
                            <span className="inline-flex items-center text-xs font-medium text-purple-700 bg-purple-50 px-2 py-1 rounded-md">
                              {getAssignedAdminLabel(e) || '—'}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-300">Unassigned</span>
                          )}
                          {e.approved_by_name && (e.status === 'approved' || e.status === 'rejected') && (
                            <TooltipProvider delayDuration={150}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold cursor-default shrink-0 ${
                                    e.status === 'approved' ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200' : 'bg-red-100 text-red-700 ring-1 ring-red-200'
                                  }`}>
                                    {e.approved_by_name[0].toUpperCase()}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs">
                                  <p>{e.status === 'approved' ? 'Approved' : 'Rejected'} by <span className="font-semibold">{e.approved_by_name}</span></p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-2.5">
                        <div className="flex items-center justify-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-blue-50" title="View Receipt" onClick={() => openReceipt(e)}>
                            <FileText className="w-3.5 h-3.5 text-blue-400 hover:text-blue-600" />
                          </Button>
                          <Button variant="ghost" size="icon" className={`h-7 w-7 ${canUpdate ? 'hover:bg-slate-100' : 'hover:bg-amber-50'}`} onClick={() => openEdit(e)} title={canUpdate ? 'Edit' : 'Request Edit'}>
                            <Edit2 className={`w-3.5 h-3.5 ${canUpdate ? 'text-slate-500' : 'text-amber-500'}`} />
                          </Button>
                          {canDelete && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-red-50" onClick={() => handleDelete(e.id, e)}>
                              <Trash2 className="w-3.5 h-3.5 text-red-400 hover:text-red-600" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}

                {/* Totals Row */}
                <TableRow className="bg-slate-50 hover:bg-slate-50 border-t-2 border-slate-200">
                  <TableCell colSpan={4} className="py-2.5">
                    <span className="text-xs font-bold text-slate-600 uppercase">Day Total ({filtered.length} entries)</span>
                  </TableCell>
                  <TableCell className="text-right py-2.5 tabular-nums">
                    <span className="text-sm font-bold text-red-700">{fmt(fTotals.d)}</span>
                  </TableCell>
                  <TableCell className="text-right py-2.5 tabular-nums">
                    <span className="text-sm font-bold text-emerald-700">{fmt(fTotals.c)}</span>
                  </TableCell>
                  <TableCell className="text-right py-2.5 tabular-nums">
                    <span className={`text-sm font-bold ${(fTotals.c - fTotals.d) > 0 ? 'text-emerald-600' : (fTotals.c - fTotals.d) < 0 ? 'text-red-600' : 'text-slate-800'}`}>
                      {(fTotals.c - fTotals.d) < 0 && '−'}{(fTotals.c - fTotals.d) > 0 && '+'}{fmt(Math.abs(fTotals.c - fTotals.d))}
                    </span>
                  </TableCell>
                  <TableCell />
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* ═══════════════════════ RECEIPT DIALOG ═══════════════════════ */}
      <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
        <DialogContent className="sm:max-w-2xl p-0 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-600" />
              <span className="text-sm font-semibold text-slate-800">Day Book Receipt</span>
            </div>
            <Button size="sm" variant="outline" onClick={handlePrintReceipt} className="h-8 text-xs gap-1.5">
              <Printer className="w-3.5 h-3.5" /> Print / Save PDF
            </Button>
          </div>

          <div className="p-5 bg-white max-h-[80vh] overflow-y-auto">
            {receiptEntry && (() => {
              const e = receiptEntry;
              const dr = parseFloat(e.debit) || 0;
              const cr = parseFloat(e.credit) || 0;
              const ts = TYPE_STYLE[e.entry_type] || TYPE_STYLE.OTHER;
              const entryIdStr = typeof e.id === 'string' ? e.id.replace(/\D+/g, '') : String(e.id || '');
              return (
                <div id="daybook-receipt-print">
                  <div className="r" style={{ fontFamily: "'Segoe UI',Arial,sans-serif", maxWidth: '680px', margin: '0 auto', padding: '28px 32px', border: '1px solid #e2e8f0', borderRadius: '12px', background: '#fff' }}>

                    {/* Header */}
                    <div className="hdr" style={{ textAlign: 'center', borderBottom: '2px solid #1e293b', paddingBottom: '16px', marginBottom: '20px' }}>
                      <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#1e293b', letterSpacing: '1px', margin: 0 }}>{currentSite?.name || 'DGACCOUNT'}</h1>
                      {currentSite?.address && <p style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>{currentSite.address}</p>}
                      <p style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Day Book Transaction Receipt</p>
                    </div>

                    {/* Receipt title row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '1.5px', padding: '4px 12px', background: '#f1f5f9', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
                        {e.entry_type || 'Transaction'} Receipt
                      </span>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '10px', color: '#64748b' }}>Receipt No.</div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>DB-{entryIdStr.padStart(5, '0')}</div>
                      </div>
                    </div>

                    {/* Date + Mode bar */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', background: '#f8fafc', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px' }}>
                      <div>
                        <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px' }}>Date</div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b', marginTop: '2px' }}>{fmtDate(e.date)}</div>
                      </div>
                      {e.payment_mode && (
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px' }}>Payment Mode</div>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b', marginTop: '2px' }}>{e.payment_mode}</div>
                        </div>
                      )}
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px' }}>Entry Type</div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b', marginTop: '2px' }}>{e.entry_type}</div>
                      </div>
                    </div>

                    <hr style={{ border: 'none', borderTop: '1px dashed #cbd5e1', margin: '0 0 16px' }} />

                    {/* Particular / parties */}
                    <div style={{ marginBottom: '16px' }}>
                      <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>Particulars</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        {e.particular && (
                          <div>
                            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}>Particular</div>
                            <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>{e.particular}</div>
                          </div>
                        )}
                        {e.category && (
                          <div>
                            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}>Category</div>
                            <div style={{ fontSize: '13px', fontWeight: 500, color: '#334155' }}>{e.category}</div>
                          </div>
                        )}
                        {e.from_entity && (
                          <div>
                            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}>From</div>
                            <div style={{ fontSize: '13px', fontWeight: 500, color: '#334155' }}>{e.from_entity}</div>
                          </div>
                        )}
                        {e.to_entity && (
                          <div>
                            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}>To</div>
                            <div style={{ fontSize: '13px', fontWeight: 500, color: '#334155' }}>{e.to_entity}</div>
                          </div>
                        )}
                        {e.farmer_name && (
                          <div>
                            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}>Farmer</div>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: '#4d7c0f' }}>{e.farmer_name}</div>
                          </div>
                        )}
                        {e.interest_amount > 0 && (
                          <div>
                            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}>Interest</div>
                            <div style={{ fontSize: '13px', fontWeight: 500, color: '#334155' }}>₹{e.interest_amount} @ {e.interest_rate}%</div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Plot / commission details */}
                    {(e.plot_no || e.pp_plot_no || e.firm_name || e.ledger_name) && (
                      <>
                        <hr style={{ border: 'none', borderTop: '1px dashed #cbd5e1', margin: '0 0 16px' }} />
                        <div style={{ marginBottom: '16px' }}>
                          <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>Additional Details</div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                            {(e.plot_no || e.pp_plot_no) && (
                              <div>
                                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}>Plot No.</div>
                                <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>{e.plot_no || e.pp_plot_no}</div>
                              </div>
                            )}
                            {e.plot_size && (
                              <div>
                                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}>Plot Size</div>
                                <div style={{ fontSize: '13px', fontWeight: 500, color: '#334155' }}>{e.plot_size}</div>
                              </div>
                            )}
                            {e.plot_rate && (
                              <div>
                                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}>Plot Rate</div>
                                <div style={{ fontSize: '13px', fontWeight: 500, color: '#334155' }}>{e.plot_rate}</div>
                              </div>
                            )}
                            {e.firm_name && (
                              <div>
                                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}>Firm</div>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: '#3730a3' }}>{e.firm_name}</div>
                              </div>
                            )}
                            {e.firm_purpose && (
                              <div>
                                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}>Purpose</div>
                                <div style={{ fontSize: '12px', fontWeight: 500, color: '#334155' }}>{e.firm_purpose}</div>
                              </div>
                            )}
                            {e.firm_cheque_no && (
                              <div>
                                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}>Cheque No.</div>
                                <div style={{ fontSize: '12px', fontWeight: 500, color: '#334155' }}>{e.firm_cheque_no}</div>
                              </div>
                            )}
                            {e.ledger_name && (
                              <div>
                                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}>Ledger</div>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: '#92400e' }}>{e.ledger_name}</div>
                              </div>
                            )}
                            {e.account_no && (
                              <div>
                                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}>Account No.</div>
                                <div style={{ fontSize: '12px', fontWeight: 500, color: '#334155', fontFamily: 'monospace' }}>{e.account_no}</div>
                              </div>
                            )}
                            {e.branch && (
                              <div>
                                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}>Branch</div>
                                <div style={{ fontSize: '12px', fontWeight: 500, color: '#334155' }}>{e.branch}</div>
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    )}

                    <hr style={{ border: 'none', borderTop: '1px dashed #cbd5e1', margin: '0 0 16px' }} />

                    {/* Amount box */}
                    <div style={{ background: '#0f172a', borderRadius: '10px', padding: '18px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <div>
                        {dr > 0 && (
                          <>
                            <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px' }}>Debit (Amount Paid)</div>
                            <div style={{ fontSize: '24px', fontWeight: 800, color: '#fca5a5', marginTop: '4px', fontFamily: 'monospace' }}>₹{dr.toLocaleString('en-IN')}</div>
                          </>
                        )}
                        {cr > 0 && (
                          <>
                            <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px' }}>Credit (Amount Received)</div>
                            <div style={{ fontSize: '24px', fontWeight: 800, color: '#6ee7b7', marginTop: '4px', fontFamily: 'monospace' }}>₹{cr.toLocaleString('en-IN')}</div>
                          </>
                        )}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Running Balance</div>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: '#34d399', marginTop: '3px', fontFamily: 'monospace' }}>₹{Math.abs(e.balance || 0).toLocaleString('en-IN')}</div>
                      </div>
                    </div>

                    {/* Remarks */}
                    {e.remarks && (
                      <div style={{ background: '#fffbeb', border: '1px solid #fef08a', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px' }}>
                        <div style={{ fontSize: '10px', color: '#92400e', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '3px' }}>Remarks</div>
                        <div style={{ fontSize: '12px', color: '#78350f', fontWeight: 500 }}>{e.remarks}</div>
                      </div>
                    )}

                    <hr style={{ border: 'none', borderTop: '1px dashed #cbd5e1', margin: '0 0 20px' }} />

                    {/* Signatures + QR */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '8px', gap: '16px' }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ width: '120px', borderTop: '1.5px solid #94a3b8', marginBottom: '5px' }}></div>
                        <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '.5px', fontWeight: 600 }}>Receiver Signature</div>
                      </div>
                      {receiptQr && (
                        <div style={{ textAlign: 'center' }}>
                          <img src={receiptQr} alt="Verify QR" style={{ width: '90px', height: '90px', border: '1px solid #0f172a', padding: '3px', background: '#fff', imageRendering: 'pixelated' }} />
                          <div style={{ fontSize: '9px', color: '#166534', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '3px' }}>Scan to verify</div>
                        </div>
                      )}
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ width: '120px', borderTop: '1.5px solid #94a3b8', marginBottom: '5px' }}></div>
                        <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '.5px', fontWeight: 600 }}>Authorised Signatory</div>
                      </div>
                    </div>

                    {/* Footer */}
                    <div style={{ textAlign: 'center', marginTop: '22px', paddingTop: '14px', borderTop: '1px solid #e2e8f0' }}>
                      <p style={{ fontSize: '10px', color: '#94a3b8' }}>This is a computer-generated receipt. For queries contact the site office.</p>
                      <p style={{ fontSize: '10px', color: '#cbd5e1', marginTop: '2px' }}>Printed on {new Date().toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}</p>
                    </div>

                  </div>
                </div>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════ DIALOG ═══════════════════════ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-xl max-h-[92vh] overflow-y-auto p-0 gap-0 rounded-xl">
          {/* Header */}
          <div className={`px-5 pt-5 pb-4 ${editingId && !canUpdate ? 'bg-amber-50' : editingId ? 'bg-slate-50' : 'bg-linear-to-r from-emerald-50 to-teal-50'} border-b border-slate-100`}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shadow-sm ${editingId && !canUpdate ? 'bg-amber-600' : editingId ? 'bg-slate-700' : 'bg-emerald-600'}`}>
                  {editingId && !canUpdate ? <Send className="w-3.5 h-3.5 text-white" /> : editingId ? <Edit2 className="w-3.5 h-3.5 text-white" /> : <Plus className="w-3.5 h-3.5 text-white" />}
                </div>
                {editingId && !canUpdate
                  ? (isEditingExpense ? 'Request Expense Edit' : (isEditingFarmerPayment || isEditingDbFarmerPayment) ? 'Request Farmer Payment Edit' : (isEditingCommission || isEditingDbCommission) ? 'Request Commission Edit' : (isEditingCashFlow || isEditingDbCashFlow) ? 'Request Cash Flow Edit' : (isEditingFirmTxn || isEditingDbFirmTxn) ? 'Request Firm Txn Edit' : (isEditingPlotPayment || isEditingDbPlotPayment) ? 'Request Plot Payment Edit' : 'Request Entry Edit')
                  : editingId ? (isEditingExpense ? 'Edit Expense' : (isEditingFarmerPayment || isEditingDbFarmerPayment) ? 'Edit Farmer Payment' : (isEditingCommission || isEditingDbCommission) ? 'Edit Commission' : (isEditingCashFlow || isEditingDbCashFlow) ? 'Edit Cash Flow Entry' : (isEditingFirmTxn || isEditingDbFirmTxn) ? 'Edit Firm Transaction' : (isEditingPlotPayment || isEditingDbPlotPayment) ? 'Edit Plot Payment' : 'Edit Entry') : 'New Day Book Entry'}
              </DialogTitle>
            </DialogHeader>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {message.text && (
              <div className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium ${message.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-red-50 border border-red-200 text-red-700'
                }`}>
                {message.type === 'success' ? <Check className="w-3.5 h-3.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
                {message.text}
              </div>
            )}

            {/* Date + Entry Type */}
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Date" required>
                <Input
                  type="date"
                  value={isAdmin ? form.date : (editingId ? form.date : TODAY)}
                  onChange={isAdmin ? ((e) => setForm({ ...form, date: e.target.value })) : undefined}
                  readOnly={!isAdmin}
                  disabled={!isAdmin}
                  required
                  className="h-9 text-sm"
                />
              </FormField>
              <FormField label="Entry Type" required>
                <Select value={form.entry_type} onValueChange={(v) => {
                  const u = { entry_type: v };
                  if (v === 'EXPENSE') u.credit = '';
                  if (v === 'FARMER PAYMENT') { u.credit = ''; u.category = ''; }
                  if (v === 'PLOT COMMISSION') { u.credit = ''; u.category = 'COMMISSION'; }
                  if (v === 'CASH FLOW') { u.category = 'CASH FLOW'; }
                  if (v === 'FIRM TRANSACTION') { u.category = 'FIRM'; }
                  if (v === 'PLOT PAYMENT') { u.category = 'PLOT PAYMENT'; }
                  if (v !== 'FARMER PAYMENT') { u.farmer_id = ''; u.interest_rate = ''; u.interest_amount = ''; }
                  if (v !== 'PLOT COMMISSION') { u.plot_no = ''; u.plot_size = ''; u.plot_rate = ''; u.father_name = ''; u.commission_person = ''; }
                  if (v !== 'CASH FLOW') { u.ledger_name = ''; u.ledger_type = 'site'; u.cf_key = ''; }
                  if (v !== 'FIRM TRANSACTION') { u.firm_id = ''; u.firm_name = ''; u.firm_purpose = ''; u.firm_remark = ''; u.firm_cheque_no = ''; }
                  if (v !== 'PLOT PAYMENT') { u.pp_plot_id = ''; u.pp_payment_from = ''; u.pp_payment_type = 'CASH'; u.pp_bank_details = ''; u.pp_narration = ''; u.pp_received_by = ''; }
                  if (v !== 'FARMER PAYMENT' && v !== 'PLOT COMMISSION') { u.by_note = ''; }
                  setForm({ ...form, ...u });
                }}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ENTRY_TYPES.map(t => (
                      <SelectItem key={t} value={t}>
                        <span className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${(TYPE_STYLE[t] || TYPE_STYLE.GENERAL).dot}`} />
                          {t}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </div>

            {/* Particular / Purpose */}
            <FormField label={form.entry_type === 'FARMER PAYMENT' ? 'Payment Description' : form.entry_type === 'PLOT COMMISSION' ? 'Commission Description' : form.entry_type === 'CASH FLOW' ? 'Particular / Description' : form.entry_type === 'FIRM TRANSACTION' ? 'Transaction Description' : form.entry_type === 'PLOT PAYMENT' ? 'Payment Description' : form.entry_type === 'EXPENSE' ? 'Expense Purpose / Description' : 'Particular / Description'} required>
              <Input value={form.particular} onChange={(e) => setForm({ ...form, particular: e.target.value.toUpperCase() })} placeholder={form.entry_type === 'FARMER PAYMENT' ? 'FARMER PAYMENT - RAJU, ADV FARMER…' : form.entry_type === 'PLOT COMMISSION' ? 'COMMISSION - PLOT A1, BROKERAGE…' : form.entry_type === 'PLOT PAYMENT' ? 'PLOT PAYMENT - A1 BUYER NAME…' : form.entry_type === 'EXPENSE' ? 'PEPSI, CEMENT, BRICKS, SALARY…' : 'Enter description…'} required className="h-9 text-sm" list="db-plist" />
              <datalist id="db-plist">{autocomplete.particulars?.map((p, i) => <option key={i} value={p} />)}</datalist>
            </FormField>

            {/* ── FARMER PAYMENT FIELDS ── */}
            {form.entry_type === 'FARMER PAYMENT' && (
              <>
                {/* Farmer Select */}
                <FormField label="Select Farmer" required>
                  <Select value={form.farmer_id} onValueChange={(v) => {
                    const farmer = farmers.find(f => String(f.id) === v);
                    setForm({
                      ...form,
                      farmer_id: v,
                      interest_rate: farmer?.interest_rate ? String(farmer.interest_rate) : form.interest_rate,
                      to_entity: farmer?.name || form.to_entity,
                      particular: form.particular || `FARMER PAYMENT - ${farmer?.name || ''}`,
                    });
                  }}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Choose a farmer…" />
                    </SelectTrigger>
                    <SelectContent>
                      {farmers.filter(f => f.status === 'active').map(f => (
                        <SelectItem key={f.id} value={String(f.id)}>
                          <span className="flex items-center gap-2">
                            <Users className="w-3.5 h-3.5 text-lime-600" />
                            <span className="font-medium">{f.name}</span>
                            {f.phone && <span className="text-slate-400 text-xs">({f.phone})</span>}
                            <span className="text-xs text-slate-400 ml-auto">Paid: {fmt(f.total_paid || 0)}</span>
                          </span>
                        </SelectItem>
                      ))}
                      {farmers.filter(f => f.status === 'active').length === 0 && (
                        <div className="px-3 py-2 text-xs text-slate-400">No active farmers for this site</div>
                      )}
                    </SelectContent>
                  </Select>
                </FormField>

                {/* Payment Mode (Farmer-specific options) */}
                <FormField label="Payment Mode" required>
                  <Select value={form.payment_mode} onValueChange={(v) => setForm({ ...form, payment_mode: v })}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Select payment method…" />
                    </SelectTrigger>
                    <SelectContent>
                      {FARMER_PAY_MODES.map(m => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>

                {/* Amount */}
                <FormField label="Payment Amount (₹)" required>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-lime-600">₹</span>
                    <Input type="number" step="0.01" placeholder="0.00" value={form.debit}
                      onChange={(e) => {
                        const amt = e.target.value;
                        const ir = parseFloat(form.interest_rate) || 0;
                        const ia = ir > 0 ? ((parseFloat(amt) || 0) * ir / 100).toFixed(2) : form.interest_amount;
                        setForm({ ...form, debit: amt, interest_amount: ia });
                      }}
                      required
                      className="h-9 pl-8 text-sm font-semibold tabular-nums border-lime-200 bg-lime-50/50 text-lime-700 focus-visible:ring-lime-300" />
                  </div>
                </FormField>

                {/* Interest Rate + Interest Amount */}
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Interest Rate (%)">
                    <Input type="number" step="0.01" placeholder="0.00" value={form.interest_rate}
                      onChange={(e) => {
                        const rate = e.target.value;
                        const amt = parseFloat(form.debit) || 0;
                        const ia = parseFloat(rate) > 0 ? (amt * parseFloat(rate) / 100).toFixed(2) : '0';
                        setForm({ ...form, interest_rate: rate, interest_amount: ia });
                      }}
                      className="h-9 text-sm tabular-nums" />
                  </FormField>
                  <FormField label="Interest Amount (₹)">
                    <Input type="number" step="0.01" placeholder="0.00" value={form.interest_amount}
                      onChange={(e) => setForm({ ...form, interest_amount: e.target.value })}
                      className="h-9 text-sm tabular-nums" />
                  </FormField>
                </div>

                {/* By Note */}
                <FormField label="By Note / Reference">
                  <Input value={form.by_note} onChange={(e) => setForm({ ...form, by_note: e.target.value.toUpperCase() })} placeholder="CHQ NO 123456, REF TXN…" className="h-9 text-sm" />
                </FormField>

                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-lime-50 border border-lime-200 text-[11px] font-semibold text-lime-700">
                  <Users className="w-3.5 h-3.5 shrink-0" />
                  This entry will also appear in the Farmer Payments module
                </div>
              </>
            )}

            {/* ── PLOT COMMISSION FIELDS ── */}
            {form.entry_type === 'PLOT COMMISSION' && (
              <>
                {/* Person Select (from Members/Users) with search */}
                <FormField label="Person / Particular" required>
                  <Select value={form.commission_person} onValueChange={(v) => {
                    const member = members.find(m => m.full_name === v);
                    setForm({
                      ...form,
                      commission_person: v,
                      particular: v,
                      to_entity: v,
                      father_name: member?.father_name || form.father_name,
                    });
                  }}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Select a person…" />
                    </SelectTrigger>
                    <SelectContent>
                      <div className="px-2 pb-2 pt-1 sticky top-0 bg-white z-10">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Search members…"
                            value={memberSearch}
                            onChange={(e) => setMemberSearch(e.target.value)}
                            className="w-full h-8 pl-8 pr-3 text-sm border border-slate-200 rounded-md outline-none focus:ring-2 focus:ring-teal-300 focus:border-teal-300"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      </div>
                      {members
                        .filter(m => {
                          if (!memberSearch) return true;
                          const s = memberSearch.toLowerCase();
                          return m.full_name?.toLowerCase().includes(s) ||
                            m.phone?.toLowerCase().includes(s) ||
                            m.email?.toLowerCase().includes(s) ||
                            m.member_type?.toLowerCase().includes(s);
                        })
                        .map(m => (
                          <SelectItem key={m.id} value={m.full_name}>
                            <span className="flex items-center gap-2">
                              <Users className="w-3.5 h-3.5 text-teal-600" />
                              <span className="font-medium">{m.full_name}</span>
                              {m.phone && <span className="text-slate-400 text-xs">({m.phone})</span>}
                              <span className="text-[10px] text-slate-400 ml-auto">{m.member_type}</span>
                            </span>
                          </SelectItem>
                        ))}
                      {members.length === 0 && (
                        <div className="px-3 py-2 text-xs text-slate-400">No members registered for this site</div>
                      )}
                    </SelectContent>
                  </Select>
                  <Input
                    value={form.particular}
                    onChange={(e) => setForm({ ...form, particular: e.target.value.toUpperCase(), commission_person: e.target.value.toUpperCase() })}
                    placeholder="Or type name manually…"
                    className="mt-1.5 h-9 text-sm"
                  />
                </FormField>

                {/* Father Name */}
                <FormField label="Father Name">
                  <Input value={form.father_name} onChange={(e) => setForm({ ...form, father_name: e.target.value.toUpperCase() })} placeholder="S/O RAMESH CHAUDHARY…" className="h-9 text-sm" />
                </FormField>

                {/* Plot No + Plot Size + Plot Rate */}
                <div className="grid grid-cols-3 gap-3">
                  <FormField label="Plot No">
                    <Input value={form.plot_no} onChange={(e) => setForm({ ...form, plot_no: e.target.value.toUpperCase() })} placeholder="A1, B12…" className="h-9 text-sm" />
                  </FormField>
                  <FormField label="Plot Size">
                    <Input value={form.plot_size} onChange={(e) => setForm({ ...form, plot_size: e.target.value.toUpperCase() })} placeholder="1200 SQFT…" className="h-9 text-sm" />
                  </FormField>
                  <FormField label="Plot Rate">
                    <Input value={form.plot_rate} onChange={(e) => setForm({ ...form, plot_rate: e.target.value.toUpperCase() })} placeholder="1500/SQFT…" className="h-9 text-sm" />
                  </FormField>
                </div>

                {/* Commission Amount */}
                <FormField label="Commission Amount (₹)" required>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-teal-600">₹</span>
                    <Input type="number" step="0.01" placeholder="0.00" value={form.debit}
                      onChange={(e) => setForm({ ...form, debit: e.target.value })}
                      required
                      className="h-9 pl-8 text-sm font-semibold tabular-nums border-teal-200 bg-teal-50/50 text-teal-700 focus-visible:ring-teal-300" />
                  </div>
                </FormField>

                {/* By Note */}
                <FormField label="By Note / Reference">
                  <Input value={form.by_note} onChange={(e) => setForm({ ...form, by_note: e.target.value.toUpperCase() })} placeholder="CHQ NO 123456, REF TXN…" className="h-9 text-sm" />
                </FormField>

                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-teal-50 border border-teal-200 text-[11px] font-semibold text-teal-700">
                  <Hash className="w-3.5 h-3.5 shrink-0" />
                  This entry will also appear in the Plot Commissions module
                </div>
              </>
            )}

            {/* ── CASH FLOW FIELDS ── */}
            {form.entry_type === 'CASH FLOW' && (() => {
              /* helper: build safe compound key for a ledger record */
              const cfKey = (l) => `${l.id}`;
              /* helper: display name for a ledger (handles null names) */
              const cfLabel = (l) => l.ledger_name || `${l.ledger_type === 'person' ? 'Person' : 'Site'} Ledger`;
              /* find selected ledger from the list */
              const selectedCfLedger = cashflowLedgers.find(l => cfKey(l) === form.cf_key);
              const selectedCfDisplay = selectedCfLedger
                ? `${cfLabel(selectedCfLedger)} — ${MONTH_NAMES[selectedCfLedger.month]} ${selectedCfLedger.year}`
                : null;

              return (
                <>
                  {/* Ledger Select — shows ALL month+ledger combinations */}
                  <FormField label="Cash Flow Ledger" required>
                    <Select value={form.cf_key} onValueChange={(v) => {
                      const ledger = cashflowLedgers.find(l => cfKey(l) === v);
                      setForm({
                        ...form,
                        cf_key: v,
                        ledger_name: ledger?.ledger_name || '',
                        ledger_type: ledger?.ledger_type || 'site',
                      });
                    }}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="Select a ledger…">
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
                          <div className="px-3 py-2 text-xs text-slate-400">No ledgers found. Create one in Cash Flow module first, or type a new name below.</div>
                        )}
                      </SelectContent>
                    </Select>
                    <Input
                      value={form.ledger_name}
                      onChange={(e) => setForm({ ...form, ledger_name: e.target.value.toUpperCase() })}
                      placeholder="Or type a new ledger name…"
                      className="mt-1.5 h-9 text-sm"
                    />
                  </FormField>

                  {/* Ledger Type */}
                  <FormField label="Ledger Type">
                    <Select value={form.ledger_type} onValueChange={(v) => setForm({ ...form, ledger_type: v })}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="site">Site Ledger</SelectItem>
                        <SelectItem value="person">Person Ledger</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormField>

                  {/* Debit + Credit */}
                  <div className="grid grid-cols-2 gap-3">
                    <FormField label="Debit (₹)">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-red-500">DR</span>
                        <Input type="number" step="0.01" placeholder="0.00" value={form.debit}
                          onChange={(e) => setForm({ ...form, debit: e.target.value })}
                          className="h-9 pl-9 text-sm tabular-nums border-red-200/50 focus-visible:ring-red-300" />
                      </div>
                    </FormField>
                    <FormField label="Credit (₹)">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-emerald-600">CR</span>
                        <Input type="number" step="0.01" placeholder="0.00" value={form.credit}
                          onChange={(e) => setForm({ ...form, credit: e.target.value })}
                          className="h-9 pl-9 text-sm tabular-nums border-emerald-200/50 focus-visible:ring-emerald-300" />
                      </div>
                    </FormField>
                  </div>

                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-[11px] font-semibold text-amber-700">
                    <IndianRupee className="w-3.5 h-3.5 shrink-0" />
                    {selectedCfLedger
                      ? <>This entry will also appear in Cash Flow → <span className="underline">{cfLabel(selectedCfLedger)}</span> ({MONTH_NAMES[selectedCfLedger.month]} {selectedCfLedger.year})</>
                      : form.ledger_name
                        ? <>This entry will create a new Cash Flow ledger "{form.ledger_name}"</>
                        : <>Select a ledger or type a new name above</>
                    }
                  </div>
                </>
              );
            })()}

            {/* ── FIRM TRANSACTION FIELDS ── */}
            {form.entry_type === 'FIRM TRANSACTION' && (
              <>
                {/* Firm Select */}
                <FormField label="Select Firm" required>
                  <Select value={form.firm_id} onValueChange={(v) => {
                    const firm = firms.find(f => String(f.id) === v);
                    setForm({
                      ...form,
                      firm_id: v,
                      to_entity: firm?.name || form.to_entity,
                      particular: form.particular || `FIRM TXN - ${firm?.name || ''}`,
                    });
                  }}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Choose a firm…" />
                    </SelectTrigger>
                    <SelectContent>
                      {firms.map(f => (
                        <SelectItem key={f.id} value={String(f.id)}>
                          <span className="flex items-center gap-2">
                            <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                            <span className="font-medium">{f.name}</span>
                            <span className="text-xs text-slate-400 ml-auto">
                              DR {fmt(f.total_debit || 0)} | CR {fmt(f.total_credit || 0)}
                            </span>
                          </span>
                        </SelectItem>
                      ))}
                      {firms.length === 0 && (
                        <div className="px-3 py-2 text-xs text-slate-400">No firms for this site. Create one in Firm Transactions module first.</div>
                      )}
                    </SelectContent>
                  </Select>
                </FormField>

                {/* Debit + Credit */}
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Debit (₹)">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-red-500">DR</span>
                      <Input type="number" step="0.01" placeholder="0.00" value={form.debit}
                        onChange={(e) => setForm({ ...form, debit: e.target.value })}
                        className="h-9 pl-9 text-sm tabular-nums border-red-200/50 focus-visible:ring-red-300" />
                    </div>
                  </FormField>
                  <FormField label="Credit (₹)">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-emerald-600">CR</span>
                      <Input type="number" step="0.01" placeholder="0.00" value={form.credit}
                        onChange={(e) => setForm({ ...form, credit: e.target.value })}
                        className="h-9 pl-9 text-sm tabular-nums border-emerald-200/50 focus-visible:ring-emerald-300" />
                    </div>
                  </FormField>
                </div>

                {/* Name + Purpose */}
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Name">
                    <Input value={form.firm_name} onChange={(e) => setForm({ ...form, firm_name: e.target.value.toUpperCase() })} placeholder="PERSON NAME…" className="h-9 text-sm" />
                  </FormField>
                  <FormField label="Purpose">
                    <Input value={form.firm_purpose} onChange={(e) => setForm({ ...form, firm_purpose: e.target.value.toUpperCase() })} placeholder="MATERIAL, LABOUR…" className="h-9 text-sm" />
                  </FormField>
                </div>

                {/* Remark + Cheque No */}
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Remark">
                    <Input value={form.firm_remark} onChange={(e) => setForm({ ...form, firm_remark: e.target.value.toUpperCase() })} placeholder="REMARK…" className="h-9 text-sm" />
                  </FormField>
                  <FormField label="Cheque No">
                    <Input value={form.firm_cheque_no} onChange={(e) => setForm({ ...form, firm_cheque_no: e.target.value.toUpperCase() })} placeholder="CHQ 123456…" className="h-9 text-sm" />
                  </FormField>
                </div>

                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-50 border border-indigo-200 text-[11px] font-semibold text-indigo-700">
                  <Building2 className="w-3.5 h-3.5 shrink-0" />
                  This entry will also appear in the Firm Transactions module
                </div>
              </>
            )}

            {/* ── PLOT PAYMENT FIELDS ── */}
            {form.entry_type === 'PLOT PAYMENT' && (
              <>
                {/* Plot Select */}
                <FormField label="Select Plot" required>
                  <Select value={form.pp_plot_id} onValueChange={(v) => {
                    const plot = plots.find(p => String(p.id) === v);
                    setForm({
                      ...form,
                      pp_plot_id: v,
                      to_entity: plot ? `${plot.plot_no} - ${plot.buyer_name}` : form.to_entity,
                      particular: form.particular || `PLOT PAYMENT - ${plot?.plot_no || ''} (${plot?.buyer_name || ''})`,
                    });
                  }}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Choose a plot…" />
                    </SelectTrigger>
                    <SelectContent>
                      {plots.map(p => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          <span className="flex items-center gap-2">
                            <MapPin className="w-3.5 h-3.5 text-pink-600" />
                            <span className="font-medium">{p.plot_no}{p.block ? ` (${p.block})` : ''}</span>
                            <span className="text-xs text-slate-500 ml-1">{p.buyer_name || 'No buyer'}</span>
                            <span className="text-xs text-slate-400 ml-auto">
                              ₹{fmt(p.sale_price || 0)} | Rcvd ₹{fmt(p.total_received || 0)}
                            </span>
                          </span>
                        </SelectItem>
                      ))}
                      {plots.length === 0 && (
                        <div className="px-3 py-2 text-xs text-slate-400">No plots for this site. Create one in Plot Registry first.</div>
                      )}
                    </SelectContent>
                  </Select>
                </FormField>

                {/* Payment From + Amount */}
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Payment From" required>
                    <Select value={form.pp_payment_from} onValueChange={(v) => {
                      const pt = derivePaymentType(v);
                      setForm({ ...form, pp_payment_from: v, pp_payment_type: pt });
                    }}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select…" /></SelectTrigger>
                      <SelectContent>
                        {PAYMENT_FROM_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FormField>
                  <FormField label="Amount (₹)" required>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-emerald-600">CR</span>
                      <Input type="number" step="0.01" placeholder="0.00" value={form.credit}
                        onChange={(e) => setForm({ ...form, credit: e.target.value })}
                        className="h-9 pl-9 text-sm tabular-nums border-emerald-200/50 focus-visible:ring-emerald-300" />
                    </div>
                  </FormField>
                </div>

                {/* Bank Details (conditional) */}
                {(form.pp_payment_type === 'BANK' || form.pp_payment_from === 'CHEQUE') && (
                  <FormField label={form.pp_payment_from === 'CHEQUE' ? 'Cheque No' : 'Bank Details'}>
                    {form.pp_payment_from === 'CHEQUE' ? (
                      <Input value={form.pp_cheque_no} onChange={(e) => setForm({ ...form, pp_cheque_no: e.target.value.toUpperCase() })} placeholder="CHQ 123456…" className="h-9 text-sm" />
                    ) : (
                      <Input value={form.pp_bank_details} onChange={(e) => setForm({ ...form, pp_bank_details: e.target.value.toUpperCase() })} placeholder="BANK NAME, CHQ NO, A/C NO…" className="h-9 text-sm" />
                    )}
                  </FormField>
                )}

                {/* Narration + Received By */}
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Narration">
                    <Input value={form.pp_narration} onChange={(e) => setForm({ ...form, pp_narration: e.target.value.toUpperCase() })} placeholder="NARRATION…" className="h-9 text-sm" />
                  </FormField>
                  <FormField label="Received By">
                    <Input value={form.pp_received_by} onChange={(e) => setForm({ ...form, pp_received_by: e.target.value.toUpperCase() })} placeholder="NAME…" className="h-9 text-sm" />
                  </FormField>
                </div>

                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-pink-50 border border-pink-200 text-[11px] font-semibold text-pink-700">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  This entry will also appear in the Plot Payments module
                </div>
              </>
            )}

            {/* ── STANDARD FIELDS (non-farmer-payment, non-commission, non-cashflow, non-firm-transaction, non-plot-payment) ── */}
            {form.entry_type !== 'FARMER PAYMENT' && form.entry_type !== 'PLOT COMMISSION' && form.entry_type !== 'CASH FLOW' && form.entry_type !== 'FIRM TRANSACTION' && form.entry_type !== 'PLOT PAYMENT' && (
              <>
                {/* Amount Row */}
                {form.entry_type === 'EXPENSE' ? (
                  <FormField label="Debit Amount (₹)">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-red-500">DR</span>
                      <Input type="number" step="0.01" placeholder="0.00" value={form.debit}
                        onChange={(e) => setForm({ ...form, debit: e.target.value })}
                        className="h-9 pl-9 text-sm font-semibold tabular-nums border-red-200 bg-red-50/50 text-red-700 focus-visible:ring-red-300" />
                    </div>
                  </FormField>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <FormField label="Debit (₹)">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-red-500">DR</span>
                        <Input type="number" step="0.01" placeholder="0.00" value={form.debit}
                          onChange={(e) => setForm({ ...form, debit: e.target.value })}
                          className="h-9 pl-9 text-sm tabular-nums border-red-200/50 focus-visible:ring-red-300" />
                      </div>
                    </FormField>
                    <FormField label="Credit (₹)">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-emerald-600">CR</span>
                        <Input type="number" step="0.01" placeholder="0.00" value={form.credit}
                          onChange={(e) => setForm({ ...form, credit: e.target.value })}
                          className="h-9 pl-9 text-sm tabular-nums border-emerald-200/50 focus-visible:ring-emerald-300" />
                      </div>
                    </FormField>
                  </div>
                )}

                {/* EXPENSE notice */}
                {form.entry_type === 'EXPENSE' && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-[11px] font-semibold text-red-700">
                    <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                    This entry will also appear in the Expenses module
                  </div>
                )}
              </>
            )}

            {/* From / To, Payment Mode, Category, Account, Branch — visible for standard types */}
            {form.entry_type !== 'FARMER PAYMENT' && form.entry_type !== 'PLOT COMMISSION' && form.entry_type !== 'CASH FLOW' && form.entry_type !== 'FIRM TRANSACTION' && form.entry_type !== 'PLOT PAYMENT' && (
              <>
                {/* From / To entities */}
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="From Entity">
                    <Input value={form.from_entity} onChange={(e) => setForm({ ...form, from_entity: e.target.value.toUpperCase() })} placeholder="GAYATRI ASSOCIATES, IDIB-001884…" className="h-9 text-sm" list="db-from" />
                    <datalist id="db-from">{autocomplete.fromEntities?.map((f, i) => <option key={i} value={f} />)}</datalist>
                  </FormField>
                  <FormField label="To Entity">
                    <Input value={form.to_entity} onChange={(e) => setForm({ ...form, to_entity: e.target.value.toUpperCase() })} placeholder="B11, A10, A5, B16…" className="h-9 text-sm" list="db-to" />
                    <datalist id="db-to">{autocomplete.toEntities?.map((t, i) => <option key={i} value={t} />)}</datalist>
                  </FormField>
                </div>

                <Separator />

                {/* Payment Mode */}
                <FormField label="Payment Mode">
                  <div className="flex flex-wrap gap-1.5">
                    {PAY_MODES.map(m => (
                      <button key={m} type="button" onClick={() => setForm({ ...form, payment_mode: form.payment_mode === m ? '' : m })}
                        className={`text-[10px] font-semibold px-2.5 py-1 rounded-md border transition-all ${form.payment_mode === m
                          ? 'bg-slate-800 text-white border-slate-800'
                          : `bg-white text-slate-500 border-slate-200 hover:border-slate-300 ${MODE_STYLE[m] || ''}`
                          }`}>
                        {m}
                      </button>
                    ))}
                  </div>
                  <Input
                    placeholder="Or type custom mode…"
                    value={!PAY_MODES.includes(form.payment_mode) ? form.payment_mode : ''}
                    onChange={(e) => setForm({ ...form, payment_mode: e.target.value.toUpperCase() })}
                    className="mt-1.5 h-9 text-sm"
                    list="db-mode-suggestions"
                  />
                  <datalist id="db-mode-suggestions">
                    {autocomplete.paymentModes?.filter(m => !PAY_MODES.includes(m)).map((m, i) => <option key={i} value={m} />)}
                  </datalist>
                </FormField>

                {/* Cheque No (conditional) */}
                {form.payment_mode === 'CHEQUE' && (
                  <FormField label="Cheque No">
                    <Input value={form.cheque_no} onChange={(e) => setForm({ ...form, cheque_no: e.target.value.toUpperCase() })} placeholder="CHQ 123456…" className="h-9 text-sm" />
                  </FormField>
                )}

                {/* Category + Account + Branch */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <FormField label="Category">
                    <Select value={form.category || '_none'} onValueChange={(v) => setForm({ ...form, category: v === '_none' ? '' : v })}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select…" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">— None —</SelectItem>
                        {[...new Set([...CATEGORIES, ...(autocomplete.categories || [])])].sort().map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FormField>

                  <FormField label="Account No">
                    <Input value={form.account_no} onChange={(e) => setForm({ ...form, account_no: e.target.value.toUpperCase() })} placeholder="CNRB-077582, SBI-858615…" className="h-9 text-sm" list="db-acc" />
                    <datalist id="db-acc">{autocomplete.accountNos?.map((a, i) => <option key={i} value={a} />)}</datalist>
                  </FormField>
                  <FormField label="Branch">
                    <Input value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value.toUpperCase() })} placeholder="MAIN, SADAR, CIVIL LINES…" className="h-9 text-sm" list="db-br" />
                    <datalist id="db-br">{autocomplete.branches?.map((b, i) => <option key={i} value={b} />)}</datalist>
                  </FormField>
                </div>
              </>
            )}

              {/* Assign To Admin */}
              {(isAdmin || canManage) && approvers.length > 0 && (
                <FormField label="Assign To Admin">
                  <Select value={form.assigned_admin_id?.toString() || '_none'} onValueChange={(v) => setForm({ ...form, assigned_admin_id: v === '_none' ? null : parseInt(v) })}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select approver..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">— Auto-assign or no preference —</SelectItem>
                      {approvers.map((app) => (
                        <SelectItem key={app.id} value={app.id.toString()}>
                          {app.full_name || app.name || app.email || `Admin #${app.id}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              )}

            {/* Remarks */}
            <FormField label="Remarks / Notes">
              <Textarea value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value.toUpperCase() })} placeholder="ADJUST A19 DG, TRF TO A7, IN BANK…" rows={2} className="text-sm resize-none" />
            </FormField>

            {/* Proof photo for sub-admin edit request - OPTIONAL */}
            {editingId && !canUpdate && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Proof Photo <span className="text-slate-400">(optional)</span></Label>
                <div className="flex items-center gap-3">
                  <label className="cursor-pointer flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 transition-colors">
                    <Camera className="w-4 h-4 text-slate-600" />
                    <span className="text-xs text-slate-700">{proofPhoto ? proofPhoto.name : 'Upload proof photo (optional)'}</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleProofPhotoChange} />
                  </label>
                  {proofPreview && (
                    <img src={proofPreview} alt="Proof" className="w-12 h-12 rounded-lg object-cover border" />
                  )}
                </div>
              </div>
            )}

            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting} className="h-9 text-sm">Cancel</Button>
              <Button type="submit" disabled={submitting} className={`h-9 text-sm gap-2 min-w-24 shadow-sm ${editingId && !isAdmin ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                {submitting
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {editingId && !isAdmin ? 'Submitting Request…' : editingId ? 'Saving…' : 'Creating…'}</>
                  : <>{editingId && !isAdmin ? <><Send className="w-3.5 h-3.5" /> Submit Edit Request</> : editingId ? <><Check className="w-3.5 h-3.5" /> Update</> : <><Plus className="w-3.5 h-3.5" /> Create</>}</>
                }
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DayBook;

/* ═══════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════ */

function SummaryCard({ label, value, sub, color, icon, onClick }) {
  const colors = {
    red: { gradient: 'from-red-50 via-rose-50 to-orange-50', border: 'border-red-100', iconBg: 'bg-red-100', iconText: 'text-red-600', valueText: 'text-red-700', wave: 'text-red-100' },
    emerald: { gradient: 'from-emerald-50 via-green-50 to-teal-50', border: 'border-emerald-100', iconBg: 'bg-emerald-100', iconText: 'text-emerald-600', valueText: 'text-emerald-700', wave: 'text-emerald-100' },
    violet: { gradient: 'from-violet-50 via-purple-50 to-indigo-50', border: 'border-violet-100', iconBg: 'bg-violet-100', iconText: 'text-violet-600', valueText: 'text-violet-700', wave: 'text-violet-100' },
    amber: { gradient: 'from-amber-50 via-yellow-50 to-orange-50', border: 'border-amber-100', iconBg: 'bg-amber-100', iconText: 'text-amber-600', valueText: 'text-amber-700', wave: 'text-amber-100' },
  };
  const c = colors[color] || colors.emerald;
  const clickable = typeof onClick === 'function';
  const Root = clickable ? 'button' : 'div';
  return (
    <Root
      type={clickable ? 'button' : undefined}
      onClick={onClick}
      className={`relative overflow-hidden rounded-2xl border ${c.border} bg-gradient-to-br ${c.gradient} p-4 transition-shadow text-left w-full hover:shadow-md ${clickable ? 'cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-slate-300 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-slate-400' : ''}`}
    >
      {/* Decorative curved wave */}
      <svg className={`absolute -bottom-3 -right-3 w-28 h-28 ${c.wave} opacity-60`} viewBox="0 0 100 100" fill="currentColor">
        <path d="M100 100C100 44.8 55.2 0 0 0v20c33.1 0 60 26.9 60 60h20z" />
        <path d="M100 100C100 66.9 73.1 40 40 40v20c22.1 0 40 17.9 40 40h20z" opacity="0.5" />
      </svg>
      <div className="relative flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
          <p className={`text-xl font-extrabold ${c.valueText} mt-1.5 tabular-nums leading-none truncate`}>{value}</p>
          {sub && <p className="text-[11px] text-slate-400 mt-1.5">{sub}</p>}
          {clickable && <p className="text-[10px] font-semibold text-slate-500 mt-1.5 inline-flex items-center gap-1">Tap for breakdown <ChevronRight className="w-3 h-3" /></p>}
        </div>
        <div className={`w-9 h-9 rounded-xl ${c.iconBg} flex items-center justify-center shrink-0 ${c.iconText}`}>
          {icon}
        </div>
      </div>
    </Root>
  );
}

// Render a signed rupee amount the same way everywhere: leading unicode minus
// on negatives, no sign on positives, fmt() for the magnitude.
function signedRupee(n) {
  const v = Number.isFinite(n) ? n : 0;
  return (v < 0 ? '−' : '') + fmt(Math.abs(v));
}

/*
 * Opening + Remaining cards for all three Day Book routes.
 *
 *   /daybook        → sum across every mode (cash + bank + cheque + upi + other)
 *                     plus a per-mode breakdown chip row so Main always equals
 *                     the sum of the individual mode totals.
 *   /daybook/cash   → Cash-only opening + remaining.
 *   /daybook/bank   → Bank-only opening + remaining.
 *
 * The "Remaining" figure is recomputed on the client from the server-provided
 * opening plus the day's credits/debits in `entries` (bucketed with the same
 * classifier the backend uses). That means as soon as a debit is added,
 * edited, or deleted, the Remaining figure drops immediately instead of
 * waiting for the next round-trip — which was the "debit not reducing cash"
 * complaint.
 */
function BalanceCards({ isToday, selectedDate, mode = 'all', modeBalance, entries = [] }) {
  // Breakdown modal state — populated when the user clicks a Cash/Bank In or
  // Out card. `detail` holds { direction, label, total, rows } or null.
  const [breakdown, setBreakdown] = useState(null);

  // Live per-bucket day totals — drives the client-side Remaining recompute.
  // SPLIT farmer_payments are routed to cash AND bank buckets by their
  // cash_amount / bank_amount so the client mirrors the backend SQL split
  // (see getModeBalance UNION 3b/3c).
  // Negative credits (refund/reversal rows) are reclassified as outflows and
  // negative debits as inflows, matching the backend accumulator, so the
  // In/Out cards show real gross-flow magnitudes. Net stays the same.
  const liveBuckets = useMemo(() => {
    const m = { cash: { c: 0, d: 0 }, bank: { c: 0, d: 0 }, cheque: { c: 0, d: 0 }, upi: { c: 0, d: 0 }, other: { c: 0, d: 0 } };
    for (const e of entries) {
      const cs = e.cheque_status ? String(e.cheque_status).toUpperCase() : null;
      if (cs === 'BOUNCED' || cs === 'RETURNED') continue;
      const pmRaw = String(e.payment_mode || '').trim().toUpperCase();
      const cashAmt = parseFloat(e.cash_amount) || 0;
      const bankAmt = parseFloat(e.bank_amount) || 0;
      if (pmRaw === 'SPLIT' && (cashAmt > 0 || bankAmt > 0)) {
        m.cash.d += cashAmt;
        m.bank.d += bankAmt;
        continue;
      }
      const b = classifyPaymentMode(e.payment_mode);
      const cr = parseFloat(e.credit) || 0;
      const dr = parseFloat(e.debit)  || 0;
      if (cr >= 0) m[b].c += cr; else m[b].d += -cr;
      if (dr >= 0) m[b].d += dr; else m[b].c += -dr;
    }
    return m;
  }, [entries]);

  if (!modeBalance) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-4 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-slate-200/70 flex items-center justify-center shrink-0 text-slate-500">
          <IndianRupee className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Opening / Remaining</p>
          <p className="text-[11px] text-slate-500 mt-1">Loading…</p>
        </div>
      </div>
    );
  }

  // Single-mode slice:
  //   /daybook/cash → just the 'cash' bucket.
  //   /daybook/bank → everything except cash (bank + cheque + upi + other),
  //                   because from the firm's side any non-cash mode settles
  //                   through a bank account.
  if (mode === 'cash' || mode === 'bank') {
    const bucketKeys = mode === 'cash' ? ['cash'] : ['bank', 'cheque', 'upi', 'other'];
    const opening = bucketKeys.reduce((s, b) => s + (parseFloat(modeBalance?.[b]?.opening_balance) || 0), 0);
    const liveC   = bucketKeys.reduce((s, b) => s + liveBuckets[b].c, 0);
    const liveD   = bucketKeys.reduce((s, b) => s + liveBuckets[b].d, 0);
    const remaining = opening + liveC - liveD;
    const label = mode === 'cash' ? 'Cash' : 'Bank';
    const openingSub = mode === 'cash'
      ? `Start of ${fmtDate(selectedDate)}`
      : `Start of ${fmtDate(selectedDate)} · Bank + Cheque + UPI + Other`;

    // Build per-source merged gross in/out across ALL bucketKeys, then decide
    // per source whether to net.
    //
    // - Sources with "reversal semantics" (plot_payments, farmer_payments,
    //   expenses, plot_commission_payments, vendor_payments, etc.) have a
    //   single `amount` column — negatives represent refunds of the same
    //   transaction. Netting matches dedicated module pages (e.g. Farmers
    //   page shows `SUM(amount)` = net paid).
    // - Sources with "two-legged semantics" (personal_ledger, imprest) have
    //   separate debit/credit rows; given vs returned are different real
    //   transactions. The Personal Ledgers page shows CASH GIVEN and
    //   CASH RECV as separate columns — so Day Book must show both legs,
    //   not their net.
    // - Today's live flow is unlabelled at the client, so split by direction.
    const NO_NET = new Set(['personal_ledger', 'imprest', '__live__']);
    const netRows = (() => {
      const merged = new Map(); // src → { in, out, label }
      for (const b of bucketKeys) {
        const bySrcMap = modeBalance?.[b]?.by_src || {};
        for (const src of Object.keys(bySrcMap)) {
          const row = bySrcMap[src];
          const cur = merged.get(src) || { in: 0, out: 0, label: row?.label || src };
          cur.in  += parseFloat(row?.in)  || 0;
          cur.out += parseFloat(row?.out) || 0;
          merged.set(src, cur);
        }
      }
      if (liveC > 0.001 || liveD > 0.001) {
        merged.set('__live__', { in: liveC, out: liveD, label: `Today's live entries · ${fmtDate(selectedDate)}` });
      }
      const inRows = [];
      const outRows = [];
      for (const [src, { in: gi, out: go, label }] of merged.entries()) {
        if (NO_NET.has(src)) {
          // Show both legs gross. Matches Personal Ledgers / Imprest pages.
          if (gi > 0.001) inRows.push({ label, amount: gi });
          if (go > 0.001) outRows.push({ label, amount: go });
        } else {
          const net = gi - go;
          if (net > 0.001) inRows.push({ label, amount: net });
          else if (net < -0.001) outRows.push({ label, amount: -net });
        }
      }
      inRows.sort((a, b) => b.amount - a.amount);
      outRows.sort((a, b) => b.amount - a.amount);
      return { inRows, outRows };
    })();

    const totalIn  = netRows.inRows.reduce((s, r) => s + r.amount, 0);
    const totalOut = netRows.outRows.reduce((s, r) => s + r.amount, 0);
    const flowSub = `Total through ${fmtDate(selectedDate)}${isToday ? ' · Live' : ''}`;

    const openBreakdown = (direction) => {
      setBreakdown({
        direction,
        label: `${label} ${direction === 'in' ? 'In' : 'Out'}`,
        total: direction === 'in' ? totalIn : totalOut,
        rows: direction === 'in' ? netRows.inRows : netRows.outRows,
      });
    };

    return (
      <div className="space-y-3">
        <TwoCardLayout
          openingLabel={`${label} Opening Balance`}
          openingValue={opening}
          openingSub={openingSub}
          runningLabel={isToday ? `Current ${label} Balance` : `${label} Closing Balance`}
          runningValue={remaining}
          runningSub={isToday ? 'Live — updates as entries change' : fmtDateLong(selectedDate)}
          isToday={isToday}
          dayCredit={liveC}
          dayDebit={liveD}
        />

        {/* In / Out cumulative through the selected date. These two values
            satisfy: (Opening + In − Out) = Remaining, i.e. the balance the
            user sees up top is fully explained by the gross flows here. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <SummaryCard
            label={`${label} In`}
            value={fmt(totalIn)}
            sub={flowSub}
            color="emerald"
            icon={<ArrowDownRight className="w-4 h-4" />}
            onClick={() => openBreakdown('in')}
          />
          <SummaryCard
            label={`${label} Out`}
            value={fmt(totalOut)}
            sub={flowSub}
            color="red"
            icon={<ArrowUpRight className="w-4 h-4" />}
            onClick={() => openBreakdown('out')}
          />
        </div>

        <FlowBreakdownDialog
          detail={breakdown}
          onClose={() => setBreakdown(null)}
          selectedDate={selectedDate}
          mode={mode}
        />

        {/* For /daybook/bank, expose the per-sub-mode breakdown so the user
            can see how Bank, Cheque, UPI and Other each contribute. */}
        {mode === 'bank' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {bucketKeys.map((b) => {
              const op = parseFloat(modeBalance?.[b]?.opening_balance) || 0;
              const rem = op + liveBuckets[b].c - liveBuckets[b].d;
              const positive = rem >= 0;
              return (
                <div key={b} className={`rounded-xl border ${positive ? 'border-slate-200 bg-white' : 'border-red-100 bg-red-50/40'} p-2.5`}>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{BUCKET_LABELS[b]}</p>
                  <p className={`text-sm font-extrabold tabular-nums leading-tight mt-0.5 ${positive ? 'text-slate-800' : 'text-red-700'}`}>
                    {signedRupee(rem)}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5 tabular-nums">
                    Op {signedRupee(op)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Main Day Book — opening = site balance at the START of the selected date
  // (historical view). Remaining = opening + that day's live credit/debit
  // flows. Applies uniformly to today and past dates so the Main card
  // reconciles with Cash + Bank; previously the today branch used an all-time
  // "current_balance" that silently folded in FUTURE-dated entries, which made
  // Main disagree with Cash/Bank whenever someone post-dated an expense.
  const siteOpeningRaw = modeBalance?.site?.opening_balance;
  const fallbackOpening = BUCKETS.reduce((s, b) => s + (parseFloat(modeBalance?.[b]?.opening_balance) || 0), 0);
  const liveCreditTotal = BUCKETS.reduce((s, b) => s + liveBuckets[b].c, 0);
  const liveDebitTotal  = BUCKETS.reduce((s, b) => s + liveBuckets[b].d, 0);

  const openingTotal   = siteOpeningRaw != null ? (parseFloat(siteOpeningRaw) || 0) : fallbackOpening;
  const remainingTotal = openingTotal + liveCreditTotal - liveDebitTotal;

  return (
    <div className="space-y-3">
      <TwoCardLayout
        openingLabel="Opening Balance"
        openingValue={openingTotal}
        openingSub={`Start of ${fmtDate(selectedDate)} · Site Balance (Incoming − Expenses − Imprest)`}
        runningLabel={isToday ? 'Remaining Balance' : 'Closing Balance'}
        runningValue={remainingTotal}
        runningSub={isToday ? 'Live — updates as entries change' : fmtDateLong(selectedDate)}
        isToday={isToday}
        dayCredit={liveCreditTotal}
        dayDebit={liveDebitTotal}
      />

      {/* Per-mode breakdown — makes it obvious why the total is what it is
          and that Main = Σ(mode totals). */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {BUCKETS.map((b) => {
          const op = parseFloat(modeBalance?.[b]?.opening_balance) || 0;
          const rem = op + liveBuckets[b].c - liveBuckets[b].d;
          const positive = rem >= 0;
          return (
            <div key={b} className={`rounded-xl border ${positive ? 'border-slate-200 bg-white' : 'border-red-100 bg-red-50/40'} p-2.5`}>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{BUCKET_LABELS[b]}</p>
              <p className={`text-sm font-extrabold tabular-nums leading-tight mt-0.5 ${positive ? 'text-slate-800' : 'text-red-700'}`}>
                {signedRupee(rem)}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5 tabular-nums">
                Op {signedRupee(op)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Shared two-card layout — Opening on the left, Remaining/Closing on the right.
function TwoCardLayout({ openingLabel, openingValue, openingSub, runningLabel, runningValue, runningSub, isToday, dayCredit = 0, dayDebit = 0 }) {
  const runningPositive = (runningValue ?? 0) >= 0;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="relative overflow-hidden rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50 p-4">
        <svg className="absolute -bottom-3 -right-3 w-28 h-28 text-sky-100 opacity-60" viewBox="0 0 100 100" fill="currentColor">
          <path d="M100 100C100 44.8 55.2 0 0 0v20c33.1 0 60 26.9 60 60h20z" />
          <path d="M100 100C100 66.9 73.1 40 40 40v20c22.1 0 40 17.9 40 40h20z" opacity="0.5" />
        </svg>
        <div className="relative flex items-start justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{openingLabel}</p>
            <p className="text-2xl font-extrabold text-sky-800 mt-1.5 tabular-nums leading-none truncate">
              {signedRupee(openingValue)}
            </p>
            <p className="text-[11px] text-slate-500 mt-1.5">{openingSub}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-sky-100 flex items-center justify-center shrink-0 text-sky-600">
            <Activity className="w-5 h-5" />
          </div>
        </div>
      </div>

      <div className={`relative overflow-hidden rounded-2xl border ${runningPositive ? 'border-emerald-100' : 'border-red-100'} bg-gradient-to-br ${runningPositive ? 'from-emerald-50 via-green-50 to-teal-50' : 'from-red-50 via-rose-50 to-orange-50'} p-4`}>
        <svg className={`absolute -bottom-3 -right-3 w-28 h-28 ${runningPositive ? 'text-emerald-100' : 'text-red-100'} opacity-60`} viewBox="0 0 100 100" fill="currentColor">
          <path d="M100 100C100 44.8 55.2 0 0 0v20c33.1 0 60 26.9 60 60h20z" />
          <path d="M100 100C100 66.9 73.1 40 40 40v20c22.1 0 40 17.9 40 40h20z" opacity="0.5" />
        </svg>
        <div className="relative flex items-start justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{runningLabel}</p>
              {isToday && <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-600 text-white"><span className="w-1 h-1 rounded-full bg-white animate-pulse" />LIVE</span>}
            </div>
            <p className={`text-2xl font-extrabold mt-1.5 tabular-nums leading-none truncate ${runningPositive ? 'text-emerald-700' : 'text-red-700'}`}>
              {signedRupee(runningValue)}
            </p>
            <p className="text-[11px] text-slate-500 mt-1.5">
              {runningSub}
              {(dayCredit || dayDebit) ? (
                <span className="ml-1 text-slate-400">
                  · +{fmt(dayCredit)} / −{fmt(dayDebit)} today
                </span>
              ) : null}
            </p>
          </div>
          <div className={`w-10 h-10 rounded-xl ${runningPositive ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'} flex items-center justify-center shrink-0`}>
            <IndianRupee className="w-5 h-5" />
          </div>
        </div>
      </div>
    </div>
  );
}

function FormField({ label, required, children }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-slate-600">
        {label} {required && <span className="text-red-500">*</span>}
      </Label>
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   CASH/BANK IN-OUT DETAIL MODAL
   Opened when the user taps a "Cash In / Out" or "Bank In / Out"
   summary card. Explains which source modules contribute to the
   number and — for Bank — how the non-cash sub-buckets break down.
   ═══════════════════════════════════════════════════════════ */
function FlowBreakdownDialog({ detail, onClose, selectedDate, mode }) {
  const open = !!detail;
  const direction = detail?.direction || 'in';
  const rows = detail?.rows || [];
  const total = detail?.total || 0;
  const sumOfRows = rows.reduce((s, r) => s + r.amount, 0);
  const unexplained = total - sumOfRows;

  const blurb = direction === 'in'
    ? (mode === 'bank'
        ? 'Total non-cash money received by this site through the selected date. Includes bank transfers, cheques, UPI, and any "other"-mode inflows.'
        : 'Total cash received by this site through the selected date. Includes plot-sale cash, cash loans from persons, imprest money returned to the cash box, and any refunds booked against cash outflows.')
    : (mode === 'bank'
        ? 'Total non-cash money paid out by this site through the selected date. Includes bank transfers, cheques, UPI, and any "other"-mode outflows.'
        : 'Total cash paid out by this site through the selected date. Includes farmer/vendor/commission cash payments, direct expenses, cash loans given to persons, and imprest allocations to sub-admins.');

  const colorText = direction === 'in' ? 'text-emerald-700' : 'text-red-700';
  const colorBg   = direction === 'in' ? 'bg-emerald-50' : 'bg-red-50';
  const colorBorder = direction === 'in' ? 'border-emerald-100' : 'border-red-100';

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {direction === 'in'
              ? <ArrowDownRight className="w-5 h-5 text-emerald-600" />
              : <ArrowUpRight   className="w-5 h-5 text-red-600" />}
            {detail?.label} · through {fmtDate(selectedDate)}
          </DialogTitle>
        </DialogHeader>

        <div className={`rounded-xl border ${colorBorder} ${colorBg} p-3`}>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total</p>
          <p className={`text-2xl font-extrabold tabular-nums mt-0.5 ${colorText}`}>{fmt(total)}</p>
          <p className="text-[11px] text-slate-500 mt-1 leading-snug">{blurb}</p>
        </div>

        <div className="mt-2">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Where it comes from</p>
          {rows.length === 0 ? (
            <p className="text-xs text-slate-500 italic">No {direction === 'in' ? 'inflows' : 'outflows'} yet for the selected cutoff.</p>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-100 rounded-lg overflow-hidden">
              {rows.map((r, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 hover:bg-slate-50">
                  <span className="text-xs text-slate-700 font-medium truncate pr-3">{r.label}</span>
                  <span className={`text-xs font-bold tabular-nums ${colorText}`}>{fmt(r.amount)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-t-2 border-slate-200">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">Sum</span>
                <span className={`text-xs font-extrabold tabular-nums ${colorText}`}>{fmt(sumOfRows)}</span>
              </div>
            </div>
          )}
        </div>

        <p className="text-[11px] text-slate-500 italic leading-snug">
          <b>Farmer / Plot / Commission / Vendor / Expense</b> rows are <i>net</i> of refund reversals (matching Farmers page, Plot Payments page, etc.). <b>Personal Ledger</b> and <b>Imprest</b> show their gross flow on each side — "given" and "returned" are independent transactions, so the Personal Ledgers page splits them into CASH GIVEN / CASH RECV columns and Day Book mirrors that.
        </p>
        {Math.abs(unexplained) > 0.5 && (
          <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-2.5 py-1.5 leading-snug">
            Note: breakdown rows sum to <b>{fmt(sumOfRows)}</b> vs card <b>{fmt(total)}</b> — diff <b>{fmt(Math.abs(unexplained))}</b>. This usually comes from the Personal Ledger accounting double-entry (loans-given leg counted once as outstanding, once as expense) — it keeps Cash + Bank = Site Balance reconciled but does not represent extra cash movement.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function FilterSelect({ label, value, onChange, allLabel, options, displayMap }) {
  return (
    <div>
      <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{allLabel}</SelectItem>
          {options.map(o => <SelectItem key={o} value={o}>{displayMap?.[o] || o}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function BreakdownRow({ label, count, dr, cr, badge, typeBadge }) {
  const ts = TYPE_STYLE[label] || TYPE_STYLE.GENERAL;
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
      {typeBadge ? (
        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${ts.bg} ${ts.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${ts.dot}`} />
          {label}
        </span>
      ) : badge ? (
        <Badge variant="outline" className={`text-[10px] font-semibold px-2 ${MODE_STYLE[label] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>{label}</Badge>
      ) : (
        <span className="text-xs font-semibold text-slate-700 min-w-0 truncate">{label}</span>
      )}
      <span className="text-[11px] text-slate-400 flex-1">{count} entr{count === 1 ? 'y' : 'ies'}</span>
      <span className="text-[11px] font-bold text-red-600 tabular-nums">DR {fmt(dr)}</span>
      <span className="text-[11px] font-bold text-emerald-600 tabular-nums">CR {fmt(cr)}</span>
    </div>
  );
}
