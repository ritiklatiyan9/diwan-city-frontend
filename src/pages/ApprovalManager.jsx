import { useState, useEffect, useMemo } from 'react';
import api from '../api/api';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Checkbox } from '../components/ui/checkbox';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../components/ui/table';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '../components/ui/tooltip';
import {
  Shield, ShieldCheck, Search, Loader2, UserCog, CheckCircle2, XCircle, Users, Save,
} from 'lucide-react';
import { Button } from '../components/ui/button';

const MODULE_LABELS = {
  farmer_payment: 'Farmer Payment',
  plot_commission: 'Legacy',
  plot_commission_payment: 'Boxed',
  cash_flow_entry: 'Personal Ledger',
  firm_transaction: 'Firm Transaction',
  plot_payment: 'Plot Payment',
  expense: 'Expense',
  daybook: 'Day Book',
};

const PLOT_COMMISSION_MODULES = ['plot_commission', 'plot_commission_payment'];

const formatModuleName = (moduleKey) => {
  if (MODULE_LABELS[moduleKey]) return MODULE_LABELS[moduleKey];
  return String(moduleKey || '')
    .split('_')
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
};

const MODULE_COLORS = {
  farmer_payment: 'bg-green-50 text-green-700 border-green-200',
  plot_commission: 'bg-purple-50 text-purple-700 border-purple-200',
  plot_commission_payment: 'bg-purple-50 text-purple-700 border-purple-200',
  cash_flow_entry: 'bg-blue-50 text-blue-700 border-blue-200',
  firm_transaction: 'bg-orange-50 text-orange-700 border-orange-200',
  plot_payment: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  expense: 'bg-red-50 text-red-700 border-red-200',
  daybook: 'bg-slate-50 text-slate-700 border-slate-200',
};

const ApprovalManager = () => {
  const [managers, setManagers] = useState([]);
  const [allModules, setAllModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null); // userId being saved
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState(null);
  // Track local edits: { [userId]: Set of modules }
  const [localEdits, setLocalEdits] = useState({});
  const [dirty, setDirty] = useState({}); // { [userId]: true } if changed from server state

  const fetchManagers = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/admin/approval-managers');
      setManagers(data.managers || []);
      setAllModules(data.all_modules || []);
      // Initialize local edits from server state
      const edits = {};
      for (const m of data.managers || []) {
        edits[m.id] = new Set(m.allowed_modules || []);
      }
      setLocalEdits(edits);
      setDirty({});
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to load managers' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchManagers(); }, []);

  const toggleModule = (userId, mod) => {
    setLocalEdits(prev => {
      const current = new Set(prev[userId] || []);
      if (current.has(mod)) current.delete(mod); else current.add(mod);
      return { ...prev, [userId]: current };
    });
    // Mark dirty
    setDirty(prev => ({ ...prev, [userId]: true }));
  };

  const toggleAll = (userId, checked) => {
    setLocalEdits(prev => ({
      ...prev,
      [userId]: checked ? new Set(allModules) : new Set(),
    }));
    setDirty(prev => ({ ...prev, [userId]: true }));
  };

  const handleSave = async (userId) => {
    setSaving(userId);
    try {
      const modules = Array.from(localEdits[userId] || []);
      await api.put(`/admin/approval-managers/${userId}`, { modules });
      setManagers(prev => prev.map(m =>
        m.id === userId ? { ...m, allowed_modules: modules } : m
      ));
      setDirty(prev => ({ ...prev, [userId]: false }));
      const userName = managers.find(m => m.id === userId)?.name || 'User';
      setMessage({
        type: 'success',
        text: modules.length > 0
          ? `${userName}: ${modules.length} module(s) granted`
          : `${userName}: All modules revoked`,
      });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to update permissions' });
    } finally {
      setSaving(null);
    }
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return managers;
    const q = search.toLowerCase();
    return managers.filter(m =>
      (m.name || '').toLowerCase().includes(q) ||
      (m.email || '').toLowerCase().includes(q) ||
      (m.phone || '').toLowerCase().includes(q)
    );
  }, [managers, search]);

  const approvedCount = managers.filter(m => (m.allowed_modules || []).length > 0 || m.role === 'admin').length;
  const dirtyCount = useMemo(() => Object.values(dirty).filter(Boolean).length, [dirty]);

  const moduleLayout = useMemo(() => {
    const plotSet = new Set(PLOT_COMMISSION_MODULES);
    const firstPlotIndex = allModules.findIndex((mod) => plotSet.has(mod));
    const plot = allModules.filter((mod) => plotSet.has(mod));

    if (firstPlotIndex === -1) {
      return {
        before: allModules.filter((mod) => !plotSet.has(mod)),
        plot,
        after: [],
      };
    }

    return {
      before: allModules.slice(0, firstPlotIndex).filter((mod) => !plotSet.has(mod)),
      plot,
      after: allModules.slice(firstPlotIndex + 1).filter((mod) => !plotSet.has(mod)),
    };
  }, [allModules]);

  const orderedModules = useMemo(
    () => [...moduleLayout.before, ...moduleLayout.plot, ...moduleLayout.after],
    [moduleLayout]
  );

  // Auto-clear message
  useEffect(() => {
    if (message) {
      const t = setTimeout(() => setMessage(null), 3000);
      return () => clearTimeout(t);
    }
  }, [message]);

  return (
    <div className="space-y-5">
      {/* Hero + Controls */}
      <Card className="border-slate-200 shadow-none bg-linear-to-r from-white via-slate-50 to-blue-50/60">
        <CardContent className="p-4 sm:p-5 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
                Approval Manager
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Manage approval access for modules by user with instant save controls.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                {approvedCount} Approved
              </Badge>
              <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200 text-xs">
                <Users className="w-3 h-3 mr-1" />
                {managers.length} Users
              </Badge>
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
                <Save className="w-3 h-3 mr-1" />
                {dirtyCount} Unsaved
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Total Modules</p>
              <p className="text-lg font-bold text-slate-800 mt-1">{allModules.length}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Plot Commission Group</p>
              <p className="text-lg font-bold text-purple-700 mt-1">{moduleLayout.plot.length}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Admins</p>
              <p className="text-lg font-bold text-blue-700 mt-1">{managers.filter((m) => m.role === 'admin').length}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Sub-Admins</p>
              <p className="text-lg font-bold text-orange-700 mt-1">{managers.filter((m) => m.role !== 'admin').length}</p>
            </div>
          </div>

          <div className="flex flex-col xl:flex-row xl:items-center gap-3">
            <div className="relative w-full xl:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <Input
                placeholder="Search by name, email or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-sm bg-white"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {orderedModules.map((mod) => (
                <span
                  key={`legend-${mod}`}
                  className={`inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-semibold ${MODULE_COLORS[mod] || 'bg-slate-50 text-slate-700 border-slate-200'}`}
                >
                  {PLOT_COMMISSION_MODULES.includes(mod) ? `Plot Commission - ${formatModuleName(mod)}` : formatModuleName(mod)}
                </span>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Message */}
      {message && (
        <div className={`px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
          {message.text}
        </div>
      )}

      {/* Table */}
      <Card className="border-slate-200 shadow-none overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
              <span className="ml-2 text-sm text-slate-400">Loading...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <UserCog className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">{search ? 'No matching users found' : 'No admins or sub-admins found'}</p>
            </div>
          ) : (
            <TooltipProvider delayDuration={200}>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-100/80 hover:bg-slate-100/80">
                      <TableHead rowSpan={moduleLayout.plot.length > 0 ? 2 : 1} className="text-xs font-semibold text-slate-500 w-10">#</TableHead>
                      <TableHead rowSpan={moduleLayout.plot.length > 0 ? 2 : 1} className="text-xs font-semibold text-slate-500 min-w-56">User</TableHead>
                      <TableHead rowSpan={moduleLayout.plot.length > 0 ? 2 : 1} className="text-xs font-semibold text-slate-500 w-28">Role</TableHead>

                      {moduleLayout.before.map((mod) => (
                        <TableHead key={`head-before-${mod}`} rowSpan={moduleLayout.plot.length > 0 ? 2 : 1} className="text-xs font-semibold text-slate-500 text-center px-2 min-w-28">
                          <span className={`inline-flex items-center rounded-md border px-2 py-1 text-[10px] font-semibold ${MODULE_COLORS[mod] || 'bg-slate-50 text-slate-700 border-slate-200'}`}>
                            {formatModuleName(mod)}
                          </span>
                        </TableHead>
                      ))}

                      {moduleLayout.plot.length > 0 && (
                        <TableHead colSpan={moduleLayout.plot.length} className="text-xs font-semibold text-slate-500 text-center min-w-56">
                          <span className="inline-flex items-center rounded-md border border-purple-200 bg-purple-50 px-2 py-1 text-[10px] font-semibold text-purple-700">
                            Plot Commission
                          </span>
                        </TableHead>
                      )}

                      {moduleLayout.after.map((mod) => (
                        <TableHead key={`head-after-${mod}`} rowSpan={moduleLayout.plot.length > 0 ? 2 : 1} className="text-xs font-semibold text-slate-500 text-center px-2 min-w-28">
                          <span className={`inline-flex items-center rounded-md border px-2 py-1 text-[10px] font-semibold ${MODULE_COLORS[mod] || 'bg-slate-50 text-slate-700 border-slate-200'}`}>
                            {formatModuleName(mod)}
                          </span>
                        </TableHead>
                      ))}

                      <TableHead rowSpan={moduleLayout.plot.length > 0 ? 2 : 1} className="text-xs font-semibold text-slate-500 text-center w-20">All</TableHead>
                      <TableHead rowSpan={moduleLayout.plot.length > 0 ? 2 : 1} className="text-xs font-semibold text-slate-500 text-center w-16"></TableHead>
                    </TableRow>

                    {moduleLayout.plot.length > 0 && (
                      <TableRow className="bg-slate-50/70 hover:bg-slate-50/70">
                        {moduleLayout.plot.map((mod) => (
                          <TableHead key={`head-plot-${mod}`} className="text-xs font-semibold text-slate-500 text-center px-2 min-w-28">
                            <span className={`inline-flex items-center rounded-md border px-2 py-1 text-[10px] font-semibold ${MODULE_COLORS[mod] || 'bg-slate-50 text-slate-700 border-slate-200'}`}>
                              {formatModuleName(mod)}
                            </span>
                          </TableHead>
                        ))}
                      </TableRow>
                    )}
                  </TableHeader>
                  <TableBody>
                    {filtered.map((m, idx) => {
                      const isAdmin = m.role === 'admin';
                      const userModules = localEdits[m.id] || new Set();
                      const allChecked = allModules.length > 0 && allModules.every(mod => userModules.has(mod));
                      const someChecked = allModules.some(mod => userModules.has(mod));
                      const isDirty = dirty[m.id];

                      return (
                        <TableRow key={m.id} className={`hover:bg-slate-50/60 ${isDirty ? 'bg-amber-50/30' : ''}`}>
                          <TableCell className="text-xs text-slate-400 tabular-nums">{idx + 1}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                                isAdmin || someChecked ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                              }`}>
                                {(m.name || '?')[0].toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-slate-800 truncate">{m.name}</p>
                                <p className="text-[10px] text-slate-400 truncate">{m.email}</p>
                                {!isAdmin && <p className="text-[10px] text-slate-400">{userModules.size} of {allModules.length} modules</p>}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-[10px] font-semibold ${
                              isAdmin
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : 'bg-orange-50 text-orange-700 border-orange-200'
                            }`}>
                              {isAdmin ? (
                                <><Shield className="w-2.5 h-2.5 mr-0.5" /> Admin</>
                              ) : (
                                <><UserCog className="w-2.5 h-2.5 mr-0.5" /> Sub-Admin</>
                              )}
                            </Badge>
                          </TableCell>

                          {orderedModules.map(mod => (
                            <TableCell key={mod} className="text-center px-2">
                              {isAdmin ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex justify-center">
                                      <CheckCircle2 className="w-4 h-4 text-blue-500" />
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent side="top">
                                    <p className="text-xs">Admins always have full access</p>
                                  </TooltipContent>
                                </Tooltip>
                              ) : (
                                <div className="flex justify-center">
                                  <Checkbox
                                    checked={userModules.has(mod)}
                                    onCheckedChange={() => toggleModule(m.id, mod)}
                                    disabled={saving === m.id}
                                    className="data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                                  />
                                </div>
                              )}
                            </TableCell>
                          ))}
                          <TableCell className="text-center">
                            {isAdmin ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="inline-flex items-center gap-1 text-[10px] text-blue-600 font-medium bg-blue-50 px-2 py-1 rounded-full">
                                    <ShieldCheck className="w-3 h-3" />
                                    All
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                  <p className="text-xs">Admins always have full access</p>
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <div className="flex justify-center">
                                <Checkbox
                                  checked={allChecked}
                                  onCheckedChange={(checked) => toggleAll(m.id, !!checked)}
                                  disabled={saving === m.id}
                                  className="data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                                />
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {!isAdmin && (
                              <Button
                                size="sm"
                                variant={isDirty ? 'default' : 'ghost'}
                                className={`h-7 px-2 text-xs ${isDirty ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'text-slate-400'}`}
                                disabled={!isDirty || saving === m.id}
                                onClick={() => handleSave(m.id)}
                              >
                                {saving === m.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Save className="w-3.5 h-3.5" />
                                )}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </TooltipProvider>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ApprovalManager;
