import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '../components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../components/ui/table';
import {
  Plus, Search, Edit2, Trash2, Eye, Phone, MapPin, Percent, Loader2,
  ArrowDownLeft, ArrowUpRight, AlertTriangle, Calculator, Users, Wallet,
} from 'lucide-react';
import { computeLoanStatus, summarise, inr, inrShort } from '../utils/interest';

const EMPTY_FORM = { name: '', phone: '', address: '', note: '' };

const StatTile = (props) => {
  // Local capitalised alias — the repo's eslint counts JSX-only usage of a
  // destructured param as unused, but not of a variable.
  const Icon = props.icon;
  const { label, value, sub, tone } = props;
  return (
    <div className={`relative overflow-hidden rounded-2xl border p-4 ${tone.wrap}`}>
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</p>
          <p className={`text-2xl font-extrabold mt-1.5 tabular-nums leading-none truncate ${tone.value}`}>{value}</p>
          <p className="text-[11px] text-slate-500 mt-1.5 truncate">{sub}</p>
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tone.icon}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
};

const InterestParties = () => {
  const { currentSite, hasPermission } = useAuth();
  const navigate = useNavigate();
  const siteId = currentSite?.id;

  const canWrite = hasPermission('interest', 'write');
  const canUpdate = hasPermission('interest', 'update');
  const canDelete = hasPermission('interest', 'delete');

  const [parties, setParties] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sideFilter, setSideFilter] = useState('all');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const fetchParties = useCallback(async () => {
    if (!siteId) return;
    setLoading(true);
    try {
      const res = await api.get(`/interest/parties?site_id=${siteId}`);
      setParties(res.data.parties || []);
      setTransactions(res.data.transactions || []);
    } catch (err) {
      console.error('Failed to fetch interest parties:', err);
      toast.error(err.response?.data?.message || 'Could not load parties');
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => {
    setParties([]);
    fetchParties();
  }, [fetchParties]);

  // Every party's live position, run through the same accrual walk the detail
  // page uses — so the two screens can never show different numbers.
  const rows = useMemo(() => {
    const today = new Date();
    return parties.map((p) => {
      const statuses = (p.loans || []).map((loan) => computeLoanStatus(loan, transactions, today));
      const totals = summarise(statuses);
      return {
        ...p,
        statuses,
        totals,
        loanCount: (p.loans || []).length,
        net: totals.receivable.payoff - totals.payable.payoff,
      };
    });
  }, [parties, transactions]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (sideFilter === 'payable' && r.totals.payable.count === 0) return false;
      if (sideFilter === 'receivable' && r.totals.receivable.count === 0) return false;
      if (sideFilter === 'overdue' && r.totals.overdue === 0) return false;
      if (!q) return true;
      return (
        (r.name || '').toLowerCase().includes(q) ||
        (r.phone || '').toLowerCase().includes(q) ||
        (r.address || '').toLowerCase().includes(q)
      );
    });
  }, [rows, search, sideFilter]);

  const site = useMemo(() => summarise(rows.flatMap((r) => r.statuses)), [rows]);

  const openCreate = () => { setForm(EMPTY_FORM); setEditingId(null); setDialogOpen(true); };

  const openEdit = (party) => {
    setForm({
      name: party.name || '',
      phone: party.phone || '',
      address: party.address || '',
      note: party.note || '',
    });
    setEditingId(party.id);
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Party name is required');
    setSaving(true);
    try {
      const payload = { ...form, site_id: siteId };
      if (editingId) {
        await api.put(`/interest/parties/${editingId}?site_id=${siteId}`, payload);
        toast.success('Party updated');
      } else {
        await api.post('/interest/parties', payload);
        toast.success('Party added');
      }
      setDialogOpen(false);
      setForm(EMPTY_FORM);
      setEditingId(null);
      fetchParties();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save party');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (party) => {
    const extra = party.loanCount > 0
      ? `\n\nThis also deletes ${party.loanCount} deal${party.loanCount === 1 ? '' : 's'} and every transaction under them.`
      : '';
    if (!window.confirm(`Delete "${party.name}"?${extra}`)) return;
    setDeletingId(party.id);
    try {
      await api.delete(`/interest/parties/${party.id}?site_id=${siteId}`);
      toast.success('Party deleted');
      fetchParties();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not delete party');
    } finally {
      setDeletingId(null);
    }
  };

  if (!currentSite) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Percent className="w-10 h-10 text-slate-200 mb-3" />
        <p className="text-sm text-slate-500">Select a site to manage interest parties</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full md:max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Interest Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            People you borrow from or lend to, with every transaction and live interest
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => navigate('/interest/calculator')} className="text-slate-600">
            <Calculator className="w-4 h-4 mr-1.5" /> Calculator
          </Button>
          {canWrite && (
            <Button size="sm" onClick={openCreate}>
              <Plus className="w-4 h-4 mr-1.5" /> Add Party
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile
          label="You Owe (Payable)"
          value={`₹${inrShort(site.payable.payoff)}`}
          sub={`${site.payable.count} borrowed deal${site.payable.count === 1 ? '' : 's'} · ₹${inrShort(site.payable.interest)} interest due`}
          icon={ArrowDownLeft}
          tone={{
            wrap: 'border-rose-100 bg-gradient-to-br from-rose-50 via-rose-50/50 to-white',
            value: 'text-rose-700',
            icon: 'bg-rose-100 text-rose-600',
          }}
        />
        <StatTile
          label="You Get (Receivable)"
          value={`₹${inrShort(site.receivable.payoff)}`}
          sub={`${site.receivable.count} lent deal${site.receivable.count === 1 ? '' : 's'} · ₹${inrShort(site.receivable.interest)} interest due`}
          icon={ArrowUpRight}
          tone={{
            wrap: 'border-emerald-100 bg-gradient-to-br from-emerald-50 via-emerald-50/50 to-white',
            value: 'text-emerald-700',
            icon: 'bg-emerald-100 text-emerald-600',
          }}
        />
        <StatTile
          label="Net Position"
          value={`₹${inrShort(Math.abs(site.receivable.payoff - site.payable.payoff))}`}
          sub={site.receivable.payoff >= site.payable.payoff ? 'In your favour' : 'Against you'}
          icon={Wallet}
          tone={{
            wrap: 'border-slate-200 bg-gradient-to-br from-slate-50 via-white to-white',
            value: site.receivable.payoff >= site.payable.payoff ? 'text-emerald-700' : 'text-rose-700',
            icon: 'bg-slate-100 text-slate-600',
          }}
        />
        <StatTile
          label="Overdue Deals"
          value={String(site.overdue)}
          sub={site.overdue > 0 ? 'Past maturity with a balance' : 'Nothing past maturity'}
          icon={AlertTriangle}
          tone={{
            wrap: site.overdue > 0
              ? 'border-amber-200 bg-gradient-to-br from-amber-50 via-amber-50/50 to-white'
              : 'border-slate-200 bg-gradient-to-br from-slate-50 via-white to-white',
            value: site.overdue > 0 ? 'text-amber-700' : 'text-slate-700',
            icon: site.overdue > 0 ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500',
          }}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search name, phone or address..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Select value={sideFilter} onValueChange={setSideFilter}>
          <SelectTrigger className="w-full sm:w-44 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All parties</SelectItem>
            <SelectItem value="payable">I owe them</SelectItem>
            <SelectItem value="receivable">They owe me</SelectItem>
            <SelectItem value="overdue">Overdue only</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-slate-400 sm:ml-auto">
          {filtered.length} part{filtered.length === 1 ? 'y' : 'ies'}
        </span>
      </div>

      {/* Table */}
      <Card className="shadow-none border-slate-200">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 px-4">
              <Users className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-500">
                {parties.length === 0 ? 'No parties yet' : 'No parties match this filter'}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {parties.length === 0
                  ? 'Add the person you borrowed from or lent to, then record their deals'
                  : 'Try clearing the search or the filter'}
              </p>
              {parties.length === 0 && canWrite && (
                <Button size="sm" className="mt-4" onClick={openCreate}>
                  <Plus className="w-4 h-4 mr-1.5" /> Add First Party
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs">Party</TableHead>
                    <TableHead className="text-xs">Deals</TableHead>
                    <TableHead className="text-xs text-right">I Owe</TableHead>
                    <TableHead className="text-xs text-right">They Owe</TableHead>
                    <TableHead className="text-xs text-right">Net</TableHead>
                    <TableHead className="text-xs text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((party) => (
                    <TableRow
                      key={party.id}
                      className="cursor-pointer hover:bg-slate-50/80"
                      onClick={() => navigate(`/interest/${party.id}`)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-slate-600 text-sm font-bold shrink-0">
                            {(party.name || '?').charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">{party.name}</p>
                            <div className="flex items-center gap-2.5 mt-0.5 flex-wrap">
                              {party.phone && (
                                <span className="text-[11px] text-slate-400 flex items-center gap-0.5">
                                  <Phone className="w-3 h-3" /> {party.phone}
                                </span>
                              )}
                              {party.address && (
                                <span className="text-[11px] text-slate-400 flex items-center gap-0.5 truncate max-w-[24ch]">
                                  <MapPin className="w-3 h-3 shrink-0" /> {party.address}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge variant="outline" className="text-[10px]">
                            {party.loanCount} deal{party.loanCount === 1 ? '' : 's'}
                          </Badge>
                          {party.totals.overdue > 0 && (
                            <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                              {party.totals.overdue} overdue
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {party.totals.payable.payoff > 0 ? (
                          <span className="text-sm font-medium text-rose-600 tabular-nums">
                            ₹{inr(party.totals.payable.payoff)}
                          </span>
                        ) : (
                          <span className="text-sm text-slate-300">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {party.totals.receivable.payoff > 0 ? (
                          <span className="text-sm font-medium text-emerald-600 tabular-nums">
                            ₹{inr(party.totals.receivable.payoff)}
                          </span>
                        ) : (
                          <span className="text-sm text-slate-300">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`text-sm font-semibold tabular-nums ${
                          party.net > 0 ? 'text-emerald-700' : party.net < 0 ? 'text-rose-700' : 'text-slate-400'
                        }`}>
                          {party.net === 0 ? '—' : `${party.net > 0 ? '+' : '−'}₹${inr(Math.abs(party.net))}`}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/interest/${party.id}`)}
                            className="h-7 w-7 p-0 text-slate-400 hover:text-blue-600"
                            title="View deals & transactions"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          {canUpdate && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEdit(party)}
                              className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700"
                              title="Edit party"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(party)}
                              disabled={deletingId === party.id}
                              className="h-7 w-7 p-0 text-slate-400 hover:text-red-600"
                              title="Delete party"
                            >
                              {deletingId === party.id
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <Trash2 className="w-3.5 h-3.5" />}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit party */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setForm(EMPTY_FORM); setEditingId(null); } }}>
        <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-lg">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base font-semibold text-slate-900">
              {editingId ? 'Edit Party' : 'Add Party'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              The person or firm you borrow money from, or lend money to. Deals and
              transactions are added inside the party.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-[11px]">Name *</Label>
              <Input
                autoFocus
                className="h-9 text-sm"
                placeholder="Ramesh Gupta"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[11px]">Phone</Label>
                <Input
                  className="h-9 text-sm"
                  placeholder="9876543210"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px]">Address</Label>
                <Input
                  className="h-9 text-sm"
                  placeholder="City / Area"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px]">Note</Label>
              <Textarea
                className="text-sm min-h-16"
                placeholder="Anything worth remembering about this party"
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
              />
            </div>

            <DialogFooter className="gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={saving}>
                {saving && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                {editingId ? 'Save Changes' : 'Add Party'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InterestParties;
