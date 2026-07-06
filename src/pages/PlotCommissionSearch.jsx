import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Search, Loader2, LayoutGrid, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

const PlotCommissionSearch = () => {
  const { currentSite } = useAuth();
  const siteId = currentSite?.id;
  const navigate = useNavigate();

  const [commissions, setCommissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

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
    fetchCommissions();
  }, [fetchCommissions]);

  const q = searchQuery.toLowerCase().trim();
  const filtered = q
    ? commissions.filter((c) =>
        c.plot_no?.toLowerCase().includes(q) ||
        c.buyer_name?.toLowerCase().includes(q) ||
        c.latest_agent_name?.toLowerCase().includes(q) ||
        c.all_agent_names?.toLowerCase().includes(q)
      )
    : commissions;

  if (!currentSite) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <LayoutGrid className="w-10 h-10 text-slate-200 mb-3" />
        <p className="text-sm text-slate-500">Select a site to search plots</p>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-4 py-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Search Plot Commission</h1>
        <p className="text-sm text-slate-500 mt-0.5">Select a plot to view commission details</p>
      </div>

      <Card className="shadow-none border-slate-200">
        <CardContent className="p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search by plot number, buyer name, or agent name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10"
              autoFocus
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10">
              <Search className="w-7 h-7 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-500">
                {searchQuery ? 'No plots match your search' : 'No commission assignments found'}
              </p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="max-h-[60vh] overflow-y-auto divide-y divide-slate-100">
                {filtered.map((c) => (
                  <button
                    key={c.plot_id}
                    onClick={() => navigate(`/plot-commission/plot/${c.plot_id}?site_id=${siteId}`)}
                    className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-slate-50 transition-colors text-left group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs font-mono font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded shrink-0">
                        {c.plot_no}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{c.latest_agent_name}</p>
                        {c.buyer_name && (
                          <p className="text-[11px] text-slate-400 truncate">{c.buyer_name}</p>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors shrink-0 ml-2" />
                  </button>
                ))}
              </div>
              <div className="px-3 py-2 bg-slate-50 border-t border-slate-200">
                <p className="text-[11px] text-slate-400">{filtered.length} plot{filtered.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PlotCommissionSearch;
