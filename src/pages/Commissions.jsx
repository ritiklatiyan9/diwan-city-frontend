import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import html2pdf from 'html2pdf.js';
import UserAvatar from '../components/UserAvatar';
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
  Plus, Edit2, Trash2, AlertCircle, Check, Search,
  IndianRupee, LayoutGrid, Users, MapPin, ChevronDown,
  Download, Filter, Calendar, Loader2, Printer, FileText,
} from 'lucide-react';
import VoucherUpload, { VoucherThumbnail } from '../components/VoucherUpload';
import ApprovalStatusBadge from '../components/ApprovalStatusBadge';

const Commissions = () => {
  const { currentSite, isAdmin, canManage, hasPermission } = useAuth();
  const siteId = currentSite?.id;
  const navigate = useNavigate();
  const location = useLocation();
  const queryFromUrl = useMemo(() => new URLSearchParams(location.search).get('q') || '', [location.search]);

  const canWrite = canManage && hasPermission('commissions', 'write');
  const canUpdate = canManage && hasPermission('commissions', 'update');
  const canDelete = canManage && hasPermission('commissions', 'delete');
  const canUpdateDate = isAdmin || hasPermission('commissions', 'update');

  const [commissions, setCommissions] = useState([]);
  const [summary, setSummary] = useState({ total_entries: 0, total_amount: 0, unique_persons: 0, unique_plots: 0 });
  const [persons, setPersons] = useState([]);
  const [autocomplete, setAutocomplete] = useState({ particulars: [], plots: [] });
  const [approvers, setApprovers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [submitting, setSubmitting] = useState(false);
  const [receiptCommission, setReceiptCommission] = useState(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPerson, setFilterPerson] = useState('all');
  const [personBreakdownOpen, setPersonBreakdownOpen] = useState(false);

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    particular: '',
    father_name: '',
    plot_no: '',
    plot_size: '',
    plot_rate: '',
    amount: '',
    by_note: '',
    remarks: '',
    voucher_url: '',
    assigned_admin_id: null,
  });

  // ── Fetch data ──
  const fetchCommissions = useCallback(async () => {
    if (!siteId) return;
    try {
      setLoading(true);
      setCommissions([]);
      const [listRes, acRes] = await Promise.all([
        api.get(`/commissions?site_id=${siteId}`),
        api.get(`/commissions/autocomplete?site_id=${siteId}`),
      ]);
      setCommissions(listRes.data.commissions || []);
      setSummary(listRes.data.summary || {});
      setPersons(listRes.data.persons || []);
      setAutocomplete(acRes.data || { particulars: [], plots: [] });
    } catch (err) {
      console.error('Failed to fetch commissions:', err);
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => {
    setCommissions([]);
    setSearchQuery(queryFromUrl);
    setFilterPerson('all');
    fetchCommissions();
  }, [fetchCommissions, queryFromUrl]);

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

  // ── Form handlers ──
  const resetForm = () => {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      particular: '',
      father_name: '',
      plot_no: '',
      plot_size: '',
      plot_rate: '',
      amount: '',
      by_note: '',
      remarks: '',
      voucher_url: '',
      assigned_admin_id: null,
    });
    setEditingId(null);
    setMessage({ type: '', text: '' });
  };

  const handleOpenCreate = () => { resetForm(); setDialogOpen(true); };

  const handleOpenEdit = (c) => {
    setFormData({
      date: c.date ? c.date.split('T')[0] : '',
      particular: c.particular || '',
      father_name: c.father_name || c.father_name_resolved || '',
      plot_no: c.plot_no || '',
      plot_size: c.plot_size || '',
      plot_rate: c.plot_rate || '',
      amount: c.amount || '',
      by_note: c.by_note || '',
      remarks: c.remarks || '',
      voucher_url: c.voucher_url || '',
      assigned_admin_id: c.assigned_admin_id || null,
    });
    setEditingId(c.id);
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    setSubmitting(true);
    try {
      const payload = { ...formData, site_id: siteId, amount: parseFloat(formData.amount) || 0, assigned_admin_id: formData.assigned_admin_id };
      if (editingId) {
        await api.put(`/commissions/${editingId}`, payload);
        setMessage({ type: 'success', text: 'Entry updated' });
      } else {
        await api.post('/commissions', payload);
        setMessage({ type: 'success', text: 'Entry added' });
      }
      await fetchCommissions();
      setTimeout(() => setDialogOpen(false), 400);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Operation failed' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this commission entry?')) return;
    try {
      await api.delete(`/commissions/${id}`);
      await fetchCommissions();
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  };

  const handleOpenReceipt = (c) => {
    setReceiptCommission(c);
    setReceiptOpen(true);
  };

  const handlePrintReceipt = async () => {
    const printContent = document.getElementById('commission-receipt-print');
    if (!printContent) return;

    try {
      setIsPrinting(true);

      const fileName = `Receipt_${receiptCommission?.id ? String(receiptCommission.id).padStart(4, '0') : 'Generated'}.pdf`;

      const opt = {
        margin: 0,
        filename: fileName,
        image: { type: 'jpeg', quality: 1.0 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      await html2pdf().set(opt).from(printContent).save();

    } catch (err) {
      console.error('Failed to generate PDF:', err);
      alert('Failed to generate PDF receipt: ' + err.message);
    } finally {
      setIsPrinting(false);
    }
  };

  // ── Filtering ──
  const filteredCommissions = useMemo(() => {
    return commissions.filter((c) => {
      const q = searchQuery.toLowerCase();
      const matchSearch =
        !q ||
        c.particular?.toLowerCase().includes(q) ||
        c.plot_no?.toLowerCase().includes(q) ||
        c.by_note?.toLowerCase().includes(q) ||
        c.remarks?.toLowerCase().includes(q);
      const matchPerson = filterPerson === 'all' || c.particular === filterPerson;
      return matchSearch && matchPerson;
    });
  }, [commissions, searchQuery, filterPerson]);

  // Running balance (on filtered list)
  const commissionsWithBalance = useMemo(() => {
    let balance = 0;
    return filteredCommissions.map((c) => {
      balance += parseFloat(c.amount) || 0;
      return { ...c, balance };
    });
  }, [filteredCommissions]);

  const filteredTotal = useMemo(() => {
    return filteredCommissions.reduce((s, c) => s + (parseFloat(c.amount) || 0), 0);
  }, [filteredCommissions]);

  // ── Helpers ──
  const formatCurrency = (val) => {
    const num = parseFloat(val) || 0;
    return num.toLocaleString('en-IN', { maximumFractionDigits: 0 });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  // Unique persons for filter dropdown
  const uniquePersons = useMemo(() => {
    const set = new Set(commissions.map((c) => c.particular));
    return Array.from(set).sort();
  }, [commissions]);

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
            Commission ledger for <span className="font-medium text-slate-700">{currentSite.name}</span>
          </p>
        </div>
        {canWrite && (
          <Button size="sm" onClick={() => navigate('/commissions/create')}>
            <Plus className="w-4 h-4 mr-1.5" /> Add Entry
          </Button>
        )}
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="shadow-none border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Total Commission</p>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                <IndianRupee className="w-4 h-4 text-emerald-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-2">₹{formatCurrency(summary.total_amount)}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{summary.total_entries} entries</p>
          </CardContent>
        </Card>
        <Card className="shadow-none border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">People</p>
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <Users className="w-4 h-4 text-blue-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-2">{summary.unique_persons || 0}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">unique persons</p>
          </CardContent>
        </Card>
        <Card className="shadow-none border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Plots</p>
              <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
                <MapPin className="w-4 h-4 text-purple-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-2">{summary.unique_plots || 0}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">unique plots</p>
          </CardContent>
        </Card>
        <Card className="shadow-none border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Filtered Total</p>
              <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                <Filter className="w-4 h-4 text-amber-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-2">₹{formatCurrency(filteredTotal)}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{filteredCommissions.length} of {commissions.length} entries</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Person Breakdown (Collapsible) ── */}
      {persons.length > 0 && (
        <Collapsible open={personBreakdownOpen} onOpenChange={setPersonBreakdownOpen}>
          <Card className="shadow-none border-slate-200">
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50/50 transition-colors rounded-lg">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-slate-400" />
                  <span className="text-sm font-medium text-slate-700">Person-wise Breakdown</span>
                  <Badge variant="outline" className="text-[10px] ml-1">{persons.length}</Badge>
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${personBreakdownOpen ? 'rotate-180' : ''}`} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-4 pb-4">
                <Separator className="mb-3" />
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                  {persons.map((p) => (
                    <button
                      key={p.particular}
                      onClick={() => setFilterPerson(filterPerson === p.particular ? 'all' : p.particular)}
                      className={`text-left p-2.5 rounded-lg border transition-all ${filterPerson === p.particular
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-150 bg-white hover:border-slate-300 hover:bg-slate-50'
                        }`}
                    >
                      <p className={`text-xs font-semibold truncate ${filterPerson === p.particular ? 'text-white' : 'text-slate-800'}`}>
                        {p.particular}
                      </p>
                      <p className={`text-[11px] mt-0.5 ${filterPerson === p.particular ? 'text-slate-300' : 'text-slate-400'}`}>
                        ₹{formatCurrency(p.total_amount)} · {p.entries} entries
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* ── Filters ── */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search person, plot, remarks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Select value={filterPerson} onValueChange={setFilterPerson}>
          <SelectTrigger className="w-48 h-9">
            <SelectValue placeholder="Filter by person" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Persons</SelectItem>
            {uniquePersons.map((p) => (
              <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {filterPerson !== 'all' && (
          <Button variant="ghost" size="sm" onClick={() => setFilterPerson('all')} className="text-xs text-slate-500">
            Clear filter
          </Button>
        )}
        <span className="text-xs text-slate-400 ml-auto">
          {filteredCommissions.length} entr{filteredCommissions.length !== 1 ? 'ies' : 'y'}
        </span>
      </div>

      {/* ── Commission Table ── */}
      <Card className="shadow-none border-slate-200">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
            </div>
          ) : commissionsWithBalance.length === 0 ? (
            <div className="text-center py-16">
              <LayoutGrid className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No commission entries found</p>
              <p className="text-xs text-slate-400 mt-0.5">Add the first commission payment to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent bg-slate-50/80">
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-10">#</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Date</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Particuler</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Father Name</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Plot No</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Plot Size</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Plot Rate</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right">Amount</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right">Balance</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">By</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Remarks</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Assigned To</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Created By</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Status</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Voucher</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {commissionsWithBalance.map((c, idx) => {
                    const isAdvance = c.remarks?.toUpperCase().includes('ADVANCE');
                    const isAdjust = c.remarks?.toUpperCase().includes('ADJUST');
                    const isOrder = c.remarks?.toUpperCase().includes('ORDER');
                    const highlightClass = isAdvance
                      ? 'bg-amber-50/60'
                      : isAdjust
                        ? 'bg-blue-50/50'
                        : isOrder
                          ? 'bg-emerald-50/40'
                          : '';

                    return (
                      <TableRow key={c.id} className={`group ${highlightClass}`}>
                        <TableCell className="text-xs text-slate-400 font-mono tabular-nums">{idx + 1}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          <span className="text-sm text-slate-700 tabular-nums">{formatDate(c.date)}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-medium text-slate-800">{c.particular}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-slate-600">{c.father_name_resolved || c.father_name || '—'}</span>
                        </TableCell>
                        <TableCell>
                          {c.plot_no ? (
                            <Badge variant="outline" className="text-[11px] font-mono bg-slate-50 text-slate-700 border-slate-200">
                              {c.plot_no}
                            </Badge>
                          ) : (
                            <span className="text-xs text-slate-300">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-slate-600">{c.plot_size || '—'}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-slate-600">{c.plot_rate || '—'}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-sm font-semibold tabular-nums text-slate-900">
                            {formatCurrency(c.amount)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-sm font-medium tabular-nums text-emerald-700">
                            {formatCurrency(c.balance)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-slate-600">{c.by_note || '—'}</span>
                        </TableCell>
                        <TableCell>
                          {c.remarks ? (
                            <span className={`text-xs max-w-48 truncate block ${isAdvance ? 'text-amber-700 font-medium' : isOrder ? 'text-emerald-700' : 'text-slate-500'
                              }`}>
                              {c.remarks}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-300">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {c.assigned_admin_id ? (
                            <span className="inline-flex items-center text-xs font-medium text-purple-700 bg-purple-50 px-2 py-1 rounded-md">
                              {getAssignedAdminLabel(c) || '—'}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-300">Unassigned</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <UserAvatar name={c.created_by_name} label="Created by" />
                        </TableCell>
                        <TableCell>
                          <ApprovalStatusBadge status={c.status || 'pending'} />
                        </TableCell>
                        <TableCell>
                          <VoucherThumbnail url={c.voucher_url} />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-0.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenReceipt(c)}
                              className="h-7 w-7 p-0 text-slate-400 hover:text-blue-600"
                              title="View Receipt"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </Button>
                            {canUpdate && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleOpenEdit(c)}
                                  className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </Button>
                            )}
                            {canDelete && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDelete(c.id)}
                                  className="h-7 w-7 p-0 text-slate-400 hover:text-red-600"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}

                  {/* ── Totals Row ── */}
                  <TableRow className="bg-slate-50 hover:bg-slate-50 border-t-2 border-slate-200">
                    <TableCell colSpan={7} className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Total ({filteredCommissions.length} entries)
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-sm font-bold text-slate-900 tabular-nums">
                        ₹{formatCurrency(filteredTotal)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-sm font-bold text-emerald-700 tabular-nums">
                        ₹{formatCurrency(filteredTotal)}
                      </span>
                    </TableCell>
                    <TableCell colSpan={canManage ? 4 : 3} />
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Receipt Dialog ── */}
      <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
        <DialogContent className="max-w-[95vw] md:max-w-4xl p-0 overflow-hidden">
          <DialogTitle className="sr-only">Commission Receipt Preview</DialogTitle>
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-600" />
              <span className="text-sm font-semibold text-slate-800">Commission Receipt</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handlePrintReceipt}
              disabled={isPrinting}
              className="h-8 text-xs gap-1.5"
            >
              {isPrinting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Printer className="w-3.5 h-3.5" />
                  Print / Save PDF
                </>
              )}
            </Button>
          </div>

          {/* Receipt Preview */}
          <div className="p-4 sm:p-5 bg-slate-100 max-h-[80vh] overflow-auto flex justify-center">
            {receiptCommission && (
              <div
                className="receipt relative shrink-0 shadow-sm border"
                id="commission-receipt-print"
                style={{ width: '794px', minHeight: '1123px', padding: '60px 50px', backgroundColor: '#ffffff', borderColor: '#e2e8f0' }}
              >
                {/* Outer Border (Optional but adds to the classic feel) */}
                <div className="absolute inset-4 border rounded-sm pointer-events-none" style={{ borderColor: '#1e293b' }} />

                {/* Top Header Section */}
                <div className="flex items-start justify-between mb-6 pt-6 px-4">
                  <div className="text-2xl font-serif whitespace-nowrap" style={{ color: '#1e3a8a' }}>
                    {String(receiptCommission.id).padStart(4, '0')}
                  </div>
                  <div className="text-center flex-1">
                    <h1 className="text-[28px] font-serif font-bold underline underline-offset-4 decoration-2 mb-2 uppercase" style={{ color: '#1e3a8a' }}>
                      {currentSite?.name || 'COMMISSION RECEIPT'}
                    </h1>
                    {currentSite && (currentSite.address || currentSite.city) ? (
                      <p className="text-[15px] font-serif font-bold underline underline-offset-2 uppercase" style={{ color: '#1e3a8a' }}>
                        {[currentSite.address, currentSite.city, currentSite.state].filter(Boolean).join(', ')}
                      </p>
                    ) : null}
                  </div>
                  <div className="w-16"></div> {/* Spacer for symmetry */}
                </div>

                {/* Receipt Designation */}
                <div className="text-center mb-8">
                  <h2 className="text-[17px] font-serif font-bold underline underline-offset-2" style={{ color: '#3b82f6' }}>
                    RECEIPT
                  </h2>
                </div>

                {/* Date Line */}
                <div className="flex justify-end mb-8 px-8">
                  <div className="flex items-center gap-2">
                    <span className="text-[15px] font-serif font-bold underline" style={{ color: '#1e3a8a' }}>DATE:-</span>
                    <span className="text-[15px] font-serif font-medium" style={{ color: '#0f172a' }}>{formatDate(receiptCommission.date)}</span>
                  </div>
                </div>

                {/* Core Form Fields */}
                <div className="space-y-6 px-8 flex-1">
                  {/* Received a sum of */}
                  <div className="flex items-end mb-1 w-full">
                    <div className="w-[200px] shrink-0 text-[15px] font-serif" style={{ color: '#1e293b' }}>Received a sum of</div>
                    <div className="w-[20px] shrink-0 text-[15px] font-serif text-center" style={{ color: '#1e293b' }}>:</div>
                    <div className="flex-1 border-b pb-1 flex items-baseline" style={{ borderColor: 'transparent' }}>
                      <span className="text-[16px] font-serif" style={{ color: '#0f172a' }}>Rs {formatCurrency(receiptCommission.amount)}/-</span>
                    </div>
                  </div>

                  {/* From */}
                  <div className="flex items-end mb-1 w-full">
                    <div className="w-[200px] shrink-0 text-[15px] font-serif" style={{ color: '#1e293b' }}>From</div>
                    <div className="w-[20px] shrink-0 text-[15px] font-serif text-center" style={{ color: '#1e293b' }}>:</div>
                    <div className="flex-1 border-b pb-1 flex items-baseline" style={{ borderColor: 'transparent' }}>
                      <span className="text-[16px] font-serif uppercase" style={{ color: '#0f172a' }}>{receiptCommission.particular}</span>
                    </div>
                  </div>

                  {/* Against Plot */}
                  <div className="flex items-end mb-1 w-full">
                    <div className="w-[200px] shrink-0 text-[15px] font-serif" style={{ color: '#1e293b' }}>
                      Against the sale of <span className="underline" style={{ color: '#3b82f6' }}>Plot</span> No
                    </div>
                    <div className="w-[20px] shrink-0 text-[15px] font-serif text-center" style={{ color: '#1e293b' }}>:</div>
                    <div className="flex-1 border-b pb-1 flex items-baseline" style={{ borderColor: 'transparent' }}>
                      <span className="text-[16px] font-serif uppercase" style={{ color: '#0f172a' }}>{receiptCommission.plot_no || '—'}</span>
                    </div>
                  </div>

                  {/* Block */}
                  <div className="flex items-end mb-1 w-full">
                    <div className="w-[200px] shrink-0 text-[15px] font-serif" style={{ color: '#1e293b' }}>Block</div>
                    <div className="w-[20px] shrink-0 text-[15px] font-serif text-center" style={{ color: '#1e293b' }}>:</div>
                    <div className="flex-1 border-b pb-1 flex items-baseline" style={{ borderColor: 'transparent' }}>
                      <span className="text-[16px] font-serif uppercase" style={{ color: '#0f172a' }}>{receiptCommission.block || '—'}</span>
                    </div>
                  </div>

                  {/* Measuring */}
                  <div className="flex items-end mb-1 w-full">
                    <div className="w-[200px] shrink-0 text-[15px] font-serif" style={{ color: '#1e293b' }}>Measuring</div>
                    <div className="w-[20px] shrink-0 text-[15px] font-serif text-center" style={{ color: '#1e293b' }}>:</div>
                    <div className="flex-1 pb-1 flex items-baseline gap-2">
                      <span className="text-[16px] font-serif" style={{ color: '#0f172a' }}>{receiptCommission.plot_size || '—'}</span>
                      <span className="underline decoration-wavy underline-offset-4" style={{ color: '#3b82f6', textDecorationColor: '#f87171' }}>Sqyds</span>
                      <span className="text-[15px] font-serif" style={{ color: '#1e293b' }}>approx.......</span>
                    </div>
                  </div>

                  {/* Settlement Statement */}
                  <div className="mt-12 mb-8">
                    <div className="text-[15px] font-serif" style={{ color: '#1e293b' }}>
                      As a full and final settlement in the following <span className="underline" style={{ color: '#3b82f6' }}>manner:-</span>
                    </div>
                  </div>

                  {/* Secondary Detail List */}
                  <div className="space-y-5">
                    <div className="font-serif font-bold text-[15px]" style={{ color: '#0f172a' }}>
                      S.No. {String(receiptCommission.id).padStart(4, '0')}
                    </div>

                    <div className="flex items-end mb-1 w-full">
                      <div className="w-[200px] shrink-0 text-[15px] font-serif font-bold" style={{ color: '#0f172a' }}>Date</div>
                      <div className="w-[20px] shrink-0 text-[15px] font-serif text-center" style={{ color: '#1e293b' }}>:</div>
                      <div className="flex-1 flex items-baseline">
                        <span className="text-[15px] font-serif" style={{ color: '#0f172a' }}>{formatDate(receiptCommission.date)}</span>
                      </div>
                    </div>

                    <div className="flex items-end mb-1 w-full">
                      <div className="w-[200px] shrink-0 text-[15px] font-serif font-bold" style={{ color: '#0f172a' }}>Ch./DD No</div>
                      <div className="w-[20px] shrink-0 text-[15px] font-serif text-center" style={{ color: '#1e293b' }}>:</div>
                      <div className="flex-1 flex items-baseline">
                        <span className="text-[15px] font-serif" style={{ color: '#0f172a' }}>{receiptCommission.by_note || '—'}</span>
                      </div>
                    </div>

                    <div className="flex items-end mb-1 w-full">
                      <div className="w-[200px] shrink-0 text-[15px] font-serif font-bold" style={{ color: '#0f172a' }}>Name of the Bank</div>
                      <div className="w-[20px] shrink-0 text-[15px] font-serif text-center" style={{ color: '#1e293b' }}>:</div>
                      <div className="flex-1 flex items-baseline">
                        <span className="text-[15px] font-serif" style={{ color: '#0f172a' }}>{'—'}</span>
                      </div>
                    </div>

                    <div className="flex items-end mb-1 w-full">
                      <div className="w-[200px] shrink-0 text-[15px] font-serif font-bold" style={{ color: '#0f172a' }}>BRANCH</div>
                      <div className="w-[20px] shrink-0 text-[15px] font-serif text-center" style={{ color: '#1e293b' }}>:</div>
                      <div className="flex-1 flex items-baseline">
                        <span className="text-[15px] font-serif" style={{ color: '#0f172a' }}>{'—'}</span>
                      </div>
                    </div>

                    <div className="flex items-end mb-1 w-full">
                      <div className="w-[200px] shrink-0 text-[15px] font-serif font-bold" style={{ color: '#0f172a' }}>In favour of</div>
                      <div className="w-[20px] shrink-0 text-[15px] font-serif text-center" style={{ color: '#1e293b' }}>:</div>
                      <div className="flex-1 flex items-baseline">
                        <span className="text-[15px] font-serif font-bold" style={{ color: '#0f172a' }}>DG ASSOCIATES</span>
                      </div>
                    </div>

                    <div className="flex items-end mb-1 w-full">
                      <div className="w-[200px] shrink-0 text-[15px] font-serif font-bold" style={{ color: '#0f172a' }}>Amount</div>
                      <div className="w-[20px] shrink-0 text-[15px] font-serif text-center" style={{ color: '#1e293b' }}>:</div>
                      <div className="flex-1 flex items-baseline">
                        <span className="text-[15px] font-serif font-bold" style={{ color: '#0f172a' }}>{formatCurrency(receiptCommission.amount)}/-</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Signatures */}
                <div className="absolute bottom-[80px] left-[50px] right-[50px] flex justify-between px-8">
                  <div className="text-center">
                    <div className="text-[15px] font-serif border-b border-dotted pb-0.5 inline-block min-w-[100px]" style={{ color: '#000000', borderColor: '#ef4444' }}>
                      Signature
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-[15px] font-serif border-b border-dotted pb-0.5 inline-block min-w-[150px]" style={{ color: '#000000', borderColor: '#ef4444' }}>
                      Authorised Signatory
                    </div>
                  </div>
                </div>

                {/* Footer Disclaimer & Print Time */}
                <div className="absolute bottom-[30px] left-[50px] right-[50px] flex justify-between items-end text-[10px] font-serif px-8" style={{ color: '#64748b' }}>
                  <div className="italic">
                    * This is a computer-generated receipt and does not require a physical signature.
                  </div>
                  <div className="text-right">
                    Printed at: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })} {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Add/Edit Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">{editingId ? 'Edit Entry' : 'Add Commission Entry'}</DialogTitle>
            <DialogDescription className="text-sm">
              {editingId ? 'Update commission payment details.' : 'Record a new commission payment.'}
            </DialogDescription>
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

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Date {canUpdateDate ? '*' : ''}</Label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => {
                    if (canUpdateDate) setFormData({ ...formData, date: e.target.value });
                  }}
                  readOnly={!canUpdateDate}
                  disabled={!canUpdateDate}
                  className={!canUpdateDate ? "bg-slate-50 text-slate-500 cursor-not-allowed border-dashed" : ""}
                  required
                />
                {!canUpdateDate ? (
                  <p className="text-[10px] text-slate-400">Auto-captured. Requires permission to modify.</p>
                ) : (
                  <p className="text-[10px] text-slate-400">Date is editable with your permissions.</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Plot No</Label>
                <Input
                  placeholder="A19, B46, C5..."
                  value={formData.plot_no}
                  onChange={(e) => setFormData({ ...formData, plot_no: e.target.value.toUpperCase() })}
                  list="plot-suggestions"
                />
                <datalist id="plot-suggestions">
                  {autocomplete.plots.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Particuler (Person Name) *</Label>
                <Input
                  placeholder="AKASH CHAUDHARY"
                  value={formData.particular}
                  onChange={(e) => setFormData({ ...formData, particular: e.target.value.toUpperCase() })}
                  required
                  list="person-suggestions"
                />
                <datalist id="person-suggestions">
                  {autocomplete.particulars.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Father Name</Label>
                <Input
                  placeholder="S/O RAMESH CHAUDHARY"
                  value={formData.father_name}
                  onChange={(e) => setFormData({ ...formData, father_name: e.target.value.toUpperCase() })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Plot Size</Label>
                <Input
                  placeholder="1200 SQFT, 30X40..."
                  value={formData.plot_size}
                  onChange={(e) => setFormData({ ...formData, plot_size: e.target.value.toUpperCase() })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Plot Rate</Label>
                <Input
                  placeholder="1500/SQFT, 2000..."
                  value={formData.plot_rate}
                  onChange={(e) => setFormData({ ...formData, plot_rate: e.target.value.toUpperCase() })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Amount (₹) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="130560"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">By</Label>
                <Input
                  placeholder="G, OM BANK, CASH..."
                  value={formData.by_note}
                  onChange={(e) => setFormData({ ...formData, by_note: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Remarks</Label>
              <Textarea
                placeholder="ADVANCE, ADJUST PERSONAL, PLOT ME JMA ORDER..."
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                rows={2}
              />
            </div>

            {(isAdmin || canManage) && approvers.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Assign To Admin</Label>
                <Select
                  value={formData.assigned_admin_id?.toString() || '_none'}
                  onValueChange={(val) => setFormData({ ...formData, assigned_admin_id: val === '_none' ? null : parseInt(val) })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select approver..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">- Auto-assign or no preference -</SelectItem>
                    {approvers.map((app) => (
                      <SelectItem key={app.id} value={app.id.toString()}>
                        {app.full_name || app.name || app.email || `Admin #${app.id}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Voucher / Receipt Upload */}
            <VoucherUpload
              value={formData.voucher_url}
              onChange={(url) => setFormData({ ...formData, voucher_url: url || '' })}
              disabled={submitting}
            />

            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setDialogOpen(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    {editingId ? 'Updating...' : 'Adding...'}
                  </>
                ) : (
                  editingId ? 'Update' : 'Add Entry'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Commissions;
