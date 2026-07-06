import { useState, useEffect, useCallback } from 'react';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Switch } from '../components/ui/switch';
import { Skeleton } from '../components/ui/skeleton';
import {
  Users, UserCog, ChevronRight, Search, Check, X, Loader2,
  LayoutDashboard, BarChart2, IndianRupee, TrendingUp, TrendingDown,
  Wallet, Shield, PieChart, ClipboardList, BarChartHorizontalBig,
  Banknote, Bell, UserSearch, Activity, ShieldCheck, Save,
  RefreshCw, CheckSquare, Square,
} from 'lucide-react';
import { toast } from 'sonner';

// ── Component catalog ──────────────────────────────────────────────────────────
const COMPONENT_GROUPS = [
  {
    group: 'Financial Overview (KPI Cards)',
    color: 'from-blue-50 to-indigo-50 border-blue-200',
    headerColor: 'text-blue-700',
    components: [
      { key: 'financial_overview', label: 'Financial Overview Section', desc: 'The entire KPI cards row + time filter', Icon: LayoutDashboard },
      { key: 'kpi_totalIncoming', label: 'Total Incoming Card', desc: 'Plot Payments + Installments + Ledger Credit', Icon: IndianRupee },
      { key: 'kpi_plotPayments', label: 'Plot Payments Card', desc: 'Raw plot payment totals', Icon: TrendingUp },
      { key: 'kpi_registryPayments', label: 'Registry Payments Card', desc: 'All money (cash + bank + other) received on plots with status REGISTRY', Icon: TrendingUp },
      { key: 'kpi_personalLedger', label: 'Personal Ledger Card', desc: 'Outstanding person-ledger balances', Icon: Users },
      { key: 'kpi_totalExpense', label: 'Total Expenses Card', desc: 'All expense sources combined', Icon: TrendingDown },
      { key: 'kpi_profit', label: 'Profit Card', desc: 'Incoming minus Expenses', Icon: Wallet },
      { key: 'kpi_siteBalance', label: 'Site Balance Card', desc: 'Alpha − Imprest Given (Gamma)', Icon: Shield },
    ],
  },
  {
    group: 'Analytics Charts',
    color: 'from-purple-50 to-violet-50 border-purple-200',
    headerColor: 'text-purple-700',
    components: [
      { key: 'revenue_charts', label: 'Revenue vs Expense Charts', desc: 'Line/bar charts for revenue & expense trends', Icon: BarChart2 },
      { key: 'expense_radar', label: 'Expense Radar Chart', desc: 'Expense breakdown by category (radar)', Icon: PieChart },
      { key: 'module_breakdown', label: 'Module Breakdown', desc: 'Progress bars per expense source', Icon: BarChartHorizontalBig },
    ],
  },
  {
    group: 'Transactions & Activity',
    color: 'from-sky-50 to-cyan-50 border-sky-200',
    headerColor: 'text-sky-700',
    components: [
      { key: 'recent_transactions', label: 'Recent Transactions', desc: 'Paginated latest day-book entries', Icon: ClipboardList },
      { key: 'site_cashflow', label: 'Site Cash Flow Summary', desc: 'Site ledger incoming / outgoing summary', Icon: Banknote },
      { key: 'approvals', label: 'Approvals Widget', desc: 'Pending approvals & edit requests', Icon: Bell },
      { key: 'activity_card', label: 'Activity Card', desc: 'Recent login and user activity', Icon: Activity },
    ],
  },
  {
    group: 'Utilities',
    color: 'from-slate-50 to-gray-50 border-slate-200',
    headerColor: 'text-slate-700',
    components: [
      { key: 'member_search', label: 'Member Search Bar', desc: 'Global search for users and ledgers', Icon: UserSearch },
      { key: 'verify_panel', label: 'Data Verification Panel', desc: 'Financial consistency checker', Icon: ShieldCheck },
    ],
  },
];

const ALL_KEYS = COMPONENT_GROUPS.flatMap(g => g.components.map(c => c.key));

// ── Role badge helper ──────────────────────────────────────────────────────────
const RoleBadge = ({ role }) => {
  if (role === 'admin') return <Badge className="bg-rose-100 text-rose-700 border-rose-200 text-[10px] font-semibold">Admin</Badge>;
  if (role === 'super_admin') return <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-[10px] font-semibold">Super Admin</Badge>;
  return <Badge className="bg-slate-100 text-slate-600 border-slate-200 text-[10px] font-semibold">Sub-Admin</Badge>;
};

// ── Main Page ──────────────────────────────────────────────────────────────────
export const DashboardManagement = () => {
  const { user: currentUser } = useAuth();

  // User list
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [userSearch, setUserSearch] = useState('');

  // Selected user
  const [selectedUser, setSelectedUser] = useState(null);

  // Permissions for selected user
  const [perms, setPerms] = useState({}); // component → boolean
  const [permsLoading, setPermsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // ── Fetch user list ──────────────────────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const res = await api.get('/dashboard-permissions/users');
      setUsers(res.data.users || []);
    } catch {
      toast.error('Failed to load users');
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // ── Fetch component permissions when user selected ───────────────────────────
  const fetchPerms = useCallback(async (userId) => {
    setPermsLoading(true);
    setDirty(false);
    try {
      const res = await api.get(`/dashboard-permissions/${userId}`);
      setPerms(res.data.permissions || {});
    } catch {
      toast.error('Failed to load dashboard permissions');
    } finally {
      setPermsLoading(false);
    }
  }, []);

  const handleSelectUser = (u) => {
    setSelectedUser(u);
    fetchPerms(u.id);
  };

  // ── Toggle a component permission ────────────────────────────────────────────
  const toggle = (key) => {
    setPerms(prev => ({ ...prev, [key]: !prev[key] }));
    setDirty(true);
  };

  // ── Bulk select / deselect all ────────────────────────────────────────────────
  const setAll = (allowed) => {
    const next = {};
    for (const key of ALL_KEYS) next[key] = allowed;
    setPerms(next);
    setDirty(true);
  };

  // ── Save ─────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!selectedUser) return;
    setSaving(true);
    try {
      await api.put(`/dashboard-permissions/${selectedUser.id}`, { permissions: perms });
      setDirty(false);
      // Update restricted_count in user list
      const restrictedCount = ALL_KEYS.filter(k => perms[k] === false).length;
      setUsers(prev => prev.map(u =>
        u.id === selectedUser.id ? { ...u, restricted_count: restrictedCount } : u
      ));
      toast.success('Dashboard permissions saved');
    } catch {
      toast.error('Failed to save permissions');
    } finally {
      setSaving(false);
    }
  };

  // ── Filtered user list ────────────────────────────────────────────────────────
  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(userSearch.toLowerCase())
  );

  const allAllowed = ALL_KEYS.every(k => perms[k] !== false);
  const noneAllowed = ALL_KEYS.every(k => perms[k] === false);

  return (
    <div className="min-h-screen pb-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <LayoutDashboard className="w-6 h-6 text-blue-600" />
          Dashboard Management
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Control which dashboard components each user can see. Admins always see all components.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left: User List ── */}
        <div className="lg:col-span-1">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Select a User</p>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-300 transition"
                />
              </div>
            </div>

            <div className="divide-y divide-slate-100 max-h-[calc(100vh-280px)] overflow-y-auto">
              {usersLoading ? (
                <div className="p-4 space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="w-9 h-9 rounded-full" />
                      <div className="flex-1 space-y-1">
                        <Skeleton className="h-3.5 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-400">No users found</div>
              ) : (
                filteredUsers.map(u => {
                  const isSelected = selectedUser?.id === u.id;
                  const restricted = parseInt(u.restricted_count) || 0;
                  return (
                    <button
                      key={u.id}
                      onClick={() => handleSelectUser(u)}
                      className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors hover:bg-blue-50/50 ${isSelected ? 'bg-blue-50 border-l-2 border-blue-500' : 'border-l-2 border-transparent'}`}
                    >
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${u.role === 'admin' || u.role === 'super_admin' ? 'bg-rose-100 text-rose-600' : 'bg-indigo-100 text-indigo-600'}`}>
                        {u.name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-semibold text-slate-800 truncate">{u.name}</span>
                          <RoleBadge role={u.role} />
                        </div>
                        <p className="text-[11px] text-slate-400 truncate">{u.email}</p>
                        {restricted > 0 && (
                          <p className="text-[10px] text-orange-600 font-medium mt-0.5">{restricted} component{restricted !== 1 ? 's' : ''} restricted</p>
                        )}
                      </div>
                      {isSelected && <ChevronRight className="w-4 h-4 text-blue-500 shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* ── Right: Component Permission Grid ── */}
        <div className="lg:col-span-2">
          {!selectedUser ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/40 h-64 flex flex-col items-center justify-center gap-3">
              <UserCog className="w-10 h-10 text-slate-300" />
              <p className="text-sm text-slate-400 font-medium">Select a user to manage their dashboard access</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* User header + action bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-base shrink-0 ${selectedUser.role === 'admin' || selectedUser.role === 'super_admin' ? 'bg-rose-100 text-rose-600' : 'bg-indigo-100 text-indigo-600'}`}>
                    {selectedUser.name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-slate-800">{selectedUser.name}</span>
                      <RoleBadge role={selectedUser.role} />
                    </div>
                    <p className="text-xs text-slate-400">{selectedUser.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 rounded-lg"
                    onClick={() => setAll(true)} disabled={permsLoading || allAllowed}>
                    <CheckSquare className="w-3.5 h-3.5" /> Allow All
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 rounded-lg text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => setAll(false)} disabled={permsLoading || noneAllowed}>
                    <Square className="w-3.5 h-3.5" /> Restrict All
                  </Button>
                  <Button
                    size="sm"
                    className="h-8 text-xs gap-1.5 rounded-lg"
                    onClick={handleSave}
                    disabled={!dirty || saving || permsLoading}
                  >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Save Changes
                  </Button>
                </div>
              </div>

              {(selectedUser.role === 'admin' || selectedUser.role === 'super_admin') && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>
                    <strong>{selectedUser.name}</strong> is an <strong>{selectedUser.role === 'super_admin' ? 'Super Admin' : 'Admin'}</strong> and will always see all dashboard components regardless of these settings. You can still configure permissions here for reference, but they won&apos;t take effect for admin-level users.
                  </span>
                </div>
              )}

              {permsLoading ? (
                <div className="space-y-4">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="rounded-2xl border border-slate-200 p-4 space-y-3">
                      <Skeleton className="h-4 w-40" />
                      {[...Array(3)].map((_, j) => (
                        <div key={j} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Skeleton className="w-7 h-7 rounded-lg" />
                            <div><Skeleton className="h-3.5 w-36 mb-1" /><Skeleton className="h-3 w-48" /></div>
                          </div>
                          <Skeleton className="w-10 h-5 rounded-full" />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {COMPONENT_GROUPS.map(group => (
                    <div key={group.group} className={`rounded-2xl border bg-linear-to-br ${group.color} overflow-hidden`}>
                      <div className={`px-4 py-2.5 border-b border-current/10`}>
                        <p className={`text-xs font-bold uppercase tracking-wider ${group.headerColor}`}>{group.group}</p>
                      </div>
                      <div className="divide-y divide-white/50">
                        {group.components.map(comp => {
                          const allowed = perms[comp.key] !== false;
                          const { Icon } = comp;
                          return (
                            <div key={comp.key} className="flex items-center justify-between px-4 py-3 bg-white/60 hover:bg-white/80 transition-colors">
                              <div className="flex items-center gap-3 min-w-0 flex-1 mr-4">
                                <div className="w-7 h-7 rounded-lg bg-white shadow-sm border border-slate-100 flex items-center justify-center shrink-0">
                                  <Icon className="w-3.5 h-3.5 text-slate-600" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-slate-800">{comp.label}</p>
                                  <p className="text-[11px] text-slate-500 truncate">{comp.desc}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${allowed ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                                  {allowed ? 'Allowed' : 'Restricted'}
                                </span>
                                <Switch
                                  checked={allowed}
                                  onCheckedChange={() => toggle(comp.key)}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Sticky Save Footer */}
              {dirty && !permsLoading && (
                <div className="sticky bottom-4 z-20">
                  <div className="rounded-xl border border-blue-200 bg-blue-600 text-white px-4 py-3 flex items-center justify-between shadow-lg">
                    <span className="text-sm font-medium">You have unsaved changes</span>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-white hover:bg-blue-700 rounded-lg"
                        onClick={() => { fetchPerms(selectedUser.id); }}>
                        <RefreshCw className="w-3.5 h-3.5 mr-1" /> Discard
                      </Button>
                      <Button size="sm" className="h-7 text-xs bg-white text-blue-700 hover:bg-blue-50 rounded-lg"
                        onClick={handleSave} disabled={saving}>
                        {saving ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}
                        Save
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardManagement;
