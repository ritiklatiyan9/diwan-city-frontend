import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { ArrowLeft, Loader2, Save, LayoutGrid, Search, User, X } from 'lucide-react';

const CreatePlotCommission = () => {
  const { currentSite, canManage, hasPermission } = useAuth();
  const canWrite = canManage && hasPermission('commissions', 'write');
  const siteId = currentSite?.id;
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

  const [plots, setPlots] = useState([]);

  // Client search state
  const [clientQuery, setClientQuery] = useState('');
  const [clientResults, setClientResults] = useState([]);
  const [clientLoading, setClientLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const dropdownRef = React.useRef(null);
  const inputRef = React.useRef(null);
  const debounceRef = React.useRef(null);

  const [formData, setFormData] = useState({
    plot_id: '',
    agent_id: '',
    total_commission: '',
    remarks: ''
  });

  useEffect(() => {
    if (!canWrite) {
      toast.error('You do not have permission to create commissions');
      navigate('/plot-commission');
    }
  }, [canWrite, navigate]);

  useEffect(() => {
    const fetchData = async () => {
      if (!siteId) return;
      try {
        setDataLoading(true);
        const res = await api.get(`/plot-commission/plots?site_id=${siteId}`);
        setPlots(res.data.plots || []);
      } catch (err) {
        console.error('Failed to fetch plots:', err);
        toast.error('Failed to load plots');
      } finally {
        setDataLoading(false);
      }
    };

    fetchData();
  }, [siteId]);

  // Debounced client search
  const searchClients = React.useCallback(async (query) => {
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

    if (selectedClient) {
      setSelectedClient(null);
      setFormData(prev => ({ ...prev, agent_id: '' }));
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchClients(val), 300);
  };

  const handleSelectClient = (client) => {
    setSelectedClient(client);
    setClientQuery(client.full_name);
    setFormData(prev => ({ ...prev, agent_id: String(client.id) }));
    setShowDropdown(false);
    setClientResults([]);
  };

  const handleClearClient = () => {
    setSelectedClient(null);
    setClientQuery('');
    setFormData(prev => ({ ...prev, agent_id: '' }));
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

  const selectedPlot = plots.find(p => String(p.id) === formData.plot_id);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!siteId) return toast.error('Please select a site first');
    if (!formData.plot_id) return toast.error('Please select a plot');
    if (!formData.agent_id) return toast.error('Please select an agent (receiver)');
    if (!formData.total_commission || parseFloat(formData.total_commission) <= 0) {
      return toast.error('Please enter a valid commission amount');
    }

    try {
      setLoading(true);
      await api.post('/plot-commission/create', {
        site_id: siteId,
        ...formData
      });
      toast.success('Commission assigned successfully');
      navigate(`/plot-commission/plot/${formData.plot_id}?site_id=${siteId}`);
    } catch (err) {
      console.error('Failed to create commission:', err);
      toast.error(err.response?.data?.message || 'Failed to create commission');
    } finally {
      setLoading(false);
    }
  };

  if (!currentSite) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <LayoutGrid className="w-10 h-10 text-slate-200 mb-3" />
        <p className="text-sm text-slate-500">Select a site to assign commission</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/plot-commission')}
          className="text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Assign Plot Commission</h1>
          <p className="text-sm text-slate-500 mt-0.5">Link a commission receiver to a plot</p>
        </div>
      </div>

      <Card className="shadow-none border-slate-200">
        <CardContent className="p-6">
          {dataLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">

              {/* Plot Selection */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium border-b pb-2 text-slate-800">1. Select Plot</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-slate-600 uppercase">Plot</Label>
                    <Select
                      value={formData.plot_id}
                      onValueChange={(val) => setFormData(prev => ({ ...prev, plot_id: val }))}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Select a plot..." />
                      </SelectTrigger>
                      <SelectContent>
                        {plots.map(plot => (
                          <SelectItem key={plot.id} value={String(plot.id)}>
                            {plot.plot_no} {plot.buyer_name ? `(${plot.buyer_name})` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Read-only Plot Details */}
                {selectedPlot && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-lg border border-slate-100">
                    <div>
                      <p className="text-[10px] uppercase text-slate-500 font-medium">Buyer Name</p>
                      <p className="text-sm font-medium text-slate-900">{selectedPlot.buyer_name || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-slate-500 font-medium">Plot Size</p>
                      <p className="text-sm font-medium text-slate-900">{selectedPlot.plot_size || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-slate-500 font-medium">Plot Rate</p>
                      <p className="text-sm font-medium text-slate-900">{selectedPlot.plot_rate || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-slate-500 font-medium">Block</p>
                      <p className="text-sm font-medium text-slate-900">{selectedPlot.block || '—'}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Commission Details */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium border-b pb-2 text-slate-800">2. Commission Details</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2" ref={dropdownRef}>
                    <Label className="text-xs font-semibold text-slate-600 uppercase">Commission Receiver (Agent) *</Label>
                    <div className="relative">
                      {selectedClient ? (
                        <div className="flex items-center gap-2 h-10 px-3 border border-slate-200 rounded-md bg-slate-50">
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
                            className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <Input
                            ref={inputRef}
                            placeholder="Search by name or phone..."
                            value={clientQuery}
                            onChange={handleClientQueryChange}
                            onFocus={() => { if (clientQuery) setShowDropdown(true); }}
                            className="pl-9 pr-8 h-10"
                            autoComplete="off"
                          />
                          {clientLoading && (
                            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />
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
                              <p className="text-sm text-slate-400">No matching clients found.</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-slate-600 uppercase">Total Commission Amount</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Enter amount"
                      value={formData.total_commission}
                      onChange={(e) => setFormData(prev => ({ ...prev, total_commission: e.target.value }))}
                      className="h-10 font-medium"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-600 uppercase">Remarks (Optional)</Label>
                  <Textarea
                    placeholder="Add any internal notes..."
                    value={formData.remarks}
                    onChange={(e) => setFormData(prev => ({ ...prev, remarks: e.target.value }))}
                    className="resize-none min-h-[80px]"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/plot-commission')}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={loading} className="gap-2">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Assign Commission
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CreatePlotCommission;
