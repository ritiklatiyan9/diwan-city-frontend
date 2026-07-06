import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowDownRight, ArrowUpRight, Banknote, Building2, Loader2, TrendingDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';

const FirmTransactionHistory = () => {
  const navigate = useNavigate();
  const { currentSite } = useAuth();
  const siteId = currentSite?.id;

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [data, setData] = useState({
    summary: { total_entries: 0, total_debit: 0, total_credit: 0 },
    byFirm: [],
    firmToFirm: [],
    transactions: [],
  });

  const fetchHistory = useCallback(async () => {
    if (!siteId) return;
    try {
      setLoading(true);
      const res = await api.get(`/firms/history/analytics?site_id=${siteId}`);
      setData({
        summary: res.data.summary || { total_entries: 0, total_debit: 0, total_credit: 0 },
        byFirm: res.data.byFirm || [],
        firmToFirm: res.data.firmToFirm || [],
        transactions: res.data.transactions || [],
      });
    } catch (err) {
      console.error('Failed to fetch firm history analytics:', err);
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const fmt = (n) => (parseFloat(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  const fmtDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const filteredTransactions = useMemo(() => {
    if (!search) return data.transactions;
    const q = search.toLowerCase();
    return data.transactions.filter((t) =>
      t.firm_name?.toLowerCase().includes(q) ||
      t.name?.toLowerCase().includes(q) ||
      t.description?.toLowerCase().includes(q) ||
      t.purpose?.toLowerCase().includes(q) ||
      t.remark?.toLowerCase().includes(q)
    );
  }, [data.transactions, search]);

  if (!currentSite) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Building2 className="w-10 h-10 text-slate-200 mb-3" />
        <p className="text-sm text-slate-500">Select a site to view firm transaction analytics</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full md:max-w-7xl space-y-5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => navigate('/firm-transactions')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Firm Transaction History & Analytics</h1>
            <p className="text-sm text-slate-500 mt-0.5">Site-wide analysis for {currentSite.name}</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="shadow-none border-slate-200"><CardContent className="p-4"><p className="text-xs text-slate-400">Entries</p><p className="text-xl font-bold text-slate-900 mt-1">{data.summary.total_entries || 0}</p></CardContent></Card>
            <Card className="shadow-none border-slate-200"><CardContent className="p-4"><p className="text-xs text-slate-400">Total Debit</p><p className="text-xl font-bold text-red-600 mt-1">₹{fmt(data.summary.total_debit)}</p></CardContent></Card>
            <Card className="shadow-none border-slate-200"><CardContent className="p-4"><p className="text-xs text-slate-400">Total Credit</p><p className="text-xl font-bold text-emerald-700 mt-1">₹{fmt(data.summary.total_credit)}</p></CardContent></Card>
            <Card className="shadow-none border-slate-200"><CardContent className="p-4"><p className="text-xs text-slate-400">Net</p><p className="text-xl font-bold text-slate-900 mt-1">₹{fmt((parseFloat(data.summary.total_credit) || 0) - (parseFloat(data.summary.total_debit) || 0))}</p></CardContent></Card>
          </div>

          <Card className="shadow-none border-slate-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingDown className="w-4 h-4 text-slate-500" />
                <h2 className="text-sm font-semibold text-slate-800">Firm-to-Firm Analytics</h2>
              </div>
              {data.firmToFirm.length === 0 ? (
                <p className="text-xs text-slate-400">No firm-to-firm patterns found yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>From Firm</TableHead>
                        <TableHead>To Firm</TableHead>
                        <TableHead className="text-right">Entries</TableHead>
                        <TableHead className="text-right">Debit</TableHead>
                        <TableHead className="text-right">Credit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.firmToFirm.map((r, idx) => (
                        <TableRow key={`${r.from_firm}-${r.to_firm}-${idx}`}>
                          <TableCell>{r.from_firm}</TableCell>
                          <TableCell>{r.to_firm}</TableCell>
                          <TableCell className="text-right">{r.entries}</TableCell>
                          <TableCell className="text-right text-red-600">₹{fmt(r.total_debit)}</TableCell>
                          <TableCell className="text-right text-emerald-700">₹{fmt(r.total_credit)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-none border-slate-200">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-800">All Transactions</h2>
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search firm, name, purpose..." className="max-w-sm h-9" />
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>From Firm</TableHead>
                      <TableHead>To</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                      <TableHead>Remark</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTransactions.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell>{fmtDate(t.date)}</TableCell>
                        <TableCell className="font-medium text-slate-700">{t.firm_name}</TableCell>
                        <TableCell>
                          {t.matched_counterparty_firm_name ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 text-xs font-medium"><Banknote className="w-3 h-3" />{t.matched_counterparty_firm_name}</span>
                          ) : (
                            t.name || '—'
                          )}
                        </TableCell>
                        <TableCell>{t.description || '—'}</TableCell>
                        <TableCell className="text-right">{parseFloat(t.debit) > 0 ? <span className="inline-flex items-center gap-1 text-red-600"><ArrowUpRight className="w-3 h-3" />₹{fmt(t.debit)}</span> : '—'}</TableCell>
                        <TableCell className="text-right">{parseFloat(t.credit) > 0 ? <span className="inline-flex items-center gap-1 text-emerald-700"><ArrowDownRight className="w-3 h-3" />₹{fmt(t.credit)}</span> : '—'}</TableCell>
                        <TableCell>{t.remark || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default FirmTransactionHistory;
