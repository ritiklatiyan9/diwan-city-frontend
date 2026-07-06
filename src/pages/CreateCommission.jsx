import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import {
  ArrowLeft, Check, AlertCircle, Loader2, Search, User, X,
} from 'lucide-react';
import VoucherUpload from '../components/VoucherUpload';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';

const CreateCommission = () => {
  const { currentSite } = useAuth();
  const siteId = currentSite?.id;
  const navigate = useNavigate();

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
    member_id: null,
    voucher_url: null,
  });

  const [message, setMessage] = useState({ type: '', text: '' });
  const [submitting, setSubmitting] = useState(false);

  // Client search state
  const [clientQuery, setClientQuery] = useState('');
  const [clientResults, setClientResults] = useState([]);
  const [clientLoading, setClientLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  // Plot autocomplete & DB plots
  const [autocomplete, setAutocomplete] = useState({ plots: [] });
  const [dbPlots, setDbPlots] = useState([]);

  // Fetch plot data
  useEffect(() => {
    if (!siteId) return;
    
    // Legacy autocomplete logic
    api.get(`/commissions/autocomplete?site_id=${siteId}`)
      .then(res => setAutocomplete(res.data || { plots: [] }))
      .catch(() => {});
      
    // Fetch all plots from DB to populate dropdown
    api.get(`/plot-commission/plots?site_id=${siteId}`)
      .then(res => setDbPlots(res.data.plots || []))
      .catch(err => console.error('Failed to load DB plots', err));
  }, [siteId]);

  // Debounced client search
  const searchClients = useCallback(async (query) => {
    if (!siteId || !query || query.length < 1) {
      setClientResults([]);
      return;
    }
    try {
      setClientLoading(true);
      const res = await api.get(`/members/search?site_id=${siteId}&q=${encodeURIComponent(query)}`);
      setClientResults(res.data.members || []);
    } catch {
      setClientResults([]);
    } finally {
      setClientLoading(false);
    }
  }, [siteId]);

  const handleClientQueryChange = (e) => {
    const val = e.target.value;
    setClientQuery(val);
    setShowDropdown(true);

    // If user clears or types after selecting, reset selection
    if (selectedClient) {
      setSelectedClient(null);
      setFormData(prev => ({ ...prev, particular: '', father_name: '', member_id: null }));
    }

    // Debounce search
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchClients(val), 300);
  };

  const handleSelectClient = (client) => {
    setSelectedClient(client);
    setClientQuery(client.full_name);
    setFormData(prev => ({
      ...prev,
      particular: client.full_name?.toUpperCase() || '',
      father_name: client.father_name?.toUpperCase() || '',
      member_id: client.id,
    }));
    setShowDropdown(false);
    setClientResults([]);
  };

  const handleClearClient = () => {
    setSelectedClient(null);
    setClientQuery('');
    setFormData(prev => ({ ...prev, particular: '', father_name: '', member_id: null }));
    setClientResults([]);
    inputRef.current?.focus();
  };

  // Click outside to close dropdown
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    if (!formData.particular) {
      setMessage({ type: 'error', text: 'Please select a person (Particuler) from the dropdown' });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        site_id: siteId,
        date: new Date().toISOString().split('T')[0],
        particular: formData.particular,
        father_name: formData.father_name,
        plot_no: formData.plot_no,
        plot_size: formData.plot_size,
        plot_rate: formData.plot_rate,
        amount: parseFloat(formData.amount) || 0,
        by_note: formData.by_note,
        remarks: formData.remarks,
        voucher_url: formData.voucher_url,
      };
      await api.post('/commissions', payload);
      setMessage({ type: 'success', text: 'Commission entry added successfully!' });
      setTimeout(() => navigate('/commissions'), 800);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to add entry' });
    } finally {
      setSubmitting(false);
    }
  };

  if (!currentSite) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-sm text-slate-500">Select a site first</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/commissions')} className="h-8 w-8 p-0">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Create Commission Entry</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Add a new commission payment for <span className="font-medium text-slate-700">{currentSite.name}</span>
          </p>
        </div>
      </div>

      {/* Message */}
      {message.text && (
        <div className={`flex gap-2 p-3 rounded-lg text-sm ${message.type === 'success'
          ? 'bg-emerald-50 border border-emerald-100 text-emerald-700'
          : 'bg-red-50 border border-red-100 text-red-700'
          }`}>
          {message.type === 'success' ? <Check className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
          {message.text}
        </div>
      )}

      {/* Form */}
      <Card className="shadow-none border-slate-200">
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Date & Plot No */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Date</Label>
                <Input
                  type="date"
                  value={new Date().toISOString().split('T')[0]}
                  readOnly
                  disabled
                  className="bg-slate-50 text-slate-500 cursor-not-allowed border-dashed"
                />
                <p className="text-[10px] text-slate-400">Auto-captured as today. Cannot be changed.</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Plot No</Label>
                <Select
                  value={formData.plot_no}
                  onValueChange={(val) => {
                    const plot = dbPlots.find(p => p.plot_no === val);
                    setFormData(prev => ({
                      ...prev,
                      plot_no: val,
                      plot_size: plot?.plot_size || prev.plot_size,
                      plot_rate: plot?.plot_rate || prev.plot_rate
                    }));
                  }}
                >
                  <SelectTrigger className="h-[38px]">
                    <SelectValue placeholder="Select a plot..." />
                  </SelectTrigger>
                  <SelectContent>
                    {dbPlots.map(p => (
                      <SelectItem key={p.id} value={p.plot_no}>
                        {p.plot_no} {p.buyer_name ? `(${p.buyer_name})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Particuler (Client Search Dropdown) */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5" ref={dropdownRef}>
                <Label className="text-xs font-medium">Particuler (Person Name) *</Label>
                <div className="relative">
                  {selectedClient ? (
                    <div className="flex items-center gap-2 h-9 px-3 border border-slate-200 rounded-md bg-slate-50">
                      <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="text-sm font-medium text-slate-800 truncate flex-1">
                        {selectedClient.full_name}
                      </span>
                      {selectedClient.phone && (
                        <span className="text-[11px] text-slate-400">{selectedClient.phone}</span>
                      )}
                      <button
                        type="button"
                        onClick={handleClearClient}
                        className="p-0.5 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                      <Input
                        ref={inputRef}
                        placeholder="Search by name or phone..."
                        value={clientQuery}
                        onChange={handleClientQueryChange}
                        onFocus={() => { if (clientQuery) setShowDropdown(true); }}
                        className="pl-9 pr-8"
                        autoComplete="off"
                      />
                      {clientLoading && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 animate-spin" />
                      )}
                    </>
                  )}

                  {/* Dropdown results */}
                  {showDropdown && !selectedClient && (clientResults.length > 0 || (clientQuery.length >= 1 && !clientLoading)) && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {clientResults.length > 0 ? (
                        clientResults.map((client) => (
                          <button
                            key={client.id}
                            type="button"
                            onClick={() => handleSelectClient(client)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 transition-colors text-left border-b border-slate-50 last:border-0"
                          >
                            <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 text-[11px] font-semibold shrink-0">
                              {client.full_name?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-800 truncate">{client.full_name}</p>
                              <p className="text-[11px] text-slate-400 truncate">
                                {[
                                  client.father_name && `S/O ${client.father_name}`,
                                  client.phone,
                                  client.member_type
                                ].filter(Boolean).join(' · ')}
                              </p>
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="px-3 py-4 text-center">
                          <p className="text-sm text-slate-400">No clients found for "{clientQuery}"</p>
                          <p className="text-[11px] text-slate-300 mt-0.5">Try a different name or phone number</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Father Name</Label>
                <Input
                  placeholder="Auto-filled from client"
                  value={formData.father_name}
                  onChange={(e) => setFormData({ ...formData, father_name: e.target.value.toUpperCase() })}
                  className={selectedClient ? 'bg-slate-50' : ''}
                />
              </div>
            </div>

            {/* Plot Size & Rate */}
            <div className="grid grid-cols-2 gap-4">
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

            {/* Amount & By */}
            <div className="grid grid-cols-2 gap-4">
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

            {/* Remarks */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Remarks</Label>
              <Textarea
                placeholder="ADVANCE, ADJUST PERSONAL, PLOT ME JMA ORDER..."
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                rows={2}
              />
            </div>

            {/* Voucher / Receipt Upload */}
            <VoucherUpload
              value={formData.voucher_url}
              onChange={(url) => setFormData({ ...formData, voucher_url: url })}
              disabled={submitting}
            />

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => navigate('/commissions')}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Adding...
                  </>
                ) : (
                  'Add Entry'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CreateCommission;
