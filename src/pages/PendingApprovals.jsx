import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Checkbox } from '../components/ui/checkbox';
import { CheckCircle2, XCircle, Clock, Loader2, RefreshCw } from 'lucide-react';

const MODULE_LABELS = {
  farmer_payment:     { label: 'Farmer Payment',   cls: 'bg-green-50 text-green-700 border-green-200' },
  plot_commission:    { label: 'Plot Commission',   cls: 'bg-purple-50 text-purple-700 border-purple-200' },
  cash_flow_entry:    { label: 'Personal Ledger',   cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  firm_transaction:   { label: 'Firm Transaction',  cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  plot_payment:       { label: 'Plot Payment',      cls: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  expense:            { label: 'Expense',           cls: 'bg-red-50 text-red-700 border-red-200' },
  daybook_farmer:     { label: 'Farmer Payment',    cls: 'bg-green-50 text-green-700 border-green-200' },
  daybook_commission: { label: 'Plot Commission',   cls: 'bg-purple-50 text-purple-700 border-purple-200' },
  daybook_expense:    { label: 'Expense',           cls: 'bg-red-50 text-red-700 border-red-200' },
  imprest_request:    { label: 'Imprest Request',   cls: 'bg-violet-50 text-violet-700 border-violet-200' },
};

const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const getApiSource = (source) => {
  if (!source) return source;
  if (source.startsWith('daybook_') || source === 'daybook') return 'daybook';
  return source;
};

const PendingApprovals = () => {
  const { currentSite, isAdmin } = useAuth();
  const siteId = currentSite?.id;

  const [entries, setEntries] = useState([]);
  const [imprestEntries, setImprestEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState(null);
  const [counts, setCounts] = useState({ total: 0 });
  const [filter, setFilter] = useState('all');
  const [selectedItems, setSelectedItems] = useState([]);

  const fetch = useCallback(async () => {
    if (!siteId) return;
    setLoading(true);
    try {
      const [pendingRes, countsRes, imprestRes] = await Promise.all([
        api.get(`/approvals/pending?site_id=${siteId}`),
        api.get(`/approvals/counts?site_id=${siteId}`),
        api.get(`/imprest/expense-requests?site_id=${siteId}&status=PENDING`),
      ]);
      setEntries(pendingRes.data.entries || []);
      setCounts(countsRes.data || { total: 0 });
      const raw = (imprestRes.data.requests || []).filter(r => r.status === 'PENDING');
      setImprestEntries(raw.map(r => ({
        id: r.id,
        source: 'imprest_request',
        entry_label: `Imprest Request — ₹${Number(r.amount).toLocaleString('en-IN')}${r.reason ? ` · ${r.reason}` : ''}`,
        date: r.created_at,
        created_by_name: r.sub_admin_name || r.created_by_name || null,
        site_name: r.site_name || null,
        _raw: r,
      })));
    } catch {
      setEntries([]);
      setImprestEntries([]);
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => { fetch(); }, [fetch]);

  const handleApprove = async (entry) => {
    const key = `${entry.source}-${entry.id}`;
    setActionId(key);
    try {
      if (entry.source === 'imprest_request') {
        await api.put(`/imprest/expense-requests/${entry.id}/approve`);
      } else {
        await api.put(`/approvals/${entry.id}/approve?source=${getApiSource(entry.source)}`);
      }
      await fetch();
    } catch (err) {
      alert(err?.response?.data?.message || 'Approve failed');
    } finally {
      setActionId(null);
    }
  };

  const handleReject = async (entry) => {
    const key = `${entry.source}-${entry.id}`;
    setActionId(key);
    try {
      if (entry.source === 'imprest_request') {
        await api.put(`/imprest/expense-requests/${entry.id}/reject`);
      } else {
        await api.put(`/approvals/${entry.id}/reject?source=${getApiSource(entry.source)}`);
      }
      await fetch();
    } catch (err) {
      alert(err?.response?.data?.message || 'Reject failed');
    } finally {
      setActionId(null);
    }
  };

  const isSelected = (entry) => selectedItems.some((item) => item.id === entry.id && item.source === entry.source);

  const handleSelectOne = (entry, checked) => {
    const isChecked = checked === true;
    if (isChecked) {
      setSelectedItems((prev) => {
        if (prev.some((item) => item.id === entry.id && item.source === entry.source)) return prev;
        return [...prev, { id: entry.id, source: entry.source }];
      });
      return;
    }
    setSelectedItems((prev) => prev.filter((item) => !(item.id === entry.id && item.source === entry.source)));
  };

  const handleBulkAction = async (type) => {
    if (selectedItems.length === 0) return;
    setActionId(`bulk-${type}`);
    try {
      const regularItems = selectedItems.filter((item) => item.source !== 'imprest_request');
      const imprestItems = selectedItems.filter((item) => item.source === 'imprest_request');

      if (regularItems.length > 0) {
        const payloadItems = regularItems.map((item) => ({
          id: item.id,
          source: getApiSource(item.source),
        }));

        if (type === 'approve') {
          await api.post('/approvals/bulk-approve', { items: payloadItems });
        } else {
          await api.post('/approvals/bulk-reject', { items: payloadItems });
        }
      }

      if (imprestItems.length > 0) {
        const actionPath = type === 'approve' ? 'approve' : 'reject';
        for (const item of imprestItems) {
          await api.put(`/imprest/expense-requests/${item.id}/${actionPath}`);
        }
      }

      setSelectedItems([]);
      await fetch();
    } catch (err) {
      alert(err?.response?.data?.message || `${type === 'approve' ? 'Bulk approve' : 'Bulk reject'} failed`);
    } finally {
      setActionId(null);
    }
  };

  // combine for filter chips — imprest entries shown separately so sources only use regular entries
  const sources = [...new Set(entries.map(e => e.source).filter(Boolean))];

  const filtered = filter === 'all' ? entries : entries.filter(e => e.source === filter);
  const totalCount = (counts.total || entries.length) + imprestEntries.length;
  const visibleEntries = [...filtered, ...imprestEntries];
  const allVisibleSelected = visibleEntries.length > 0 && visibleEntries.every((entry) => isSelected(entry));

  const handleSelectAll = (checked) => {
    const isChecked = checked === true;
    if (isChecked) {
      setSelectedItems(visibleEntries.map((entry) => ({ id: entry.id, source: entry.source })));
      return;
    }
    setSelectedItems([]);
  };

  useEffect(() => {
    const regularVisible = filter === 'all' ? entries : entries.filter((entry) => entry.source === filter);
    const validKeys = new Set([...regularVisible, ...imprestEntries].map((entry) => `${entry.source}-${entry.id}`));
    setSelectedItems((prev) => {
      const next = prev.filter((item) => validKeys.has(`${item.source}-${item.id}`));
      return next.length === prev.length ? prev : next;
    });
  }, [entries, imprestEntries, filter]);

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <XCircle className="w-10 h-10 text-red-300 mb-3" />
        <p className="text-sm text-slate-500">Admin access required</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5 py-6 px-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Pending Approvals</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {currentSite?.name || '—'} &middot; {totalCount} pending
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetch} disabled={loading}>
          {loading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
          Refresh
        </Button>
      </div>

      {/* Module filter chips */}
      {sources.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
              filter === 'all'
                ? 'bg-slate-800 text-white border-slate-800'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
            }`}
          >
            All ({entries.length})
          </button>
          {sources.map(src => {
            const mod = MODULE_LABELS[src] || { label: src, cls: 'bg-slate-50 text-slate-600 border-slate-200' };
            const cnt = entries.filter(e => e.source === src).length;
            return (
              <button
                key={src}
                onClick={() => setFilter(src)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                  filter === src ? 'bg-slate-800 text-white border-slate-800' : `${mod.cls} hover:opacity-80`
                }`}
              >
                {mod.label} ({cnt})
              </button>
            );
          })}
        </div>
      )}

      {/* Selection & bulk actions */}
      {visibleEntries.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <Checkbox checked={allVisibleSelected} onCheckedChange={handleSelectAll} />
          <span className="text-xs font-medium text-slate-700">Select All</span>
          <span className="text-xs text-slate-500">{selectedItems.length} selected</span>
          <div className="ml-auto flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={selectedItems.length === 0 || !!actionId}
              onClick={() => handleBulkAction('approve')}
              className="h-8 text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50"
            >
              {actionId === 'bulk-approve' ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />}
              Approve Selected
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={selectedItems.length === 0 || !!actionId}
              onClick={() => handleBulkAction('reject')}
              className="h-8 text-xs border-red-200 text-red-700 hover:bg-red-50"
            >
              {actionId === 'bulk-reject' ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5 mr-1.5" />}
              Reject Selected
            </Button>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-slate-200 border-t-indigo-500 animate-spin" />
          <p className="text-xs text-slate-400">Loading approvals…</p>
        </div>
      ) : filtered.length === 0 && imprestEntries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 border border-dashed border-slate-200 rounded-2xl bg-slate-50">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
            <CheckCircle2 className="w-7 h-7 text-emerald-500" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-700">All clear!</p>
            <p className="text-xs text-slate-400 mt-0.5">No pending approvals for {currentSite?.name || 'this site'}</p>
          </div>
        </div>
      ) : (
        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white divide-y divide-slate-100">
          {filtered.map((entry) => {
            const mod = MODULE_LABELS[entry.source] || { label: entry.source, cls: 'bg-slate-50 text-slate-600 border-slate-200' };
            const actionKey = `${entry.source}-${entry.id}`;
            const isActing = actionId === actionKey;
            const itemSelected = isSelected(entry);
            return (
              <div key={actionKey} className={`px-5 py-4 transition-colors ${itemSelected ? 'bg-blue-50/60' : 'hover:bg-slate-50/60'}`}>
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={itemSelected}
                    onCheckedChange={(checked) => handleSelectOne(entry, checked)}
                    disabled={!!actionId}
                    className="mt-2"
                  />
                  <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0 mt-0.5">
                    <Clock className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 leading-snug">{entry.entry_label}</p>
                    <div className="flex items-center flex-wrap gap-1.5 mt-1.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-semibold ${mod.cls}`}>
                        {mod.label}
                      </span>
                      <span className="text-[11px] text-slate-400">{fmtDate(entry.date)}</span>
                      {entry.created_by_name && (
                        <span className="text-[11px] text-slate-400">by {entry.created_by_name}</span>
                      )}
                      {entry.booked_by && (
                        <span className="text-[11px] text-slate-400">Booked by {entry.booked_by}</span>
                      )}
                      {entry.plot_no && (
                        <span className="text-[10px] font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-full px-2 py-0.5">
                          Plot {entry.plot_no}
                        </span>
                      )}
                      {(entry.payment_mode || entry.cash_type) && (
                        <span className={`text-[10px] font-medium rounded-full px-2 py-0.5 border ${
                          (entry.payment_mode || entry.cash_type) === 'CASH' || entry.cash_type === 'cash'
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}>
                          {(entry.payment_mode || entry.cash_type || '').toUpperCase()}
                        </span>
                      )}
                      {entry.site_name && (
                        <span className="text-[10px] text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">{entry.site_name}</span>
                      )}
                    </div>
                  </div>
                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 mt-0.5">
                    <button
                      disabled={!!actionId}
                      onClick={() => handleApprove(entry)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                    >
                      {isActing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      Approve
                    </button>
                    <button
                      disabled={!!actionId}
                      onClick={() => handleReject(entry)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors disabled:opacity-50"
                    >
                      {isActing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Imprest Requests Section */}
      {imprestEntries.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-700">Imprest Requests</h2>
            <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 text-[11px] font-bold bg-violet-100 text-violet-700 rounded-full">
              {imprestEntries.length}
            </span>
          </div>
          <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white divide-y divide-slate-100">
            {imprestEntries.map((entry) => {
              const mod = MODULE_LABELS.imprest_request;
              const actionKey = `imprest_request-${entry.id}`;
              const isActing = actionId === actionKey;
              const itemSelected = isSelected(entry);
              return (
                <div key={actionKey} className={`px-5 py-4 transition-colors ${itemSelected ? 'bg-blue-50/60' : 'hover:bg-slate-50/60'}`}>
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={itemSelected}
                      onCheckedChange={(checked) => handleSelectOne(entry, checked)}
                      disabled={!!actionId}
                      className="mt-2"
                    />
                    <div className="w-9 h-9 rounded-xl bg-violet-50 border border-violet-200 flex items-center justify-center shrink-0 mt-0.5">
                      <Clock className="w-4 h-4 text-violet-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 leading-snug">{entry.entry_label}</p>
                      <div className="flex items-center flex-wrap gap-1.5 mt-1.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-semibold ${mod.cls}`}>
                          {mod.label}
                        </span>
                        <span className="text-[11px] text-slate-400">{fmtDate(entry.date)}</span>
                        {entry.created_by_name && (
                          <span className="text-[11px] text-slate-400">by {entry.created_by_name}</span>
                        )}
                        {entry.site_name && (
                          <span className="text-[10px] text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">{entry.site_name}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 mt-0.5">
                      <button
                        disabled={!!actionId}
                        onClick={() => handleApprove(entry)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                      >
                        {isActing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        Approve
                      </button>
                      <button
                        disabled={!!actionId}
                        onClick={() => handleReject(entry)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors disabled:opacity-50"
                      >
                        {isActing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default PendingApprovals;
