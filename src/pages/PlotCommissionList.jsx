import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '../components/ui/dialog';
import {
  Plus, Search, ArrowUpDown,
  IndianRupee, LayoutGrid, Users, Loader2, Eye, Edit2, Trash2, AlertCircle, Printer, RefreshCw,
  Banknote, Building2,
} from 'lucide-react';
import { toast } from 'sonner';

const naturalSortPlotNo = (a, b) => {
  const parse = (s) => (s || '').split(/(\d+)/).map((v, i) => i % 2 ? parseInt(v, 10) : v.toLowerCase());
  const pa = parse(a), pb = parse(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const va = pa[i] ?? '', vb = pb[i] ?? '';
    if (va < vb) return -1;
    if (va > vb) return 1;
  }
  return 0;
};

const PlotCommissionList = () => {
  const { currentSite, canManage, hasPermission } = useAuth();
  const canWrite = canManage && hasPermission('commissions', 'write');
  const canUpdate = canManage && hasPermission('commissions', 'update');
  const canDelete = canManage && hasPermission('commissions', 'delete');
  const siteId = currentSite?.id;
  const navigate = useNavigate();

  const [commissions, setCommissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('asc');
  const [statusFilter, setStatusFilter] = useState('all'); // plot status: BOOKED, REGISTRY, etc.
  const [commissionStatusFilter, setCommissionStatusFilter] = useState('all'); // Pending, Partial, Completed

  const fetchCommissions = useCallback(async () => {
    if (!siteId) return;
    try {
      setLoading(true);
      // Watchdog so the spinner can never hang on a stalled request.
      const watchdog = setTimeout(() => setLoading(false), 15000);
      const res = await api.get(`/plot-commission/list?site_id=${siteId}`);
      clearTimeout(watchdog);
      setCommissions(res.data.commissions || []);
    } catch (err) {
      console.error('Failed to fetch commissions:', err);
      toast.error('Failed to load commissions');
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => {
    setCommissions([]);
    setSearchQuery('');
    setStatusFilter('all');
    setCommissionStatusFilter('all');
    fetchCommissions();
  }, [fetchCommissions]);

  // ── Edit / Delete a commission master ──
  const [editTarget, setEditTarget] = useState(null);   // the grouped row
  const [editForm, setEditForm] = useState({ total_commission: '', remarks: '' });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleOpenEdit = (g) => {
    setEditForm({
      total_commission: g.total_commission != null ? String(g.total_commission) : '',
      remarks: '',
    });
    setEditTarget(g);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    const amount = parseFloat(editForm.total_commission);
    if (!Number.isFinite(amount) || amount < 0) return toast.error('Enter a valid commission amount');
    if (!editTarget?.latest_commission_id) return toast.error('This plot has no commission record to edit');

    setSaving(true);
    try {
      // PUT /:id overwrites BOTH fields (it is not a patch), so always send both.
      await api.put(`/plot-commission/${editTarget.latest_commission_id}`, {
        total_commission: amount,
        remarks: editForm.remarks?.trim() || null,
      });
      toast.success(`Commission updated for plot ${editTarget.plot_no}`);
      setEditTarget(null);
      fetchCommissions();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update commission');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget?.latest_commission_id) return toast.error('This plot has no commission record to delete');
    setSaving(true);
    try {
      await api.delete(`/plot-commission/${deleteTarget.latest_commission_id}`);
      toast.success(`Commission deleted for plot ${deleteTarget.plot_no}`);
      setDeleteTarget(null);
      fetchCommissions();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete commission');
    } finally {
      setSaving(false);
    }
  };

  // Filtering — search across plot_no, buyer_name, latest_agent_name, AND all_agent_names + status filters
  const filteredCommissions = useMemo(() => {
    let list = commissions.filter((c) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q ||
        c.plot_no?.toLowerCase().includes(q) ||
        c.buyer_name?.toLowerCase().includes(q) ||
        c.latest_agent_name?.toLowerCase().includes(q) ||
        c.all_agent_names?.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || (c.plot_status || '').toUpperCase() === statusFilter;
      const matchesCommissionStatus = commissionStatusFilter === 'all' || c.latest_status === commissionStatusFilter;
      return matchesSearch && matchesStatus && matchesCommissionStatus;
    });
    list = [...list].sort((a, b) => {
      const order = naturalSortPlotNo(a.plot_no, b.plot_no);
      return sortOrder === 'asc' ? order : -order;
    });
    return list;
  }, [commissions, searchQuery, sortOrder, statusFilter, commissionStatusFilter]);

  // Available filter options derived from data
  const statusOptions = useMemo(() => {
    const counts = {};
    commissions.forEach(c => {
      const s = (c.plot_status || 'UNKNOWN').toUpperCase();
      counts[s] = (counts[s] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0]));
  }, [commissions]);

  const commissionStatusOptions = useMemo(() => {
    const counts = {};
    commissions.forEach(c => {
      const s = c.latest_status || 'Unknown';
      counts[s] = (counts[s] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0]));
  }, [commissions]);

  // Group by plot_no so duplicate plot numbers collapse into one row with timeline
  const groupedCommissions = useMemo(() => {
    const map = new Map();
    for (const c of filteredCommissions) {
      const key = c.plot_no;
      if (!map.has(key)) {
        map.set(key, {
          plot_no: c.plot_no,
          entries: [],
        });
      }
      const group = map.get(key);
      group.entries.push(c);
    }
    // Sort entries within each group by latest_created_at desc
    for (const group of map.values()) {
      group.entries.sort((a, b) => new Date(b.latest_created_at) - new Date(a.latest_created_at));
      // Use the first (most recent / current) booking's values — NOT summed across resales
      const latest = group.entries[0];
      group.total_commission = parseFloat(latest.total_commission) || 0;
      group.total_paid = parseFloat(latest.total_paid) || 0;
      group.cash_paid = parseFloat(latest.cash_paid) || 0;
      group.bank_paid = parseFloat(latest.bank_paid) || 0;
      group.balance = parseFloat(latest.balance) || 0;
      group.plot_id = latest.plot_id;
      group.buyer_name = latest.buyer_name;
      group.plot_size = latest.plot_size;
      group.plot_rate = latest.plot_rate;
      group.commission_rate = latest.commission_rate;
      group.plot_tag = latest.plot_tag;
      group.plot_status = latest.plot_status;
      group.latest_agent_name = latest.latest_agent_name;
      group.latest_agent_phone = latest.latest_agent_phone;
      group.latest_status = latest.latest_status;
      // The commission-master id — the key PUT/DELETE /plot-commission/:id need.
      // The list payload only exposes the latest master per plot.
      group.latest_commission_id = latest.latest_commission_id;
      group.all_agent_names = [...new Set(group.entries.flatMap(e => (e.all_agent_names || '').split(', ').filter(Boolean)))].join(', ');
      group.commission_count = group.entries.length;
    }
    return [...map.values()];
  }, [filteredCommissions]);

  // Aggregated Stats — use grouped values which already use fixed commission
  const totals = useMemo(() => {
    return groupedCommissions.reduce(
      (acc, g) => {
        acc.total_commission += g.total_commission;
        acc.total_paid += g.total_paid;
        acc.cash_paid += g.cash_paid;
        acc.bank_paid += g.bank_paid;
        acc.balance += g.balance;
        return acc;
      },
      { total_commission: 0, total_paid: 0, cash_paid: 0, bank_paid: 0, balance: 0 }
    );
  }, [groupedCommissions]);

  const uniqueAgentsCount = useMemo(() => {
    const names = new Set();
    filteredCommissions.forEach(c => {
      if (c.all_agent_names) c.all_agent_names.split(', ').forEach(n => names.add(n));
    });
    return names.size;
  }, [filteredCommissions]);

  // Footer totals — use grouped values for correct fixed commission
  const footerTotals = useMemo(() => {
    let totalArea = 0;
    let totalCommission = 0;
    let totalPaid = 0;
    let totalBalance = 0;
    for (const g of groupedCommissions) {
      totalCommission += g.total_commission;
      totalPaid += g.total_paid;
      totalBalance += g.balance;
      totalArea += parseFloat(g.plot_size) || 0;
    }
    return { totalArea, totalCommission, totalPaid, totalBalance };
  }, [groupedCommissions]);

  const formatCurrency = (val) => {
    const num = parseFloat(val) || 0;
    return num.toLocaleString('en-IN', { maximumFractionDigits: 0 });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  if (!currentSite) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <LayoutGrid className="w-10 h-10 text-slate-200 mb-3" />
        <p className="text-sm text-slate-500">Select a site to view commissions</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Plot Commission Payments</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Structured commission management for <span className="font-medium text-slate-700">{currentSite.name}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => {
            const siteName = (currentSite?.name || '').toUpperCase();
            const siteAddr = [currentSite?.address, currentSite?.city, currentSite?.state].filter(Boolean).join(', ').toUpperCase();
            const fmtINR = (v) => parseFloat(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 });
            
            const html = `<!DOCTYPE html>
<html>
<head>
  <title>MASTER COMMISSION STATEMENT - ${currentSite.name}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Inter:wght@400;500;600;700&display=swap');
    @page { size: A4 landscape; margin: 10mm; }
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: 'Inter', sans-serif; color: #1e293b; background: #fff; padding: 10mm; }
    .header { text-align: center; border-bottom: 3px double #0f172a; padding-bottom: 5mm; margin-bottom: 8mm; }
    .header h1 { font-family: 'Cinzel', serif; font-size: 24px; color: #0f172a; text-transform: uppercase; }
    .header p { font-size: 9px; color: #64748b; font-weight: 600; margin-top: 3px; }
    .title { text-align: center; font-family: 'Cinzel', serif; font-size: 14px; margin-bottom: 6mm; letter-spacing: 2px; text-decoration: underline; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; }
    th { background: #f1f5f9; padding: 3mm 2mm; text-align: left; text-transform: uppercase; font-weight: 800; border: 1px solid #cbd5e1; }
    td { padding: 3mm 2mm; border: 1px solid #e2e8f0; }
    .total-row { font-weight: 800; background: #f8fafc; }
    @media print { .no-print { display: none !important; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>${siteName}</h1>
    <p>${siteAddr || 'MASTER COMMISSION DISBURSEMENT LEDGER'}</p>
  </div>
  <div class="title">Master Commission Settlement Register</div>
  <table>
    <thead>
      <tr>
        <th>Plot</th>
        <th>Buyer</th>
        <th>Agent(s)</th>
        <th style="text-align:right">Total Comm.</th>
        <th style="text-align:right">Paid</th>
        <th style="text-align:right">Pending</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${groupedCommissions.map(g => `
        <tr>
          <td>${g.plot_no}${g.commission_count > 1 ? ' <small style="color:#b45309">(RESALE)</small>' : ''}</td>
          <td>${g.buyer_name || '—'}</td>
          <td>${g.all_agent_names || '—'}</td>
          <td style="text-align:right">₹${fmtINR(g.total_commission)}</td>
          <td style="text-align:right; color:#059669">₹${fmtINR(g.total_paid)}</td>
          <td style="text-align:right; color:#dc2626">₹${fmtINR(g.balance)}</td>
          <td>${g.latest_status}</td>
        </tr>
      `).join('')}
      <tr class="total-row">
        <td colspan="3" style="text-align:right">GRAND TOTALS</td>
        <td style="text-align:right">₹${fmtINR(footerTotals.totalCommission)}</td>
        <td style="text-align:right">₹${fmtINR(footerTotals.totalPaid)}</td>
        <td style="text-align:right">₹${fmtINR(footerTotals.totalBalance)}</td>
        <td></td>
      </tr>
    </tbody>
  </table>
  <div class="no-print" style="margin-top:20px; text-align:center;">
    <button onclick="window.print()" style="padding:10px 40px; background:#0f172a; color:#fff; border:none; border-radius:6px; cursor:pointer;">PRINT REGISTER</button>
  </div>
</body>
</html>`;
            const w = window.open('', '_blank');
            w.document.write(html);
            w.document.close();
          }} className="h-8 border-blue-200 text-blue-700 hover:bg-blue-50 mr-2">
            <Printer className="h-4 w-4 mr-2" /> Print Statement
          </Button>
        </div>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-none border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Total Comm.</p>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                <IndianRupee className="w-4 h-4 text-emerald-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-2">₹{formatCurrency(totals.total_commission)}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{groupedCommissions.length} plot{groupedCommissions.length !== 1 ? 's' : ''} <span className="text-[9px] opacity-60">({filteredCommissions.length} records)</span></p>
          </CardContent>
        </Card>
        <Card className="shadow-none border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Total Paid</p>
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <IndianRupee className="w-4 h-4 text-blue-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-2">₹{formatCurrency(totals.total_paid)}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">approved payouts</p>
          </CardContent>
        </Card>
        <Card className="shadow-none border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Pending Comm.</p>
              <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                <IndianRupee className="w-4 h-4 text-amber-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-2">₹{formatCurrency(totals.balance)}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">outstanding balance</p>
          </CardContent>
        </Card>
        <Card className="shadow-none border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Agents</p>
              <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
                <Users className="w-4 h-4 text-purple-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-2">{uniqueAgentsCount}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">active commission receivers</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Cash vs Bank Flow ── Cash + Bank = Total Paid; same classifier
          the Day Book and Farmers/Expenses pages use, so numbers reconcile. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="relative overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 p-4">
          <svg className="absolute -bottom-3 -right-3 w-28 h-28 text-emerald-100 opacity-60" viewBox="0 0 100 100" fill="currentColor">
            <path d="M100 100C100 44.8 55.2 0 0 0v20c33.1 0 60 26.9 60 60h20z" />
            <path d="M100 100C100 66.9 73.1 40 40 40v20c22.1 0 40 17.9 40 40h20z" opacity="0.5" />
          </svg>
          <div className="relative flex items-start justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Cash Paid to Agents</p>
              <p className="text-2xl font-extrabold text-emerald-700 mt-1.5 tabular-nums leading-none truncate">
                ₹{formatCurrency(totals.cash_paid)}
              </p>
              <p className="text-[11px] text-slate-500 mt-1.5">
                {totals.total_paid > 0 ? `${Math.round((totals.cash_paid / totals.total_paid) * 100)}% of total paid` : 'No payouts yet'}
                {' · '}Mode: CASH
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0 text-emerald-600">
              <Banknote className="w-5 h-5" />
            </div>
          </div>
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-blue-50 to-sky-50 p-4">
          <svg className="absolute -bottom-3 -right-3 w-28 h-28 text-indigo-100 opacity-60" viewBox="0 0 100 100" fill="currentColor">
            <path d="M100 100C100 44.8 55.2 0 0 0v20c33.1 0 60 26.9 60 60h20z" />
            <path d="M100 100C100 66.9 73.1 40 40 40v20c22.1 0 40 17.9 40 40h20z" opacity="0.5" />
          </svg>
          <div className="relative flex items-start justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Bank Paid to Agents</p>
              <p className="text-2xl font-extrabold text-indigo-700 mt-1.5 tabular-nums leading-none truncate">
                ₹{formatCurrency(totals.bank_paid)}
              </p>
              <p className="text-[11px] text-slate-500 mt-1.5">
                {totals.total_paid > 0 ? `${Math.round((totals.bank_paid / totals.total_paid) * 100)}% of total paid` : 'No payouts yet'}
                {' · '}RTGS / NEFT / IMPS / UPI / Cheque / Bank
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0 text-indigo-600">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search plot, buyer, agent..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          {/* Plot Status Filter */}
          {statusOptions.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] uppercase text-slate-400 font-semibold tracking-wider mr-1">Plot:</span>
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                  statusFilter === 'all'
                    ? 'bg-slate-800 text-white border-slate-800'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                All ({commissions.length})
              </button>
              {statusOptions.map(([status, count]) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(statusFilter === status ? 'all' : status)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                    statusFilter === status
                      ? status === 'BOOKED' ? 'bg-blue-600 text-white border-blue-600'
                        : status === 'REGISTRY' ? 'bg-purple-600 text-white border-purple-600'
                        : 'bg-slate-800 text-white border-slate-800'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {status} ({count})
                </button>
              ))}
            </div>
          )}
        </div>
        {/* Commission Payment Status Filter */}
        {commissionStatusOptions.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] uppercase text-slate-400 font-semibold tracking-wider mr-1">Commission:</span>
            <button
              onClick={() => setCommissionStatusFilter('all')}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                commissionStatusFilter === 'all'
                  ? 'bg-slate-800 text-white border-slate-800'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              All
            </button>
            {commissionStatusOptions.map(([status, count]) => (
              <button
                key={status}
                onClick={() => setCommissionStatusFilter(commissionStatusFilter === status ? 'all' : status)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                  commissionStatusFilter === status
                    ? status === 'Completed' ? 'bg-emerald-600 text-white border-emerald-600'
                      : status === 'Partial' ? 'bg-amber-600 text-white border-amber-600'
                      : status === 'Pending' ? 'bg-slate-600 text-white border-slate-600'
                      : 'bg-slate-800 text-white border-slate-800'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {status} ({count})
              </button>
            ))}
            <span className="text-xs text-slate-400 ml-auto">
              {groupedCommissions.length} plot{groupedCommissions.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      {/* ── Master Commission Table ── */}
      <Card className="shadow-none border-slate-200">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
            </div>
          ) : groupedCommissions.length === 0 ? (
            <div className="text-center py-16">
              <LayoutGrid className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No commission assignments found</p>
              <p className="text-xs text-slate-400 mt-0.5">Assign commission to a plot agent to get started</p>
            </div>
          ) : (
            <div className="overflow-auto relative z-0 will-change-scroll" style={{ maxHeight: 'calc(100vh - 300px)', WebkitOverflowScrolling: 'touch' }}>
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-30 bg-slate-50" style={{ boxShadow: '0 1px 0 0 #e2e8f0' }}>
                  <tr>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 sticky left-0 z-40 bg-slate-50 px-3 py-2 text-left w-20">
                      <Button variant="ghost" size="sm" onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')} className="h-6 px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500 -ml-1">
                        Plot No <ArrowUpDown className="w-3 h-3 ml-1" />
                      </Button>
                    </th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 sticky left-20 z-40 bg-slate-50 px-3 py-2 text-left" style={{boxShadow: '2px 0 4px -1px rgba(0,0,0,0.08)'}}>Buyer Name</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-left">Plot Size</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-left">Agent</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-right">Comm. Rate</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-right">Total Comm.</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-right">Paid</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-right">Pending</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-left">Status</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedCommissions.map((g) => {
                    const latest = g.entries[0];
                    return (
                      <tr 
                        key={g.plot_no} 
                        className="group border-b cursor-pointer hover:bg-slate-50/50 transition-colors"
                        onClick={() => navigate(`/plot-commission/plot/${latest.plot_id}?site_id=${siteId}`)}
                        style={{ contentVisibility: 'auto', containIntrinsicSize: '0 44px' }}
                      >
                        <td className="sticky left-0 z-10 bg-white px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className="text-[11px] font-mono bg-slate-50 text-slate-700 border-slate-200">
                              {g.plot_no}
                            </Badge>
                            {g.commission_count > 1 && (
                              <Badge className="text-[9px] px-1.5 py-0 font-semibold bg-amber-50 text-amber-700 border-amber-200" variant="outline">
                                <RefreshCw className="w-2.5 h-2.5 mr-0.5" />
                                RESALE
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="sticky left-20 z-10 bg-white px-3 py-2" style={{boxShadow: '2px 0 4px -1px rgba(0,0,0,0.08)'}}>
                          <span className="text-sm text-slate-700">{g.buyer_name || '—'}</span>
                        </td>
                        <td className="px-3 py-2">
                          <span className="text-sm text-slate-700">{g.plot_size || '—'}</span>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-slate-800">{g.latest_agent_name}</span>
                            {g.latest_agent_phone && <span className="text-[10px] text-slate-400">{g.latest_agent_phone}</span>}
                            {g.commission_count > 1 && (
                              <span className="text-[10px] text-amber-600 font-medium mt-0.5">{g.commission_count} agents total</span>
                            )}
                          </div>
                        </td>
                        <td className="text-right px-3 py-2">
                          <span className="text-sm font-medium text-slate-700 tabular-nums">
                            {g.commission_rate ? `₹${parseFloat(g.commission_rate).toLocaleString('en-IN')}` : '—'}
                          </span>
                        </td>
                        <td className="text-right px-3 py-2">
                          <span className="text-sm font-semibold text-slate-900 tabular-nums">
                            {formatCurrency(g.total_commission)}
                          </span>
                        </td>
                        <td className="text-right px-3 py-2">
                          <span className="text-sm font-medium text-emerald-600 tabular-nums">
                            {formatCurrency(g.total_paid)}
                          </span>
                        </td>
                        <td className="text-right px-3 py-2">
                          <span className="text-sm font-medium text-amber-600 tabular-nums">
                            {formatCurrency(g.balance)}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <Badge 
                             className={`text-[10px] uppercase font-semibold ${
                               g.latest_status === 'Completed' ? 'bg-emerald-100/50 text-emerald-700 border-emerald-200 outline-emerald-300' :
                               g.latest_status === 'Partial' ? 'bg-amber-100/50 text-amber-700 border-amber-200 outline-amber-300' :
                               'bg-slate-100/50 text-slate-700 border-slate-200 outline-slate-300'
                             }`}
                             variant="outline"
                          >
                            {g.latest_status}
                          </Badge>
                        </td>
                        <td className="text-center px-3 py-2">
                          <div className="flex items-center justify-center gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/plot-commission/plot/${latest.plot_id}?site_id=${siteId}`);
                              }}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {/* Edit/Delete act on the LATEST commission master
                                for this plot. A resale row groups several
                                masters but the list payload only carries
                                latest_commission_id, so older ones stay
                                editable from the detail page only — hence the
                                hint in the dialog. */}
                            {canUpdate && (
                              <Button
                                variant="ghost" size="icon" title="Edit commission"
                                className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                                onClick={(e) => { e.stopPropagation(); handleOpenEdit(g); }}
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                            )}
                            {canDelete && (
                              <Button
                                variant="ghost" size="icon" title="Delete commission"
                                className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                                onClick={(e) => { e.stopPropagation(); setDeleteTarget(g); }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {groupedCommissions.length > 0 && (
                  <tfoot className="sticky bottom-0 z-20 bg-slate-50 border-t-2 border-slate-300">
                    <tr className="font-semibold text-xs">
                      <td className="sticky left-0 z-30 bg-slate-50 px-3 py-2.5 text-slate-700" colSpan={2}>
                        TOTALS
                      </td>
                      <td className="px-3 py-2.5 text-slate-700">{footerTotals.totalArea ? footerTotals.totalArea.toLocaleString('en-IN') : '—'}</td>
                      <td className="px-3 py-2.5"></td>
                      <td className="px-3 py-2.5"></td>
                      <td className="text-right px-3 py-2.5 text-slate-900 tabular-nums">₹{formatCurrency(footerTotals.totalCommission)}</td>
                      <td className="text-right px-3 py-2.5 text-emerald-700 tabular-nums">₹{formatCurrency(footerTotals.totalPaid)}</td>
                      <td className="text-right px-3 py-2.5 text-amber-700 tabular-nums">₹{formatCurrency(footerTotals.totalBalance)}</td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Edit commission ── */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && !saving && setEditTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Edit Commission · Plot {editTarget?.plot_no}</DialogTitle>
            <DialogDescription className="text-sm">
              {editTarget?.latest_agent_name
                ? <>Agent <span className="font-medium text-slate-700">{editTarget.latest_agent_name}</span>. Payments already recorded are not changed.</>
                : 'Payments already recorded are not changed.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Total Commission (₹) *</Label>
              <Input
                type="number" step="0.01" min="0" required autoFocus
                value={editForm.total_commission}
                onChange={(e) => setEditForm((p) => ({ ...p, total_commission: e.target.value }))}
              />
              {editTarget?.total_paid > 0 && (
                <p className="text-[10px] text-slate-400">
                  ₹{Number(editTarget.total_paid).toLocaleString('en-IN')} already paid against this plot.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Remarks</Label>
              <Input
                placeholder="Optional note"
                value={editForm.remarks}
                onChange={(e) => setEditForm((p) => ({ ...p, remarks: e.target.value }))}
              />
            </div>
            {editTarget?.commission_count > 1 && (
              <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[11px] text-amber-800">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  This plot has {editTarget.commission_count} bookings (resale). Only the newest agent&apos;s
                  commission is edited here — open the plot to edit the others.
                </span>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" size="sm" disabled={saving} onClick={() => setEditTarget(null)}>Cancel</Button>
              <Button type="submit" size="sm" disabled={saving}>
                {saving ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Saving...</> : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete commission ── */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && !saving && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Delete commission for plot {deleteTarget?.plot_no}?</DialogTitle>
            <DialogDescription className="text-sm">
              This permanently deletes the commission for
              {' '}<span className="font-medium text-slate-700">{deleteTarget?.latest_agent_name || 'this agent'}</span>
              {' '}and every payment recorded against it. It cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {/* Delete cascades to plot_commission_payments and their cash-flow
              mirrors, so name the money at risk rather than a bare "are you sure?". */}
          {deleteTarget?.total_paid > 0 && (
            <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <span className="font-semibold">₹{Number(deleteTarget.total_paid).toLocaleString('en-IN')}</span> has
                already been paid against this commission. Those payment records and their cash-flow entries
                will be deleted too.
              </span>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" disabled={saving} onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              type="button" size="sm" disabled={saving}
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={handleDeleteConfirm}
            >
              {saving ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Deleting...</> : 'Delete Commission'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PlotCommissionList;
