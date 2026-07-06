import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useQuery } from '@apollo/client/react';
import { GET_KPI_CARDS } from '../graphql/queries';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import eventBus from '../utils/eventBus';
import { io } from 'socket.io-client';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Checkbox } from '../components/ui/checkbox';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '../components/ui/dialog';
import { ActivityCard } from '../components/ui/activity-card';
import { Skeleton } from '../components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../components/ui/table';
import {
  Users, Tractor, Landmark, Wallet, Banknote, LayoutGrid,
  ClipboardList, CreditCard, MapPin, UserCog, Settings,
  ChevronRight, ChevronLeft,
  Loader2, Clock, CheckCircle2, XCircle, ExternalLink,
  Send, Search, Phone, TrendingUp, TrendingDown, AlertTriangle,
  MessageSquare, Paperclip, ArrowLeft, X, ShieldCheck, RefreshCw,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import TimeFilter, { useTimeRange } from '../components/dashboard/TimeFilter';
import KpiCard from '../components/dashboard/KpiCard';
import VerifyPanel from '../components/dashboard/VerifyPanel';
import { RevenueVsExpenseChart, ProfitTrendChart, ExpenseByCategoryRadar } from '../components/dashboard/AnalyticsCharts';

/* Reusable decorative SVG curves for cards */
const CardCurves = ({ color = 'rgba(99,102,241,0.07)', color2 = null }) => (
  <svg className="absolute bottom-0 left-0 right-0 w-full h-16 pointer-events-none" viewBox="0 0 400 64" preserveAspectRatio="none">
    <path d="M0,48 C100,16 200,60 300,28 C350,14 380,36 400,30 L400,64 L0,64 Z" fill={color} />
    <path d="M0,52 C120,32 220,58 320,38 C370,26 390,48 400,42 L400,64 L0,64 Z" fill={color2 || color.replace(/[\d.]+\)$/, (m) => `${Math.max(parseFloat(m) - 0.03, 0.02)})`)} />
  </svg>
);

/* Premium live-stat chip used in the dashboard hero */
const HERO_CHIP_TONES = {
  amber:   'bg-amber-50 text-amber-700 ring-amber-100',
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  indigo:  'bg-indigo-50 text-indigo-700 ring-indigo-100',
  rose:    'bg-rose-50 text-rose-700 ring-rose-100',
};
const HeroChip = ({ icon: Icon, tone = 'indigo', label, value }) => (
  <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ${HERO_CHIP_TONES[tone] || HERO_CHIP_TONES.indigo}`}>
    {Icon && <Icon className="h-3.5 w-3.5" />}
    <span className="text-slate-500">{label}</span>
    <span className="font-semibold tabular-nums">{value}</span>
  </div>
);

const MODULE_CARDS = [
  { to: '/clients', label: 'User Management', icon: Users, desc: 'Clients, farmers & members', color: 'from-blue-500 to-blue-600', module: 'clients' },
  { to: '/farmers', label: 'Farmer Payments', icon: Tractor, desc: 'Track farmer payment records', color: 'from-emerald-500 to-emerald-600', module: 'farmers' },
  { to: '/commissions', label: 'Plot Commission', icon: Landmark, desc: 'Commission calculations', color: 'from-purple-500 to-purple-600', module: 'commissions' },
  { to: '/cashflow', label: 'Cash Flow / Ledgers', icon: Wallet, desc: 'Income & expense tracking', color: 'from-amber-500 to-amber-600', module: 'cashflow' },
  { to: '/firm-transactions', label: 'Firm Transactions', icon: Banknote, desc: 'Firm-level transactions', color: 'from-cyan-500 to-cyan-600', module: 'firm_transactions' },
  { to: '/plot-payments', label: 'Plot Payments', icon: LayoutGrid, desc: 'Plot payment schedules', color: 'from-rose-500 to-rose-600', module: 'plot_payments' },
  { to: '/plot-registry', label: 'Plot Registry', icon: ClipboardList, desc: 'Registry records & docs', color: 'from-indigo-500 to-indigo-600', module: 'plot_registry' },
  { to: '/expenses', label: 'Expenses', icon: CreditCard, desc: 'Expense vouchers & tracking', color: 'from-orange-500 to-orange-600', module: 'expenses' },
];

const ADMIN_CARDS = [
  { to: '/sites', label: 'Sites', icon: MapPin, desc: 'Manage project sites', color: 'from-slate-600 to-slate-700' },
  { to: '/sub-admins', label: 'Sub-Admins', icon: UserCog, desc: 'User access & roles', color: 'from-slate-600 to-slate-700' },
  { to: '/settings', label: 'Settings', icon: Settings, desc: 'Account & preferences', color: 'from-slate-600 to-slate-700' },
];

const APPROVAL_MODULE = {
  farmer_payment: { label: 'Farmer Payment', cls: 'bg-green-50 text-green-700 border-green-200' },
  plot_commission: { label: 'Plot Commission', cls: 'bg-purple-50 text-purple-700 border-purple-200' },
  cash_flow_entry: { label: 'Cash Flow', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  firm_transaction: { label: 'Firm Transaction', cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  plot_payment: { label: 'Plot Payment', cls: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  expense: { label: 'Expense', cls: 'bg-red-50 text-red-700 border-red-200' },
  daybook_farmer: { label: 'Farmer Payment', cls: 'bg-green-50 text-green-700 border-green-200' },
  daybook_commission: { label: 'Plot Commission', cls: 'bg-purple-50 text-purple-700 border-purple-200' },
  daybook_expense: { label: 'Expense', cls: 'bg-red-50 text-red-700 border-red-200' },
};

const EDIT_MODULE_LABELS = {
  farmer: 'Farmer', farmer_payment: 'Farmer Payment', plot: 'Plot',
  plot_payment: 'Plot Payment', daybook: 'Day Book',
  daybook_expense: 'Expense', daybook_farmer_payment: 'Farmer Payment',
  daybook_commission: 'Commission', daybook_cashflow: 'Cash Flow',
  daybook_firm_transaction: 'Firm Transaction', daybook_plot_payment: 'Plot Payment',
};

const MODE_COLORS = {
  'CASH': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'UPI': 'bg-green-50 text-green-700 border-green-200',
  'CHEQUE': 'bg-teal-50 text-teal-700 border-teal-200',
  'BANK': 'bg-blue-50 text-blue-700 border-blue-200',
  'TRANSFER': 'bg-purple-50 text-purple-700 border-purple-200',
  'NEFT': 'bg-cyan-50 text-cyan-700 border-cyan-200',
  'RTGS': 'bg-sky-50 text-sky-700 border-sky-200',
  'IMPS': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'ADJUST': 'bg-orange-50 text-orange-700 border-orange-200',
};

const SOURCE_MODULE_MAP = {
  farmer_payments: { label: 'Farmer Payment', cls: 'bg-green-50 text-green-700 border-green-200' },
  plot_commissions: { label: 'Commission', cls: 'bg-purple-50 text-purple-700 border-purple-200' },
  plot_commission_payments: { label: 'Comm. Payment', cls: 'bg-violet-50 text-violet-700 border-violet-200' },
  day_book: { label: 'Day Book', cls: 'bg-slate-50 text-slate-700 border-slate-200' },
  firm_transactions: { label: 'Firm Txn', cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  plot_payments: { label: 'Plot Payment', cls: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  expenses: { label: 'Expense', cls: 'bg-red-50 text-red-700 border-red-200' },
  vendor_payments: { label: 'Vendor', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  plot_installment_payments: { label: 'Installment', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  plot_registry_payments: { label: 'Registry Txn', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  personal_ledger_debit: { label: 'Personal Ledger', cls: 'bg-pink-50 text-pink-700 border-pink-200' },
};

const MEMBER_MODULE_CONFIG = {
  clients: {
    label: 'Profile',
    module: 'clients',
    icon: Users,
    cls: 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100',
    to: (member) => `/clients/${member.id}`,
  },
  expenses: {
    label: 'Expenses',
    module: 'expenses',
    icon: CreditCard,
    cls: 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100',
    to: (member) => `/expenses?q=${encodeURIComponent(member.full_name || '')}`,
  },
  commissions: {
    label: 'Commissions',
    module: 'commissions',
    icon: Landmark,
    cls: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100',
    to: (member) => `/commissions?q=${encodeURIComponent(member.full_name || '')}`,
  },
  plot_payments: {
    label: 'Plot Payments',
    module: 'plot_payments',
    icon: LayoutGrid,
    cls: 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100',
    to: (member) => `/plot-payments?q=${encodeURIComponent(member.full_name || '')}`,
  },
  farmer_payments: {
    label: 'Farmer Payments',
    module: 'farmers',
    icon: Tractor,
    cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
    to: (member) => `/farmers?q=${encodeURIComponent(member.full_name || '')}`,
  },
  firm_transactions: {
    label: 'Firm Transactions',
    module: 'firm_transactions',
    icon: Banknote,
    cls: 'bg-cyan-50 text-cyan-700 border-cyan-200 hover:bg-cyan-100',
    to: (member) => `/firm-transactions?q=${encodeURIComponent(member.full_name || '')}`,
  },
  personal_ledger: {
    label: 'Personal Ledger',
    module: 'cashflow',
    icon: Wallet,
    cls: 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200',
    to: (entity) => `/cashflow?q=${encodeURIComponent(entity.full_name || entity.ledger_name || '')}`,
  },
};

const STATUS_BADGE = {
  pending: { label: 'Pending', icon: Clock, cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  approved: { label: 'Approved', icon: CheckCircle2, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  rejected: { label: 'Rejected', icon: XCircle, cls: 'bg-red-50 text-red-700 border-red-200' },
  BOUNCED: { label: 'Bounced', icon: AlertTriangle, cls: 'bg-red-50 text-red-700 border-red-200' },
  RETURNED: { label: 'Returned', icon: AlertTriangle, cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  CLEARED: { label: 'Cleared', icon: CheckCircle2, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  PENDING: { label: 'Pending', icon: Clock, cls: 'bg-amber-50 text-amber-700 border-amber-200' },
};

const fmt = (v) => {
  const n = parseFloat(v) || 0;
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
};

const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const getSearchEntityKey = (entity) => (
  entity?._kind === 'ledger' ? `ledger-${entity.ledger_id}` : `member-${entity.id}`
);

export const Dashboard = () => {
  const { user, token, currentSite, sites, isAdmin, hasPermission } = useAuth();
  const navigate = useNavigate();

  // Recent Transactions
  const [txnLoading, setTxnLoading] = useState(false);
  const [txnData, setTxnData] = useState([]);
  const [txnPage, setTxnPage] = useState(1);
  const [txnPagination, setTxnPagination] = useState({ totalItems: 0, totalPages: 1, currentPage: 1 });
  const TXN_PER_PAGE = 10;

  const canReadExpenses = hasPermission('expenses', 'read');
  const canReadCashflow = hasPermission('cashflow', 'read');
  const canReadClients = hasPermission('clients', 'read');
  const canReadChat = hasPermission('chat', 'read');

  // ── Dashboard component visibility permissions ──
  // Admins always see everything. Sub-admins are checked against the DB.
  const [dashPerms, setDashPerms] = useState(null); // null = loading, {} = loaded
  useEffect(() => {
    if (isAdmin) { setDashPerms(null); return; } // admins bypass
    api.get('/dashboard-permissions/me')
      .then(res => setDashPerms(res.data.permissions || {}))
      .catch(() => setDashPerms({})); // on error default to all visible
  }, [isAdmin, user?.id]);

  // Helper: returns true if admin OR component is allowed (defaults to true when not in map)
  const canSee = useCallback((key) => {
    if (isAdmin) return true;
    if (!dashPerms) return false; // still loading
    return dashPerms[key] !== false;
  }, [isAdmin, dashPerms]);

  // ── GraphQL-powered KPI analytics ──
  const [timePreset, setTimePreset] = useState('overall');
  const [excludeOldPlots, setExcludeOldPlots] = useState(false);
  const [showLedgerReturned, setShowLedgerReturned] = useState(false);
  // Registry Payments card defaults to NEW-only (mirrors the /plot-payments
  // footer's default). User can tick "+Include OLD" on the card to add the
  // OLD plot receipts back in.
  const [registryIncludeOld, setRegistryIncludeOld] = useState(false);
  const range = useTimeRange(timePreset);

  // Auto-select best resolution for the chart based on the time window
  const chartResolution = useMemo(() => {
    if (timePreset === 'today' || timePreset === 'this_week') return 'DAY';
    if (timePreset === 'this_month') return 'DAY';
    if (timePreset === 'this_year') return 'MONTH';
    return 'YEAR'; // overall
  }, [timePreset]);

  const { data: kpiData, loading: kpiLoading, refetch: refetchKpi } = useQuery(GET_KPI_CARDS, {
    variables: { siteId: String(currentSite?.id), range, excludeOldPlots },
    skip: !currentSite?.id || (!isAdmin && !dashPerms),
    // cache-and-network: render instantly from Apollo's in-memory cache
    // (last successful response for this site + range) and refresh in
    // background. The backend resolver also has Redis caching now, so
    // the network leg is fast even on cache-miss.
    fetchPolicy: 'cache-and-network',
    nextFetchPolicy: 'cache-first',
  });

  const kpi = kpiData?.kpiCards;

  // ── KPI detail modal ──
  const [kpiModal, setKpiModal] = useState(null); // 'totalIncoming' | 'totalExpense' | 'profit' | 'personalLedger' | null
  const [chatOpen, setChatOpen] = useState(false);
  const [chatUsers, setChatUsers] = useState([]);
  const [chatConversations, setChatConversations] = useState([]);
  const [chatActive, setChatActive] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatSearch, setChatSearch] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatAttachment, setChatAttachment] = useState(null);
  const [chatUploading, setChatUploading] = useState(false);
  const chatEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const chatFileRef = useRef(null);
  const chatSocketRef = useRef(null);
  const chatActiveRef = useRef(null);
  const chatLastConvRef = useRef(null);

  useEffect(() => { chatActiveRef.current = chatActive; }, [chatActive]);

  // Socket.io for chat
  useEffect(() => {
    if (!token || !canReadChat) return;
    const s = io(import.meta.env.VITE_API_URL || 'http://localhost:80000', { auth: { token } });
    chatSocketRef.current = s;
    s.on('new_message', (msg) => {
      const cur = chatActiveRef.current;
      setChatMessages(prev => {
        if (cur && msg.conversation_id === cur.id) {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        }
        return prev;
      });
      setChatConversations(prev =>
        prev.map(c => c.conversation_id === msg.conversation_id ? {
          ...c, last_message: msg.message_text, last_message_time: msg.created_at,
          unread_count: (msg.sender_id !== user?.id && (!cur || cur.id !== msg.conversation_id))
            ? Number(c.unread_count || 0) + 1 : c.unread_count,
        } : c).sort((a, b) => new Date(b.last_message_time || b.conversation_created_at) - new Date(a.last_message_time || a.conversation_created_at))
      );
    });
    return () => { s.disconnect(); chatSocketRef.current = null; };
  }, [token, canReadChat]);

  // Join/leave conversation room
  useEffect(() => {
    const s = chatSocketRef.current;
    if (s && chatActive) {
      s.emit('join_conversation', chatActive.id);
      return () => s.emit('leave_conversation', chatActive.id);
    }
  }, [chatActive]);

  // Fetch chat data when modal opens
  useEffect(() => {
    if (!chatOpen || !canReadChat) return;
    const load = async () => {
      setChatLoading(true);
      try {
        const [uRes, cRes] = await Promise.all([api.get('/chat/users'), api.get('/chat/conversations')]);
        setChatUsers(uRes.data.users || []);
        setChatConversations(cRes.data.conversations || []);
      } catch { } finally { setChatLoading(false); }
    };
    load();
  }, [chatOpen, canReadChat]);

  // Fetch messages when conversation changes
  useEffect(() => {
    if (!chatActive) return;
    const load = async () => {
      try {
        const res = await api.get(`/chat/messages/${chatActive.id}`);
        setChatMessages(res.data.messages || []);
        setChatConversations(prev => prev.map(c =>
          c.conversation_id === chatActive.id ? { ...c, unread_count: 0 } : c
        ));
      } catch { }
    };
    load();
  }, [chatActive]);

  // Auto-scroll
  useEffect(() => {
    if (!chatActive) return;
    const isNew = chatLastConvRef.current !== chatActive.id;
    if (isNew) { chatLastConvRef.current = chatActive.id; setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'auto' }), 50); return; }
    if (chatContainerRef.current) {
      const { scrollHeight, scrollTop, clientHeight } = chatContainerRef.current;
      if (scrollHeight - scrollTop - clientHeight < 350) setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  }, [chatMessages, chatActive]);

  const chatStartConv = async (userId) => {
    try {
      const res = await api.get(`/chat/conversations/${userId}`);
      const conv = res.data.conversation;
      const other = chatUsers.find(u => u.id === userId);
      const ac = { id: conv.id, user_name: other?.name || 'User', user_photo: other?.photo, user_id: userId };
      setChatActive(ac);
      setChatConversations(prev => {
        if (!prev.find(c => c.conversation_id === conv.id)) {
          return [{ conversation_id: conv.id, user_id: userId, user_name: other?.name, user_photo: other?.photo, last_message: '', last_message_time: new Date().toISOString(), unread_count: 0 }, ...prev];
        }
        return prev;
      });
    } catch { }
  };

  const chatSend = async (e) => {
    e.preventDefault();
    if ((!chatInput.trim() && !chatAttachment) || !chatActive) return;
    try {
      const res = await api.post('/chat/messages', { conversationId: chatActive.id, text: chatInput, attachmentUrl: chatAttachment?.url || null });
      const nm = res.data.message;
      if (nm) {
        setChatMessages(prev => prev.some(m => m.id === nm.id) ? prev : [...prev, nm]);
        setChatConversations(prev => prev.map(c => c.conversation_id === nm.conversation_id ? { ...c, last_message: nm.message_text, last_message_time: nm.created_at } : c)
          .sort((a, b) => new Date(b.last_message_time || b.conversation_created_at) - new Date(a.last_message_time || a.conversation_created_at)));
      }
      setChatInput(''); setChatAttachment(null);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch { }
  };

  const chatHandleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setChatUploading(true);
    try {
      const fd = new FormData(); fd.append('file', file);
      const res = await api.post('/upload/single?provider=cloudinary', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setChatAttachment({ url: res.data.fileUrl || res.data.url, name: file.name });
    } catch { alert('Upload failed'); } finally { setChatUploading(false); if (chatFileRef.current) chatFileRef.current.value = ''; }
  };

  const chatTotalUnread = useMemo(() => chatConversations.reduce((s, c) => s + (Number(c.unread_count) || 0), 0), [chatConversations]);
  const chatFilteredUsers = useMemo(() => chatUsers.filter(u => u.name.toLowerCase().includes(chatSearch.toLowerCase())), [chatUsers, chatSearch]);

  const [memberSearchQuery, setMemberSearchQuery] = useState(() => sessionStorage.getItem('dashboard_member_search') || '');
  const [memberSearchLoading, setMemberSearchLoading] = useState(false);
  const [memberResults, setMemberResults] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('dashboard_member_results')) || []; } catch { return []; }
  });
  const rehydrateModules = (stored) => {
    const result = {};
    Object.entries(stored).forEach(([entityKey, mods]) => {
      result[entityKey] = (mods || []).map((m) => {
        const cfg = MEMBER_MODULE_CONFIG[m.key];
        return cfg ? { ...cfg, key: m.key, count: m.count } : null;
      }).filter(Boolean);
    });
    return result;
  };

  const [memberModulesById, setMemberModulesById] = useState(() => {
    try {
      const stored = JSON.parse(sessionStorage.getItem('dashboard_member_modules')) || {};
      return rehydrateModules(stored);
    } catch { return {}; }
  });
  const [memberModuleLoadingById, setMemberModuleLoadingById] = useState({});
  const modulesCacheRef = useRef(() => {
    const map = new Map();
    try {
      const stored = JSON.parse(sessionStorage.getItem('dashboard_member_modules')) || {};
      const hydrated = rehydrateModules(stored);
      Object.entries(hydrated).forEach(([k, v]) => map.set(k, v));
    } catch { }
    return map;
  });
  // Lazily initialize the ref (run the factory once)
  if (typeof modulesCacheRef.current === 'function') {
    modulesCacheRef.current = modulesCacheRef.current();
  }
  // Prevent unbounded cache growth
  const MODULE_CACHE_LIMIT = 100;
  const trimModuleCache = useCallback(() => {
    const cache = modulesCacheRef.current;
    if (cache.size > MODULE_CACHE_LIMIT) {
      const excess = cache.size - MODULE_CACHE_LIMIT;
      const keys = cache.keys();
      for (let i = 0; i < excess; i++) keys.next().value && cache.delete(keys.next().value);
    }
  }, []);
  const lastFetchedQueryRef = useRef(sessionStorage.getItem('dashboard_member_search') || '');

  useEffect(() => {
    sessionStorage.setItem('dashboard_member_search', memberSearchQuery);
  }, [memberSearchQuery]);

  useEffect(() => {
    try { sessionStorage.setItem('dashboard_member_results', JSON.stringify(memberResults)); } catch { }
  }, [memberResults]);

  useEffect(() => {
    try {
      // Only store serializable fields (key + count) — icons/functions can't survive JSON
      const serializable = {};
      Object.entries(memberModulesById).forEach(([entityKey, mods]) => {
        serializable[entityKey] = (mods || []).map((m) => ({ key: m.key, count: m.count }));
      });
      sessionStorage.setItem('dashboard_member_modules', JSON.stringify(serializable));
    } catch { }
  }, [memberModulesById]);

  // NOTE: siteCashFlowSummary state was removed — the previous code fetched
  // /cashflow/months on every Dashboard load, computed totals, and stored
  // them in state … but the values were never read anywhere in the JSX.
  // The same numbers are also returned in `kpi.cashflowDetail`, so any
  // future renderer can read from there without an extra round-trip.

  const fetchTransactions = useCallback(async (page = 1) => {
    if (!currentSite?.id) return;
    setTxnLoading(true);
    try {
      const res = await api.get(`/daybook/recent?site_id=${currentSite.id}&page=${page}&limit=${TXN_PER_PAGE}`);
      setTxnData(res.data.transactions || []);
      setTxnPagination(res.data.pagination || { totalItems: 0, totalPages: 1, currentPage: page });
      setTxnPage(page);
    } catch {
      setTxnData([]);
    } finally {
      setTxnLoading(false);
    }
  }, [currentSite?.id]);

  const handleTxnClick = useCallback((txn) => {
    const mod = txn.source_module;
    if (mod === 'plot_payments' || mod === 'plot_installment_payments') {
      const q = txn.plot_no ? `?q=${encodeURIComponent(txn.plot_no)}` : '';
      navigate(`/plot-payments${q}`);
    } else if (mod === 'plot_commissions' || mod === 'plot_commission_payments') {
      navigate('/plot-commission');
    } else if (mod === 'expenses' || mod === 'plot_registry_payments') {
      const particular = txn.particular || '';
      // Try to extract a useful search term
      const q = particular ? `?q=${encodeURIComponent(particular.replace(/^EXPENSE ENTRY\s*[-–]?\s*/i, '').split(' - ')[0] || '')}` : '';
      navigate(mod === 'expenses' ? `/expenses${q}` : '/plot-registry');
    } else if (mod === 'farmer_payments') {
      navigate('/farmers');
    } else if (mod === 'vendor_payments') {
      navigate('/vendors');
    } else if (mod === 'firm_transactions') {
      navigate('/firm-transactions');
    } else if (mod === 'day_book') {
      navigate('/daybook');
    } else {
      navigate('/cashflow');
    }
  }, [navigate]);

  // fetchSiteCashFlowSummary intentionally removed — see note above. The
  // expensive /cashflow/months REST call it triggered served no UI purpose.
  // Kept as a no-op to preserve the existing Promise.all signature below.
  const fetchSiteCashFlowSummary = useCallback(async () => { /* no-op */ }, []);

  // Track whether initial data has loaded (to suppress loading spinners on bg refresh)
  const hasLoadedOnceRef = useRef(false);
  // Phase 2 (charts/analytics) ready flag — prevents rendering heavy Recharts until critical data is painted
  const [deferredReady, setDeferredReady] = useState(false);
  const lastRefreshRef = useRef(0);

  // ── Verify Data Dialog (legacy REST-based, kept alongside GraphQL VerifyPanel) ──
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verifyData, setVerifyData] = useState(null);
  const [verifyLoading, setVerifyLoading] = useState(false);

  const handleVerifyData = useCallback(async () => {
    if (!currentSite?.id) return;
    setVerifyOpen(true);
    setVerifyLoading(true);
    try {
      const res = await api.get('/daybook/verify-data', { params: { site_id: currentSite.id } });
      setVerifyData(res.data.modules || []);
    } catch {
      setVerifyData(null);
    } finally {
      setVerifyLoading(false);
    }
  }, [currentSite?.id]);

  // Approvals card
  const [appTab, setAppTab] = useState(isAdmin ? 'received' : 'sent');  // 'received' | 'sent'
  const [appLoading, setAppLoading] = useState(false);
  const [receivedData, setReceivedData] = useState([]);
  const [sentData, setSentData] = useState([]);
  const [appCounts, setAppCounts] = useState({ total: 0 });
  const [editCounts, setEditCounts] = useState({ pending: 0, approved: 0, rejected: 0 });

  const fetchApprovals = useCallback(async () => {
    if (!currentSite?.id) return;
    setAppLoading(true);
    try {
      if (isAdmin) {
        // Admin: fetch all endpoints
        const [pendingRes, countsRes, editRes, editCountsRes, imprestRes] = await Promise.all([
          api.get(`/approvals/pending?site_id=${currentSite.id}`),
          api.get(`/approvals/counts?site_id=${currentSite.id}`),
          api.get('/edit-requests/my-requests'),
          api.get(`/edit-requests/counts?site_id=${currentSite.id}`),
          api.get(`/imprest/expense-requests?site_id=${currentSite.id}`),
        ]);
        setReceivedData((pendingRes.data.entries || []).slice(0, 8));
        setAppCounts(countsRes.data || { total: 0 });

        const edits = (editRes.data.requests || []).map(r => ({ ...r, _type: 'edit' }));
        const imprests = (imprestRes.data.requests || []).map(r => ({
          ...r,
          _type: 'imprest',
          status: (r.status || '').toLowerCase(),
        }));
        const merged = [...edits, ...imprests]
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .slice(0, 8);
        setSentData(merged);

        const ec = editCountsRes.data || { pending: 0, approved: 0, rejected: 0 };
        const impPending = imprests.filter(r => r.status === 'pending').length;
        setEditCounts({ ...ec, pending: (parseInt(ec.pending) || 0) + impPending });
      } else {
        // Sub-admin: only fetch own requests (skip admin-only endpoints)
        const [editRes, imprestRes] = await Promise.all([
          api.get('/edit-requests/my-requests'),
          api.get(`/imprest/expense-requests?site_id=${currentSite.id}`),
        ]);

        const edits = (editRes.data.requests || []).map(r => ({ ...r, _type: 'edit' }));
        const imprests = (imprestRes.data.requests || []).map(r => ({
          ...r,
          _type: 'imprest',
          status: (r.status || '').toLowerCase(),
        }));
        const merged = [...edits, ...imprests]
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .slice(0, 8);
        setSentData(merged);

        const impPending = imprests.filter(r => r.status === 'pending').length;
        const editPending = edits.filter(r => r.status === 'pending').length;
        setEditCounts({ pending: editPending + impPending, approved: 0, rejected: 0 });
      }
    } catch {
      setReceivedData([]); setSentData([]);
    } finally {
      setAppLoading(false);
    }
  }, [currentSite?.id, isAdmin]);

  useEffect(() => {
    if (!currentSite?.id) return;
    let cancelled = false;
    setDeferredReady(false);

    // Phase 1: Above-fold critical data (transactions + approvals — KPIs now via GraphQL)
    Promise.all([
      fetchTransactions(1),
      fetchApprovals(),
    ]).then(() => {
      if (cancelled) return;
      // Phase 2: Below-fold analytics & charts (staggered after UI is interactive)
      setDeferredReady(true);
      lastRefreshRef.current = Date.now();
      fetchSiteCashFlowSummary();
    });

    hasLoadedOnceRef.current = true;
    return () => { cancelled = true; };
  }, [currentSite?.id, fetchTransactions, fetchApprovals, fetchSiteCashFlowSummary]);

  // Auto-refresh dashboard silently when data is mutated or tab re-focused
  useEffect(() => {
    if (!currentSite?.id) return;
    let debounceTimer = null;
    const refresh = (silent = false) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        lastRefreshRef.current = Date.now();
        // Stagger: critical first, then analytics
        Promise.all([
          fetchTransactions(1),
          fetchApprovals(),
        ]).then(() => {
          fetchSiteCashFlowSummary();
          // GraphQL KPIs + charts refresh via Apollo's cache-and-network policy
          refetchKpi();
        });
      }, 600);
    };
    const onMutated = () => refresh(false);
    eventBus.on('data-mutated', onMutated);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && hasLoadedOnceRef.current) {
        // Skip if refreshed less than 30s ago
        if (Date.now() - lastRefreshRef.current < 30000) return;
        refresh(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      eventBus.off('data-mutated', onMutated);
      document.removeEventListener('visibilitychange', handleVisibility);
      clearTimeout(debounceTimer);
    };
  }, [currentSite?.id, fetchTransactions, fetchSiteCashFlowSummary, fetchApprovals, refetchKpi]);

  useEffect(() => {
    if (!currentSite?.id) {
      setMemberResults([]);
      setMemberSearchLoading(false);
      setMemberModulesById({});
      setMemberModuleLoadingById({});
      modulesCacheRef.current.clear();
      return;
    }

    const query = memberSearchQuery.trim();
    if (query.length < 2) {
      setMemberResults([]);
      setMemberSearchLoading(false);
      lastFetchedQueryRef.current = '';
      return;
    }

    // Skip fetch if we already have cached results for this exact query (e.g. on remount)
    if (query === lastFetchedQueryRef.current && memberResults.length > 0) {
      return;
    }

    let cancelled = false;
    const timeout = setTimeout(async () => {
      setMemberSearchLoading(true);
      try {
        const [memberRes, monthsRes] = await Promise.all([
          api.get('/members/search', { params: { site_id: currentSite.id, q: query } }),
          canReadCashflow ? api.get('/cashflow/months', { params: { site_id: currentSite.id } }) : Promise.resolve({ data: { months: [] } }),
        ]);

        const members = (memberRes.data?.members || []).map((m) => ({ ...m, _kind: 'member' }));
        const ledgers = (monthsRes.data?.months || [])
          .filter((m) => m.ledger_type === 'person' && (m.ledger_name || '').toLowerCase().includes(query.toLowerCase()))
          .map((m) => ({
            id: `ledger-${m.id}`,
            _kind: 'ledger',
            ledger_id: m.id,
            ledger_name: m.ledger_name,
            full_name: m.ledger_name,
            member_type: 'PERSONAL LEDGER',
            phone: null,
            alt_phone: null,
          }));

        const list = [...members, ...ledgers].slice(0, 10);

        if (!cancelled) {
          setMemberResults(list);
          lastFetchedQueryRef.current = query;
          const modulesFromCache = {};
          const immediateModules = {};
          list.forEach((entity) => {
            const key = getSearchEntityKey(entity);
            if (modulesCacheRef.current.has(key)) {
              modulesFromCache[key] = modulesCacheRef.current.get(key);
            }

            if (entity._kind === 'ledger') {
              const ledgerCfg = MEMBER_MODULE_CONFIG.personal_ledger;
              const modules = hasPermission(ledgerCfg.module, 'read')
                ? [{ key: 'personal_ledger', count: 1, ...ledgerCfg }]
                : [];
              immediateModules[key] = modules;
              modulesCacheRef.current.set(key, modules);
            }
          });

          if (Object.keys(modulesFromCache).length > 0 || Object.keys(immediateModules).length > 0) {
            setMemberModulesById((prev) => ({ ...prev, ...modulesFromCache, ...immediateModules }));
          }
        }
      } catch {
        if (!cancelled) setMemberResults([]);
      } finally {
        if (!cancelled) setMemberSearchLoading(false);
      }
    }, 280);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [memberSearchQuery, currentSite?.id, canReadCashflow, hasPermission]);

  useEffect(() => {
    if (!currentSite?.id || memberResults.length === 0) return;

    const toFetch = memberResults.filter((m) => m._kind === 'member' && !modulesCacheRef.current.has(getSearchEntityKey(m)));
    if (toFetch.length === 0) return;

    let cancelled = false;
    setMemberModuleLoadingById((prev) => {
      const next = { ...prev };
      toFetch.forEach((m) => { next[getSearchEntityKey(m)] = true; });
      return next;
    });

    Promise.allSettled(
      toFetch.map(async (member) => {
        try {
          const res = await api.get(`/members/${member.id}/financial-info`, { params: { site_id: currentSite.id } });
          const summary = res.data?.summary || {};
          const modules = [];

          const profileCfg = MEMBER_MODULE_CONFIG.clients;
          if (hasPermission(profileCfg.module, 'read')) {
            modules.push({ key: 'clients', count: 1, ...profileCfg });
          }

          Object.entries({
            expenses: summary.expenses?.count || 0,
            commissions: summary.commissions?.count || 0,
            plot_payments: summary.plot_payments?.count || 0,
            farmer_payments: summary.farmer_payments?.count || 0,
            firm_transactions: summary.firm_transactions?.count || 0,
          }).forEach(([key, count]) => {
            if (!count) return;
            const cfg = MEMBER_MODULE_CONFIG[key];
            if (!cfg || !hasPermission(cfg.module, 'read')) return;
            modules.push({ key, count, ...cfg });
          });

          const cacheKey = getSearchEntityKey(member);
          modulesCacheRef.current.set(cacheKey, modules);
          trimModuleCache();
          if (!cancelled) {
            setMemberModulesById((prev) => ({ ...prev, [cacheKey]: modules }));
          }
        } catch {
          if (!cancelled) {
            setMemberModulesById((prev) => ({ ...prev, [getSearchEntityKey(member)]: [] }));
          }
        } finally {
          if (!cancelled) {
            setMemberModuleLoadingById((prev) => ({ ...prev, [getSearchEntityKey(member)]: false }));
          }
        }
      })
    );

    return () => {
      cancelled = true;
    };
  }, [memberResults, currentSite?.id, hasPermission]);

  const activeSites = useMemo(() => sites.filter(s => s.status === 'active').length, [sites]);
  const pendingWork = useMemo(() => isAdmin ? (parseInt(appCounts.total, 10) || 0) : (parseInt(editCounts.pending, 10) || 0), [isAdmin, appCounts.total, editCounts.pending]);
  return (
    <div className="min-h-screen pb-6">
      {/* ═══ Header ═══ */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-30 mb-6 rounded-3xl border border-slate-200/70 bg-gradient-to-br from-white via-indigo-50/30 to-white shadow-[0_2px_24px_-10px_rgba(30,41,59,0.18)]"
      >
        {/* decorative blobs — clipped to the rounded card WITHOUT clipping the search dropdown */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
          <div className="absolute -top-24 -right-16 h-56 w-56 rounded-full bg-gradient-to-br from-indigo-300/25 to-violet-300/15 blur-3xl" />
          <div className="absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-gradient-to-tr from-sky-200/25 to-emerald-200/10 blur-3xl" />
        </div>
        <div className="relative flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-2xl font-bold tracking-tight text-slate-900">
                {(() => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; })()}, {user?.name?.split(' ')[0] || 'User'}
              </h1>
              <motion.span
                initial={{ rotate: 0 }}
                animate={{ rotate: [0, 18, -8, 14, 0] }}
                transition={{ duration: 1.4, delay: 0.4, ease: 'easeInOut' }}
                className="origin-[70%_70%] text-2xl"
              >👋</motion.span>
            </div>
            <p className="mt-1 text-[13px] text-slate-500">
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              {currentSite?.name ? ` · ${currentSite.name}${currentSite.city ? ', ' + currentSite.city : ''}` : ''}
            </p>
          
          </div>
        {currentSite && canSee('member_search') && (
          <div className="relative w-full sm:w-80 lg:w-96 group shrink-0">
            <div className="relative flex items-center">
              <Search className="absolute left-3 h-4 w-4 text-slate-400 pointer-events-none" />
              <Input
                placeholder="Search users, ledgers, payments..."
                value={memberSearchQuery}
                onChange={(e) => setMemberSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && memberSearchQuery.trim()) {
                    navigate(`/clients?q=${encodeURIComponent(memberSearchQuery.trim())}`);
                  }
                }}
                className="pl-9 pr-9 h-10 rounded-lg border-slate-200 bg-white text-[13px] shadow-none placeholder:text-slate-400 focus-visible:ring-1 focus-visible:ring-slate-300 focus-visible:border-slate-300 transition-colors"
              />
              {memberSearchQuery.trim() && (
                <button onClick={() => setMemberSearchQuery('')} className="absolute right-2.5 w-5 h-5 rounded-md hover:bg-slate-100 flex items-center justify-center transition-colors">
                  <X className="w-3 h-3 text-slate-400" />
                </button>
              )}
            </div>
            {/* Search Results Dropdown */}
            {memberSearchQuery.trim() && (
              <div className="absolute top-full left-0 right-0 mt-2 rounded-xl border border-slate-200 bg-white shadow-lg z-50 overflow-hidden">
                {memberSearchLoading ? (
                  <div className="flex items-center justify-center gap-2 py-5 text-sm text-slate-500">
                    <Loader2 className="w-4 h-4 animate-spin" /> Finding users...
                  </div>
                ) : memberSearchQuery.trim().length < 2 ? (
                  <div className="py-4 px-4 text-xs text-slate-500">Type 2+ chars to search.</div>
                ) : memberResults.length === 0 ? (
                  <div className="py-4 px-4 text-xs text-slate-500">
                    No results for &quot;{memberSearchQuery.trim()}&quot;
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                    {memberResults.map((member) => {
                      const entityKey = getSearchEntityKey(member);
                      const modules = memberModulesById[entityKey] || [];
                      const loadingModules = !!memberModuleLoadingById[entityKey];
                      const isLedgerResult = member._kind === 'ledger';
                      return (
                        <div key={entityKey} className="px-4 py-3 hover:bg-slate-50 transition-colors">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-slate-800 truncate">{member.full_name}</p>
                              <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                                <span>{member.member_type || 'Member'}</span>
                                {!isLedgerResult && (member.phone || member.alt_phone) && (
                                  <span className="inline-flex items-center gap-0.5">
                                    <Phone className="w-3 h-3" /> {member.phone || member.alt_phone}
                                  </span>
                                )}
                              </div>
                            </div>
                            <Button size="sm" className="h-7 text-xs shrink-0 px-3 rounded-lg"
                              onClick={() => navigate(isLedgerResult ? `/cashflow?q=${encodeURIComponent(member.full_name || '')}` : `/clients/${member.id}`)}>
                              {isLedgerResult ? 'Ledger' : 'Profile'}
                            </Button>
                          </div>
                          <div className="mt-2">
                            {loadingModules ? (
                              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                <Loader2 className="w-3 h-3 animate-spin" /> Resolving...
                              </div>
                            ) : modules.length === 0 ? (
                              <p className="text-xs text-slate-400">No modules yet.</p>
                            ) : (
                              <div className="flex flex-wrap gap-1.5">
                                {modules.map((mod) => {
                                  const ModIcon = mod.icon;
                                  return (
                                    <button key={`${entityKey}-${mod.key}`} type="button"
                                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-medium transition-colors ${mod.cls}`}
                                      onClick={() => navigate(mod.to(member))}>
                                      <ModIcon className="w-3 h-3" /> {mod.label}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
          </div>
        </motion.div>

      {/* ═══ Main Dashboard ═══ */}
      <div className="space-y-6">

        {/* ── Time Filter header ── */}
        {currentSite && canSee('financial_overview') && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="h-5 w-1 rounded-full bg-gradient-to-b from-indigo-400 to-violet-500" />
              <h2 className="text-sm font-semibold tracking-tight text-slate-800">Financial Overview</h2>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <label className="flex items-center gap-1.5 cursor-pointer select-none rounded-lg border border-slate-200 bg-white px-2.5 h-8">
                <Checkbox
                  checked={excludeOldPlots}
                  onCheckedChange={(v) => setExcludeOldPlots(!!v)}
                  className="h-3.5 w-3.5"
                />
                <span className="text-[11px] text-slate-600 font-medium">New Plots Only</span>
              </label>
              <TimeFilter value={timePreset} onChange={setTimePreset} />
              <button
                onClick={() => refetchKpi()}
                disabled={kpiLoading}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition-colors disabled:opacity-50"
                title="Refresh data"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${kpiLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        )}

        {/* ── Row 1: Revenue vs Expense | Profit Trend ── */}
        {currentSite && deferredReady && canSee('revenue_charts') && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <RevenueVsExpenseChart siteId={currentSite.id} range={range} resolution={chartResolution} excludeOldPlots={excludeOldPlots} />
            <ProfitTrendChart siteId={currentSite.id} range={range} resolution={chartResolution} excludeOldPlots={excludeOldPlots} />
          </div>
        )}

        {/* ── Row 2: Financial KPI Cards — one horizontal row ── */}
        {currentSite && canSee('financial_overview') && (() => {
          const outstanding = parseFloat(kpi?.outstanding) || 0;
          const ledgerReturned = parseFloat(kpi?.outstandingDetail?.returned) || 0;
          const totalRev = parseFloat(kpi?.totalRevenue) || 0;
          const adjustedIncoming = showLedgerReturned
            ? totalRev + ledgerReturned
            : totalRev - outstanding;
          const alpha = adjustedIncoming - (parseFloat(kpi?.totalExpense) || 0);
          const gamma = alpha - (parseFloat(kpi?.imprestGiven) || 0);
          return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 auto-rows-fr items-stretch">
            {canSee('kpi_totalIncoming') && <div className="relative h-full">
              <KpiCard
                kpiKey="totalIncoming"
                value={adjustedIncoming}
                loading={kpiLoading}
                subtitle={kpi ? (showLedgerReturned ? `Plot + Installments + Returned ₹${fmt(ledgerReturned)}` : `Plot + Installments ${outstanding >= 0 ? '−' : '+'} Pending ₹${fmt(Math.abs(outstanding))}`) : undefined}
                onClick={() => setKpiModal('totalIncoming')}
              />
              <label className="absolute top-2 right-2 flex items-center gap-1 cursor-pointer select-none z-10 rounded-md bg-white/70 px-1.5 py-1 backdrop-blur-sm">
                <Checkbox
                  checked={showLedgerReturned}
                  onCheckedChange={(v) => setShowLedgerReturned(!!v)}
                  className="h-3.5 w-3.5"
                />
                <span className="text-[9px] text-slate-500 font-medium">Returned</span>
              </label>
            </div>}
            {canSee('kpi_plotPayments') && <KpiCard
              kpiKey="plotPayments"
              value={kpi?.totalRevenue}
              loading={kpiLoading}
              onClick={() => setKpiModal('totalIncoming')}
            />}
            {canSee('kpi_registryPayments') && (() => {
              const regNew   = parseFloat(kpi?.registryPaymentsNew) || 0;
              const regOld   = parseFloat(kpi?.registryPaymentsOld) || 0;
              const regTotal = parseFloat(kpi?.registryPayments) || (regNew + regOld);
              const regNewCount = parseInt(kpi?.registryPaymentsNewCount, 10) || 0;
              const regOldCount = parseInt(kpi?.registryPaymentsOldCount, 10) || 0;
              const displayedValue = registryIncludeOld ? regTotal : regNew;
              const displayedCount = registryIncludeOld ? (regNewCount + regOldCount) : regNewCount;
              return (
                <div className="relative h-full">
                  <KpiCard
                    kpiKey="registryPayments"
                    value={displayedValue}
                    loading={kpiLoading}
                    subtitle={kpi
                      ? (registryIncludeOld
                          ? `NEW ₹${fmt(regNew)} + OLD ₹${fmt(regOld)} · ${displayedCount} payment${displayedCount === 1 ? '' : 's'}`
                          : `NEW plots only · ${displayedCount} payment${displayedCount === 1 ? '' : 's'} · +₹${fmt(regOld)} OLD hidden`)
                      : undefined}
                    details={kpi ? [
                      { label: 'NEW plots', value: `₹${fmt(regNew)}`, color: 'text-emerald-600' },
                      { label: 'OLD plots', value: `₹${fmt(regOld)}`, color: registryIncludeOld ? 'text-amber-600' : 'text-slate-400' },
                      { label: registryIncludeOld ? '= Total (NEW + OLD)' : '= Showing (NEW only)', value: `₹${fmt(displayedValue)}`, color: 'text-violet-700' },
                    ] : undefined}
                    onClick={() => setKpiModal('registryPayments')}
                  />
                  {kpi && regOldCount > 0 && (
                    <label
                      className="absolute top-2 right-2 flex items-center gap-1 cursor-pointer select-none z-10 rounded-md bg-white/70 px-1.5 py-1 backdrop-blur-sm"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        checked={registryIncludeOld}
                        onCheckedChange={(v) => setRegistryIncludeOld(!!v)}
                        className="h-3.5 w-3.5"
                      />
                      <span className="text-[9px] text-slate-500 font-medium">+{regOldCount} OLD</span>
                    </label>
                  )}
                </div>
              );
            })()}
            {canSee('kpi_personalLedger') && <KpiCard
              kpiKey="personalLedger"
              value={kpi?.outstanding}
              loading={kpiLoading}
              details={kpi?.outstandingDetail ? [
                { label: 'Given', value: `₹${fmt(kpi.outstandingDetail.given)}`, color: 'text-red-600' },
                { label: 'Received', value: `₹${fmt(kpi.outstandingDetail.returned)}`, color: 'text-emerald-600' },
                { label: 'Pending', value: `₹${fmt(kpi.outstandingDetail.pending)}`, color: 'text-amber-600' },
              ] : undefined}
              onClick={() => setKpiModal('personalLedger')}
            />}
            {canSee('kpi_totalExpense') && <KpiCard
              kpiKey="totalExpense"
              value={kpi?.totalExpense}
              loading={kpiLoading}
              onClick={() => setKpiModal('totalExpense')}
            />}
            {canSee('kpi_profit') && <KpiCard
              kpiKey="profit"
              value={kpi?.netProfit}
              loading={kpiLoading}
              subtitle={kpi ? `₹${fmt(kpi.totalRevenue)} − ₹${fmt(kpi.totalExpense)}` : undefined}
              onClick={() => setKpiModal('profit')}
            />}
            {canSee('kpi_siteBalance') && <KpiCard
              kpiKey="siteBalance"
              value={gamma}
              loading={kpiLoading}
              details={kpi ? [
                { label: 'Total Incoming', value: `₹${fmt(adjustedIncoming)}`, color: 'text-blue-600' },
                { label: '− Expenses', value: `₹${fmt(kpi.totalExpense)}`, color: 'text-red-600' },
                { label: '= Alpha', value: `₹${fmt(alpha)}`, color: alpha >= 0 ? 'text-emerald-600' : 'text-red-600' },
                { label: '− Imprest Given', value: `₹${fmt(kpi.imprestGiven)}`, color: 'text-orange-600' },
                { label: '= Site Balance', value: `₹${fmt(gamma)}`, color: gamma >= 0 ? 'text-cyan-700' : 'text-red-600' },
              ] : undefined}
              onClick={() => setKpiModal('siteBalance')}
            />}
          </div>
          </div>
          );
        })()}

        {/* ── KPI Detail Modal ── */}
        <Dialog open={!!kpiModal} onOpenChange={(open) => !open && setKpiModal(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">
                {kpiModal === 'totalIncoming' && 'Total Incoming — Breakdown'}
                {kpiModal === 'totalExpense' && 'Total Expenses — Breakdown'}
                {kpiModal === 'profit' && 'Profit — Calculation'}
                {kpiModal === 'personalLedger' && 'Personal Ledger — Details'}
                {kpiModal === 'siteBalance' && 'Site Balance — Calculation'}
                {kpiModal === 'registryPayments' && 'Registry Payments — Details'}
              </DialogTitle>
            </DialogHeader>
            {kpi && (
              <div className="space-y-4 mt-2">
                {/* ── Total Incoming ── */}
                {kpiModal === 'totalIncoming' && (() => {
                  const pp = kpi.breakdown?.find(b => b.module === 'plot_payments');
                  const plotRev = parseFloat(pp?.credit || kpi.totalRevenue) || 0;
                  const outstandingVal = parseFloat(kpi.outstanding) || 0;
                  const returnedVal = parseFloat(kpi.outstandingDetail?.returned) || 0;
                  const pendingVal = parseFloat(kpi.outstandingDetail?.pending) || 0;
                  const givenVal = parseFloat(kpi.outstandingDetail?.given) || 0;
                  const modalIncoming = showLedgerReturned
                    ? plotRev + returnedVal
                    : plotRev - outstandingVal;
                  return (
                    <div className="space-y-3">
                      <p className="text-xs text-slate-500 font-mono">
                        {showLedgerReturned
                          ? 'Formula: Plot Payments + Installments + Ledger Returned'
                          : `Formula: Plot Payments + Installments ${outstandingVal >= 0 ? '−' : '+'} Ledger Pending`}
                      </p>
                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">Plot Payments + Installments</span>
                          <span className="font-bold text-emerald-700 tabular-nums">₹{fmt(plotRev)}</span>
                        </div>
                      </div>
                      {showLedgerReturned ? (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-600">Personal Ledger Incoming </span>
                            <span className="font-bold text-blue-700 tabular-nums">+ ₹{fmt(returnedVal)}</span>
                          </div>
                        </div>
                      ) : (
                        <div className={`${outstandingVal >= 0 ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'} border rounded-lg p-3`}>
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-600">
                              Personal Ledger Pending {outstandingVal >= 0 ? '(To Receive — subtracted)' : '(To Give — added)'}
                            </span>
                            <span className={`font-bold tabular-nums ${outstandingVal >= 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                              {outstandingVal >= 0 ? '−' : '+'} ₹{fmt(Math.abs(outstandingVal))}
                            </span>
                          </div>
                          {outstandingVal !== 0 && (
                            <div className="mt-2 pt-2 border-t border-dashed text-xs text-slate-500 space-y-0.5">
                              <div className="flex justify-between"><span>Given</span><span>₹{fmt(givenVal)}</span></div>
                              <div className="flex justify-between"><span>Received</span><span>₹{fmt(returnedVal)}</span></div>
                              <div className="flex justify-between font-medium"><span>Pending</span><span>₹{fmt(pendingVal)}</span></div>
                            </div>
                          )}
                        </div>
                      )}
                      <div className="flex items-center gap-2 px-1">
                        <Checkbox
                          checked={showLedgerReturned}
                          onCheckedChange={(v) => setShowLedgerReturned(!!v)}
                          className="h-3.5 w-3.5"
                        />
                        <span className="text-xs text-slate-500">Show Returned instead of Pending adjustment</span>
                      </div>
                      <div className="border-t pt-3 flex justify-between text-base font-bold">
                        <span>Total Incoming</span>
                        <span className="text-emerald-700 tabular-nums">₹{fmt(modalIncoming)}</span>
                      </div>
                    </div>
                  );
                })()}

                {/* ── Total Expenses ── */}
                {kpiModal === 'totalExpense' && (() => {
                  const expModules = (kpi.breakdown || []).filter(b => b.module !== 'plot_payments' && b.debit > 0);
                  const moduleLabels = {
                    farmer_payments: 'Farmer Payments',
                    expenses: 'Expense Module',
                    commission_payments: 'Commission Payments',
                    vendor_payments: 'Vendor Payments',
                    personal_ledger_debit: 'Personal Ledger (Debit)',
                    daybook_expense: 'Day Book (Orphan)',
                  };
                  return (
                    <div className="space-y-3">
                      <p className="text-xs text-slate-500 font-mono">Formula: SUM(farmer + expenses + commissions + vendors + ledger_debit + daybook)</p>
                      <div className="space-y-1.5">
                        {expModules.map((m) => (
                          <div key={m.module} className="flex justify-between items-center text-sm bg-red-50/60 border border-red-100 rounded-lg px-3 py-2">
                            <span className="text-slate-600">{moduleLabels[m.module] || m.module.replace(/_/g, ' ')}</span>
                            <div className="text-right">
                              <span className="font-semibold text-red-700 tabular-nums">₹{fmt(m.debit)}</span>
                              <span className="text-[10px] text-slate-400 ml-2">({m.count})</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="border-t pt-3 flex justify-between text-base font-bold">
                        <span>Total Expenses</span>
                        <span className="text-red-700 tabular-nums">₹{fmt(kpi.totalExpense)}</span>
                      </div>
                    </div>
                  );
                })()}

                {/* ── Profit ── */}
                {kpiModal === 'profit' && (() => {
                  const isPos = kpi.netProfit >= 0;
                  return (
                    <div className="space-y-3">
                      <p className="text-xs text-slate-500 font-mono">Formula: Total Incoming − Total Expenses</p>
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-sm bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                          <span className="text-slate-600">Total Incoming (Plot Payments)</span>
                          <span className="font-semibold text-emerald-700 tabular-nums">+ ₹{fmt(kpi.totalRevenue)}</span>
                        </div>
                        <div className="flex justify-between text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                          <span className="text-slate-600">Total Expenses</span>
                          <span className="font-semibold text-red-700 tabular-nums">− ₹{fmt(kpi.totalExpense)}</span>
                        </div>
                      </div>
                      <div className="border-t pt-3 flex justify-between text-base font-bold">
                        <span>Net Profit</span>
                        <span className={`tabular-nums ${isPos ? 'text-emerald-700' : 'text-red-700'}`}>
                          {isPos ? '' : '-'}₹{fmt(Math.abs(kpi.netProfit))}
                        </span>
                      </div>
                      {kpi.profitMargin !== 0 && (
                        <p className="text-xs text-slate-400 text-right">Margin: {kpi.profitMargin}%</p>
                      )}
                    </div>
                  );
                })()}

                {/* ── Personal Ledger ── */}
                {kpiModal === 'personalLedger' && kpi.outstandingDetail && (() => {
                  const { given, returned, pending } = kpi.outstandingDetail;
                  return (
                    <div className="space-y-3">
                      <p className="text-xs text-slate-500 font-mono">Formula: Given − Received = Pending</p>
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                          <span className="text-slate-600">Given (Debit)</span>
                          <span className="font-semibold text-red-700 tabular-nums">₹{fmt(given)}</span>
                        </div>
                        <div className="flex justify-between text-sm bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                          <span className="text-slate-600">Received (Credit)</span>
                          <span className="font-semibold text-emerald-700 tabular-nums">₹{fmt(returned)}</span>
                        </div>
                      </div>
                      <div className="border-t pt-3 flex justify-between text-base font-bold">
                        <span>Pending (Outstanding)</span>
                        <span className={`tabular-nums ${pending >= 0 ? 'text-amber-600' : 'text-emerald-700'}`}>
                          ₹{fmt(Math.abs(pending))}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* ── Site Balance ── */}
                {kpiModal === 'siteBalance' && (() => {
                  const siteOutstanding = parseFloat(kpi.outstanding) || 0;
                  const siteLedgerReturned = parseFloat(kpi.outstandingDetail?.returned) || 0;
                  const adjustedIncoming = showLedgerReturned
                    ? (parseFloat(kpi.totalRevenue) || 0) + siteLedgerReturned
                    : (parseFloat(kpi.totalRevenue) || 0) - siteOutstanding;
                  const alpha = adjustedIncoming - (parseFloat(kpi.totalExpense) || 0);
                  const imprest = parseFloat(kpi.imprestGiven) || 0;
                  const gamma = alpha - imprest;
                  const imprestDistribution = Array.isArray(kpi.imprestDistribution) ? kpi.imprestDistribution : [];
                  return (
                    <div className="space-y-3">
                      <p className="text-xs text-slate-500 font-mono">Alpha = Total Incoming − Expenses | Gamma = Alpha − Imprest Given</p>
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-sm bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                          <span className="text-slate-600">Total Incoming</span>
                          <span className="font-semibold text-blue-700 tabular-nums">₹{fmt(adjustedIncoming)}</span>
                        </div>
                        <div className="flex justify-between text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                          <span className="text-slate-600">− Total Expenses</span>
                          <span className="font-semibold text-red-700 tabular-nums">₹{fmt(kpi.totalExpense)}</span>
                        </div>
                        <div className={`flex justify-between text-sm rounded-lg px-3 py-2 border font-semibold ${alpha >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                          <span className="text-slate-700">= Alpha</span>
                          <span className={`tabular-nums ${alpha >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>₹{fmt(alpha)}</span>
                        </div>
                        <div className="flex justify-between text-sm bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                          <span className="text-slate-600">− Imprest Given</span>
                          <span className="font-semibold text-orange-700 tabular-nums">₹{fmt(imprest)}</span>
                        </div>
                      </div>
                      <div className="border rounded-lg bg-orange-50/50 border-orange-200 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-orange-800">Imprest Distributed To</span>
                          <span className="text-xs font-semibold text-orange-700">₹{fmt(imprest)}</span>
                        </div>
                        {imprestDistribution.length > 0 ? (
                          <div className="space-y-1.5 max-h-36 overflow-auto pr-1">
                            {imprestDistribution.map((row) => (
                              <div key={row.subAdminId} className="flex items-center justify-between text-xs bg-white border border-orange-100 rounded-md px-2.5 py-1.5">
                                <span className="text-slate-700 truncate pr-2">{row.recipientName}</span>
                                <span className="font-semibold text-orange-700 tabular-nums whitespace-nowrap">₹{fmt(row.totalAmount)}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500">No imprest distribution found in this time range.</p>
                        )}
                      </div>

                      {(() => {
                        const pairs = Array.isArray(kpi.imprestPairs) ? kpi.imprestPairs : [];
                        if (pairs.length === 0) return null;
                        const totalTransferred = pairs.reduce((s, r) => s + (parseFloat(r.totalAmount) || 0), 0);
                        const roleBadge = (role) => role === 'sub_admin' ? 'Sub' : role === 'super_admin' ? 'Super' : 'Admin';
                        return (
                          <div className="border rounded-lg bg-sky-50/60 border-sky-200 p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-semibold text-sky-800">Imprest Transfers — Who gave to whom</span>
                              <span className="text-[10px] font-semibold text-sky-700">Final amount · {pairs.length} pair{pairs.length === 1 ? '' : 's'}</span>
                            </div>
                            <div className="space-y-1.5 max-h-40 overflow-auto pr-1">
                              {pairs.map((p) => (
                                <div key={`${p.giverId}-${p.receiverId}`} className="flex items-center justify-between gap-2 text-xs bg-white border border-sky-100 rounded-md px-2.5 py-1.5">
                                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                    <span className="text-slate-700 truncate font-medium">{p.giverName}</span>
                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 shrink-0">{roleBadge(p.giverRole)}</span>
                                    <span className="text-slate-400">→</span>
                                    <span className="text-slate-700 truncate font-medium">{p.receiverName}</span>
                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 shrink-0">{roleBadge(p.receiverRole)}</span>
                                  </div>
                                  <span className="font-semibold text-sky-700 tabular-nums whitespace-nowrap">₹{fmt(p.totalAmount)}</span>
                                </div>
                              ))}
                            </div>
                            <div className="flex items-center justify-between text-[11px] pt-1 border-t border-sky-100">
                              <span className="text-slate-500">Total transferred (net per-pair)</span>
                              <span className="font-semibold text-sky-700 tabular-nums">₹{fmt(totalTransferred)}</span>
                            </div>
                          </div>
                        );
                      })()}
                      <div className="border-t pt-3 flex justify-between text-base font-bold">
                        <span>Gamma (Site Balance)</span>
                        <span className={`tabular-nums ${gamma >= 0 ? 'text-cyan-700' : 'text-red-700'}`}>
                          {gamma < 0 ? '-' : ''}₹{fmt(Math.abs(gamma))}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* ── Registry Payments ── */}
                {kpiModal === 'registryPayments' && (() => {
                  const regTotal = parseFloat(kpi.registryPayments) || 0;
                  const regNew   = parseFloat(kpi.registryPaymentsNew) || 0;
                  const regOld   = parseFloat(kpi.registryPaymentsOld) || 0;
                  const regCount    = parseInt(kpi.registryPaymentsCount, 10) || 0;
                  const regNewCount = parseInt(kpi.registryPaymentsNewCount, 10) || 0;
                  const regOldCount = parseInt(kpi.registryPaymentsOldCount, 10) || 0;
                  return (
                    <div className="space-y-3">
                      <p className="text-xs text-slate-500 font-mono">
                        Source: plot_payments + plot_installment_payments · filtered to plots.status = 'REGISTRY'
                      </p>
                      <div className="rounded-lg border border-violet-200 bg-violet-50/60 p-3 space-y-2">
                        <div className="flex justify-between items-center text-sm bg-emerald-50/60 border border-emerald-100 rounded-md px-2.5 py-1.5">
                          <span className="text-slate-600">
                            NEW plots <span className="text-[10px] text-slate-400 ml-1">({regNewCount} payment{regNewCount === 1 ? '' : 's'})</span>
                          </span>
                          <span className="font-semibold text-emerald-700 tabular-nums">₹{fmt(regNew)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm bg-amber-50/60 border border-amber-100 rounded-md px-2.5 py-1.5">
                          <span className="text-slate-600">
                            OLD plots <span className="text-[10px] text-slate-400 ml-1">({regOldCount} payment{regOldCount === 1 ? '' : 's'})</span>
                          </span>
                          <span className="font-semibold text-amber-700 tabular-nums">₹{fmt(regOld)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm font-bold border-t border-violet-200 pt-2 mt-1">
                          <span className="text-slate-700">= Total received on registered plots</span>
                          <span className="text-violet-700 tabular-nums">₹{fmt(regTotal)}</span>
                        </div>
                        <div className="flex justify-between text-xs pt-0.5">
                          <span className="text-slate-500">Total payment entries</span>
                          <span className="font-semibold text-violet-700 tabular-nums">{regCount}</span>
                        </div>
                      </div>
                      <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-800 leading-relaxed">
                        All money collected against plots whose status is <b>REGISTRY</b>, across every
                        payment mode (cash, bank, cheque, UPI, other). Includes both plot payments
                        and installment payments, skipping bounced / returned cheques.
                        <br /><br />
                        The card <b>defaults to NEW plots only</b> — mirrors the <b>RECEIVED</b> footer
                        on the Plot Payments page. Tick the <b>+OLD</b> checkbox on the card to add
                        OLD (resold / superseded) plot receipts into the number. This is a read-only
                        view — the amounts already flow into Total Incoming, Profit and Site Balance
                        via the underlying plot_payments / plot_installment_payments rows.
                      </div>
                      <div className="flex justify-end">
                        <Link to="/plot-registry">
                          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                            <ExternalLink className="w-3 h-3" /> View Plot Registry
                          </Button>
                        </Link>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* ── Row 4: Expense Radar — full width ── */}
        {currentSite && deferredReady && canSee('expense_radar') && (
          <ExpenseByCategoryRadar siteId={currentSite.id} range={range} />
        )}

        {/* ── Row 3: Recent Transactions (2/3) + Analytics sidebar (1/3) ── */}
        {currentSite && canSee('recent_transactions') && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recent Transactions — takes 2 columns */}
            <div className="lg:col-span-2">
              <div className="relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_2px_16px_-8px_rgba(16,24,40,0.12)]">
                <div className="relative">
                  <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-slate-400" />
                      <span className="text-[13px] font-semibold text-slate-900">Recent Transactions</span>
                    </div>
                    <Link to="/daybook">
                      <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5 rounded-lg text-slate-500 hover:text-slate-900">
                        View all <ChevronRight className="w-3.5 h-3.5" />
                      </Button>
                    </Link>
                  </div>
                  {txnLoading ? (
                    <div className="p-4 space-y-3">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <Skeleton className="h-4 w-16" />
                          <Skeleton className="h-4 w-20" />
                          <Skeleton className="h-4 flex-1" />
                          <Skeleton className="h-4 w-20" />
                        </div>
                      ))}
                    </div>
                  ) : txnData.length === 0 ? (
                    <div className="text-center py-16">
                      <CreditCard className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                      <p className="text-sm text-slate-500 font-medium">No transactions found</p>
                      <p className="text-xs text-slate-400 mt-0.5">Transactions from all modules will appear here</p>
                    </div>
                  ) : (
                    <>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="hover:bg-transparent bg-slate-50/80">
                              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-8">#</TableHead>
                              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-24">Date</TableHead>
                              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-28 hidden sm:table-cell">Type</TableHead>
                              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Particular</TableHead>
                              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-20 hidden md:table-cell">Mode</TableHead>
                              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right w-28">Debit (₹)</TableHead>
                              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right w-28">Credit (₹)</TableHead>
                              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-20 hidden sm:table-cell">Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {txnData.map((txn, idx) => {
                              const rawDebit = parseFloat(txn.debit) || 0;
                              const rawCredit = parseFloat(txn.credit) || 0;
                              const debit = rawDebit > 0 ? rawDebit : (rawCredit < 0 ? Math.abs(rawCredit) : 0);
                              const credit = rawCredit > 0 ? rawCredit : (rawDebit < 0 ? Math.abs(rawDebit) : 0);
                              const isRefund = rawCredit < 0 || rawDebit < 0;
                              const chequeCs = txn.cheque_status ? txn.cheque_status.toUpperCase() : null;
                              const st = (chequeCs && STATUS_BADGE[chequeCs]) ? STATUS_BADGE[chequeCs] : (STATUS_BADGE[txn.status] || STATUS_BADGE.pending);
                              const StIcon = st.icon;
                              const srcMod = SOURCE_MODULE_MAP[txn.source_module] || { label: 'Cash Flow', cls: 'bg-blue-50 text-blue-700 border-blue-200' };
                              const modeLabel = (txn.cash_type || '').toUpperCase() || null;
                              return (
                                <TableRow key={`txn-${txn.id}`} className="cursor-pointer hover:bg-slate-50/80 transition-colors" onClick={() => handleTxnClick(txn)}>
                                  <TableCell className="text-xs text-slate-400 tabular-nums">{(txnPage - 1) * TXN_PER_PAGE + idx + 1}</TableCell>
                                  <TableCell className="text-sm text-slate-700 whitespace-nowrap tabular-nums">{fmtDate(txn.date)}</TableCell>
                                  <TableCell className="hidden sm:table-cell">
                                    <Badge variant="outline" className={`text-[10px] font-medium ${srcMod.cls}`}>{srcMod.label}</Badge>
                                  </TableCell>
                                  <TableCell>
                                    <span className="text-sm font-medium text-slate-800 line-clamp-1" title={txn.particular}>{txn.particular || '—'}</span>
                                    {txn.plot_no && <span className="text-[10px] text-cyan-600 font-semibold block mt-0.5">Plot: {txn.plot_no}</span>}
                                    {txn.buyer_name && <span className="text-[10px] text-indigo-600 font-medium block mt-0.5">Buyer: {txn.buyer_name}</span>}
                                    {txn.booked_by && <span className="text-[10px] text-violet-600 font-medium block mt-0.5">Booked By: {txn.booked_by}</span>}
                                    {txn.created_by_name && <span className="text-[10px] text-slate-500 font-medium block mt-0.5">Entry By: {txn.created_by_name}</span>}
                                    {isRefund && <span className="text-[10px] text-orange-500 font-medium block mt-0.5">Refund / Adjustment</span>}
                                    {txn.cheque_no && <span className="text-[10px] text-blue-600 font-medium block mt-0.5">Cheque No: {txn.cheque_no}</span>}
                                    {txn.remarks && <span className="text-[10px] text-slate-400 line-clamp-1 mt-0.5 block" title={txn.remarks}>{txn.remarks}</span>}
                                  </TableCell>
                                  <TableCell className="hidden md:table-cell">
                                    {modeLabel ? (
                                      <Badge variant="outline" className={`text-[10px] font-medium ${MODE_COLORS[modeLabel] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>{modeLabel}</Badge>
                                    ) : <span className="text-xs text-slate-300">—</span>}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {debit > 0
                                      ? <span className="text-sm font-semibold text-red-600 tabular-nums">{isRefund ? '−' : ''}{fmt(debit)}</span>
                                      : <span className="text-xs text-slate-300">—</span>}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {credit > 0
                                      ? <span className="text-sm font-semibold text-emerald-700 tabular-nums">{fmt(credit)}</span>
                                      : <span className="text-xs text-slate-300">—</span>}
                                  </TableCell>
                                  <TableCell className="hidden sm:table-cell">
                                    <Badge variant="outline" className={`text-[10px] font-medium gap-1 ${st.cls}`}>
                                      <StIcon className="w-3 h-3" /> {st.label}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                      {txnPagination.totalPages > 1 && (
                        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t border-slate-100">
                          <p className="text-xs text-slate-400">
                            Showing {(txnPage - 1) * TXN_PER_PAGE + 1}–{Math.min(txnPage * TXN_PER_PAGE, txnPagination.totalItems)} of {txnPagination.totalItems}
                          </p>
                          <div className="flex items-center gap-1">
                            <Button variant="outline" size="icon" className="h-7 w-7 rounded-lg" disabled={txnPage <= 1 || txnLoading} onClick={() => fetchTransactions(txnPage - 1)}>
                              <ChevronLeft className="w-3.5 h-3.5" />
                            </Button>
                            {Array.from({ length: txnPagination.totalPages }, (_, i) => i + 1)
                              .filter(p => p === 1 || p === txnPagination.totalPages || Math.abs(p - txnPage) <= 1)
                              .reduce((acc, p, i, arr) => {
                                if (i > 0 && p - arr[i - 1] > 1) acc.push('...');
                                acc.push(p);
                                return acc;
                              }, [])
                              .map((p, i) =>
                                p === '...'
                                  ? <span key={`dots-${i}`} className="text-xs text-slate-400 px-1">…</span>
                                  : <Button key={p} variant={p === txnPage ? 'default' : 'outline'} size="icon" className="h-7 w-7 text-xs rounded-lg" onClick={() => fetchTransactions(p)} disabled={txnLoading}>{p}</Button>
                              )}
                            <Button variant="outline" size="icon" className="h-7 w-7 rounded-lg" disabled={txnPage >= txnPagination.totalPages || txnLoading} onClick={() => fetchTransactions(txnPage + 1)}>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Analytics info sidebar */}
            <div className="space-y-4">
            

              {/* Module Breakdown */}
              {kpi?.breakdown?.length > 0 && canSee('module_breakdown') && (
                <div className="relative rounded-xl border border-slate-200 bg-white overflow-hidden">
                  <div className="relative p-4">
                    <p className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider mb-3">Module Breakdown</p>
                    {kpiLoading ? (
                      <div className="space-y-3">
                        {[...Array(3)].map((_, i) => (
                          <div key={i}>
                            <div className="flex justify-between mb-1"><Skeleton className="h-3 w-24" /><Skeleton className="h-3 w-16" /></div>
                            <Skeleton className="h-1.5 w-full" />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {kpi.breakdown.map((mod) => {
                          const value = mod.credit > 0 ? mod.credit : mod.debit;
                          if (!value) return null;
                          const total = (kpi.totalRevenue || 0) + (kpi.totalExpense || 0);
                          const pct = total > 0 ? Math.round((value / total) * 100) : 0;
                          const isEarn = mod.credit > 0;
                          const colorMap = {
                            plot_payments: 'bg-emerald-400', expenses: 'bg-rose-400',
                            farmer_payments: 'bg-orange-400', commissions: 'bg-purple-400',
                            commission_payments: 'bg-violet-400', vendor_payments: 'bg-amber-400',
                            plot_registry_payments: 'bg-indigo-400', daybook_expense: 'bg-slate-400',
                            personal_ledger_debit: 'bg-pink-400',
                          };
                          return (
                            <div key={mod.module}>
                              <div className="flex items-center justify-between text-[11px] mb-1">
                                <span className="text-slate-600 capitalize">{mod.module.replace(/_/g, ' ')}</span>
                                <span className={`font-medium tabular-nums ${isEarn ? 'text-emerald-700' : 'text-red-600'}`}>
                                  {isEarn ? '+' : '-'}₹{fmt(value)}
                                </span>
                              </div>
                              <div className="w-full bg-slate-100 rounded-full h-1.5">
                                <div className={`h-1.5 rounded-full transition-all duration-500 ${colorMap[mod.module] || 'bg-slate-400'}`}
                                  style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
          </div>
        )}



      </div>

      {/* ═══ WhatsApp-style Chat FAB ═══ */}
      {canReadChat && (
        <>
          <button
            onClick={() => setChatOpen(prev => !prev)}
            className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-green-500 hover:bg-green-600 text-white shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center active:scale-95"
          >
            {chatOpen ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
            {!chatOpen && chatTotalUnread > 0 && (
              <span className="absolute -top-1 -right-1 min-w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center px-1">
                {chatTotalUnread > 99 ? '99+' : chatTotalUnread}
              </span>
            )}
          </button>

          {chatOpen && (
            <div className="fixed bottom-12 right-6 z-50 w-[calc(100vw-2rem)] sm:w-96 h-[70vh] max-h-140 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
              <div className="bg-green-600 text-white px-4 py-3 flex items-center justify-between shrink-0">
                {chatActive ? (
                  <div className="flex items-center gap-2 min-w-0">
                    <button onClick={() => { setChatActive(null); setChatMessages([]); }} className="p-1 hover:bg-green-700 rounded-lg transition-colors">
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div className="w-8 h-8 rounded-full bg-green-400 text-white flex items-center justify-center font-bold text-sm overflow-hidden shrink-0">
                      {chatActive.user_photo ? <img src={chatActive.user_photo} alt="" className="object-cover w-full h-full" /> : chatActive.user_name?.charAt(0)}
                    </div>
                    <span className="font-semibold text-sm truncate">{chatActive.user_name}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5" />
                    <span className="font-semibold text-sm">Internal Chat</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Link to="/chat" className="p-1.5 hover:bg-green-700 rounded-lg transition-colors" title="Open full chat">
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                  <button onClick={() => setChatOpen(false)} className="p-1.5 hover:bg-green-700 rounded-lg transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {chatActive ? (
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50/50" ref={chatContainerRef}>
                    {chatMessages.map(msg => {
                      const isMe = msg.sender_id === user?.id;
                      return (
                        <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                          {!isMe && (
                            <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-[10px] mr-1.5 shrink-0 mt-auto">
                              {msg.sender_photo ? <img src={msg.sender_photo} alt="" className="object-cover w-full h-full rounded-full" /> : msg.sender_name?.charAt(0)}
                            </div>
                          )}
                          <div className="max-w-[75%]">
                            <div className={`px-3 py-2 rounded-xl text-sm ${isMe ? 'bg-green-600 text-white rounded-br-sm' : 'bg-white border border-gray-100 text-gray-800 rounded-bl-sm shadow-sm'}`}>
                              {msg.message_text && <p className="leading-relaxed whitespace-pre-wrap wrap-break-word">{msg.message_text}</p>}
                              {msg.attachment_url && (
                                msg.attachment_url.match(/\.(jpeg|jpg|gif|png)$/) ? (
                                  <img src={msg.attachment_url} alt="attachment" className="mt-1.5 rounded-lg max-w-full h-auto max-h-40 object-contain" />
                                ) : (
                                  <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 mt-1 text-xs underline opacity-80 hover:opacity-100">
                                    <Paperclip className="w-3 h-3" /> Document
                                  </a>
                                )
                              )}
                            </div>
                            <span className={`text-[10px] text-gray-400 mt-0.5 px-1 block ${isMe ? 'text-right' : ''}`}>
                              {format(new Date(msg.created_at), 'p')}{isMe ? ` • ${msg.is_read ? 'Read' : 'Sent'}` : ''}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={chatEndRef} />
                  </div>
                  <div className="p-2 bg-white border-t border-gray-100 shrink-0">
                    {chatAttachment && (
                      <div className="mb-1.5 px-2 py-1 bg-green-50 border border-green-100 rounded-lg flex items-center justify-between text-xs">
                        <span className="truncate text-green-700 flex items-center gap-1"><Paperclip className="w-3 h-3 shrink-0" />{chatAttachment.name}</span>
                        <button onClick={() => setChatAttachment(null)} className="text-green-400 hover:text-green-600"><X className="w-3 h-3" /></button>
                      </div>
                    )}
                    <form onSubmit={chatSend} className="flex items-center gap-1.5">
                      <input type="file" ref={chatFileRef} className="hidden" onChange={chatHandleFile} />
                      <button type="button" onClick={() => chatFileRef.current?.click()} disabled={chatUploading}
                        className={`p-2 rounded-lg transition-colors ${chatUploading ? 'text-gray-300 animate-pulse' : 'text-gray-400 hover:text-green-600 hover:bg-green-50'}`}>
                        <Paperclip className="w-4 h-4" />
                      </button>
                      <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Type a message..."
                        className="flex-1 bg-gray-50 border-transparent focus:bg-white focus:border-green-300 focus:ring-1 focus:ring-green-100 rounded-lg px-3 py-2 text-sm outline-none transition-all" />
                      <button type="submit" disabled={(!chatInput.trim() && !chatAttachment) || chatUploading}
                        className="p-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 active:scale-95">
                        <Send className="w-4 h-4" />
                      </button>
                    </form>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="p-3 border-b border-gray-100 shrink-0">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
                      <input type="text" placeholder="Search users..." value={chatSearch} onChange={e => setChatSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-green-300 focus:border-green-300 transition-all" />
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {chatLoading ? (
                      <div className="flex items-center justify-center py-10 text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
                    ) : chatSearch ? (
                      <div className="p-2">
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-2 mb-1">Users</p>
                        {chatFilteredUsers.length === 0 && <p className="text-xs text-gray-400 text-center py-4">No users found</p>}
                        {chatFilteredUsers.map(u => (
                          <div key={u.id} onClick={() => { chatStartConv(u.id); setChatSearch(''); }}
                            className="flex items-center gap-2.5 p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors">
                            <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm overflow-hidden shrink-0">
                              {u.photo ? <img src={u.photo} alt={u.name} className="object-cover w-full h-full" /> : u.name.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">{u.name}</p>
                              <p className="text-[10px] text-gray-400">{u.role}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-2">
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-2 mb-1">Recent</p>
                        {chatConversations.length === 0 && <p className="text-xs text-gray-400 text-center py-4">No conversations yet</p>}
                        {chatConversations.map(conv => (
                          <div key={conv.conversation_id} onClick={() => setChatActive({ id: conv.conversation_id, user_name: conv.user_name, user_photo: conv.user_photo, user_id: conv.user_id })}
                            className="flex items-center gap-2.5 p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors">
                            <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm overflow-hidden shrink-0 relative">
                              {conv.user_photo ? <img src={conv.user_photo} alt={conv.user_name} className="object-cover w-full h-full" /> : conv.user_name?.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-baseline">
                                <p className="text-sm font-medium text-gray-800 truncate">{conv.user_name}</p>
                                {conv.last_message_time && <span className="text-[10px] text-gray-400 shrink-0 ml-1">{format(new Date(conv.last_message_time), 'p')}</span>}
                              </div>
                              <p className="text-xs text-gray-500 truncate">{conv.last_message || 'No messages yet'}</p>
                            </div>
                            {conv.unread_count > 0 && (
                              <span className="min-w-5 h-5 bg-green-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 shrink-0">
                                {conv.unread_count}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Verify Data Dialog ── */}
      <Dialog open={verifyOpen} onOpenChange={setVerifyOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              Data Consistency Check
            </DialogTitle>
          </DialogHeader>
          {verifyLoading ? (
            <div className="flex items-center justify-center py-8 text-sm text-slate-500 gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Verifying data across modules...
            </div>
          ) : verifyData ? (
            <div className="space-y-2">
              {verifyData.map((m) => (
                <div key={m.module} className={`rounded-lg border p-3 ${m.match ? 'border-emerald-200 bg-emerald-50/40' : 'border-red-200 bg-red-50/40'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-800">{m.module}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${m.match ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {m.match ? '✓ Match' : '✗ Mismatch'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2 text-xs text-slate-600">
                    <div>
                      <span className="text-slate-400">Source:</span> ₹{fmt(m.sourceTotal)} ({m.sourceCount} rows)
                    </div>
                    <div>
                      <span className="text-slate-400">Cash Flow:</span> ₹{fmt(m.cfeTotal)} ({m.cfeCount} rows)
                    </div>
                  </div>
                  {!m.match && (
                    <div className="mt-1 text-xs text-red-600 font-medium">
                      Diff: ₹{fmt(Math.abs(m.diff))} | Rows: {Math.abs(m.countDiff)}
                    </div>
                  )}
                  {m.daybookTotal !== undefined && (
                    <div className="mt-1 text-xs text-slate-400">
                      Day Book: ₹{fmt(m.daybookTotal)} ({m.daybookCount} rows)
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-red-500 py-4 text-center">Failed to load verification data.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;
