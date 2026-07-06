import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { AlertCircle, Check, Loader2, Plus, Store, Tags, Trash2, X } from 'lucide-react';

const VendorCategories = () => {
  const navigate = useNavigate();
  const { currentSite, canManage, hasPermission } = useAuth();
  const canWrite = canManage && hasPermission('vendors', 'write');
  const canDelete = canManage && hasPermission('vendors', 'delete');
  const siteId = currentSite?.id;

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [heads, setHeads] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [headName, setHeadName] = useState('');

  const loadHeads = useCallback(async () => {
    if (!siteId) return;
    setLoading(true);
    // Watchdog — never let the spinner hang.
    const watchdog = setTimeout(() => setLoading(false), 15000);
    try {
      const res = await api.get('/vendors/heads', { params: { site_id: siteId } });
      setHeads(res.data.heads || []);
    } catch {
      setMessage({ type: 'error', text: 'Failed to load categories' });
    } finally {
      clearTimeout(watchdog);
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => { loadHeads(); }, [loadHeads]);

  useEffect(() => {
    if (!message.text) return;
    const t = setTimeout(() => setMessage({ type: '', text: '' }), 3500);
    return () => clearTimeout(t);
  }, [message]);

  const handleCreate = async () => {
    if (!siteId || !headName.trim()) {
      setMessage({ type: 'error', text: 'Category name is required' });
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await api.post('/vendors/heads', { site_id: siteId, name: headName.trim().toUpperCase() });
      // Optimistic add — close dialog instantly.
      if (data?.head) {
        setHeads((prev) => {
          const exists = prev.findIndex((h) => h.id === data.head.id);
          if (exists >= 0) {
            const next = prev.slice();
            next[exists] = { ...next[exists], ...data.head };
            return next;
          }
          return [...prev, { commitment_count: 0, ...data.head }];
        });
      }
      setMessage({ type: 'success', text: 'Category created' });
      setHeadName('');
      setDialogOpen(false);
      loadHeads(); // background reconcile
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to create category' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this category? Existing commitments using it will not be affected.')) return;
    const snapshot = heads;
    setHeads((prev) => prev.filter((h) => h.id !== id));
    try {
      await api.delete(`/vendors/heads/${id}`, { params: { site_id: siteId } });
      setMessage({ type: 'success', text: 'Category deleted' });
      loadHeads();
    } catch (err) {
      setHeads(snapshot); // rollback
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to delete category' });
    }
  };

  if (!currentSite) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Tags className="w-10 h-10 text-slate-200 mb-3" />
        <p className="text-sm text-slate-500">Select a site to manage vendor categories</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full md:max-w-350 space-y-5">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-white via-slate-50 to-orange-50/60 p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
              <button onClick={() => navigate('/vendors')} className="hover:text-slate-600 transition-colors">Vendor Management</button>
              <span>/</span>
              <span className="font-medium text-slate-600">Categories</span>
            </div>
            <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Vendor Categories</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Manage work/payment categories for <span className="font-medium text-slate-700">{currentSite.name}</span>
            </p>
          </div>
          {canWrite && (
            <Button size="sm" onClick={() => { setHeadName(''); setDialogOpen(true); }}>
              <Plus className="w-4 h-4 mr-1.5" /> Add Category
            </Button>
          )}
        </div>
      </div>

      {/* Alert */}
      {message.text && (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm border ${message.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'}`}>
          {message.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{message.text}</span>
          <button className="ml-auto" onClick={() => setMessage({ type: '', text: '' })}><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* Categories List */}
      <Card className="shadow-none border-slate-200">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
            </div>
          ) : heads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Tags className="w-9 h-9 text-slate-200 mb-3" />
              <p className="text-sm font-medium text-slate-500">No categories yet</p>
              <p className="text-xs text-slate-400 mt-1">Add categories like CEMENT, BRICKS, JCB, CIVIL WORK</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80">
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold">#</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Category Name</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-right">Commitments</TableHead>
                  {canDelete && <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-right w-20">Action</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {heads.map((h, idx) => (
                  <TableRow key={h.id}>
                    <TableCell className="text-slate-400 text-sm">{idx + 1}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-lg bg-orange-100 flex items-center justify-center">
                          <Store className="w-3.5 h-3.5 text-orange-600" />
                        </div>
                        <span className="text-sm font-semibold text-slate-800">{h.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary" className="text-xs">{h.commitment_count || 0}</Badge>
                    </TableCell>
                    {canDelete && (
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-slate-400 hover:text-red-500"
                          onClick={() => handleDelete(h.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Category Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Add Category</DialogTitle>
            <DialogDescription className="text-sm">Create a work/payment category like CIVIL WORK, MATERIAL, CONTRACTOR LABOUR.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Category Name</Label>
            <Input
              value={headName}
              onChange={(e) => setHeadName(e.target.value.toUpperCase())}
              placeholder="CIVIL WORK"
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => setDialogOpen(false)} disabled={submitting}>Cancel</Button>
            <Button type="button" size="sm" onClick={handleCreate} disabled={submitting}>
              {submitting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Plus className="w-3.5 h-3.5 mr-1.5" />}
              Add Category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VendorCategories;
