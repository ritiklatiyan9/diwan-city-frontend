import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';
import { Textarea } from '../components/ui/textarea';
import {
  Dialog,
  DialogContent,
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
import { Label } from '../components/ui/label';
import {
  AlertCircle, Check, Search, Clock, CheckCircle2, XCircle,
  Loader2, Eye, RefreshCw, Image, FileEdit, X, Upload, Camera,
  ChevronLeft, ChevronRight,
} from 'lucide-react';

const PAGE_SIZE = 15;

// ── Constants ──
const STATUS_CONFIG = {
  pending: { label: 'Pending', icon: Clock, className: 'bg-amber-50 text-amber-700 border-amber-200' },
  approved: { label: 'Approved', icon: CheckCircle2, className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  rejected: { label: 'Rejected', icon: XCircle, className: 'bg-red-50 text-red-700 border-red-200' },
};

const MODULE_LABELS = {
  farmer: 'Farmer',
  farmer_payment: 'Farmer Payment',
  plot: 'Plot',
  plot_payment: 'Plot Payment',
  daybook: 'Day Book',
  daybook_expense: 'DayBook Expense',
  daybook_farmer_payment: 'DayBook Farmer Payment',
  daybook_commission: 'DayBook Commission',
  daybook_cashflow: 'DayBook Cash Flow',
  daybook_firm_transaction: 'DayBook Firm Transaction',
  daybook_plot_payment: 'DayBook Plot Payment',
};

const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const fmt = (v) => {
  const num = parseFloat(v);
  if (isNaN(num)) return v;
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(num);
};

const EditApprovals = () => {
  const { isAdmin, currentSite } = useAuth();

  const [requests, setRequests] = useState([]);
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Filters
  const [statusFilter, setStatusFilter] = useState('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [moduleFilter, setModuleFilter] = useState('all');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // Dialogs
  const [detailDialog, setDetailDialog] = useState({ open: false, request: null });
  const [rejectDialog, setRejectDialog] = useState({ open: false, request: null, reason: '' });
  const [approveDialog, setApproveDialog] = useState({ open: false, request: null });
  const [reviewPhoto, setReviewPhoto] = useState(null);
  const [reviewPhotoPreview, setReviewPhotoPreview] = useState(null);
  const [imageDialog, setImageDialog] = useState({ open: false, url: '' });

  const fetchRequests = useCallback(async (showRefresh = false) => {
    try {
      if (showRefresh) setRefreshing(true);
      else setLoading(true);

      const params = { status: statusFilter };
      if (currentSite?.id) params.site_id = currentSite.id;

      const [reqRes, countsRes] = await Promise.all([
        api.get('/edit-requests', { params }),
        api.get('/edit-requests/counts', { params: currentSite?.id ? { site_id: currentSite.id } : {} }),
      ]);

      setRequests(reqRes.data.requests || []);
      setCounts(countsRes.data || { pending: 0, approved: 0, rejected: 0 });
    } catch (err) {
      console.error('Failed to fetch edit requests:', err);
      setMessage({ type: 'error', text: 'Failed to load edit requests' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, currentSite]);

  useEffect(() => {
    if (isAdmin) fetchRequests();
  }, [fetchRequests, isAdmin]);

  // Client-side filtering
  const filtered = useMemo(() => {
    let list = requests;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(r =>
        r.requested_by_name?.toLowerCase().includes(q) ||
        r.module?.toLowerCase().includes(q) ||
        r.site_name?.toLowerCase().includes(q) ||
        JSON.stringify(r.proposed_data)?.toLowerCase().includes(q)
      );
    }
    if (moduleFilter !== 'all') {
      list = list.filter(r => r.module === moduleFilter);
    }
    return list;
  }, [requests, searchQuery, moduleFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = useMemo(
    () => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filtered, currentPage]
  );

  // Reset to page 1 when filters change
  useEffect(() => { setCurrentPage(1); }, [statusFilter, searchQuery, moduleFilter]);

  const openApproveDialog = (request) => {
    setReviewPhoto(null);
    setReviewPhotoPreview(null);
    setApproveDialog({ open: true, request });
  };

  const closeApproveDialog = () => {
    setApproveDialog({ open: false, request: null });
    setReviewPhoto(null);
    setReviewPhotoPreview(null);
  };

  const handleReviewPhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setReviewPhoto(file);
      setReviewPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleApprove = async () => {
    const { request } = approveDialog;
    if (!request) return;
    try {
      setSubmitting(true);
      const formData = new FormData();
      if (reviewPhoto) formData.append('review_photo', reviewPhoto);
      await api.put(`/edit-requests/${request.id}/approve`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setMessage({ type: 'success', text: 'Edit request approved and changes applied' });
      closeApproveDialog();
      setDetailDialog({ open: false, request: null });
      fetchRequests(true);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to approve' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    const { request, reason } = rejectDialog;
    try {
      setSubmitting(true);
      await api.put(`/edit-requests/${request.id}/reject`, { rejection_reason: reason });
      setMessage({ type: 'success', text: 'Edit request rejected' });
      setRejectDialog({ open: false, request: null, reason: '' });
      setDetailDialog({ open: false, request: null });
      fetchRequests(true);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to reject' });
    } finally {
      setSubmitting(false);
    }
  };

  // Render changes comparison
  const renderChanges = (original, proposed) => {
    const orig = typeof original === 'string' ? JSON.parse(original) : (original || {});
    const prop = typeof proposed === 'string' ? JSON.parse(proposed) : (proposed || {});
    
    const changedKeys = Object.keys(prop).filter(k => {
      if (['id', 'created_at', 'updated_at', 'created_by'].includes(k)) return false;
      return String(orig[k] ?? '') !== String(prop[k] ?? '');
    });

    if (changedKeys.length === 0) {
      return <p className="text-sm text-slate-400 italic">No changes detected</p>;
    }

    return (
      <div className="space-y-2">
        {changedKeys.map(key => (
          <div key={key} className="text-sm border rounded-lg p-2 bg-slate-50">
            <span className="font-medium text-slate-600 capitalize">{key.replace(/_/g, ' ')}:</span>
            <div className="flex gap-2 mt-1">
              <span className="line-through text-red-500 bg-red-50 px-1.5 py-0.5 rounded text-xs">
                {orig[key] !== null && orig[key] !== undefined ? String(orig[key]) : '(empty)'}
              </span>
              <span className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded text-xs font-medium">
                {prop[key] !== null && prop[key] !== undefined ? String(prop[key]) : '(empty)'}
              </span>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Auto-clear messages
  useEffect(() => {
    if (message.text) {
      const t = setTimeout(() => setMessage({ type: '', text: '' }), 4000);
      return () => clearTimeout(t);
    }
  }, [message]);

  return (
    <div className="max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Edit Approvals</h1>
          <p className="text-sm text-slate-500 mt-0.5">Review and approve sub-admin edit requests</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchRequests(true)} disabled={refreshing}>
          <RefreshCw className={`w-4 h-4 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {/* Message */}
      {message.text && (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
          message.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
        }`}>
          {message.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <Check className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      {/* Status Tabs */}
      <div className="flex gap-2">
        {Object.entries(STATUS_CONFIG).map(([key, config]) => {
          const Icon = config.icon;
          const count = counts[key] || 0;
          return (
            <Button
              key={key}
              variant={statusFilter === key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(key)}
              className="gap-1.5"
            >
              <Icon className="w-3.5 h-3.5" />
              {config.label}
              {count > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
                  {count}
                </Badge>
              )}
            </Button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            className="pl-9 h-9"
            placeholder="Search requests..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={moduleFilter} onValueChange={setModuleFilter}>
          <SelectTrigger className="w-52 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Modules</SelectItem>
            {Object.entries(MODULE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FileEdit className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-sm text-slate-500">No edit requests found</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-36">Date</TableHead>
                  <TableHead>Requested By</TableHead>
                  <TableHead>Module</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead>Plot No.</TableHead>
                  <TableHead>Booked By</TableHead>
                  
                  <TableHead className="w-20">Proof</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead className="w-28 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map(req => {
                  const sc = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending;
                  const Icon = sc.icon;
                  return (
                    <TableRow key={req.id} className="hover:bg-slate-50/50">
                      <TableCell className="text-xs text-slate-500">{fmtDate(req.created_at)}</TableCell>
                      <TableCell className="font-medium text-sm">{req.requested_by_name || '—'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {MODULE_LABELS[req.module] || req.module}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">{req.site_name || '—'}</TableCell>
                      <TableCell className="text-sm text-slate-600">{req.record_plot_no || '—'}</TableCell>
                      <TableCell className="text-sm text-slate-600">{req.record_booked_by || '—'}</TableCell>
                     
                      <TableCell>
                        {req.proof_photo_url ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => setImageDialog({ open: true, url: req.proof_photo_url })}
                          >
                            <Image className="w-4 h-4 text-blue-500" />
                          </Button>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs gap-1 ${sc.className}`}>
                          <Icon className="w-3 h-3" /> {sc.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => setDetailDialog({ open: true, request: req })}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {req.status === 'pending' && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-emerald-600 hover:text-emerald-700"
                                onClick={() => openApproveDialog(req)}
                                disabled={submitting}
                              >
                                <CheckCircle2 className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                                onClick={() => setRejectDialog({ open: true, request: req, reason: '' })}
                                disabled={submitting}
                              >
                                <XCircle className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {!loading && filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">
            Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
              .reduce((acc, p, idx, arr) => {
                if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...');
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) =>
                p === '...' ? (
                  <span key={`ellipsis-${i}`} className="px-1 text-slate-400">…</span>
                ) : (
                  <Button
                    key={p}
                    variant={currentPage === p ? 'default' : 'outline'}
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => setCurrentPage(p)}
                  >
                    {p}
                  </Button>
                )
              )}
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={detailDialog.open} onOpenChange={(open) => !open && setDetailDialog({ open: false, request: null })}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          {detailDialog.request && (() => {
            const r = detailDialog.request;
            const sc = STATUS_CONFIG[r.status] || STATUS_CONFIG.pending;
            const Icon = sc.icon;
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <FileEdit className="w-5 h-5" />
                    Edit Request — {MODULE_LABELS[r.module] || r.module}
                    <Badge variant="outline" className={`ml-2 text-xs gap-1 ${sc.className}`}>
                      <Icon className="w-3 h-3" /> {sc.label}
                    </Badge>
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                  {/* Meta Info */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-slate-500">Requested By:</span>
                      <span className="ml-2 font-medium">{r.requested_by_name}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Date:</span>
                      <span className="ml-2">{fmtDate(r.created_at)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Site:</span>
                      <span className="ml-2">{r.site_name || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Record ID:</span>
                      <span className="ml-2 font-mono">#{r.record_id}</span>
                    </div>
                    {r.record_plot_no && (
                      <div>
                        <span className="text-slate-500">Plot No.:</span>
                        <span className="ml-2 font-medium">{r.record_plot_no}</span>
                      </div>
                    )}
                    {r.record_booked_by && (
                      <div>
                        <span className="text-slate-500">Booked By:</span>
                        <span className="ml-2">{r.record_booked_by}</span>
                      </div>
                    )}
                    {r.record_payment_mode && (
                      <div>
                        <span className="text-slate-500">Payment Mode:</span>
                        <span className="ml-2">{r.record_payment_mode}</span>
                      </div>
                    )}
                    {r.record_buyer_name && (
                      <div>
                        <span className="text-slate-500">Buyer Name:</span>
                        <span className="ml-2">{r.record_buyer_name}</span>
                      </div>
                    )}
                  </div>

                  {/* Proof Photo */}
                  {r.proof_photo_url && (
                    <div>
                      <p className="text-sm font-medium text-slate-600 mb-2">Proof Photo</p>
                      <img
                        src={r.proof_photo_url}
                        alt="Proof"
                        className="rounded-lg border max-h-60 object-contain cursor-pointer hover:opacity-90 transition"
                        onClick={() => setImageDialog({ open: true, url: r.proof_photo_url })}
                      />
                    </div>
                  )}

                  <Separator />

                  {/* Changes */}
                  <div>
                    <p className="text-sm font-medium text-slate-600 mb-2">Proposed Changes</p>
                    {renderChanges(r.original_data, r.proposed_data)}
                  </div>

                  {/* Rejection reason (if rejected) */}
                  {r.status === 'rejected' && r.rejection_reason && (
                    <>
                      <Separator />
                      <div>
                        <p className="text-sm font-medium text-red-600 mb-1">Rejection Reason</p>
                        <p className="text-sm text-slate-600 bg-red-50 p-2 rounded">{r.rejection_reason}</p>
                      </div>
                    </>
                  )}

                  {r.status === 'approved' && (
                    <>
                      <Separator />
                      {r.review_photo_url && (
                        <div>
                          <p className="text-sm font-medium text-slate-600 mb-2">Admin Review Photo</p>
                          <img
                            src={r.review_photo_url}
                            alt="Review"
                            className="rounded-lg border max-h-60 object-contain cursor-pointer hover:opacity-90 transition"
                            onClick={() => setImageDialog({ open: true, url: r.review_photo_url })}
                          />
                        </div>
                      )}
                      {r.reviewed_by_name && (
                        <div className="text-sm text-slate-500">
                          Approved by <span className="font-medium">{r.reviewed_by_name}</span> on {fmtDate(r.reviewed_at)}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {r.status === 'pending' && (
                  <DialogFooter className="gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setRejectDialog({ open: true, request: r, reason: '' })}
                      disabled={submitting}
                      className="text-red-600 border-red-200 hover:bg-red-50"
                    >
                      <XCircle className="w-4 h-4 mr-1.5" /> Reject
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => openApproveDialog(r)}
                      disabled={submitting}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-1.5" />
                      Approve & Apply Changes
                    </Button>
                  </DialogFooter>
                )}
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialog.open} onOpenChange={(open) => !open && setRejectDialog({ open: false, request: null, reason: '' })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Edit Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-slate-500">
              Provide a reason for rejecting this edit request (optional).
            </p>
            <Textarea
              placeholder="Reason for rejection..."
              value={rejectDialog.reason}
              onChange={(e) => setRejectDialog(prev => ({ ...prev, reason: e.target.value }))}
              rows={3}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setRejectDialog({ open: false, request: null, reason: '' })}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleReject}
              disabled={submitting}
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <XCircle className="w-4 h-4 mr-1.5" />}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve Dialog */}
      <Dialog open={approveDialog.open} onOpenChange={(open) => !open && closeApproveDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              Approve Edit Request
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              The proposed changes will be applied immediately. You can optionally upload a review photo.
            </p>

            {/* Review Photo Upload */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Review Photo (optional)</Label>
              {reviewPhotoPreview ? (
                <div className="relative">
                  <img
                    src={reviewPhotoPreview}
                    alt="Review preview"
                    className="rounded-lg border max-h-48 object-contain w-full bg-slate-50"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-1 right-1 h-7 w-7 p-0 bg-white/80 hover:bg-white rounded-full shadow"
                    onClick={() => { setReviewPhoto(null); setReviewPhotoPreview(null); }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-slate-200 rounded-lg cursor-pointer hover:border-emerald-300 hover:bg-emerald-50/30 transition">
                  <Camera className="w-6 h-6 text-slate-300 mb-1" />
                  <span className="text-xs text-slate-400">Click to upload photo</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleReviewPhotoChange} />
                </label>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={closeApproveDialog}>Cancel</Button>
            <Button
              size="sm"
              onClick={handleApprove}
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <CheckCircle2 className="w-4 h-4 mr-1.5" />}
              Approve & Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Preview Dialog */}
      <Dialog open={imageDialog.open} onOpenChange={(open) => !open && setImageDialog({ open: false, url: '' })}>
        <DialogContent className="sm:max-w-3xl p-2">
          <img
            src={imageDialog.url}
            alt="Preview"
            className="w-full h-auto rounded-lg"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EditApprovals;
