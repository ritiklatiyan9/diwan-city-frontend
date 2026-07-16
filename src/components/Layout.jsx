import { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import eventBus from '../utils/eventBus';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from './ui/collapsible';
import {
  LogOut, Settings, Home, Users, MapPin,
  Building2, UserCog, ChevronRight, ChevronDown, ChevronLeft, PanelLeftClose, PanelLeft,
  ChevronsUpDown, Tractor, Landmark, Wallet, Banknote, LayoutGrid, CreditCard,
  ClipboardList, BookOpen, ShieldCheck, Shield, ListChecks,
  UserPlus, Tags, Sheet, FilePlus2, FolderOpen, CalendarClock, MessageSquare, KeyRound, Lock,
  Plus, BarChart3, Search,
  Store, Menu, X, Package,
  Bell, Clock, CheckCircle2, XCircle, FileEdit, Send, Inbox, Loader2,
  LayoutDashboard,
  // Upgraded icons
  Sprout, HandCoins, Briefcase, Library, UsersRound, ShoppingBag, NotebookPen,
  Sparkles, SearchX,
  Map as MapIcon,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Separator } from './ui/separator';

// ── Notification helpers ────────────────────────────────────────────
const NOTIF_APPROVAL_MODULE = {
  farmer_payment:     { label: 'Farmer Payment',  cls: 'bg-green-50 text-green-700 border-green-200' },
  plot_commission:    { label: 'Plot Commission',  cls: 'bg-purple-50 text-purple-700 border-purple-200' },
  cash_flow_entry:    { label: 'Personal Ledger',  cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  firm_transaction:   { label: 'Firm Transaction', cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  plot_payment:       { label: 'Plot Payment',     cls: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  expense:            { label: 'Expense',          cls: 'bg-red-50 text-red-700 border-red-200' },
  daybook_farmer:     { label: 'Farmer Payment',   cls: 'bg-green-50 text-green-700 border-green-200' },
  daybook_commission: { label: 'Plot Commission',  cls: 'bg-purple-50 text-purple-700 border-purple-200' },
  daybook_expense:    { label: 'Expense',          cls: 'bg-red-50 text-red-700 border-red-200' },
  imprest:            { label: 'Imprest Request',  cls: 'bg-violet-50 text-violet-700 border-violet-200' },
};

const NOTIF_EDIT_MODULE_LABELS = {
  farmer: 'Farmer', farmer_payment: 'Farmer Payment', plot: 'Plot',
  plot_payment: 'Plot Payment', daybook: 'Day Book',
  daybook_expense: 'Expense', daybook_farmer_payment: 'Farmer Payment',
  daybook_commission: 'Commission', daybook_cashflow: 'Personal Ledger',
  daybook_firm_transaction: 'Firm Transaction', daybook_plot_payment: 'Plot Payment',
};

const NOTIF_STATUS_BADGE = {
  pending:  { label: 'Pending',  icon: Clock,        cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  approved: { label: 'Approved', icon: CheckCircle2,  cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  rejected: { label: 'Rejected', icon: XCircle,       cls: 'bg-red-50 text-red-700 border-red-200' },
};

const notifFmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const notifFmt = (v) => (parseFloat(v) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

// ── Polished brand logo ─────────────────────────────────────────────
const BrandLogo = ({ compact = false }) => (
  <div className="flex items-center gap-2.5 pl-1 min-w-0">
    <div className="relative w-8 h-8 rounded-xl bg-linear-to-br from-indigo-600 via-indigo-500 to-violet-500 flex items-center justify-center shadow-sm shadow-indigo-500/25 ring-1 ring-inset ring-white/25 shrink-0">
      <Building2 className="w-4 h-4 text-white drop-shadow-sm" />
      <Sparkles className="w-2 h-2 text-white/80 absolute top-1 right-1" />
      <span className="pointer-events-none absolute inset-0 rounded-xl bg-linear-to-t from-transparent to-white/15" />
    </div>
    {!compact && (
      <div className="flex flex-col leading-tight min-w-0">
        <span className="text-[13px] font-semibold text-slate-900 tracking-tight truncate">Account Software</span>
        <span className="text-[9px] font-medium text-slate-400 tracking-[0.14em] uppercase truncate">Management Suite</span>
      </div>
    )}
  </div>
);

// ── Stable, memoized primary nav link (prevents remount on every keystroke) ──
const NavLinkButton = memo(function NavLinkButton({ item, collapsed, isActive, iconTone, onNavigate }) {
  const Icon = item.icon;
  return (
    <button
      onClick={() => onNavigate(item.path)}
      title={collapsed ? item.label : undefined}
      className={`group relative w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors duration-150 ${isActive
        ? 'bg-indigo-50/70 text-indigo-700 shadow-sm shadow-indigo-100/60'
        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
        }`}
    >
      {isActive && !collapsed && (
        <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r-full bg-linear-to-b from-indigo-400 to-violet-500" />
      )}
      <span className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${isActive ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200' : iconTone}`}>
        <Icon className="w-3.5 h-3.5" />
      </span>
      {!collapsed && <span className="truncate">{item.label}</span>}
    </button>
  );
});

// ── Animated tree / branch group for collapsible sub-items ──────────
// Renders a vertical guide line that spans only first→last item centers,
// with an animated indigo highlight that slides to the active child and
// L-shaped branch connectors that stop cleanly inside the item row.
const TreeGroup = memo(function TreeGroup({ items, getIconTone }) {
  const location = useLocation();
  const navigate = useNavigate();
  const containerRef = useRef(null);
  // [topPx, bottomPx, highlightPx] — top/bottom clip the base guide so it
  // does not overshoot below the last item; highlight tracks the active row.
  const [bounds, setBounds] = useState({ top: 0, bottom: 0, highlight: 0 });

  const activeIdx = items.findIndex((it) => {
    const p = (it.path || '').split('?')[0];
    return location.pathname === p && !(it.path || '').includes('?');
  });

  useEffect(() => {
    if (!containerRef.current) return;
    const rows = containerRef.current.querySelectorAll('[data-tree-item]');
    if (!rows.length) { setBounds({ top: 0, bottom: 0, highlight: 0 }); return; }
    const parentRect = containerRef.current.getBoundingClientRect();
    const firstRect = rows[0].getBoundingClientRect();
    const lastRect = rows[rows.length - 1].getBoundingClientRect();
    const top = firstRect.top - parentRect.top + firstRect.height / 2;
    const bottom = lastRect.top - parentRect.top + lastRect.height / 2;
    let highlight = 0;
    if (activeIdx >= 0 && rows[activeIdx]) {
      const rect = rows[activeIdx].getBoundingClientRect();
      highlight = rect.top - parentRect.top + rect.height / 2 - top;
    }
    setBounds({ top, bottom, highlight: Math.max(0, highlight) });
  }, [activeIdx, items.length]);

  const guideHeight = Math.max(0, bounds.bottom - bounds.top);

  return (
    <div ref={containerRef} className="relative ml-4.5 pl-4 py-0.5">
      {/* Base vertical guide — clipped to first→last item centers */}
      <span
        className="pointer-events-none absolute left-0 w-px bg-slate-200/80 rounded-full"
        style={{ top: `${bounds.top}px`, height: `${guideHeight}px` }}
      />
      {/* Animated highlight segment */}
      <span
        className="pointer-events-none absolute left-0 w-0.5 bg-linear-to-b from-indigo-400 via-indigo-500 to-violet-500 rounded-full transition-[height] duration-300 ease-out will-change-[height]"
        style={{
          top: `${bounds.top}px`,
          height: `${bounds.highlight}px`,
          opacity: bounds.highlight > 0 ? 1 : 0,
        }}
      />
      <div className="space-y-0.5">
        {items.map((item) => {
          const Icon = item.icon;
          const pathOnly = (item.path || '').split('?')[0];
          const isActive = location.pathname === pathOnly && !(item.path || '').includes('?');
          const iconTone = getIconTone ? getIconTone(pathOnly) : 'bg-slate-100 text-slate-500';
          return (
            <button
              key={item.path}
              data-tree-item
              onClick={() => navigate(item.path)}
              className={`group relative w-full flex items-center gap-2.5 pr-3 py-1.5 rounded-md text-[12px] font-medium transition-colors duration-150 ${
                isActive
                  ? 'text-indigo-700 bg-indigo-50/70'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {/* L-shaped branch connector — runs from guide line to icon edge */}
              <span
                className={`pointer-events-none absolute top-1/2 -translate-y-1/2 h-px transition-colors duration-200 -left-4 ${
                  isActive
                    ? 'bg-linear-to-r from-indigo-400 to-indigo-300 w-4'
                    : 'bg-slate-200 w-3'
                }`}
              />
              {/* Active dot — centered on the guide line (line is at button-left:-16px) */}
              {isActive && (
                <span className="pointer-events-none absolute -left-4 -translate-x-1/2 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-indigo-500 ring-2 ring-white shadow-sm shadow-indigo-500/40" />
              )}
              <span className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${
                isActive ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200' : iconTone
              }`}>
                <Icon className="w-3 h-3" />
              </span>
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
});

const Layout = () => {
  // Desktop sidebar collapse (persisted). The mobile drawer is always expanded.
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebarCollapsed') === '1'; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem('sidebarCollapsed', collapsed ? '1' : '0'); } catch { /* ignore */ }
  }, [collapsed]);
  // Which sidebar parent groups are expanded (keyed by group.key).
  const [openGroups, setOpenGroups] = useState({});
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [siteTransition, setSiteTransition] = useState(false);
  const [search, setSearch] = useState('');
  const [searchExpanded, setSearchExpanded] = useState(false);
  const prevSiteRef = useRef(null);
  const { user, logout, sites, currentSite, setCurrentSite, isAdmin, hasPermission } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Close mobile menu on navigation
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Brief fade transition when site changes
  useEffect(() => {
    if (prevSiteRef.current && currentSite && prevSiteRef.current !== currentSite.id) {
      setSiteTransition(true);
      const timer = setTimeout(() => setSiteTransition(false), 150);
      return () => clearTimeout(timer);
    }
    prevSiteRef.current = currentSite?.id ?? null;
  }, [currentSite]);

  // Plot Commission collapsible state
  const commissionPaths = ['/commissions', '/plot-commission', '/plot-commission/search'];
  const isCommissionActive = commissionPaths.some(p => location.pathname.startsWith(p));
  const [commissionOpen, setCommissionOpen] = useState(isCommissionActive);

  // User Management collapsible state
  const userMgmtPaths = ['/clients', '/register-user', '/user-categories'];
  const isUserMgmtActive = userMgmtPaths.some(p => location.pathname.startsWith(p));
  const [userMgmtOpen, setUserMgmtOpen] = useState(isUserMgmtActive);

  // Vendor Management collapsible state
  const vendorPaths = ['/vendors'];
  const isVendorActive = vendorPaths.some(p => location.pathname.startsWith(p));
  const [vendorOpen, setVendorOpen] = useState(isVendorActive);

  // Expenses collapsible state
  const expensePaths = ['/expenses', '/expense-categories', '/expense-approvals'];
  const isExpenseActive = expensePaths.some(p => location.pathname.startsWith(p));
  const [expenseOpen, setExpenseOpen] = useState(isExpenseActive);

  // Plot Payments collapsible state
  const plotPayPaths = ['/plot-payments', '/payment-management', '/payment-analytics'];
  const isPlotPayActive = plotPayPaths.some(p => location.pathname.startsWith(p));
  const [plotPayOpen, setPlotPayOpen] = useState(isPlotPayActive);

  // Day Book collapsible state
  const dayBookPaths = ['/daybook', '/daybook/cash', '/daybook/bank'];
  const isDayBookActive = dayBookPaths.some(p => location.pathname.startsWith(p));
  const [dayBookOpen, setDayBookOpen] = useState(isDayBookActive);

  // Native Excel collapsible state
  const excelPaths = ['/excel'];
  const isExcelActive = excelPaths.some(p => location.pathname.startsWith(p));
  const [excelOpen, setExcelOpen] = useState(isExcelActive);

  useEffect(() => {
    if (isCommissionActive) setCommissionOpen(true);
  }, [isCommissionActive]);

  useEffect(() => {
    if (isUserMgmtActive) setUserMgmtOpen(true);
  }, [isUserMgmtActive]);

  useEffect(() => {
    if (isVendorActive) setVendorOpen(true);
  }, [isVendorActive]);

  useEffect(() => {
    if (isExpenseActive) setExpenseOpen(true);
  }, [isExpenseActive]);

  useEffect(() => {
    if (isPlotPayActive) setPlotPayOpen(true);
  }, [isPlotPayActive]);

  useEffect(() => {
    if (isDayBookActive) setDayBookOpen(true);
  }, [isDayBookActive]);

  useEffect(() => {
    if (isExcelActive) setExcelOpen(true);
  }, [isExcelActive]);

  // Navigation items (User Management handled separately as collapsible)
  const navItems = useMemo(() => {
    return [
      { path: '/dashboard', label: 'Dashboard', icon: Home, module: 'dashboard' },
      { path: '/farmers', label: 'Farmer Payments', icon: Sprout, module: 'farmers' },
      // Plot Commission is now a collapsible group — handled separately
      { path: '/daybook', label: 'Day Book', icon: BookOpen, module: 'daybook' },
      { path: '/cashflow', label: 'Personal Ledgers', icon: NotebookPen, module: 'cashflow' },
      { path: '/firm-transactions', label: 'Firm Transactions', icon: Briefcase, module: 'firm_transactions' },
      // Plot Payments is now a collapsible group — handled separately
      { path: '/plot-registry', label: 'Plot Registry', icon: Library, module: 'plot_registry' },
      // Expenses is now a collapsible group — handled separately
      { path: '/imprest', label: 'Imprest', icon: Wallet, module: 'imprest' },
    ].filter(item => hasPermission(item.module, 'read'));
  }, [hasPermission]);

  const adminNavItems = [
    { path: '/sites', label: 'Sites', icon: MapPin },
    { path: '/sub-admins', label: 'Admin Management', icon: UserCog },
    { path: '/user-id-management', label: 'User ID Management', icon: KeyRound },
    { path: '/pending-approvals', label: 'Approvals', icon: CheckCircle2 },
    { path: '/approval-manager', label: 'Approval Manager', icon: ShieldCheck },
    { path: '/edit-approvals', label: 'Edit Approvals', icon: ShieldCheck },
    { path: '/imprest-management', label: 'Imprest Management', icon: Banknote },
    { path: '/permissions', label: 'Permissions', icon: Shield },
    { path: '/dashboard-management', label: 'Dashboard Management', icon: LayoutDashboard },
  ];

  // Expense Approvals child items (within Expenses group, visible to those with permission)
  const expenseChildren = [
    { path: '/expenses', label: 'All Expenses', icon: CreditCard },
    { path: '/expense-categories', label: 'Expense Categories', icon: Tags },
    ...(isAdmin || hasPermission('expense_approval', 'read') ? [{ path: '/expense-approvals', label: 'Expense Approvals', icon: ListChecks }] : []),
  ];

  // User Management child items
  const userMgmtChildren = [
    { path: '/clients', label: 'All Members', icon: UsersRound },
    { path: '/register-user', label: 'Register User', icon: UserPlus },
    ...(isAdmin ? [{ path: '/user-categories', label: 'User Categories', icon: Tags }] : []),
  ];

  // Vendor Management child items
  const vendorChildren = [
    { path: '/vendors', label: 'Commitments', icon: ShoppingBag },
    { path: '/vendors/inventory', label: 'Inventory', icon: Package },
    { path: '/vendors/categories', label: 'Categories', icon: Tags },
  ];

  // Plot Commission child items
  const commissionChildren = [
    { path: '/plot-commission', label: 'All Commissions', icon: HandCoins },
    { path: '/plot-commission/search', label: ' Add Payment', icon: Search },
  ];

  // Plot Payments child items
  const plotPayChildren = [
    { path: '/plot-payments', label: 'Plot Payments', icon: LayoutGrid },
    { path: '/colony-map', label: 'Colony Map', icon: MapIcon },
    { path: '/plot-payments?action=create-plot', label: 'Create Plot', icon: Plus },
    { path: '/payment-management', label: 'Payment Tracker', icon: CalendarClock },
    { path: '/payment-analytics', label: 'Payment Analytics', icon: BarChart3 },
  ];

  // Day Book child items
  const dayBookChildren = [
    { path: '/daybook', label: 'Main Day Book', icon: BookOpen },
    { path: '/daybook/cash', label: 'Cash Day Book', icon: Wallet },
    { path: '/daybook/bank', label: 'Bank Day Book', icon: Banknote },
  ];

  // Native Excel child items
  const excelChildren = [
    { path: '/excel/new', label: 'Create New', icon: FilePlus2 },
    { path: '/excel/files', label: 'Saved Files', icon: FolderOpen },
  ];

  const canReadExcel = hasPermission('excel', 'read');
  const canReadChat = hasPermission('chat', 'read');

  // ── Unified module list for the header navigation ──────────────────
  // Each group is either a direct link (has `path`) or a dropdown of
  // child modules (has `children`). Filtered by the user's permissions.
  const menuGroups = [
    hasPermission('dashboard', 'read')         && { key: 'dashboard', label: 'Dashboard',         icon: Home,         path: '/dashboard' },
    hasPermission('clients', 'read')           && { key: 'users',     label: 'User Management',    icon: UsersRound,   base: '/clients',         children: userMgmtChildren },
    hasPermission('commissions', 'read')       && { key: 'commission',label: 'Plot Commission',    icon: HandCoins,    base: '/plot-commission', children: commissionChildren },
    hasPermission('plot_payments', 'read')     && { key: 'plotpay',   label: 'Plot Payments',      icon: LayoutGrid,   base: '/plot-payments',   children: plotPayChildren },
    hasPermission('expenses', 'read')          && { key: 'expenses',  label: 'Expenses',           icon: CreditCard,   base: '/expenses',        children: expenseChildren },
    hasPermission('daybook', 'read')           && { key: 'daybook',   label: 'Day Book',           icon: BookOpen,     base: '/daybook',         children: dayBookChildren },
    isAdmin                                    && { key: 'admin',     label: 'Administration',     icon: Shield,       base: '__admin__',        children: adminNavItems },
    hasPermission('vendors', 'read')           && { key: 'vendors',   label: 'Vendor Management',  icon: ShoppingBag,  base: '/vendors',         children: vendorChildren },
    hasPermission('farmers', 'read')           && { key: 'farmers',   label: 'Farmer Payments',    icon: Sprout,       path: '/farmers' },
    hasPermission('cashflow', 'read')          && { key: 'cashflow',  label: 'Personal Ledgers',   icon: NotebookPen,  path: '/cashflow' },
    hasPermission('firm_transactions', 'read') && { key: 'firm',      label: 'Firm Transactions',  icon: Briefcase,    path: '/firm-transactions' },
    hasPermission('plot_registry', 'read')     && { key: 'registry',  label: 'Plot Registry',      icon: Library,      path: '/plot-registry' },
    hasPermission('imprest', 'read')           && { key: 'imprest',   label: 'Imprest',            icon: Wallet,       path: '/imprest' },
    canReadExcel                               && { key: 'excel',     label: 'Native Excel',       icon: Sheet,        base: '/excel',           children: excelChildren },
    canReadChat                                && { key: 'chat',      label: 'Internal Chat',      icon: MessageSquare,path: '/chat' },
  ].filter(Boolean);

  const isGroupActive = (group) => {
    if (group.path) {
      const p = group.path.split('?')[0];
      return location.pathname === p;
    }
    return (group.children || []).some(c => {
      const p = (c.path || '').split('?')[0];
      return location.pathname === p || location.pathname.startsWith(p + '/');
    });
  };

  // Auto-expand the sidebar parent group that owns the current route.
  useEffect(() => {
    const active = menuGroups.find((g) => g.children && isGroupActive(g));
    if (active) setOpenGroups((prev) => (prev[active.key] ? prev : { ...prev, [active.key]: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Active top-level group — used for the desktop top-bar context label.
  const activeGroup = menuGroups.find((g) => isGroupActive(g));
  const ActiveIcon = activeGroup?.icon;

  // ── Notifications / Approvals ─────────────────────────────────────
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifTab, setNotifTab] = useState(isAdmin ? 'received' : 'sent');
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifReceived, setNotifReceived] = useState([]);
  const [notifSent, setNotifSent] = useState([]);
  const [notifAppCounts, setNotifAppCounts] = useState({ total: 0 });
  const [notifEditCounts, setNotifEditCounts] = useState({ pending: 0 });
  const [notifActionId, setNotifActionId] = useState(null); // id being approved/rejected

  // Map remapped daybook sources back to 'daybook' for the API
  const getApiSource = (source) => {
    if (!source) return source;
    if (source.startsWith('daybook_') || source === 'daybook') return 'daybook';
    return source;
  };

  const handleNotifApprove = async (entry) => {
    const key = `${entry.source || entry._type}-${entry.id}`;
    setNotifActionId(key);
    try {
      if (entry._type === 'imprest') {
        await api.put(`/imprest/expense-requests/${entry.id}/approve`);
      } else {
        await api.put(`/approvals/${entry.id}/approve?source=${getApiSource(entry.source)}`);
      }
      eventBus.emit('data-mutated');
      await fetchNotifApprovals();
    } catch (err) {
      console.error('Approve failed', err);
    } finally {
      setNotifActionId(null);
    }
  };

  const handleNotifReject = async (entry) => {
    const key = `${entry.source || entry._type}-${entry.id}`;
    setNotifActionId(key);
    try {
      if (entry._type === 'imprest') {
        await api.put(`/imprest/expense-requests/${entry.id}/reject`, { review_remark: '' });
      } else {
        await api.put(`/approvals/${entry.id}/reject?source=${getApiSource(entry.source)}`);
      }
      eventBus.emit('data-mutated');
      await fetchNotifApprovals();
    } catch (err) {
      console.error('Reject failed', err);
    } finally {
      setNotifActionId(null);
    }
  };

  const fetchNotifApprovals = useCallback(async () => {
    if (!currentSite?.id) return;
    setNotifLoading(true);
    try {
      if (isAdmin) {
        const [pendingRes, countsRes, editRes, editCountsRes, imprestRes] = await Promise.allSettled([
          api.get(`/approvals/pending?site_id=${currentSite.id}`),
          api.get(`/approvals/counts?site_id=${currentSite.id}`),
          api.get(`/edit-requests/my-requests?site_id=${currentSite.id}`),
          api.get(`/edit-requests/counts?site_id=${currentSite.id}`),
          api.get(`/imprest/expense-requests?site_id=${currentSite.id}`),
        ]);
        const siteId = currentSite.id;

        // Regular approvals (daybook, expenses, etc.)
        const regularApprovals = pendingRes.status === 'fulfilled'
          ? (pendingRes.value.data.entries || []).slice(0, 20)
          : [];

        // Pending imprest requests from sub-admins → Received tab
        const pendingImprests = imprestRes.status === 'fulfilled'
          ? (imprestRes.value.data.requests || [])
              .filter(r => String(r.site_id) === String(siteId) && (r.status || '').toUpperCase() === 'PENDING')
              .map(r => ({
                id: r.id,
                source: 'imprest',
                _type: 'imprest',
                entry_label: `Imprest Request — ₹${Number(r.amount).toLocaleString('en-IN')}${r.reason ? ': ' + r.reason : ''}`,
                date: r.created_at,
                created_by_name: r.sub_admin_name || null,
                amount: r.amount,
              }))
          : [];

        const allReceived = [...regularApprovals, ...pendingImprests]
          .sort((a, b) => new Date(b.date || b.created_at) - new Date(a.date || a.created_at))
          .slice(0, 30);
        setNotifReceived(allReceived);

        if (countsRes.status === 'fulfilled') {
          setNotifAppCounts(countsRes.value.data || { total: 0 });
        }

        // Admin's Sent tab = their own edit requests only
        const edits = editRes.status === 'fulfilled'
          ? (editRes.value.data.requests || [])
              .filter(r => String(r.site_id) === String(siteId))
              .map(r => ({ ...r, _type: 'edit' }))
          : [];
        setNotifSent(edits);

        const ec = editCountsRes.status === 'fulfilled'
          ? (editCountsRes.value.data || { pending: 0 })
          : { pending: 0 };
        setNotifEditCounts(ec);

      } else {
        const [editRes, imprestReqRes, allocRes, assignedRes] = await Promise.allSettled([
          api.get(`/edit-requests/my-requests?site_id=${currentSite.id}`),
          api.get(`/imprest/expense-requests?site_id=${currentSite.id}`),
          api.get(`/imprest/pending-receipts?site_id=${currentSite.id}`),
          // Pending approvals explicitly delegated to this sub-admin for the current site.
          api.get(`/approvals/pending?site_id=${currentSite.id}&assigned_admin_id=${user.id}`),
        ]);
        const siteId = currentSite.id;

        const edits = editRes.status === 'fulfilled'
          ? (editRes.value.data.requests || [])
              .filter(r => String(r.site_id) === String(siteId))
              .map(r => ({ ...r, _type: 'edit' }))
          : [];

        const imprests = imprestReqRes.status === 'fulfilled'
          ? (imprestReqRes.value.data.requests || [])
              .filter(r => String(r.site_id) === String(siteId))
              .map(r => ({ ...r, _type: 'imprest', status: (r.status || '').toLowerCase() }))
          : [];

        const merged = [...edits, ...imprests]
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .slice(0, 20);
        setNotifSent(merged);

        // Sub-admin Received = imprest allocations pending confirmation + approvals delegated to me.
        const allocs = allocRes.status === 'fulfilled'
          ? (allocRes.value.data.allocations || [])
              .filter(r => String(r.site_id) === String(siteId))
              .map(r => ({ ...r, _type: 'allocation' }))
          : [];

        const assignedApprovals = assignedRes.status === 'fulfilled'
          ? (assignedRes.value.data.entries || []).slice(0, 30)
          : [];

        const received = [...assignedApprovals, ...allocs]
          .sort((a, b) => new Date(b.date || b.created_at) - new Date(a.date || a.created_at))
          .slice(0, 40);
        setNotifReceived(received);

        const impPending = imprests.filter(r => r.status === 'pending').length;
        const editPending = edits.filter(r => r.status === 'pending').length;
        setNotifEditCounts({ pending: editPending + impPending + assignedApprovals.length });
      }
    } catch (err) {
      console.error('fetchNotifApprovals failed:', err);
    } finally {
      setNotifLoading(false);
    }
  }, [currentSite?.id, isAdmin, user?.id]);

  useEffect(() => {
    if (currentSite?.id) fetchNotifApprovals();
  }, [currentSite?.id, fetchNotifApprovals]);

  useEffect(() => {
    if (!currentSite?.id) return;
    const refresh = () => fetchNotifApprovals();
    eventBus.on('data-mutated', refresh);
    return () => eventBus.off('data-mutated', refresh);
  }, [currentSite?.id, fetchNotifApprovals]);

  // Close modal on Escape key
  useEffect(() => {
    if (!notifOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') setNotifOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [notifOpen]);

  const imprestPendingCount = notifReceived.filter(r => r._type === 'imprest').length;
  const notifBadgeCount = isAdmin
    ? (parseInt(notifAppCounts.total) || 0) + imprestPendingCount
    : (parseInt(notifEditCounts.pending) || 0) + notifReceived.length;



  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleSiteChange = (siteId) => {
    if (siteId === '__add_site__') {
      navigate('/sites');
      return;
    }
    const site = sites.find(s => String(s.id) === siteId);
    if (site) setCurrentSite(site);
  };

  const getIconTone = (path = '') => {
    if (path.startsWith('/dashboard')) return 'bg-blue-50 text-blue-600';
    if (path.startsWith('/clients') || path.startsWith('/register-user') || path.startsWith('/user-categories')) return 'bg-indigo-50 text-indigo-600';
    if (path.startsWith('/vendors')) return 'bg-orange-50 text-orange-600';
    if (path.startsWith('/farmers')) return 'bg-emerald-50 text-emerald-600';
    if (path.startsWith('/plot-commission') || path.startsWith('/commissions')) return 'bg-amber-50 text-amber-700';
    if (path.startsWith('/daybook')) return 'bg-teal-50 text-teal-700';
    if (path.startsWith('/cashflow')) return 'bg-cyan-50 text-cyan-700';
    if (path.startsWith('/firm-transactions')) return 'bg-sky-50 text-sky-700';
    if (path.startsWith('/plot-payments') || path.startsWith('/payment-management') || path.startsWith('/payment-analytics')) return 'bg-violet-50 text-violet-700';
    if (path.startsWith('/plot-registry')) return 'bg-fuchsia-50 text-fuchsia-700';
    if (path.startsWith('/expenses') || path.startsWith('/expense-categories') || path.startsWith('/expense-approvals')) return 'bg-rose-50 text-rose-700';
    if (path.startsWith('/imprest') || path.startsWith('/imprest-management')) return 'bg-lime-50 text-lime-700';
    if (path.startsWith('/excel')) return 'bg-green-50 text-green-700';
    if (path.startsWith('/chat')) return 'bg-purple-50 text-purple-700';
    if (path.startsWith('/settings')) return 'bg-slate-100 text-slate-700';
    if (path.startsWith('/sites') || path.startsWith('/sub-admins') || path.startsWith('/user-id-management') || path.startsWith('/permissions') || path.startsWith('/edit-approvals') || path.startsWith('/approval-manager') || path.startsWith('/dashboard-management')) return 'bg-red-50 text-red-700';
    return 'bg-slate-100 text-slate-600';
  };

  // Forwards to the module-level memoized button so it doesn't remount on every render
  const NavLink = useCallback(({ item }) => {
    const pathOnly = item.path.split('?')[0];
    const isActive = location.pathname === pathOnly && !item.path.includes('?');
    return (
      <NavLinkButton
        item={item}
        collapsed={false}
        isActive={isActive}
        iconTone={getIconTone(pathOnly)}
        onNavigate={navigate}
      />
    );
  }, [location.pathname, navigate]);

  const ChildNavLink = ({ item }) => {
    const Icon = item.icon;
    const pathOnly = item.path.split('?')[0];
    const isActive = location.pathname === pathOnly && !item.path.includes('?');
    const iconTone = getIconTone(pathOnly);
    return (
      <button
        onClick={() => navigate(item.path)}
        className={`w-full flex items-center gap-2.5 pl-9 pr-3 py-1.5 rounded-md text-[12px] font-medium transition-colors ${isActive
          ? 'bg-slate-100 text-slate-900'
          : 'text-slate-400 hover:text-slate-700 hover:bg-slate-50'
          }`}
      >
        <span className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${iconTone}`}>
          <Icon className="w-3 h-3" />
        </span>
        <span>{item.label}</span>
      </button>
    );
  };

  const hasClientsPermission = hasPermission('clients', 'read');

  // ── Sidebar search: flatten all items and filter by label ─────────
  const searchQ = search.trim().toLowerCase();
  const searchActive = searchQ.length > 0;
  const flatSearchItems = useMemo(() => {
    const list = [];
    navItems.forEach(i => list.push({ ...i }));
    if (hasClientsPermission) userMgmtChildren.forEach(i => list.push({ ...i, group: 'User Management' }));
    if (hasPermission('vendors', 'read')) vendorChildren.forEach(i => list.push({ ...i, group: 'Vendor Management' }));
    if (hasPermission('commissions', 'read')) commissionChildren.forEach(i => list.push({ ...i, group: 'Plot Commission' }));
    if (hasPermission('daybook', 'read')) dayBookChildren.forEach(i => list.push({ ...i, group: 'Day Book' }));
    if (hasPermission('plot_payments', 'read')) plotPayChildren.forEach(i => list.push({ ...i, group: 'Plot Payments' }));
    if (hasPermission('expenses', 'read')) expenseChildren.forEach(i => list.push({ ...i, group: 'Expenses' }));
    if (canReadExcel) excelChildren.forEach(i => list.push({ ...i, group: 'Native Excel' }));
    if (canReadChat) list.push({ path: '/chat', label: 'Internal Chat', icon: MessageSquare });
    if (isAdmin) adminNavItems.forEach(i => list.push({ ...i, group: 'Admin' }));
    // dedupe by path
    const seen = new Set();
    return list.filter(i => { if (seen.has(i.path)) return false; seen.add(i.path); return true; });
  }, [navItems, hasClientsPermission, hasPermission, isAdmin, canReadExcel, canReadChat]);

  const filteredSearchItems = useMemo(() => {
    if (!searchActive) return [];
    // Match against label OR parent group name OR path so users can search e.g.
    // "user" → all User Management children, "/cash" → cash day book, etc.
    return flatSearchItems.filter(i => {
      const label = (i.label || '').toLowerCase();
      const group = (i.group || '').toLowerCase();
      const path = (i.path || '').toLowerCase();
      return label.includes(searchQ) || group.includes(searchQ) || path.includes(searchQ);
    });
  }, [flatSearchItems, searchActive, searchQ]);

  // Reusable sidebar search box (inline JSX, not a component — keeps input focus stable)
  const searchBox = (
    <div className="px-3 pt-1 pb-2">
      <div className="relative group">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search menu…"
          className="w-full h-8 pl-8 pr-7 rounded-lg text-xs bg-slate-50 border border-slate-200 text-slate-700 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-colors"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Clear search"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );

  // Shared search results renderer
  const renderSearchList = () => {
    if (filteredSearchItems.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-10 gap-2 px-3">
          <div className="w-11 h-11 rounded-2xl bg-slate-100 flex items-center justify-center">
            <SearchX className="w-5 h-5 text-slate-400" />
          </div>
          <p className="text-[11px] text-slate-400 text-center">No matches for "{search}"</p>
        </div>
      );
    }
    return (
      <>
        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium px-3 pt-1 pb-1.5">
          Results · {filteredSearchItems.length}
        </p>
        {filteredSearchItems.map((item) => {
          const Icon = item.icon;
          const pathOnly = (item.path || '').split('?')[0];
          const iconTone = getIconTone(pathOnly);
          const isActive = location.pathname === pathOnly && !(item.path || '').includes('?');
          return (
            <button
              key={item.path}
              onClick={() => { navigate(item.path); setSearch(''); setMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <span className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${isActive ? 'bg-indigo-100 text-indigo-700' : iconTone}`}>
                <Icon className="w-3.5 h-3.5" />
              </span>
              <div className="flex-1 min-w-0 text-left">
                <div className="truncate">{item.label}</div>
                {item.group && <div className="text-[10px] text-slate-400 truncate">{item.group}</div>}
              </div>
            </button>
          );
        })}
      </>
    );
  };

  // ── Desktop sidebar: render one menu group (direct link OR collapsible parent) ──
  const renderSidebarGroup = (group) => {
    const Icon = group.icon;

    // Direct link — no children
    if (group.path) {
      return (
        <NavLinkButton
          key={group.key}
          item={group}
          collapsed={collapsed}
          isActive={isGroupActive(group)}
          iconTone={getIconTone(group.path)}
          onNavigate={navigate}
        />
      );
    }

    const active = isGroupActive(group);
    const isOpen = !!openGroups[group.key];
    const showBadge = group.key === 'admin' && notifBadgeCount > 0;
    const tone = getIconTone(group.base || '');

    // Collapsed rail — icon only; clicking expands the sidebar and opens the group
    if (collapsed) {
      return (
        <button
          key={group.key}
          title={group.label}
          onClick={() => { setCollapsed(false); setOpenGroups((p) => ({ ...p, [group.key]: true })); }}
          className={`group relative w-full flex items-center justify-center py-2 rounded-lg transition-colors ${active ? 'bg-indigo-50/70' : 'hover:bg-slate-50'}`}
        >
          <span className={`w-8 h-8 rounded-md flex items-center justify-center ${active ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200' : tone}`}>
            <Icon className="w-4 h-4" />
          </span>
          {showBadge && (
            <span className="absolute top-1 right-1 min-w-4 h-4 flex items-center justify-center rounded-full bg-rose-500 text-[8px] font-bold text-white px-1">
              {notifBadgeCount > 99 ? '99+' : notifBadgeCount}
            </span>
          )}
        </button>
      );
    }

    // Expanded — collapsible parent with the animated child tree
    return (
      <Collapsible
        key={group.key}
        open={isOpen}
        onOpenChange={(v) => setOpenGroups((p) => ({ ...p, [group.key]: v }))}
      >
        <CollapsibleTrigger asChild>
          <button className={`group w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${active ? 'bg-indigo-50/70 text-indigo-700' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}>
            <span className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${active ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200' : tone}`}>
              <Icon className="w-3.5 h-3.5" />
            </span>
            <span className="flex-1 text-left truncate">{group.label}</span>
            {showBadge && (
              <span className="min-w-4.5 h-4.5 flex items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white px-1">
                {notifBadgeCount > 99 ? '99+' : notifBadgeCount}
              </span>
            )}
            <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-0.5">
          <TreeGroup items={group.children} getIconTone={getIconTone} />
        </CollapsibleContent>
      </Collapsible>
    );
  };

  return (
    <div className="flex h-screen bg-white">
      {/* ── Mobile Sidebar Overlay ── */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileMenuOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-xl flex flex-col overflow-hidden animate-in slide-in-from-left duration-200">
            {/* Mobile sidebar header */}
            <div className="h-14 px-3 flex items-center justify-between border-b border-slate-100">
              <BrandLogo />
              <button onClick={() => setMobileMenuOpen(false)} className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mobile site selector */}
            {sites.length > 0 && (
              <div className="px-3 py-2">
                <Select value={currentSite ? String(currentSite.id) : ''} onValueChange={handleSiteChange}>
                  <SelectTrigger className="w-full h-9 text-xs bg-slate-50 border-slate-200 text-slate-700 focus:ring-1 focus:ring-slate-300">
                    <div className="flex items-center gap-2 truncate">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                      <SelectValue placeholder="Select site" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {sites.map((site) => (
                      <SelectItem key={site.id} value={String(site.id)} className="text-xs">{site.name}</SelectItem>
                    ))}
                    {isAdmin && (
                      <SelectItem value="__add_site__" disabled className="text-xs data-[disabled]:opacity-90 data-[disabled]:pointer-events-none">
                        <span className="inline-flex items-start gap-2">
                          <Lock className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                          <span className="flex flex-col leading-tight">
                            <span className="font-medium text-slate-500">Add Site — Locked</span>
                            <span className="text-[10px] text-slate-400">Contact development team to enable multiple site</span>
                          </span>
                        </span>
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Separator />

            {searchBox}

            {/* Mobile nav — reuse same nav structure but never collapsed */}
            <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
              {searchActive ? renderSearchList() : (<>
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium px-3 pt-1 pb-1.5">Menu</p>

              {navItems.filter(i => i.path === '/dashboard').map((item) => (
                <NavLink key={item.path} item={item} />
              ))}

              {hasClientsPermission && (
                <Collapsible open={userMgmtOpen} onOpenChange={setUserMgmtOpen}>
                  <CollapsibleTrigger asChild>
                    <button className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${isUserMgmtActive ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}>
                      <span className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${getIconTone('/clients')}`}><UsersRound className="w-3.5 h-3.5" /></span>
                      <span className="flex-1 text-left">User Management</span>
                      {userMgmtOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-0.5 mt-0.5">
                    <TreeGroup items={userMgmtChildren} getIconTone={getIconTone} />
                  </CollapsibleContent>
                </Collapsible>
              )}

              {hasPermission('vendors', 'read') && (
                <Collapsible open={vendorOpen} onOpenChange={setVendorOpen}>
                  <CollapsibleTrigger asChild>
                    <button className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${isVendorActive ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}>
                      <span className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${getIconTone('/vendors')}`}><ShoppingBag className="w-3.5 h-3.5" /></span>
                      <span className="flex-1 text-left">Vendor Management</span>
                      {vendorOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-0.5 mt-0.5">
                    <TreeGroup items={vendorChildren} getIconTone={getIconTone} />
                  </CollapsibleContent>
                </Collapsible>
              )}

              {navItems.filter(i => i.path === '/farmers').map((item) => (
                <NavLink key={item.path} item={item} />
              ))}

              {hasPermission('commissions', 'read') && (
                <Collapsible open={commissionOpen} onOpenChange={setCommissionOpen}>
                  <CollapsibleTrigger asChild>
                    <button className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${isCommissionActive ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}>
                      <span className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${getIconTone('/plot-commission')}`}><HandCoins className="w-3.5 h-3.5" /></span>
                      <span className="flex-1 text-left">Plot Commission</span>
                      {commissionOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-0.5 mt-0.5">
                    <TreeGroup items={commissionChildren} getIconTone={getIconTone} />
                  </CollapsibleContent>
                </Collapsible>
              )}

              {hasPermission('daybook', 'read') && (
                <Collapsible open={dayBookOpen} onOpenChange={setDayBookOpen}>
                  <CollapsibleTrigger asChild>
                    <button className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${isDayBookActive ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}>
                      <span className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${getIconTone('/daybook')}`}><BookOpen className="w-3.5 h-3.5" /></span>
                      <span className="flex-1 text-left">Day Book</span>
                      {dayBookOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-0.5 mt-0.5">
                    <TreeGroup items={dayBookChildren} getIconTone={getIconTone} />
                  </CollapsibleContent>
                </Collapsible>
              )}

              {navItems.filter(i => i.path !== '/dashboard' && i.path !== '/farmers' && i.path !== '/daybook' && i.path !== '/imprest').map((item) => (
                <NavLink key={item.path} item={item} />
              ))}

              {hasPermission('plot_payments', 'read') && (
                <Collapsible open={plotPayOpen} onOpenChange={setPlotPayOpen}>
                  <CollapsibleTrigger asChild>
                    <button className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${isPlotPayActive ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}>
                      <span className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${getIconTone('/plot-payments')}`}><LayoutGrid className="w-3.5 h-3.5" /></span>
                      <span className="flex-1 text-left">Plot Payments</span>
                      {plotPayOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-0.5 mt-0.5">
                    <TreeGroup items={plotPayChildren} getIconTone={getIconTone} />
                  </CollapsibleContent>
                </Collapsible>
              )}

              {hasPermission('expenses', 'read') && (
                <Collapsible open={expenseOpen} onOpenChange={setExpenseOpen}>
                  <CollapsibleTrigger asChild>
                    <button className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${isExpenseActive ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}>
                      <span className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${getIconTone('/expenses')}`}><CreditCard className="w-3.5 h-3.5" /></span>
                      <span className="flex-1 text-left">Expenses</span>
                      {expenseOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-0.5 mt-0.5">
                    <TreeGroup items={expenseChildren} getIconTone={getIconTone} />
                  </CollapsibleContent>
                </Collapsible>
              )}

              {navItems.filter(i => i.path === '/imprest').map((item) => (
                <NavLink key={item.path} item={item} />
              ))}

              {canReadExcel && (
                <Collapsible open={excelOpen} onOpenChange={setExcelOpen}>
                  <CollapsibleTrigger asChild>
                    <button className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${isExcelActive ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}>
                      <span className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${getIconTone('/excel/files')}`}><Sheet className="w-3.5 h-3.5" /></span>
                      <span className="flex-1 text-left">Native Excel</span>
                      {excelOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-0.5 mt-0.5">
                    <TreeGroup items={excelChildren} getIconTone={getIconTone} />
                  </CollapsibleContent>
                </Collapsible>
              )}

              {canReadChat && <NavLink item={{ path: '/chat', label: 'Internal Chat', icon: MessageSquare }} />}

              {isAdmin && (
                <>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium px-3 pt-4 pb-1.5">Admin</p>
                  {adminNavItems.map((item) => (<NavLink key={item.path} item={item} />))}
                </>
              )}
              </>)}
            </nav>

            {/* Mobile bottom */}
            <div className="px-2 pb-2 space-y-0.5">
              <NavLink item={{ path: '/settings', label: 'Settings', icon: Settings }} />
              <Separator className="my-2" />
              <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium text-red-600 hover:bg-red-50 transition-colors">
                <span className="w-6 h-6 rounded-md flex items-center justify-center bg-red-50"><LogOut className="w-3.5 h-3.5" /></span>
                <span>Sign out</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ── Desktop Sidebar ── */}
      <aside className={`hidden md:flex flex-col shrink-0 bg-white border-r border-slate-200 transition-[width] duration-200 ease-out ${collapsed ? 'w-[70px]' : 'w-64'}`}>
        {/* Brand + collapse toggle */}
        <div className={`h-[60px] flex items-center border-b border-slate-100 shrink-0 ${collapsed ? 'justify-center px-2' : 'justify-between px-3'}`}>
          {collapsed ? <BrandLogo compact /> : <BrandLogo />}
          {!collapsed && (
            <button
              onClick={() => setCollapsed((c) => !c)}
              title="Collapse sidebar"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <PanelLeftClose className="w-4.5 h-4.5" />
            </button>
          )}
        </div>

        {collapsed && (
          <button
            onClick={() => setCollapsed((c) => !c)}
            title="Expand sidebar"
            className="mx-auto mt-2 mb-1 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <PanelLeft className="w-4.5 h-4.5" />
          </button>
        )}

        {/* Site selector */}
        {!collapsed && sites.length > 0 && (
          <div className="px-3 py-2">
            <Select value={currentSite ? String(currentSite.id) : ''} onValueChange={handleSiteChange}>
              <SelectTrigger className="w-full h-9 text-xs bg-slate-50 border-slate-200 text-slate-700 focus:ring-1 focus:ring-slate-300">
                <div className="flex items-center gap-2 truncate">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <SelectValue placeholder="Select site" />
                </div>
              </SelectTrigger>
              <SelectContent>
                {sites.map((site) => (
                  <SelectItem key={site.id} value={String(site.id)} className="text-xs">{site.name}</SelectItem>
                ))}
                {isAdmin && (
                  <SelectItem value="__add_site__" disabled className="text-xs data-[disabled]:opacity-90 data-[disabled]:pointer-events-none">
                    <span className="inline-flex items-start gap-2">
                      <Lock className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                      <span className="flex flex-col leading-tight">
                        <span className="font-medium text-slate-500">Add Site — Locked</span>
                        <span className="text-[10px] text-slate-400">Contact development team to enable multiple site</span>
                      </span>
                    </span>
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Search (expanded only) */}
        {!collapsed && searchBox}

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-slate-300">
          {!collapsed && (
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium px-3 pt-1 pb-1.5">Menu</p>
          )}
          {(searchActive && !collapsed)
            ? renderSearchList()
            : menuGroups.map((group) => renderSidebarGroup(group))}
        </nav>

        {/* Footer: settings + sign out */}
        <div className="px-2 py-2 border-t border-slate-100 space-y-0.5 shrink-0">
          {collapsed ? (
            <>
              <button onClick={() => navigate('/settings')} title="Settings" className="w-full flex items-center justify-center py-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-colors">
                <span className="w-8 h-8 rounded-md flex items-center justify-center bg-slate-100"><Settings className="w-4 h-4" /></span>
              </button>
              <button onClick={handleLogout} title="Sign out" className="w-full flex items-center justify-center py-2 rounded-lg text-red-500 hover:bg-red-50 transition-colors">
                <span className="w-8 h-8 rounded-md flex items-center justify-center bg-red-50"><LogOut className="w-4 h-4" /></span>
              </button>
            </>
          ) : (
            <>
              <NavLinkButton
                item={{ path: '/settings', label: 'Settings', icon: Settings }}
                collapsed={false}
                isActive={location.pathname.startsWith('/settings')}
                iconTone={getIconTone('/settings')}
                onNavigate={navigate}
              />
              <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium text-red-600 hover:bg-red-50 transition-colors">
                <span className="w-6 h-6 rounded-md flex items-center justify-center bg-red-50"><LogOut className="w-3.5 h-3.5" /></span>
                <span>Sign out</span>
              </button>
            </>
          )}
        </div>
      </aside>

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/50">
        {/* ── Desktop Header: full-height menu bar — items divided by vertical rules ── */}
        <header className="hidden md:flex items-center h-[60px] bg-white border-b border-slate-200/80 shrink-0">
          {/* Left: current section context */}
          <div className="flex items-center gap-2.5 px-4 shrink-0 min-w-0">
            {activeGroup && ActiveIcon && (
              <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${getIconTone(activeGroup.path || activeGroup.base || '')}`}>
                <ActiveIcon className="w-4 h-4" />
              </span>
            )}
            <div className="flex flex-col leading-tight min-w-0">
              <span className="text-sm font-semibold text-slate-800 truncate">{activeGroup?.label || 'Dashboard'}</span>
              {currentSite?.name && <span className="text-[11px] text-slate-400 truncate">{currentSite.name}</span>}
            </div>
          </div>

          <div className="flex-1 min-w-0" />

          {/* Center: modules — moved to the desktop sidebar; hidden here */}
          <nav className="hidden">
            <div className="flex items-stretch h-full w-max divide-x divide-slate-200/70">
              {menuGroups.map((group) => {
                const Icon = group.icon;
                const active = isGroupActive(group);
                const cellCls = `group relative h-full flex items-center gap-2 px-4 text-[13px] font-medium transition-colors whitespace-nowrap ${active
                  ? 'text-indigo-700 bg-indigo-50/60'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`;
                const iconEl = (
                  <Icon className={`w-4 h-4 shrink-0 transition-colors ${active ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
                );
                const accent = active && <span className="absolute left-0 right-0 bottom-0 h-[2px] bg-gradient-to-r from-indigo-500 to-violet-500" />;

                // Direct link — no child modules
                if (group.path) {
                  return (
                    <button key={group.key} onClick={() => navigate(group.path)} className={cellCls}>
                      {iconEl}
                      <span>{group.label}</span>
                      {accent}
                    </button>
                  );
                }

                // Full-height cell that opens a dropdown of child modules
                const showBadge = group.key === 'admin' && notifBadgeCount > 0;
                return (
                  <DropdownMenu key={group.key}>
                    <DropdownMenuTrigger asChild>
                      <button className={cellCls}>
                        {iconEl}
                        <span>{group.label}</span>
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-colors" />
                        {showBadge && (
                          <span className="absolute top-2 right-1.5 min-w-4.5 h-4.5 flex items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white leading-none px-1 shadow-sm">
                            {notifBadgeCount > 99 ? '99+' : notifBadgeCount}
                          </span>
                        )}
                        {accent}
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" sideOffset={8} className="w-64 p-1.5 rounded-xl border-slate-200/80 shadow-xl shadow-slate-900/[0.07]">
                      <DropdownMenuLabel className="flex items-center gap-2 px-2 pt-1 pb-1.5 text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                        <Icon className="w-3 h-3 text-slate-400" />
                        {group.label}
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator className="bg-slate-100" />
                      {group.children.map((child) => {
                        const CIcon = child.icon;
                        const cPath = (child.path || '').split('?')[0];
                        const cActive = location.pathname === cPath && !(child.path || '').includes('?');
                        const cTone = getIconTone(cPath);
                        const cBadge = child.path === '/pending-approvals' && notifBadgeCount > 0;
                        return (
                          <DropdownMenuItem
                            key={child.path}
                            onSelect={() => navigate(child.path)}
                            className={`group/item gap-2.5 px-2 py-2 rounded-lg cursor-pointer text-[13px] font-medium transition-colors ${cActive
                              ? 'bg-indigo-50 text-indigo-700 focus:bg-indigo-50 focus:text-indigo-700'
                              : 'text-slate-600 focus:bg-slate-50 focus:text-slate-900'}`}
                          >
                            <span className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-transform duration-150 group-focus/item:scale-105 ${cActive ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200' : cTone}`}>
                              <CIcon className="w-3.5 h-3.5" />
                            </span>
                            <span className="flex-1 truncate">{child.label}</span>
                            {cBadge ? (
                              <span className="min-w-4.5 h-4.5 flex items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white leading-none px-1">
                                {notifBadgeCount > 99 ? '99+' : notifBadgeCount}
                              </span>
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 text-slate-300 opacity-0 -translate-x-1 transition-all duration-150 group-focus/item:opacity-100 group-focus/item:translate-x-0" />
                            )}
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                );
              })}
            </div>
          </nav>

          {/* Right: search · notifications · role · user */}
          <div className="flex items-center gap-2 px-4 shrink-0 border-l border-slate-200">
            {/* Collapsible search — icon only; expands to an input on click */}
            <div className="relative">
              {searchExpanded ? (
                <>
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    autoFocus
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Escape') { setSearch(''); setSearchExpanded(false); } }}
                    placeholder="Search modules…"
                    className="w-48 lg:w-60 h-9 pl-8 pr-7 rounded-lg text-xs bg-slate-50 border border-slate-200 text-slate-700 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => { setSearch(''); setSearchExpanded(false); }}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                    aria-label="Close search"
                  >
                    <X className="w-3 h-3" />
                  </button>
                  {searchActive && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => { setSearch(''); setSearchExpanded(false); }} />
                      <div className="absolute right-0 top-11 z-50 w-80 max-h-96 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl shadow-black/10 p-1.5">
                        {renderSearchList()}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setSearchExpanded(true)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
                  title="Search"
                  aria-label="Search"
                >
                  <Search className="w-5 h-5" />
                </button>
              )}
            </div>

            <button
              onClick={() => { setNotifOpen(true); setNotifTab(isAdmin ? 'received' : 'sent'); fetchNotifApprovals(); }}
              className="relative p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
              title="Approvals & Notifications"
            >
              <Bell className="w-5 h-5" />
              {notifBadgeCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-4.25 h-4.25 flex items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white leading-none px-1 shadow-sm">
                  {notifBadgeCount > 99 ? '99+' : notifBadgeCount}
                </span>
              )}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="rounded-full hover:ring-2 hover:ring-slate-200 transition-all" aria-label="Account menu">
                  {user?.photo ? (
                    <img src={user.photo} alt="" className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 text-sm font-semibold">
                      {user?.name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <div className="px-2 py-1.5">
                  <p className="text-xs font-medium text-slate-800">{user?.name}</p>
                  <p className="text-[11px] text-slate-400">{user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/settings')} className="text-xs">
                  <Settings className="w-3.5 h-3.5 mr-2" /> Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-xs text-red-600 focus:text-red-600">
                  <LogOut className="w-3.5 h-3.5 mr-2" /> Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* ── Mobile Header ── */}
        <header className="md:hidden h-14 bg-white border-b border-slate-200/80 px-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={() => setMobileMenuOpen(true)} className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors" aria-label="Open menu">
              <Menu className="w-5 h-5" />
            </button>
            <span className="text-sm font-medium text-slate-700 truncate">{currentSite?.name || 'No site'}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => { setNotifOpen(true); setNotifTab(isAdmin ? 'received' : 'sent'); fetchNotifApprovals(); }}
              className="relative p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
              title="Approvals & Notifications"
            >
              <Bell className="w-5 h-5" />
              {notifBadgeCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-4.25 h-4.25 flex items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white leading-none px-1 shadow-sm">
                  {notifBadgeCount > 99 ? '99+' : notifBadgeCount}
                </span>
              )}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center px-1.5 py-1.5 rounded-lg hover:bg-slate-50 transition-colors">
                  {user?.photo ? (
                    <img src={user.photo} alt="" className="w-7 h-7 rounded-full object-cover" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 text-xs font-semibold">
                      {user?.name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <div className="px-2 py-1.5">
                  <p className="text-xs font-medium text-slate-800">{user?.name}</p>
                  <p className="text-[11px] text-slate-400">{user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/settings')} className="text-xs">
                  <Settings className="w-3.5 h-3.5 mr-2" /> Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-xs text-red-600 focus:text-red-600">
                  <LogOut className="w-3.5 h-3.5 mr-2" /> Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-3 md:p-6 pb-20 md:pb-6">
          <div
            className={`transition-opacity duration-150 ${siteTransition ? 'opacity-0' : 'opacity-100'}`}
          >
            <Outlet key={currentSite?.id || 'no-site'} />
          </div>
        </main>
      </div>

      {/* ── Mobile Bottom Navigation ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 safe-area-bottom">
        <div className="flex items-center justify-around h-16 px-1">
          {[
            { path: '/dashboard', label: 'Main', icon: Home },
            { path: '/expenses', label: 'Expenses', icon: CreditCard },
            { path: '/plot-payments', label: 'Plots', icon: LayoutGrid },
            { path: '/daybook', label: 'Day Book', icon: BookOpen },
          ].map((tab) => {
            const isActive = location.pathname.startsWith(tab.path);
            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 rounded-lg transition-colors ${isActive ? 'text-slate-900' : 'text-slate-400'}`}
              >
                <tab.icon className={`w-5 h-5 ${isActive ? 'text-slate-900' : 'text-slate-400'}`} />
                <span className={`text-[10px] font-medium ${isActive ? 'text-slate-900' : 'text-slate-400'}`}>{tab.label}</span>
              </button>
            );
          })}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 rounded-lg text-slate-400 transition-colors"
          >
            <Menu className="w-5 h-5" />
            <span className="text-[10px] font-medium">More</span>
          </button>
        </div>
      </nav>

      {/* ── Notifications / Approvals Modal ── */}
      {notifOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            onClick={() => setNotifOpen(false)}
          />

          {/* Modal panel */}
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl shadow-black/20 flex flex-col overflow-hidden max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center">
                  <Bell className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Approvals</p>
                  <p className="text-[11px] text-slate-400">
                    {currentSite?.name || 'No site'} · {isAdmin
                      ? `${notifBadgeCount} pending`
                      : `${notifBadgeCount} pending`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setNotifOpen(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex items-center border-b border-slate-100 shrink-0 bg-white">
              <button
                onClick={() => setNotifTab('received')}
                className={`flex items-center gap-1.5 px-5 py-3 text-xs font-medium transition-colors relative ${
                  notifTab === 'received' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <Inbox className="w-3.5 h-3.5" />
                Received
                {notifReceived.length > 0 && (
                  <span className="inline-flex items-center justify-center min-w-4.5 h-4.5 px-1 text-[9px] font-bold bg-amber-100 text-amber-700 rounded-full">
                    {notifReceived.length}
                  </span>
                )}
                {notifTab === 'received' && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-900 rounded-t" />
                )}
              </button>
              <button
                onClick={() => setNotifTab('sent')}
                className={`flex items-center gap-1.5 px-5 py-3 text-xs font-medium transition-colors relative ${
                  notifTab === 'sent' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <Send className="w-3.5 h-3.5" />
                Sent
                {(parseInt(notifEditCounts.pending) || 0) > 0 && (
                  <span className="inline-flex items-center justify-center min-w-4.5 h-4.5 px-1 text-[9px] font-bold bg-blue-100 text-blue-700 rounded-full">
                    {notifEditCounts.pending}
                  </span>
                )}
                {notifTab === 'sent' && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-900 rounded-t" />
                )}
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {notifLoading ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16">
                  <div className="w-10 h-10 rounded-full border-2 border-slate-200 border-t-indigo-500 animate-spin" />
                  <p className="text-xs text-slate-400">Loading…</p>
                </div>
              ) : notifTab === 'received' ? (
                notifReceived.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-16">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                      <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-slate-700">All clear!</p>
                      <p className="text-xs text-slate-400 mt-0.5">No pending approvals right now</p>
                    </div>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {notifReceived.map((entry) => {
                      // Sub-admin allocation received from admin
                      if (entry._type === 'allocation') {
                        return (
                          <div key={`allocation-${entry.id}`} className="px-4 py-3.5 hover:bg-slate-50/70 transition-colors">
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0 mt-0.5">
                                <Wallet className="w-3.5 h-3.5 text-emerald-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-800 leading-tight">
                                  Imprest Allocated{' '}
                                  <span className="text-slate-400 font-normal text-xs">₹{Number(entry.amount).toLocaleString('en-IN')}</span>
                                </p>
                                <div className="flex items-center flex-wrap gap-1.5 mt-1">
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-medium bg-emerald-50 text-emerald-700 border-emerald-200">Allocation</span>
                                  <span className="text-[11px] text-slate-400">{notifFmtDate(entry.created_at)}</span>
                                  {entry.remark && <span className="text-[11px] text-slate-400 truncate max-w-32">{entry.remark}</span>}
                                </div>
                              </div>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium shrink-0 mt-0.5 bg-amber-50 text-amber-700 border-amber-200">
                                <Clock className="w-3 h-3" /> Pending
                              </span>
                            </div>
                            <div className="mt-2.5 ml-11">
                              <Link
                                to="/imprest"
                                onClick={() => setNotifOpen(false)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                              >
                                <CheckCircle2 className="w-3 h-3" /> Confirm Receipt
                              </Link>
                            </div>
                          </div>
                        );
                      }
                      const mod = NOTIF_APPROVAL_MODULE[entry.source] || { label: entry.source, cls: 'bg-slate-50 text-slate-600 border-slate-200' };
                      const actionKey = `${entry.source}-${entry.id}`;
                      const isActing = notifActionId === actionKey;
                      return (
                        <div key={actionKey} className="px-4 py-3.5 hover:bg-slate-50/70 transition-colors">
                          <div className="flex items-start gap-3">
                            <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 ${entry._type === 'imprest' ? 'bg-violet-50 border-violet-200' : 'bg-amber-50 border-amber-200'}`}>
                              {entry._type === 'imprest'
                                ? <Wallet className="w-3.5 h-3.5 text-violet-600" />
                                : <Clock className="w-3.5 h-3.5 text-amber-600" />
                              }
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-800 leading-tight line-clamp-2">{entry.entry_label}</p>
                              <div className="flex items-center flex-wrap gap-1.5 mt-1">
                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-medium ${mod.cls}`}>
                                  {mod.label}
                                </span>
                                <span className="text-[11px] text-slate-400">{notifFmtDate(entry.date)}</span>
                                {entry.created_by_name && (
                                  <span className="text-[11px] text-slate-400">by {entry.created_by_name}</span>
                                )}
                                {entry.booked_by && (
                                  <span className="text-[11px] text-slate-400">Booked by - {entry.booked_by}</span>
                                )}
                                {entry.plot_no && (
                                  <span className="text-[10px] font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 rounded px-1.5 py-0.5">Plot {entry.plot_no}</span>
                                )}
                                {(entry.payment_mode || entry.cash_type) && (
                                  <span className={`text-[10px] font-medium rounded px-1.5 py-0.5 border ${
                                    (entry.payment_mode || entry.cash_type) === 'CASH' || entry.cash_type === 'cash'
                                      ? 'bg-green-50 text-green-700 border-green-200'
                                      : (entry.payment_mode || entry.cash_type) === 'CHEQUE' || entry.cash_type === 'cheque'
                                        ? 'bg-teal-50 text-teal-700 border-teal-200'
                                        : 'bg-blue-50 text-blue-700 border-blue-200'
                                  }`}>{(entry.payment_mode || entry.cash_type || '').toUpperCase()}</span>
                                )}
                                {entry.site_name && (
                                  <span className="text-[10px] text-slate-400 bg-slate-100 rounded px-1.5 py-0.5">{entry.site_name}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          {/* Approve / Reject actions */}
                          {isAdmin && (
                            <div className="flex items-center gap-2 mt-2.5 ml-11">
                              <button
                                disabled={!!notifActionId}
                                onClick={() => handleNotifApprove(entry)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                              >
                                {isActing ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                                Approve
                              </button>
                              <button
                                disabled={!!notifActionId}
                                onClick={() => handleNotifReject(entry)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors disabled:opacity-50"
                              >
                                {isActing ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                                Reject
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )
              ) : (
                notifSent.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-16">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center">
                      <Send className="w-6 h-6 text-blue-400" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-slate-700">No requests sent</p>
                      <p className="text-xs text-slate-400 mt-0.5">Your edit & imprest requests will appear here</p>
                    </div>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {notifSent.map((req) => {
                      const st = NOTIF_STATUS_BADGE[req.status] || NOTIF_STATUS_BADGE.pending;
                      const StIcon = st.icon;
                      const isImprest = req._type === 'imprest';
                      const colorMap = {
                        approved: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-600' },
                        rejected: { bg: 'bg-red-50 border-red-200', text: 'text-red-600' },
                      };
                      const fallback = isImprest
                        ? { bg: 'bg-violet-50 border-violet-200', text: 'text-violet-600' }
                        : { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-600' };
                      const c = colorMap[req.status] || fallback;
                      return (
                        <div key={`${req._type}-${req.id}`} className="flex items-start gap-3 px-4 py-3.5 hover:bg-slate-50/70 transition-colors">
                          <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 ${c.bg}`}>
                            {isImprest
                              ? <Wallet className={`w-3.5 h-3.5 ${c.text}`} />
                              : <FileEdit className={`w-3.5 h-3.5 ${c.text}`} />
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            {isImprest ? (
                              <p className="text-sm font-medium text-slate-800 leading-tight">
                                Imprest Request{' '}
                                <span className="text-slate-400 font-normal text-xs">₹{notifFmt(req.amount)}</span>
                              </p>
                            ) : (
                              <p className="text-sm font-medium text-slate-800 truncate leading-tight">
                                Edit {NOTIF_EDIT_MODULE_LABELS[req.module] || req.module}{' '}
                                <span className="text-slate-400 font-normal text-xs">#{req.record_id}</span>
                              </p>
                            )}
                            <div className="flex items-center flex-wrap gap-1.5 mt-1">
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-medium ${
                                isImprest ? 'bg-violet-50 text-violet-700 border-violet-200' : 'bg-blue-50 text-blue-700 border-blue-200'
                              }`}>
                                {isImprest ? 'Imprest' : 'Edit'}
                              </span>
                              <span className="text-[11px] text-slate-400">{notifFmtDate(req.created_at)}</span>
                              {req.site_name && <span className="text-[11px] text-slate-400">{req.site_name}</span>}
                            </div>
                          </div>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium shrink-0 mt-0.5 ${st.cls}`}>
                            <StIcon className="w-3 h-3" /> {st.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )
              )}
            </div>

            {/* Footer */}
            <div className="shrink-0 border-t border-slate-100 px-4 py-3 flex items-center justify-between bg-slate-50/60">
              <p className="text-[11px] text-slate-400">
                {notifTab === 'received'
                  ? `${notifReceived.length} item${notifReceived.length !== 1 ? 's' : ''} shown`
                  : `${notifSent.length} item${notifSent.length !== 1 ? 's' : ''} shown`}
              </p>
              <Link
                to={notifTab === 'received'
                  ? (isAdmin ? '/pending-approvals' : '/imprest')
                  : '/edit-approvals'}
                onClick={() => setNotifOpen(false)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                View All
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Layout;
