import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '../components/ui/command';
import {
  Tractor, Plus, Edit2, Trash2, AlertCircle, Check,
  Search, Eye, IndianRupee, Percent, Phone, MapPin, Loader2,
  Camera, Clock, Send, Users, Banknote, Building2, ArrowUpDown, UserPlus,
  ChevronsUpDown, X, Calculator,
} from 'lucide-react';

const Farmers = () => {
  const { currentSite, isAdmin, canManage } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryFromUrl = useMemo(() => new URLSearchParams(location.search).get('q') || '', [location.search]);
  const [farmers, setFarmers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('desc');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [submitting, setSubmitting] = useState(false);
  const [proofPhoto, setProofPhoto] = useState(null);
  const [proofPreview, setProofPreview] = useState(null);
  const [editRequestPending, setEditRequestPending] = useState(false);

  // Member selection for Register Farmer
  const [farmerMembers, setFarmerMembers] = useState([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState(null);
  const [memberPickerOpen, setMemberPickerOpen] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    total_amount: '',
    notes: '',
    status: 'active',
    member_id: null,
    payment_mode: 'CASH',
    cash_amount: '',
    bank_amount: '',
    bank_name: '',
    bank_account_no: '',
    bank_reference: '',
    bank_ifsc: '',
    land_size_bigha: '',
    land_rate: '',
    commission_percentage: '',
    commission_amount: '',
    land_payment: '',
    _autoPaymentApplied: '',
  });

  const siteId = currentSite?.id;

  const fetchFarmers = useCallback(async () => {
    if (!siteId) return;
    try {
      setLoading(true);
      // Watchdog so the spinner can never hang on a stalled request.
      const watchdog = setTimeout(() => setLoading(false), 15000);
      const res = await api.get(`/farmers?site_id=${siteId}`);
      clearTimeout(watchdog);
      setFarmers(res.data.farmers || []);
    } catch (err) {
      console.error('Failed to fetch farmers:', err);
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  // Background refresh — does NOT toggle the page-wide loader.
  const refreshFarmers = useCallback(async () => {
    if (!siteId) return;
    try {
      const res = await api.get(`/farmers?site_id=${siteId}`);
      setFarmers(res.data.farmers || []);
    } catch { /* keep current */ }
  }, [siteId]);

  const fetchFarmerMembers = useCallback(async () => {
    if (!siteId) return;
    try {
      const res = await api.get(`/farmers/members?site_id=${siteId}`);
      setFarmerMembers(res.data.members || []);
    } catch (err) {
      console.error('Failed to fetch farmer members:', err);
    }
  }, [siteId]);

  // Clear old data immediately and refetch when site changes
  useEffect(() => {
    setFarmers([]);
    setSearchQuery(queryFromUrl);
    setStatusFilter('all');
    fetchFarmers();
    fetchFarmerMembers();
  }, [fetchFarmers, fetchFarmerMembers, queryFromUrl]);

  const resetForm = () => {
    setFormData({ name: '', phone: '', address: '', total_amount: '', notes: '', status: 'active', member_id: null, payment_mode: 'CASH', cash_amount: '', bank_amount: '', bank_name: '', bank_account_no: '', bank_reference: '', bank_ifsc: '', land_size_bigha: '', land_rate: '', commission_percentage: '', commission_amount: '', land_payment: '', _autoPaymentApplied: '' });
    setEditingId(null);
    setMessage({ type: '', text: '' });
    setProofPhoto(null);
    setProofPreview(null);
    setEditRequestPending(false);
    setSelectedMemberId(null);
    setMemberSearch('');
  };

  const handleProofPhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setProofPhoto(file);
      setProofPreview(URL.createObjectURL(file));
    }
  };

  const handleOpenCreate = () => { resetForm(); setDialogOpen(true); };

  const handleOpenEdit = (farmer) => {
    setFormData({
      name: farmer.name || '',
      phone: farmer.phone || '',
      address: farmer.address || '',
      total_amount: farmer.total_amount || '',
      notes: farmer.notes || '',
      status: farmer.status || 'active',
      member_id: farmer.member_id || null,
      payment_mode: farmer.payment_mode || 'CASH',
      cash_amount: farmer.cash_amount || '',
      bank_amount: farmer.bank_amount || '',
      bank_name: farmer.bank_name || '',
      bank_account_no: farmer.bank_account_no || '',
      bank_reference: farmer.bank_reference || '',
      bank_ifsc: farmer.bank_ifsc || '',
      land_size_bigha: farmer.land_size_bigha || '',
      land_rate: farmer.land_rate || '',
      commission_percentage: farmer.commission_percentage || '',
      commission_amount: farmer.commission_amount || '',
    });
    setSelectedMemberId(farmer.member_id || null);
    setEditingId(farmer.id);
    setDialogOpen(true);
  };

  const handleFormChange = (field, value) => {
    const newForm = { ...formData, [field]: value };

    // Auto-calculate total_amount = cash_amount + bank_amount
    if (field === 'cash_amount' || field === 'bank_amount') {
      const cash = parseFloat(field === 'cash_amount' ? value : newForm.cash_amount) || 0;
      const bank = parseFloat(field === 'bank_amount' ? value : newForm.bank_amount) || 0;
      newForm.total_amount = (cash + bank) || '';
      // Auto-determine payment_mode
      if (cash > 0 && bank > 0) newForm.payment_mode = 'SPLIT';
      else if (bank > 0) newForm.payment_mode = 'BANK';
      else newForm.payment_mode = 'CASH';
    }

    // Auto-calculate land_payment = land_size_bigha × land_rate (display only)
    // and commission_amount = commission_percentage% × land_payment.
    // Note: these never touch cash_amount / bank_amount — the user fills
    // Payment Breakdown independently.
    if (field === 'land_size_bigha' || field === 'land_rate' || field === 'commission_percentage') {
      const size = parseFloat(field === 'land_size_bigha' ? value : newForm.land_size_bigha) || 0;
      const rate = parseFloat(field === 'land_rate' ? value : newForm.land_rate) || 0;
      const pct = parseFloat(field === 'commission_percentage' ? value : newForm.commission_percentage) || 0;
      newForm.land_payment = (size > 0 && rate > 0) ? (size * rate).toFixed(2) : '';
      newForm.commission_amount = (size > 0 && rate > 0 && pct > 0) ? ((pct / 100) * rate * size).toFixed(2) : '';
    }

    setFormData(newForm);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    if (!editingId && !formData.member_id) {
      setMessage({ type: 'error', text: 'Please select a registered member first' });
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        total_amount: parseFloat(formData.total_amount) || 0,
        cash_amount: parseFloat(formData.cash_amount) || 0,
        bank_amount: parseFloat(formData.bank_amount) || 0,
        site_id: siteId,
        member_id: formData.member_id || null,
        land_size_bigha: formData.land_size_bigha !== '' ? parseFloat(formData.land_size_bigha) : null,
        land_rate: formData.land_rate !== '' ? parseFloat(formData.land_rate) : null,
        commission_percentage: formData.commission_percentage !== '' ? parseFloat(formData.commission_percentage) : null,
        commission_amount: formData.commission_amount !== '' ? parseFloat(formData.commission_amount) : null,
      };

      // Sub-admin editing: submit edit request instead of direct update
      if (editingId && !isAdmin) {
        if (!proofPhoto) {
          setMessage({ type: 'error', text: 'Please upload a proof photo for the edit request' });
          setSubmitting(false);
          return;
        }
        const fd = new FormData();
        fd.append('module', 'farmer');
        fd.append('record_id', editingId);
        fd.append('proposed_data', JSON.stringify(payload));
        fd.append('site_id', siteId);
        fd.append('proof_photo', proofPhoto);
        await api.post('/edit-requests', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        setMessage({ type: 'success', text: 'Edit request submitted for admin approval' });
        setEditRequestPending(true);
        setDialogOpen(false);
      } else if (editingId) {
        const { data } = await api.put(`/farmers/${editingId}`, payload);
        // Optimistic in-place update so the dialog can close instantly.
        const updated = data?.farmer;
        if (updated) {
          setFarmers((prev) => prev.map((f) => (f.id === updated.id ? { ...f, ...updated } : f)));
        }
        setMessage({ type: 'success', text: 'Farmer updated' });
        setDialogOpen(false);
        refreshFarmers(); // background reconcile (server-computed totals)
      } else {
        await api.post('/farmers', payload);
        setMessage({ type: 'success', text: 'Farmer registered' });
        setDialogOpen(false);
        refreshFarmers(); // need the server-computed totals — refresh in bg
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Operation failed' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this farmer and all payments? This cannot be undone.')) return;
    // Optimistic removal — instant UI feedback.
    const snapshot = farmers;
    setFarmers((prev) => prev.filter((f) => f.id !== id));
    try {
      await api.delete(`/farmers/${id}`);
      refreshFarmers();
    } catch (err) {
      setFarmers(snapshot); // rollback
      console.error('Failed to delete farmer:', err);
    }
  };

  const filteredFarmers = useMemo(() => {
    let list = farmers.filter((f) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        f.name?.toLowerCase().includes(q) ||
        f.phone?.toLowerCase().includes(q) ||
        f.address?.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || f.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
    if (sortOrder === 'asc') list.reverse();
    return list;
  }, [farmers, searchQuery, statusFilter, sortOrder]);

  const statusBadge = (status) => {
    const map = {
      active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      completed: 'bg-blue-50 text-blue-700 border-blue-200',
      inactive: 'bg-slate-50 text-slate-500 border-slate-200',
    };
    return map[status] || '';
  };

  const formatCurrency = (val) => {
    const num = parseFloat(val) || 0;
    return num.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  };

  // Summary cards
  const totalFarmers = farmers.length;
  const totalAmount = farmers.reduce((s, f) => s + (parseFloat(f.total_amount) || 0), 0);
  const totalPaid = farmers.reduce((s, f) => s + (parseFloat(f.total_paid) || 0), 0);
  const totalRemaining = totalAmount - totalPaid;
  // Cash vs bank flow. cash_paid + bank_paid = total_paid (reconciles).
  const totalCashPaid = farmers.reduce((s, f) => s + (parseFloat(f.cash_paid) || 0), 0);
  const totalBankPaid = farmers.reduce((s, f) => s + (parseFloat(f.bank_paid) || 0), 0);

  if (!currentSite) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Tractor className="w-10 h-10 text-slate-200 mb-3" />
        <p className="text-sm text-slate-500">Select a site to manage farmers</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full md:max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Farmer Payments</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage farmer land payments &amp; installments</p>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => navigate('/register-user')} className="text-blue-600 border-blue-200 hover:bg-blue-50">
              <UserPlus className="w-4 h-4 mr-1.5" /> Register User
            </Button>
            <Button size="sm" onClick={handleOpenCreate}>
              <Plus className="w-4 h-4 mr-1.5" /> Register Farmer
            </Button>
          </div>
        )}
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-2xl max-h-[92vh] overflow-y-auto p-4 sm:p-6">
              <DialogHeader className="space-y-1">
                <DialogTitle className="text-base sm:text-lg font-semibold text-slate-900">
                  {editingId ? (isAdmin ? 'Edit Farmer' : 'Request Farmer Edit') : 'Register Farmer'}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  {editingId ? (isAdmin ? 'Update farmer details.' : 'Submit an edit request with proof for admin approval.') : 'Select a registered member, add land & commission, then confirm payment.'}
                </DialogDescription>
              </DialogHeader>

              {message.text && (
                <div className={`flex gap-2 p-2.5 rounded-lg text-xs ${
                  message.type === 'success'
                    ? 'bg-emerald-50 border border-emerald-100 text-emerald-700'
                    : 'bg-red-50 border border-red-100 text-red-700'
                }`}>
                  {message.type === 'success' ? <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
                  {message.text}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3">
                {/* ── Section 1: Member Selection ── */}
                {!editingId && (
                  <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-3 sm:p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5 uppercase tracking-wider">
                        <Users className="w-3.5 h-3.5 text-emerald-600" /> Registered Member
                      </p>
                      <span className="text-[10px] text-slate-400">Required</span>
                    </div>

                    {!selectedMemberId ? (
                      farmerMembers.length > 0 ? (
                        <Popover open={memberPickerOpen} onOpenChange={setMemberPickerOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              role="combobox"
                              aria-expanded={memberPickerOpen}
                              className="w-full justify-between h-10 px-3 font-normal text-sm text-slate-500 border-dashed hover:border-solid hover:border-emerald-400 hover:bg-emerald-50/40"
                            >
                              <span className="flex items-center gap-2">
                                <Search className="w-4 h-4 text-slate-400" />
                                Search and select a member…
                              </span>
                              <ChevronsUpDown className="w-4 h-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="p-0 w-[min(92vw,32rem)]" align="start">
                            <Command>
                              <CommandInput placeholder="Type name or mobile…" className="h-10" />
                              <CommandList className="max-h-64">
                                <CommandEmpty className="py-6 text-center text-xs text-slate-500">
                                  No matching members.
                                </CommandEmpty>
                                <CommandGroup>
                                  {farmerMembers.map((m) => (
                                    <CommandItem
                                      key={m.id}
                                      value={`${m.full_name || ''} ${m.phone || ''}`}
                                      onSelect={() => {
                                        setSelectedMemberId(m.id);
                                        setFormData((prev) => ({
                                          ...prev,
                                          name: m.full_name || prev.name,
                                          phone: m.phone || prev.phone,
                                          address: m.address || prev.address,
                                          member_id: m.id,
                                          bank_name: m.bank_name || prev.bank_name,
                                          bank_account_no: m.bank_account_no || prev.bank_account_no,
                                          bank_ifsc: m.bank_ifsc || prev.bank_ifsc,
                                        }));
                                        setMemberSearch('');
                                        setMemberPickerOpen(false);
                                      }}
                                      className="flex items-start gap-3 py-2.5 cursor-pointer"
                                    >
                                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-100 to-emerald-200 flex items-center justify-center text-emerald-700 text-sm font-bold shrink-0">
                                        {(m.full_name || '?').charAt(0).toUpperCase()}
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium text-slate-800 truncate">{m.full_name || '—'}</p>
                                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                          {m.member_type && (
                                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                                              {m.member_type}
                                            </span>
                                          )}
                                          {m.phone && (
                                            <span className="text-[11px] text-slate-500 flex items-center gap-0.5">
                                              <Phone className="w-2.5 h-2.5" /> {m.phone}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] text-amber-700 flex items-start gap-2">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          No registered members found. Register members in User Management first.
                        </div>
                      )
                    ) : (
                      // ── Selected state: show only the selected member with Change action ──
                      <div className="relative rounded-lg border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-white px-3 py-3 flex items-center gap-3 shadow-sm">
                        <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white text-sm sm:text-base font-bold shrink-0 ring-2 ring-emerald-200">
                          {(formData.name || '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-slate-900 truncate">{formData.name || '—'}</p>
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-600 text-white uppercase tracking-wider">Selected</span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            {formData.phone && (
                              <span className="text-[11px] text-slate-600 flex items-center gap-1">
                                <Phone className="w-3 h-3 text-slate-400" /> {formData.phone}
                              </span>
                            )}
                            {formData.address && (
                              <span className="text-[11px] text-slate-600 flex items-center gap-1 truncate max-w-[20ch] sm:max-w-[40ch]">
                                <MapPin className="w-3 h-3 text-slate-400 shrink-0" /> {formData.address}
                              </span>
                            )}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedMemberId(null);
                            setFormData((prev) => ({
                              ...prev,
                              name: '', phone: '', address: '',
                              member_id: null,
                              bank_name: '', bank_account_no: '', bank_ifsc: '',
                            }));
                          }}
                          className="shrink-0 h-8 text-[11px] text-slate-500 hover:text-rose-600 hover:bg-rose-50"
                        >
                          <X className="w-3.5 h-3.5 mr-1" /> Change
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* Editable name/phone/address for edit mode */}
                {editingId && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-3 sm:p-4 space-y-2">
                    <p className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider">Farmer Details</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                      <div className="space-y-1">
                        <Label className="text-[11px]">Name *</Label>
                        <Input className="h-9 text-sm" placeholder="Ajay Chaudhary" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px]">Phone</Label>
                        <Input className="h-9 text-sm" placeholder="9876543210" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">Address</Label>
                      <Input className="h-9 text-sm" placeholder="Village / Area" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
                    </div>
                  </div>
                )}

                {/* ── Section 2: Land & Commission (above Payment) ── */}
                <div className="rounded-xl border border-amber-100 bg-gradient-to-br from-amber-50/60 via-white to-white p-3 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
                      <span className="inline-flex w-5 h-5 items-center justify-center rounded-md bg-amber-500/10 text-amber-600">
                        <Tractor className="w-3 h-3" />
                      </span>
                      Land &amp; Commission
                    </p>
                    <span className="text-[10px] text-slate-400 italic">Optional</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[11px] text-slate-600">Size (Bigha)</Label>
                      <Input
                        className="h-9 text-sm"
                        type="number" step="0.01" placeholder="0.00"
                        value={formData.land_size_bigha}
                        onChange={(e) => handleFormChange('land_size_bigha', e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-slate-600">Rate / Bigha (₹)</Label>
                      <Input
                        className="h-9 text-sm"
                        type="number" step="0.01" placeholder="0"
                        value={formData.land_rate}
                        onChange={(e) => handleFormChange('land_rate', e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-slate-600">Commission (%)</Label>
                      <Input
                        className="h-9 text-sm"
                        type="number" step="0.01" min="0" max="100" placeholder="0"
                        value={formData.commission_percentage}
                        onChange={(e) => handleFormChange('commission_percentage', e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Computed summary box — shows both Payment (Land×Rate) and Commission.
                      Values are display-only and never auto-populate Payment Breakdown. */}
                  {(formData.land_payment || formData.commission_amount) && (
                    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                      <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
                        <div className="px-3 py-2 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="inline-flex w-7 h-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 shrink-0">
                              <IndianRupee className="w-3.5 h-3.5" />
                            </span>
                            <div className="min-w-0">
                              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Payment</p>
                              <p className="text-[10px] text-slate-400 truncate">
                                {formData.land_size_bigha || 0} × ₹{formatCurrency(formData.land_rate || 0)}
                              </p>
                            </div>
                          </div>
                          <span className="text-sm font-bold text-emerald-700 tabular-nums">
                            ₹{formatCurrency(formData.land_payment || 0)}
                          </span>
                        </div>
                        <div className="px-3 py-2 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="inline-flex w-7 h-7 items-center justify-center rounded-full bg-amber-100 text-amber-700 shrink-0">
                              <Percent className="w-3.5 h-3.5" />
                            </span>
                            <div className="min-w-0">
                              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Commission</p>
                              <p className="text-[10px] text-slate-400 truncate">
                                {formData.commission_percentage || 0}% of Payment
                              </p>
                            </div>
                          </div>
                          <span className="text-sm font-bold text-amber-700 tabular-nums">
                            ₹{formatCurrency(formData.commission_amount || 0)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Section 3: Payment Breakdown ── */}
                <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2.5">
                  <p className="text-[11px] font-semibold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
                    <span className="inline-flex w-5 h-5 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600">
                      <IndianRupee className="w-3 h-3" />
                    </span>
                    Payment Breakdown
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="border border-green-200 rounded-lg p-2.5 bg-green-50/40 space-y-1">
                      <Label className="text-[11px] flex items-center gap-1 text-green-700 font-medium">
                        <Banknote className="w-3.5 h-3.5" /> Cash (₹)
                      </Label>
                      <Input
                        className="h-9 text-sm border-green-200 bg-white focus-visible:ring-green-300"
                        type="number" step="0.01" placeholder="0"
                        value={formData.cash_amount}
                        onChange={(e) => handleFormChange('cash_amount', e.target.value)}
                      />
                    </div>
                    <div className="border border-blue-200 rounded-lg p-2.5 bg-blue-50/40 space-y-1">
                      <Label className="text-[11px] flex items-center gap-1 text-blue-700 font-medium">
                        <Building2 className="w-3.5 h-3.5" /> Bank (₹)
                      </Label>
                      <Input
                        className="h-9 text-sm border-blue-200 bg-white focus-visible:ring-blue-300"
                        type="number" step="0.01" placeholder="0"
                        value={formData.bank_amount}
                        onChange={(e) => handleFormChange('bank_amount', e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Total */}
                  <div className="flex items-center justify-between rounded-lg bg-slate-900 text-white px-3 py-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-300">Total Amount</span>
                    <span className="text-base font-bold tabular-nums">
                      ₹{formatCurrency((parseFloat(formData.cash_amount) || 0) + (parseFloat(formData.bank_amount) || 0))}
                    </span>
                  </div>

                  {/* Bank Details — only when bank amount > 0 */}
                  {(parseFloat(formData.bank_amount) || 0) > 0 && (
                    <div className="rounded-lg border border-blue-100 bg-blue-50/30 p-2.5 space-y-2">
                      <p className="text-[10px] font-semibold text-blue-700 flex items-center gap-1 uppercase tracking-wider">
                        <Building2 className="w-3 h-3" /> Bank Details
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[10px]">Bank Name</Label>
                          <Input className="h-9 text-sm" placeholder="State Bank of India" value={formData.bank_name} onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px]">Account No.</Label>
                          <Input className="h-9 text-sm" placeholder="1234567890" value={formData.bank_account_no} onChange={(e) => setFormData({ ...formData, bank_account_no: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px]">Reference / UTR</Label>
                          <Input className="h-9 text-sm" placeholder="UTR / Cheque No." value={formData.bank_reference} onChange={(e) => setFormData({ ...formData, bank_reference: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px]">IFSC Code</Label>
                          <Input className="h-9 text-sm" placeholder="SBIN0001234" value={formData.bank_ifsc} onChange={(e) => setFormData({ ...formData, bank_ifsc: e.target.value })} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Section 4: Notes & Status ── */}
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px] gap-2">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-slate-600">Notes</Label>
                    <Textarea className="text-sm min-h-[72px] resize-none" placeholder="Any additional notes..." value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={3} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-slate-600">Status</Label>
                    <Select value={formData.status} onValueChange={(val) => setFormData({ ...formData, status: val })}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Proof Photo Upload (sub-admin editing only) */}
                {editingId && !isAdmin && (
                  <div className="border rounded-lg p-3 space-y-2">
                    <Label className="text-[11px] flex items-center gap-1.5">
                      <Camera className="w-3.5 h-3.5" /> Proof Photo *
                    </Label>
                    <Input type="file" accept="image/*" onChange={handleProofPhotoChange} required className="text-xs" />
                    {proofPreview && (
                      <img src={proofPreview} alt="Proof preview" className="h-20 rounded-lg border object-contain" />
                    )}
                    <p className="text-[10px] text-amber-600">Upload a photo as proof for admin to verify</p>
                  </div>
                )}

                <DialogFooter className="pt-1">
                  <Button type="button" variant="outline" size="sm" onClick={() => setDialogOpen(false)} disabled={submitting}>Cancel</Button>
                  <Button type="submit" size="sm" disabled={submitting || editRequestPending}>
                    {submitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        {editingId && !isAdmin ? 'Submitting Request...' : editingId ? 'Updating...' : 'Registering...'}
                      </>
                    ) : editRequestPending ? (
                      <><Clock className="w-3.5 h-3.5 mr-1.5" /> Request Sent</>
                    ) : editingId && !isAdmin ? (
                      <><Send className="w-3.5 h-3.5 mr-1.5" /> Submit Edit Request</>
                    ) : (
                      editingId ? 'Update' : 'Register'
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="shadow-none border-slate-200">
          <CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Total Farmers</p>
            <p className="text-2xl font-semibold text-slate-900 mt-1">{totalFarmers}</p>
          </CardContent>
        </Card>
        <Card className="shadow-none border-slate-200">
          <CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Total Amount</p>
            <p className="text-2xl font-semibold text-slate-900 mt-1">₹{formatCurrency(totalAmount)}</p>
          </CardContent>
        </Card>
        <Card className="shadow-none border-slate-200">
          <CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Total Paid</p>
            <p className="text-2xl font-semibold text-emerald-600 mt-1">₹{formatCurrency(totalPaid)}</p>
          </CardContent>
        </Card>
        <Card className="shadow-none border-slate-200">
          <CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Remaining</p>
            <p className="text-2xl font-semibold text-amber-600 mt-1">₹{formatCurrency(totalRemaining)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Payment Flow — Cash vs Bank. Cash + Bank always equals Total Paid;
          rendered as two bigger cards with the same visual language as the
          Day Book Cash/Bank flow cards so users transfer intuition. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="relative overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 p-4">
          <svg className="absolute -bottom-3 -right-3 w-28 h-28 text-emerald-100 opacity-60" viewBox="0 0 100 100" fill="currentColor">
            <path d="M100 100C100 44.8 55.2 0 0 0v20c33.1 0 60 26.9 60 60h20z" />
            <path d="M100 100C100 66.9 73.1 40 40 40v20c22.1 0 40 17.9 40 40h20z" opacity="0.5" />
          </svg>
          <div className="relative flex items-start justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Cash Paid to Farmers</p>
              <p className="text-2xl font-extrabold text-emerald-700 mt-1.5 tabular-nums leading-none truncate">
                ₹{formatCurrency(totalCashPaid)}
              </p>
              <p className="text-[11px] text-slate-500 mt-1.5">
                {totalPaid > 0 ? `${Math.round((totalCashPaid / totalPaid) * 100)}% of total paid` : 'No payments yet'}
                {' · '}Mode: CASH + SPLIT cash leg
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
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Bank Paid to Farmers</p>
              <p className="text-2xl font-extrabold text-indigo-700 mt-1.5 tabular-nums leading-none truncate">
                ₹{formatCurrency(totalBankPaid)}
              </p>
              <p className="text-[11px] text-slate-500 mt-1.5">
                {totalPaid > 0 ? `${Math.round((totalBankPaid / totalPaid) * 100)}% of total paid` : 'No payments yet'}
                {' · '}RTGS / NEFT / IMPS / UPI / Cheque / Bank
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0 text-indigo-600">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search farmers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-slate-400 ml-auto">{filteredFarmers.length} farmer{filteredFarmers.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      <Card className="shadow-none border-slate-200">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
            </div>
          ) : filteredFarmers.length === 0 ? (
            <div className="text-center py-16">
              <Tractor className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No farmers found</p>
              <p className="text-xs text-slate-400 mt-0.5">Register your first farmer to get started</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs">
                    <Button variant="ghost" size="sm" onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')} className="h-6 px-1 text-xs font-semibold -ml-1">
                      Farmer <ArrowUpDown className="w-3 h-3 ml-1" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-xs">Total Amount</TableHead>
                  <TableHead className="text-xs">Paid</TableHead>
                  <TableHead className="text-xs">Remaining</TableHead>
                  <TableHead className="text-xs">Payments</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFarmers.map((farmer) => {
                  const paid = parseFloat(farmer.total_paid) || 0;
                  const total = parseFloat(farmer.total_amount) || 0;
                  const remaining = total - paid;
                  const progressPct = total > 0 ? Math.min((paid / total) * 100, 100) : 0;

                  return (
                    <TableRow
                      key={farmer.id}
                      className="cursor-pointer hover:bg-slate-50/80"
                      onClick={() => navigate(`/farmers/${farmer.id}`)}
                    >
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium text-slate-800">{farmer.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {farmer.phone && (
                              <span className="text-[11px] text-slate-400 flex items-center gap-0.5">
                                <Phone className="w-3 h-3" /> {farmer.phone}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-medium text-slate-700">₹{formatCurrency(total)}</span>
                      </TableCell>
                      <TableCell>
                        <div>
                          <span className="text-sm text-emerald-600">₹{formatCurrency(paid)}</span>
                          <div className="w-20 h-1.5 bg-slate-100 rounded-full mt-1">
                            <div
                              className="h-full bg-emerald-500 rounded-full transition-all"
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`text-sm font-medium ${remaining > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                          ₹{formatCurrency(remaining)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {farmer.payment_count || 0} installment{farmer.payment_count != 1 ? 's' : ''}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] capitalize ${statusBadge(farmer.status)}`}>
                          {farmer.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/farmers/${farmer.id}`)}
                            className="h-7 w-7 p-0 text-slate-400 hover:text-blue-600"
                            title="View Payments"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEdit(farmer)}
                            className={`h-7 w-7 p-0 ${canManage ? 'text-slate-400 hover:text-slate-700' : 'text-amber-400 hover:text-amber-600'}`}
                            title={canManage ? 'Edit' : 'Request Edit'}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          {canManage && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(farmer.id)}
                              className="h-7 w-7 p-0 text-slate-400 hover:text-red-600"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Farmers;
