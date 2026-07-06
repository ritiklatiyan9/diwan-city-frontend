import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import QRCode from 'qrcode';
import UserAvatar from '../components/UserAvatar';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
  ArrowLeft,
  ArrowDownLeft,
  ArrowUpRight,
  Loader2,
  IndianRupee,
  User,
  Plus,
  Clock,
  AlertCircle,
  Printer,
  Edit2,
  Trash2,
  RefreshCw,
  Search,
  X,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Circle,
  Wallet,
  Landmark,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import ChequeStatusControl from '../components/ChequeStatusControl';
import VoucherUpload, { VoucherThumbnail } from '../components/VoucherUpload';
import React from 'react';

const PlotCommissionDetail = () => {
  const { plotId, id } = useParams();
  const [searchParams] = useSearchParams();
  const siteIdParam = searchParams.get('site_id');
  const navigate = useNavigate();
  const { currentSite, canManage, hasPermission, isAdmin, user } = useAuth();
  const canWrite = canManage && hasPermission('commissions', 'write');
  const canUpdate = canManage && hasPermission('commissions', 'update');
  const canDelete = canManage && hasPermission('commissions', 'delete');
  const siteId = siteIdParam || currentSite?.id;
  // If accessed via old route /plot-commission/:id (commission id), we need to resolve plot_id
  const [resolvedPlotId, setResolvedPlotId] = useState(plotId || null);

  // State
  const [data, setData] = useState(null); // { plot, agents, totals, is_resale }
  const [loading, setLoading] = useState(true);
  const [approvers, setApprovers] = useState([]);

  // Payment dialog state
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentCommissionId, setPaymentCommissionId] = useState(null); // which agent commission to pay
  const [paymentAction, setPaymentAction] = useState('pay'); // pay | get
  const [submitLoading, setSubmitLoading] = useState(false);
  const [overpayConfirmOpen, setOverpayConfirmOpen] = useState(false);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: '',
    payment_mode: 'CASH',
    bank_name: '',
    transaction_id: '',
    cheque_no: '',
    remarks: '',
    voucher_url: null,
    assigned_admin_id: null,
  });

  // Edit payment state
  const [editingPayment, setEditingPayment] = useState(null);
  const [editPaymentForm, setEditPaymentForm] = useState({});
  const [editPaymentLoading, setEditPaymentLoading] = useState(false);

  // Delete payment state
  const [deletePaymentId, setDeletePaymentId] = useState(null);
  const [deletePaymentLoading, setDeletePaymentLoading] = useState(false);

  // Edit commission state
  const [editCommission, setEditCommission] = useState(null);
  const [editCommissionForm, setEditCommissionForm] = useState({ total_commission: '', remarks: '' });
  const [editCommissionLoading, setEditCommissionLoading] = useState(false);

  // Delete commission state
  const [deleteCommissionId, setDeleteCommissionId] = useState(null);
  const [deleteCommissionLoading, setDeleteCommissionLoading] = useState(false);

  // Assign new agent state
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignLoading, setAssignLoading] = useState(false);
  const [clientQuery, setClientQuery] = useState('');
  const [clientResults, setClientResults] = useState([]);
  const [clientLoading, setClientLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);
  const [assignFormData, setAssignFormData] = useState({ total_commission: '', remarks: '' });

  // Expanded agent sections
  const [expandedAgents, setExpandedAgents] = useState({});
  const [expandedHistory, setExpandedHistory] = useState({});

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      // Watchdog so the page-level spinner can never hang on a stalled request.
      const watchdog = setTimeout(() => setLoading(false), 15000);
      let pid = resolvedPlotId;
      // If accessed via old route /plot-commission/:id, resolve the plot_id
      if (!pid && id) {
        const commRes = await api.get(`/plot-commission/${id}`);
        pid = commRes.data.master?.plot_id;
        if (!pid) throw new Error('Could not resolve plot ID');
        setResolvedPlotId(pid);
      }
      if (!pid) throw new Error('No plot ID');
      const res = await api.get(`/plot-commission/plot/${pid}?site_id=${siteId}`);
      clearTimeout(watchdog);
      setData(res.data);
      // Auto-expand all agents
      const expanded = {};
      (res.data.agents || []).forEach(a => { expanded[a.commission_id] = true; });
      setExpandedAgents(expanded);
    } catch (error) {
      console.error('Failed to fetch plot commission detail:', error);
      toast.error('Failed to load commission details');
      navigate('/plot-commission');
    } finally {
      setLoading(false);
    }
  }, [resolvedPlotId, id, siteId, navigate]);

  // Background refresh — does NOT toggle the page-wide loader. Used after
  // every create / update / delete so dialogs can close instantly while the
  // page reconciles with the server.
  const refreshData = useCallback(async () => {
    try {
      const pid = resolvedPlotId;
      if (!pid) return;
      const res = await api.get(`/plot-commission/plot/${pid}?site_id=${siteId}`);
      setData(res.data);
    } catch { /* keep current data */ }
  }, [resolvedPlotId, siteId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const url = siteId ? `/admin/approvers?site_id=${siteId}` : '/admin/approvers';
    api.get(url)
      .then((res) => setApprovers(res.data.approvers || []))
      .catch(() => setApprovers([]));
  }, [siteId]);

  // Click outside to close agent search dropdown
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const getAssignedAdminLabel = (entry) => {
    if (entry?.assigned_admin_name) return entry.assigned_admin_name;
    const assignedId = entry?.assigned_admin_id;
    if (!assignedId) return null;
    const approver = approvers.find((a) => String(a.id) === String(assignedId));
    return approver?.full_name || approver?.name || approver?.email || `Admin #${assignedId}`;
  };

  const formatCurrency = (val) => {
    const num = parseFloat(val) || 0;
    return num.toLocaleString('en-IN', { maximumFractionDigits: 0 });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const isReceiveAmount = (amount) => (parseFloat(amount) || 0) < 0;
  const formatSignedAmount = (amount) => {
    const num = parseFloat(amount) || 0;
    return `${num < 0 ? '+' : '-'}₹${formatCurrency(Math.abs(num))}`;
  };

  const toggleAgent = (commissionId) => {
    setExpandedAgents(prev => ({ ...prev, [commissionId]: !prev[commissionId] }));
  };

  // ── Payment Handlers ──
  const openPaymentDialog = (commissionId, action = 'pay') => {
    setPaymentCommissionId(commissionId);
    setPaymentAction(action === 'get' ? 'get' : 'pay');
    setOverpayConfirmOpen(false);
    setFormData({
      date: new Date().toISOString().split('T')[0],
      amount: '',
      payment_mode: 'CASH',
      bank_name: '',
      transaction_id: '',
      cheque_no: '',
      remarks: '',
      voucher_url: null,
      assigned_admin_id: null,
    });
    setPaymentDialogOpen(true);
  };

  const getAgentBalance = (commissionId) => {
    const agent = data?.agents?.find(a => a.commission_id === commissionId);
    return agent ? agent.balance : 0;
  };

  const getAgentPaidAll = (commissionId) => {
    const agent = data?.agents?.find(a => a.commission_id === commissionId);
    return agent ? (parseFloat(agent.total_paid_all) || 0) : 0;
  };

  const handlePaymentSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!formData.amount || isNaN(parseFloat(formData.amount))) {
      return toast.error('Please enter a valid amount');
    }
    const amountInput = Math.abs(parseFloat(formData.amount));
    const balance = getAgentBalance(paymentCommissionId);
    const paidAll = getAgentPaidAll(paymentCommissionId);

    if (paymentAction === 'pay' && amountInput > balance && !overpayConfirmOpen) {
      setOverpayConfirmOpen(true);
      return;
    }
    if (paymentAction === 'get' && amountInput > paidAll && !overpayConfirmOpen) {
      setOverpayConfirmOpen(true);
      return;
    }
    if (formData.payment_mode === 'BANK' && !formData.bank_name) {
      return toast.error('Bank name is required for BANK payments');
    }

    const signedAmount = paymentAction === 'get' ? -amountInput : amountInput;

    // ── Optimistic UI: splice a temp row into the right agent's payments
    //    array and adjust the agent + plot totals BEFORE the network call.
    //    On failure we restore the snapshot.
    const snapshotData = data;
    const tempId = -Date.now();
    const optimisticPayment = {
      id: tempId,
      plot_commission_id: paymentCommissionId,
      date: formData.date,
      amount: signedAmount,
      payment_mode: formData.payment_mode,
      bank_name: formData.bank_name || null,
      transaction_id: formData.transaction_id || null,
      cheque_no: formData.cheque_no || null,
      remarks: formData.remarks || null,
      voucher_url: formData.voucher_url || null,
      assigned_admin_id: formData.assigned_admin_id || null,
      status: 'pending',
      cheque_status: formData.payment_mode === 'CHEQUE' ? 'PENDING' : null,
      created_at: new Date().toISOString(),
      created_by: user?.id || null,
      created_by_name: user?.full_name || user?.name || null,
    };

    if (data) {
      const nextAgents = data.agents.map((a) => {
        if (a.commission_id !== paymentCommissionId) return a;
        const newPayments = [optimisticPayment, ...(a.payments || [])];
        // Pending entries adjust total_paid_all + balance, not approved-only
        // total_paid (matches server semantics in findAllCommissionsByPlotId).
        const nextTotalPaidAll = (parseFloat(a.total_paid_all) || 0) + signedAmount;
        const nextBalance = parseFloat(a.total_commission || 0) - nextTotalPaidAll;
        return {
          ...a,
          payments: newPayments,
          payment_count: newPayments.length,
          total_paid_all: nextTotalPaidAll,
          balance: nextBalance,
        };
      });
      const nextTotalPaidAll = nextAgents.reduce((s, a) => s + (parseFloat(a.total_paid_all) || 0), 0);
      setData({
        ...data,
        agents: nextAgents,
        totals: {
          ...data.totals,
          total_paid_all: nextTotalPaidAll,
          balance: parseFloat(data.totals?.total_commission || 0) - nextTotalPaidAll,
        },
      });
    }

    setPaymentDialogOpen(false);
    setOverpayConfirmOpen(false);

    try {
      setSubmitLoading(true);
      await api.post('/plot-commission/payment', {
        master_id: paymentCommissionId,
        ...formData,
        amount: signedAmount,
      });
      toast.success(paymentAction === 'get' ? 'Money received entry recorded' : 'Payment recorded');
      // Reconcile with server (gets canonical id, verifyUrl, fresh status).
      refreshData();
    } catch (err) {
      console.error('Payment error:', err);
      toast.error(err.response?.data?.message || 'Failed to record payment');
      setData(snapshotData); // rollback
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleEditPayment = (p) => {
    setEditingPayment(p);
    setEditPaymentForm({
      date: p.date ? p.date.substring(0, 10) : '',
      amount: Math.abs(parseFloat(p.amount) || 0),
      is_receive_entry: isReceiveAmount(p.amount),
      payment_mode: p.payment_mode || 'CASH',
      bank_name: p.bank_name || '',
      transaction_id: p.transaction_id || '',
      cheque_no: p.cheque_no || '',
      remarks: p.remarks || '',
      voucher_url: p.voucher_url || null,
      assigned_admin_id: p.assigned_admin_id || null,
    });
  };

  const handleEditPaymentSubmit = async (e) => {
    e.preventDefault();
    if (!editPaymentForm.amount || isNaN(parseFloat(editPaymentForm.amount))) {
      return toast.error('Please enter a valid amount');
    }
    const amountInput = Math.abs(parseFloat(editPaymentForm.amount));
    const signedAmount = editPaymentForm.is_receive_entry ? -amountInput : amountInput;

    // Optimistic in-place update of the payment row + adjust agent totals
    // by the delta (new amount - old amount).
    const snapshotData = data;
    const targetId = editingPayment.id;
    if (data) {
      const nextAgents = data.agents.map((a) => {
        const idx = (a.payments || []).findIndex((p) => p.id === targetId);
        if (idx === -1) return a;
        const oldAmount = parseFloat(a.payments[idx].amount) || 0;
        const delta = signedAmount - oldAmount;
        const newPayments = a.payments.slice();
        newPayments[idx] = {
          ...newPayments[idx],
          ...editPaymentForm,
          amount: signedAmount,
        };
        const nextTotalPaidAll = (parseFloat(a.total_paid_all) || 0) + delta;
        const nextBalance = parseFloat(a.total_commission || 0) - nextTotalPaidAll;
        return { ...a, payments: newPayments, total_paid_all: nextTotalPaidAll, balance: nextBalance };
      });
      const nextTotalPaidAll = nextAgents.reduce((s, a) => s + (parseFloat(a.total_paid_all) || 0), 0);
      setData({
        ...data,
        agents: nextAgents,
        totals: {
          ...data.totals,
          total_paid_all: nextTotalPaidAll,
          balance: parseFloat(data.totals?.total_commission || 0) - nextTotalPaidAll,
        },
      });
    }
    setEditingPayment(null);

    try {
      setEditPaymentLoading(true);
      await api.put(`/plot-commission/payment/${targetId}`, {
        ...editPaymentForm,
        amount: signedAmount,
      });
      toast.success('Payment updated');
      refreshData(); // reconcile (status flag, approved-only totals)
    } catch (err) {
      console.error('Update error:', err);
      toast.error(err.response?.data?.message || 'Failed to update payment');
      setData(snapshotData); // rollback
    } finally {
      setEditPaymentLoading(false);
    }
  };

  const handleDeletePayment = async () => {
    const targetId = deletePaymentId;
    // Optimistic removal — strip the payment from whichever agent owns it.
    const snapshotData = data;
    if (data) {
      const nextAgents = data.agents.map((a) => {
        const removed = (a.payments || []).find((p) => p.id === targetId);
        if (!removed) return a;
        const removedAmt = parseFloat(removed.amount) || 0;
        const newPayments = a.payments.filter((p) => p.id !== targetId);
        const nextTotalPaidAll = (parseFloat(a.total_paid_all) || 0) - removedAmt;
        const nextBalance = parseFloat(a.total_commission || 0) - nextTotalPaidAll;
        return {
          ...a,
          payments: newPayments,
          payment_count: newPayments.length,
          total_paid_all: nextTotalPaidAll,
          balance: nextBalance,
        };
      });
      const nextTotalPaidAll = nextAgents.reduce((s, a) => s + (parseFloat(a.total_paid_all) || 0), 0);
      setData({
        ...data,
        agents: nextAgents,
        totals: {
          ...data.totals,
          total_paid_all: nextTotalPaidAll,
          balance: parseFloat(data.totals?.total_commission || 0) - nextTotalPaidAll,
        },
      });
    }
    setDeletePaymentId(null);

    try {
      setDeletePaymentLoading(true);
      await api.delete(`/plot-commission/payment/${targetId}`);
      toast.success('Payment deleted');
      refreshData();
    } catch (err) {
      console.error('Delete error:', err);
      toast.error(err.response?.data?.message || 'Failed to delete payment');
      setData(snapshotData); // rollback
    } finally {
      setDeletePaymentLoading(false);
    }
  };

  // ── Edit/Delete Commission Handlers ──
  const handleEditCommissionSubmit = async (e) => {
    e.preventDefault();
    if (!editCommissionForm.total_commission || parseFloat(editCommissionForm.total_commission) <= 0) {
      return toast.error('Please enter a valid commission amount');
    }
    const targetId = editCommission.commission_id;
    const newCommission = parseFloat(editCommissionForm.total_commission);

    // Optimistic update of the agent's total_commission + balance.
    const snapshotData = data;
    if (data) {
      const nextAgents = data.agents.map((a) =>
        a.commission_id === targetId
          ? {
              ...a,
              total_commission: newCommission,
              remarks: editCommissionForm.remarks || null,
              balance: newCommission - (parseFloat(a.total_paid_all) || 0),
            }
          : a
      );
      // Plot-level totals: recompute fixed plot commission if needed.
      setData({ ...data, agents: nextAgents });
    }
    setEditCommission(null);

    try {
      setEditCommissionLoading(true);
      await api.put(`/plot-commission/${targetId}`, editCommissionForm);
      toast.success('Commission updated');
      refreshData();
    } catch (err) {
      console.error('Update error:', err);
      toast.error(err.response?.data?.message || 'Failed to update');
      setData(snapshotData); // rollback
    } finally {
      setEditCommissionLoading(false);
    }
  };

  const handleDeleteCommission = async () => {
    const targetId = deleteCommissionId;
    // Optimistic removal of the agent (and their payments).
    const snapshotData = data;
    if (data) {
      const nextAgents = data.agents.filter((a) => a.commission_id !== targetId);
      setData({ ...data, agents: nextAgents });
    }
    setDeleteCommissionId(null);

    try {
      setDeleteCommissionLoading(true);
      await api.delete(`/plot-commission/${targetId}`);
      toast.success('Commission deleted');
      refreshData();
    } catch (err) {
      console.error('Delete error:', err);
      toast.error(err.response?.data?.message || 'Failed to delete');
      setData(snapshotData); // rollback
    } finally {
      setDeleteCommissionLoading(false);
    }
  };

  // ── Assign New Agent Handlers ──
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
    if (selectedClient) {
      setSelectedClient(null);
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchClients(val), 300);
  };

  const handleSelectClient = (client) => {
    setSelectedClient(client);
    setClientQuery(client.full_name);
    setShowDropdown(false);
    setClientResults([]);
  };

  const handleClearClient = () => {
    setSelectedClient(null);
    setClientQuery('');
    setClientResults([]);
    inputRef.current?.focus();
  };

  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    if (!selectedClient) return toast.error('Please select an agent');
    if (!assignFormData.total_commission || parseFloat(assignFormData.total_commission) <= 0) {
      return toast.error('Please enter a valid commission amount');
    }
    // Close dialog first — server returns the canonical commission and we
    // use refreshData to bring it into the list.
    const agent = selectedClient;
    const totalComm = parseFloat(assignFormData.total_commission);
    const memo = assignFormData.remarks;

    setAssignDialogOpen(false);
    setSelectedClient(null);
    setClientQuery('');
    setAssignFormData({ total_commission: '', remarks: '' });

    try {
      setAssignLoading(true);
      await api.post('/plot-commission/create', {
        site_id: siteId,
        plot_id: resolvedPlotId,
        agent_id: agent.id,
        total_commission: totalComm,
        remarks: memo,
      });
      toast.success('New agent assigned');
      refreshData();
    } catch (err) {
      console.error('Assign error:', err);
      toast.error(err.response?.data?.message || 'Failed to assign agent');
    } finally {
      setAssignLoading(false);
    }
  };

  // ── Print Statement ──
  const printStatement = () => {
    if (!data) return;
    const { plot, agents, totals } = data;
    const fmtINR = (v) => parseFloat(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 });

    const agentSections = agents.map(agent => `
      <div style="margin-bottom:6mm; page-break-inside:avoid;">
        <h3 style="font-size:12px; margin-bottom:3mm; border-bottom:1px solid #cbd5e1; padding-bottom:2mm;">
          Agent: ${agent.agent_name} ${agent.agent_phone ? `(${agent.agent_phone})` : ''} — Commission: ₹${fmtINR(agent.total_commission)}
          <span style="float:right; font-size:10px; color:${agent.status === 'Completed' ? '#059669' : '#b45309'}">${agent.status}</span>
        </h3>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Mode</th>
              <th>Cheque</th>
              <th style="text-align:right">Amount</th>
              <th>Status</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            ${agent.payments.length > 0 ? agent.payments.map(p => `
              <tr>
                <td>${p.date ? new Date(p.date).toLocaleDateString('en-IN') : '—'}</td>
                <td>${p.payment_mode || '—'}</td>
                <td>${p.cheque_no || '—'}</td>
                <td style="text-align:right">${parseFloat(p.amount) < 0 ? '+' : '-'}₹${fmtINR(Math.abs(p.amount || 0))}</td>
                <td>${p.status || '—'}</td>
                <td>${p.remarks || '—'}</td>
              </tr>
            `).join('') : '<tr><td colspan="6" style="text-align:center; color:#94a3b8;">No payments recorded</td></tr>'}
          </tbody>
        </table>
        <div style="text-align:right; margin-top:2mm; font-size:10px; font-weight:700;">
          Paid: ₹${fmtINR(agent.total_paid)} | Pending: ₹${fmtINR(agent.balance)}
        </div>
      </div>
    `).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Commission Statement - Plot ${plot.plot_no}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Inter:wght@400;500;600;700&display=swap');
    @page { size: A4; margin: 10mm; }
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: 'Inter', sans-serif; color: #1e293b; background: #fff; padding: 10mm; }
    .header { text-align: center; border-bottom: 3px double #0f172a; padding-bottom: 5mm; margin-bottom: 6mm; }
    .header h1 { font-family: 'Cinzel', serif; font-size: 20px; color: #0f172a; }
    .header p { font-size: 9px; color: #64748b; font-weight: 600; margin-top: 3px; }
    .plot-info { display: flex; gap: 5mm; margin-bottom: 6mm; }
    .plot-info div { flex:1; border:1px solid #e2e8f0; padding:3mm; border-radius:2mm; }
    .plot-info .label { font-size:8px; text-transform:uppercase; color:#94a3b8; font-weight:700; }
    .plot-info .value { font-size:12px; font-weight:600; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; }
    th { background: #f1f5f9; padding: 2mm; text-align: left; text-transform: uppercase; font-weight: 800; border: 1px solid #cbd5e1; font-size: 8px; }
    td { padding: 2mm; border: 1px solid #e2e8f0; }
    .grand-total { margin-top:6mm; padding:4mm; background:#f8fafc; border:2px solid #0f172a; border-radius:2mm; text-align:center; font-weight:700; }
    @media print { .no-print { display: none !important; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>Commission Statement — Plot ${plot.plot_no}</h1>
    <p>${plot.site_name || ''} | ${plot.buyer_name || 'N/A'}</p>
  </div>
  <div class="plot-info">
    <div><span class="label">Plot Size</span><br/><span class="value">${plot.plot_size || 'N/A'}</span></div>
    <div><span class="label">Plot Rate</span><br/><span class="value">${plot.plot_rate ? '₹' + fmtINR(plot.plot_rate) : 'N/A'}</span></div>
    <div><span class="label">Total Commission</span><br/><span class="value">₹${fmtINR(totals.total_commission)}</span></div>
    <div><span class="label">Total Paid</span><br/><span class="value" style="color:#059669">₹${fmtINR(totals.total_paid)}</span></div>
    <div><span class="label">Pending</span><br/><span class="value" style="color:#dc2626">₹${fmtINR(totals.balance)}</span></div>
  </div>
  ${agentSections}
  <div class="grand-total">
    GRAND TOTAL — Commission: ₹${fmtINR(totals.total_commission)} | Paid: ₹${fmtINR(totals.total_paid)} | Pending: ₹${fmtINR(totals.balance)}
  </div>
  <div class="no-print" style="margin-top:20px; text-align:center;">
    <button onclick="window.print()" style="padding:10px 40px; background:#0f172a; color:#fff; border:none; border-radius:6px; cursor:pointer;">PRINT</button>
  </div>
</body>
</html>`;
    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
  };

  // ── Print Receipt (farmer-style two-copy layout) ──
  const handlePrintReceipt = async (payment, agent) => {
    if (!data) return;
    const { plot } = data;
    const amt = parseFloat(payment.amount) || 0;
    const absAmt = Math.abs(amt);
    const isReceiveEntry = amt < 0;
    const amountColor = isReceiveEntry ? '#059669' : '#dc2626';
    const siteName = (currentSite?.name || plot.site_name || 'ALLOTMENT DIVISION').toUpperCase();
    const siteAddr = [currentSite?.address, currentSite?.city, currentSite?.state].filter(Boolean).join(', ').toUpperCase();
    const fmtINR = (v) => parseFloat(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 });
    const payDate = payment.date ? new Date(payment.date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
    const printedAt = new Date().toLocaleString('en-IN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
    const isCash = (payment.payment_mode || '').toUpperCase() === 'CASH';
    const signerName = user?.full_name || user?.name || '';
    const docTitle = isReceiveEntry ? 'Commission Money Receive Receipt' : 'Commission Payment Receipt';

    let qrDataUrl = null;
    if (payment.verifyUrl) {
      try {
        qrDataUrl = await QRCode.toDataURL(payment.verifyUrl, {
          width: 640, margin: 2, errorCorrectionLevel: 'M',
          color: { dark: '#000000', light: '#ffffff' },
        });
      } catch { qrDataUrl = null; }
    }
    const qrSection = qrDataUrl
      ? `<div class="qr-section"><img src="${qrDataUrl}" alt="Verify QR" /><div class="qr-label">Scan to verify</div></div>`
      : '';

    const receiptBlock = (copyLabel) => `
      <div class="receipt-copy">
        <div class="copy-label">${copyLabel}</div>
        <div class="border-frame"></div>
        <div class="watermark">${siteName}</div>
        <div class="content">
          <div class="header">
            <h1>${siteName}</h1>
            <p>${siteAddr || 'COMMISSION SETTLEMENT DIVISION'}</p>
          </div>
          <div class="doc-type"><h2>${docTitle}</h2></div>
          <div class="meta-info">
            <div class="meta-item"><b>Ref:</b> CMN-${payment.id}</div>
            <div class="meta-item"><b>Date:</b> ${payDate}</div>
          </div>
          <div class="kv-qr-wrap">
            <div class="kv-section">
              <div class="kv-row"><div class="k">${isReceiveEntry ? 'Received From (Agent)' : 'Paid To (Agent)'}</div><div class="c">:</div><div class="v">${(agent?.agent_name || '—').toUpperCase()}</div></div>
              <div class="kv-row"><div class="k">Plot No</div><div class="c">:</div><div class="v">${(plot?.plot_no || '—').toString().toUpperCase()}</div></div>
              <div class="kv-row"><div class="k">Buyer</div><div class="c">:</div><div class="v">${(plot?.buyer_name || '—').toUpperCase()}</div></div>
              <div class="kv-row"><div class="k">Amount</div><div class="c">:</div><div class="v" style="color:${amountColor}">RS ${fmtINR(absAmt)}/-</div></div>
              <div class="kv-row"><div class="k">Payment Mode</div><div class="c">:</div><div class="v">${(payment.payment_mode || '—').toUpperCase()}</div></div>
            </div>
            ${qrSection}
          </div>
          <div class="settlement-title">Commission ${isReceiveEntry ? 'Receipt' : 'Payment'} Details:</div>
          <table class="data-table">
            <tr><th>S.No.</th><td>#${payment.id}</td></tr>
            <tr><th>Date</th><td>${payDate || '—'}</td></tr>
            <tr><th>Entry Type</th><td>${isReceiveEntry ? 'MONEY RECEIVED' : 'PAYMENT OUT'}</td></tr>
            <tr><th>Payment Mode</th><td>${(payment.payment_mode || '—').toUpperCase()}</td></tr>
            ${payment.cheque_no ? `<tr><th>Cheque No</th><td>${payment.cheque_no}</td></tr>` : ''}
            ${payment.bank_name ? `<tr><th>Bank</th><td>${payment.bank_name.toUpperCase()}</td></tr>` : ''}
            ${payment.transaction_id ? `<tr><th>Transaction ID</th><td>${payment.transaction_id}</td></tr>` : ''}
            ${payment.remarks ? `<tr><th>Remarks</th><td>${payment.remarks}</td></tr>` : ''}
            <tr><th>Amount</th><td style="color:${amountColor}">RS ${fmtINR(absAmt)}/-</td></tr>
          </table>
          ${isCash ? '<div class="bank-proviso">STATUTORY PROVISO: Cash received exclusively as a temporary custodian on behalf of our designated banking institution for immediate reconciliation and ledger entry.</div>' : ''}
          <div class="footer">
            <div class="sig-box"><div class="sig-line">${isReceiveEntry ? 'Agent Signature' : 'Receiver Signature'}</div></div>
            <div class="sig-box"><div class="digital-signature">${signerName}</div><div class="sig-line">Authorized Signatory & Seal</div></div>
          </div>
          <div class="print-meta">Printed on: <b>${printedAt}</b></div>
        </div>
      </div>
    `;

    const html = `<!DOCTYPE html>
<html><head>
  <title>COMMISSION RECEIPT - ${payment.id}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Inter:wght@400;500;600;700&family=Dancing+Script:wght@400;500;600;700&display=swap');
    @page { size: A4 portrait; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', -apple-system, sans-serif; color: #1a1a1a; background: #f1f5f9; display: flex; justify-content: center; padding: 10mm 0; }
    .document { background: #fff; width: 210mm; min-height: 297mm; padding: 8mm 15mm; position: relative; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; display: flex; flex-direction: column; overflow: hidden; }
    .receipt-copy { position: relative; flex: 1; display: flex; flex-direction: column; padding: 3mm 5mm; overflow: hidden; }
    .copy-label { position: absolute; top: 2mm; right: 3mm; font-size: 8px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; }
    .scissor-line { position: relative; border: none; border-top: 1.5px dashed #94a3b8; margin: 2mm 0; overflow: visible; }
    .scissor-line::before { content: '✂'; position: absolute; top: -10px; left: -2px; font-size: 16px; color: #94a3b8; line-height: 1; }
    .border-frame { position: absolute; top: 2mm; left: 2mm; right: 2mm; bottom: 2mm; border: 1px solid #cbd5e1; pointer-events: none; }
    .watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-family: 'Cinzel', serif; font-size: 60px; color: rgba(226,232,240,0.25); font-weight: 700; z-index: 1; pointer-events: none; white-space: nowrap; text-transform: uppercase; }
    .content { position: relative; z-index: 10; flex: 1; display: flex; flex-direction: column; }
    .header { text-align: center; margin-bottom: 2mm; border-bottom: 2px double #0f172a; padding: 2mm 3mm 1.5mm; background: #f0fdf4; border-radius: 4px; }
    .header h1 { font-family: 'Cinzel', serif; font-size: 17px; color: #166534; letter-spacing: 2px; margin-bottom: 1px; text-transform: uppercase; }
    .header p { font-size: 9px; color: #475569; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; max-width: 80%; margin: 0 auto; }
    .doc-type { text-align: center; margin-bottom: 2mm; }
    .doc-type h2 { font-family: 'Cinzel', serif; font-size: 11px; color: #64748b; letter-spacing: 4px; text-transform: uppercase; display: inline-block; padding: 1px 15px; border-bottom: 1px solid #cbd5e1; }
    .meta-info { display: flex; justify-content: space-between; margin-bottom: 2mm; font-size: 10px; padding: 0 3mm; }
    .meta-item b { color: #64748b; font-size: 8px; text-transform: uppercase; margin-right: 3px; }
    .kv-qr-wrap { display: flex; align-items: flex-start; gap: 4mm; padding: 0 3mm; margin-bottom: 2mm; }
    .kv-section { flex: 1; min-width: 0; }
    .kv-row { display: grid; grid-template-columns: 44% 4% 52%; gap: 1px; align-items: baseline; margin: 1mm 0; font-size: 10px; }
    .kv-row .k { color: #0f172a; font-weight: 600; } .kv-row .c { text-align: center; color: #475569; font-weight: 700; } .kv-row .v { color: #0f172a; font-weight: 600; text-transform: uppercase; }
    .qr-section { flex-shrink: 0; display: flex; flex-direction: column; align-items: center; background: #fff; padding: 1.5mm; border: 1px solid #0f172a; border-radius: 3px; }
    .qr-section img { display: block; width: 30mm; height: 30mm; image-rendering: pixelated; image-rendering: crisp-edges; }
    .qr-label { font-size: 7px; color: #166534; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 800; margin-top: 1mm; }
    .settlement-title { margin: 1mm 3mm 0.8mm; font-size: 10px; color: #0f172a; font-weight: 700; }
    .data-table { width: 100%; border-collapse: collapse; margin-bottom: 2mm; }
    .data-table th, .data-table td { border: 1px solid #e2e8f0; padding: 0.8mm 3mm; text-align: left; line-height: 1.25; }
    .data-table th { background: #f8fafc; font-size: 8px; text-transform: uppercase; color: #64748b; width: 35%; }
    .data-table td { font-size: 10px; font-weight: 600; color: #0f172a; }
    .bank-proviso { margin-top: 1mm; padding: 1.8mm 2.5mm; background: #f8fafc; border: 1px solid #e2e8f0; font-size: 8px; font-style: italic; color: #64748b; text-align: center; line-height: 1.4; }
    .footer { flex-shrink: 0; margin-top: auto; display: flex; justify-content: space-between; align-items: flex-end; padding: 3mm 5mm 1mm; }
    .sig-box { text-align: center; width: 55mm; min-height: 14mm; display: flex; flex-direction: column; justify-content: flex-end; }
    .sig-line { border-top: 1.5px solid #0f172a; padding-top: 3px; font-size: 8px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; }
    .digital-signature { font-family: 'Dancing Script', 'Brush Script MT', cursive; font-size: 22px; font-weight: 700; color: #1a237e; margin-bottom: 1px; line-height: 1; height: 8mm; display: flex; align-items: flex-end; justify-content: center; }
    .print-meta { flex-shrink: 0; text-align: center; font-size: 7.5px; color: #64748b; margin-top: 1.5mm; padding: 0.8mm 0 0; border-top: 1px dashed #e2e8f0; letter-spacing: 0.3px; }
    .print-meta b { color: #0f172a; font-weight: 600; }
    @media print { body { background: white; padding: 0; } .document { box-shadow: none !important; border: none !important; width: 210mm; height: 297mm; margin: 0 !important; padding: 8mm 15mm !important; } .receipt-copy { padding: 3mm 5mm !important; } .header { padding: 2mm 3mm !important; margin-bottom: 1.5mm !important; } .header h1 { font-size: 16px !important; } .doc-type { margin-bottom: 1.5mm !important; } .meta-info { margin-bottom: 1.5mm !important; } .kv-qr-wrap { margin-bottom: 1mm !important; } .qr-section img { width: 24mm !important; height: 24mm !important; } .settlement-title { margin: 1mm 3mm 0.5mm !important; } .data-table { margin-bottom: 1.5mm !important; } .data-table th, .data-table td { padding: 0.8mm 3mm !important; } .bank-proviso { margin-top: 1mm !important; padding: 1.5mm 2mm !important; font-size: 7px !important; line-height: 1.35 !important; } .footer { padding: 1.5mm 5mm 0 !important; } .sig-box { min-height: 11mm !important; } .digital-signature { font-size: 18px !important; height: 6mm !important; } .print-meta { margin-top: 0.5mm !important; } .no-print { display: none !important; } }
  </style>
</head>
<body>
  <div class="document">
    ${receiptBlock('Office Copy')}
    <hr class="scissor-line" />
    ${receiptBlock('Agent Copy')}
  </div>
  <div class="no-print" style="position:fixed; bottom: 30px; left:0; right:0; text-align:center; z-index:1000;">
    <button onclick="(async () => { try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch(e){} window.print(); })()" style="padding:12px 50px; font-size:15px; font-weight:700; background:#0f172a; color:#fff; border:none; border-radius:10px; cursor:pointer; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.2);">EXECUTE PRINT (A4)</button>
    <button onclick="window.close()" style="padding:12px 50px; font-size:15px; font-weight:700; background:#fff; color:#475569; border:1px solid #e2e8f0; border-radius:10px; cursor:pointer; margin-left:15px;">TERMINATE</button>
  </div>
</body></html>`;

    const w = window.open('', '_blank', 'width=1000,height=750');
    w.document.write(html);
    w.document.close();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
      </div>
    );
  }

  if (!data) return null;

  const { plot, agents, totals, is_resale, timeline } = data;
  const completionPercentage = totals.total_commission > 0
    ? Math.max(0, Math.round((totals.total_paid / totals.total_commission) * 100))
    : 0;
  const isOverpaid = totals.total_paid > totals.total_commission;

  // Cross-cycle grand totals — commission is fixed per plot, paid only from current booking
  const fixedCommission = parseFloat(plot.plot_commission) || totals.total_commission;
  // Only count paid from the CURRENT booking (current agents' actual payments)
  const grandTotalPaid = totals.total_paid;
  const grandTotalCommission = fixedCommission;
  const grandRemaining = grandTotalCommission - grandTotalPaid;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-50 via-emerald-50/40 to-cyan-100/40 p-3 sm:p-5">
      <div className="pointer-events-none absolute -top-16 -right-16 h-52 w-52 rounded-full bg-emerald-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-cyan-200/40 blur-3xl" />

      <div className="relative max-w-6xl mx-auto space-y-5 pb-6">
        {/* ── Header ── */}
        <Card className="border-emerald-200/60 bg-white/85 shadow-sm backdrop-blur">
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex items-start gap-3 min-w-0">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => navigate('/plot-commission')}
                  className="shrink-0 h-9 w-9 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Plot {plot.plot_no} Commission Ledger</h1>
                    {is_resale && (
                      <Badge className="text-[10px] px-2 py-0.5 font-semibold bg-amber-50 text-amber-700 border-amber-200" variant="outline">
                        <RefreshCw className="w-3 h-3 mr-1" /> RESALE
                      </Badge>
                    )}
                    <Badge
                      className={`text-[10px] uppercase font-semibold ${
                        completionPercentage >= 100 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        completionPercentage > 0 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        'bg-slate-50 text-slate-600 border-slate-200'
                      }`}
                      variant="outline"
                    >
                      {completionPercentage >= 100 ? 'SETTLED' : completionPercentage > 0 ? 'IN PROGRESS' : 'PENDING'}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-600 mt-1 truncate">
                    {plot.buyer_name || 'No buyer selected'}
                    {plot.site_name ? ` • ${plot.site_name}` : ''}
                    {plot.plot_size ? ` • ${plot.plot_size}` : ''}
                    {plot.plot_rate ? ` • Rate: ₹${formatCurrency(plot.plot_rate)}` : ''}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={printStatement}
                  className="text-xs h-9 border-slate-200 text-slate-700 hover:bg-slate-50"
                >
                  <Printer className="w-3.5 h-3.5 mr-1.5" /> Print Statement
                </Button>
                {canWrite && (
                  <Button
                    size="sm"
                    onClick={() => setAssignDialogOpen(true)}
                    className="h-9 shadow-sm text-xs bg-emerald-600 hover:bg-emerald-700"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Assign Agent
                  </Button>
                )}
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              Manage payout and money-back entries from the same ledger with full approval workflow.
            </div>
          </CardContent>
        </Card>

        {/* ── Unified Summary Bar ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <Card className="border-slate-200/80 bg-white/90 backdrop-blur shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Total Commission</p>
                <Landmark className="w-4 h-4 text-slate-400" />
              </div>
              <p className="text-2xl font-bold text-slate-900 mt-2 tabular-nums">₹{formatCurrency(totals.total_commission)}</p>
              <p className="text-[11px] text-slate-500 mt-1">For this booking cycle</p>
            </CardContent>
          </Card>

          <Card className="border-emerald-200 bg-emerald-50/70 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-wider text-emerald-700 font-semibold">Net Paid Out</p>
                <ArrowUpRight className="w-4 h-4 text-emerald-600" />
              </div>
              <p className={`text-2xl font-bold mt-2 tabular-nums ${isOverpaid ? 'text-red-600' : 'text-emerald-700'}`}>₹{formatCurrency(totals.total_paid)}</p>
              <p className={`text-[11px] font-medium mt-1 ${isOverpaid ? 'text-red-500' : 'text-emerald-700/80'}`}>{completionPercentage}% completion</p>
            </CardContent>
          </Card>

          <Card className="border-amber-200 bg-amber-50/70 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-wider text-amber-700 font-semibold">{isOverpaid ? 'Excess Paid' : 'Pending Amount'}</p>
                <Wallet className="w-4 h-4 text-amber-600" />
              </div>
              <p className={`text-2xl font-bold mt-2 tabular-nums ${isOverpaid ? 'text-red-600' : totals.balance <= 0 ? 'text-emerald-600' : 'text-amber-700'}`}>
                ₹{formatCurrency(Math.abs(totals.balance))}
              </p>
              <p className="text-[11px] text-amber-700/80 mt-1">After approved + pending entries</p>
            </CardContent>
          </Card>

          <Card className="border-cyan-200 bg-cyan-50/70 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-wider text-cyan-700 font-semibold">Active Agents</p>
                <User className="w-4 h-4 text-cyan-600" />
              </div>
              <p className="text-2xl font-bold text-cyan-800 mt-2">{agents.length}</p>
              <p className="text-[11px] text-cyan-700/80 mt-1">{is_resale ? 'Includes resale history' : 'Assigned in current booking'}</p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-slate-200 bg-white/90 overflow-hidden shadow-sm">
          <CardContent className="p-0">
            <div className="h-2 bg-slate-100">
              <div
                className={`h-full transition-all duration-500 ${isOverpaid ? 'bg-red-500' : completionPercentage >= 100 ? 'bg-emerald-500' : 'bg-cyan-500'}`}
                style={{ width: `${Math.min(completionPercentage, 100)}%` }}
              />
            </div>
            {timeline && timeline.length > 1 ? (
              <div className="px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-[11px]">
                <span className="text-slate-500 font-semibold uppercase tracking-wider text-[9px]">Fixed Plot Commission</span>
                <span className="text-slate-600">Commission: <strong className="text-slate-800">₹{formatCurrency(grandTotalCommission)}</strong></span>
                <span className="text-slate-600">Net Paid: <strong className="text-emerald-700">₹{formatCurrency(grandTotalPaid)}</strong></span>
                <span className="text-slate-600">Remaining: <strong className={grandRemaining > 0 ? 'text-amber-700' : 'text-emerald-700'}>₹{formatCurrency(Math.abs(grandRemaining))}</strong></span>
                <span className="text-[9px] text-slate-400 ml-auto">{timeline.length} booking cycles</span>
              </div>
            ) : (
              <div className="px-4 py-3 flex items-center gap-2 text-[11px] text-slate-600">
                <Landmark className="w-3.5 h-3.5 text-slate-400" />
                Progress reflects all entries in this booking, including money-back adjustments.
              </div>
            )}
          </CardContent>
        </Card>

      {/* ── Plot History (Accordion) ── */}
      {timeline && timeline.length > 1 && (
        <Card className="shadow-none border-slate-200 overflow-hidden">
          <div className="px-4 pt-3.5 pb-2 flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-indigo-50 flex items-center justify-center">
              <Clock className="w-3 h-3 text-indigo-600" />
            </div>
            <span className="text-sm font-semibold text-slate-700">Booking History</span>
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-slate-500 border-slate-200">
              {timeline.length} bookings
            </Badge>
          </div>
          <CardContent className="pt-0 pb-2">
            <div className="space-y-1.5">
              {timeline.map((entry, idx) => {
                const isOpen = expandedHistory[entry.plot_id];
                return (
                  <div key={entry.plot_id} className={`rounded-lg border transition-all ${
                    entry.is_current ? 'border-blue-200 bg-blue-50/30' : 'border-slate-100'
                  }`}>
                    {/* Accordion Header */}
                    <div
                      className="flex items-center gap-3 p-3 cursor-pointer hover:bg-slate-50/50 transition-colors"
                      onClick={() => setExpandedHistory(prev => ({ ...prev, [entry.plot_id]: !prev[entry.plot_id] }))}
                    >
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        entry.is_current ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {timeline.length - idx}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-semibold text-slate-400 uppercase">Buyer:</span>
                          <span className="text-xs font-semibold text-slate-800">{entry.buyer_name || '—'}</span>
                          {entry.is_current && (
                            <Badge className="text-[8px] px-1 py-0 bg-blue-100 text-blue-700 border-blue-200" variant="outline">CURRENT</Badge>
                          )}
                          <Badge
                            className={`text-[9px] uppercase font-semibold ${
                              entry.latest_status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                              entry.latest_status === 'Partial' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                              'bg-slate-50 text-slate-600 border-slate-200'
                            }`}
                            variant="outline"
                          >
                            {entry.latest_status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                          <span className="text-[10px] text-slate-400">Agent:</span>
                          <span className="font-medium text-slate-600 truncate">{entry.agent_names}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0 mr-1">
                        <p className="text-xs font-bold text-slate-800 tabular-nums">₹{formatCurrency(entry.total_commission)}</p>
                        {entry.payment_count > 0 ? (
                          <p className="text-[10px] text-emerald-600 font-medium tabular-nums">₹{formatCurrency(entry.total_paid)} paid · {entry.payment_count} txn{entry.payment_count !== 1 ? 's' : ''}</p>
                        ) : (
                          <p className="text-[10px] text-slate-400 font-medium">No transactions</p>
                        )}
                      </div>
                      <div className="w-5 flex justify-center shrink-0">
                        {isOpen ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                      </div>
                    </div>
                    {/* Accordion Body */}
                    {isOpen && (
                      <div className="px-3 pb-3 pt-0 border-t border-slate-100">
                        <div className="grid grid-cols-2 gap-3 mt-3 text-[11px]">
                          <div>
                            <p className="text-[9px] text-slate-400 uppercase font-semibold">Buyer</p>
                            <p className="text-slate-700 font-medium mt-0.5">{entry.buyer_name || '—'}</p>
                          </div>
                          <div>
                            <p className="text-[9px] text-slate-400 uppercase font-semibold">Total Commission</p>
                            <p className="text-slate-800 font-bold mt-0.5 tabular-nums">₹{formatCurrency(entry.total_commission)}</p>
                          </div>
                        </div>
                        {/* Per-agent breakdown */}
                        {entry.agents_detail && entry.agents_detail.length > 0 && (
                          <div className="mt-3 space-y-1.5">
                            <p className="text-[9px] text-slate-400 uppercase font-semibold mb-1">Agent Breakdown</p>
                            {entry.agents_detail.map(a => {
                              const aPct = a.total_commission > 0 ? Math.min(Math.round((a.total_paid / a.total_commission) * 100), 100) : 0;
                              return (
                                <div key={a.commission_id} className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 ${
                                  a.status === 'Completed' ? 'bg-emerald-50 border border-emerald-100' :
                                  a.total_paid > 0 ? 'bg-amber-50 border border-amber-100' :
                                  'bg-slate-50 border border-slate-100'
                                }`}>
                                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                                    a.status === 'Completed' ? 'bg-emerald-500 text-white' :
                                    a.total_paid > 0 ? 'bg-amber-500 text-white' :
                                    'bg-slate-200 text-slate-500'
                                  }`}>
                                    {a.status === 'Completed'
                                      ? <CheckCircle2 className="w-3.5 h-3.5" />
                                      : <Circle className="w-3.5 h-3.5" />}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="text-[11px] font-semibold text-slate-700">{a.agent_name}</span>
                                      <Badge className={`text-[8px] px-1 py-0 ${
                                        a.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                        a.total_paid > 0 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                        'bg-slate-50 text-slate-500 border-slate-200'
                                      }`} variant="outline">{a.status}</Badge>
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                      <div className="h-1 w-16 rounded-full bg-slate-200 overflow-hidden">
                                        <div className={`h-full rounded-full ${a.status === 'Completed' ? 'bg-emerald-500' : a.total_paid > 0 ? 'bg-amber-400' : ''}`} style={{ width: `${aPct}%` }} />
                                      </div>
                                      <span className="text-[9px] text-slate-400 tabular-nums">{aPct}%</span>
                                    </div>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <p className="text-[10px] font-bold tabular-nums text-slate-700">₹{formatCurrency(a.total_commission)}</p>
                                    {a.total_paid > 0 ? (
                                      <p className="text-[9px] text-emerald-600 tabular-nums">{a.payment_count} txn{a.payment_count !== 1 ? 's' : ''} · ₹{formatCurrency(a.total_paid)}</p>
                                    ) : (
                                      <p className="text-[9px] text-slate-400 italic">No payment</p>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        <div className="flex items-center gap-3 mt-3">
                          <span className="text-[10px] text-slate-400">Created: {formatDate(entry.first_created)}</span>
                          {entry.last_created !== entry.first_created && (
                            <span className="text-[10px] text-slate-400">Last updated: {formatDate(entry.last_created)}</span>
                          )}
                          {!entry.is_current && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="ml-auto h-6 text-[10px] px-2 border-slate-200 text-slate-600"
                              onClick={(e) => { e.stopPropagation(); navigate(`/plot-commission/plot/${entry.plot_id}?site_id=${siteId}`); }}
                            >
                              View this booking
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Agent Sections (vertical timeline) ── */}
      <div className="space-y-3">
        <div className="rounded-xl border border-slate-200 bg-white/85 backdrop-blur px-3 py-2.5 flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-cyan-100 text-cyan-700 flex items-center justify-center">
            <User className="w-4 h-4" />
          </div>
          <h2 className="text-sm font-semibold text-slate-800">Commission Agents</h2>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-slate-600 border-slate-300">{agents.length}</Badge>
          <span className="ml-auto text-[11px] text-slate-500">Use Pay for payout and Get Money for recovery</span>
        </div>

        {/* Vertical parcel-shipping timeline */}
        <div className="relative pl-0">
          {agents.map((agent, index) => {
            const isLast = index === agents.length - 1;
            const isCompleted = agent.status === 'Completed';
            const isPartial = agent.status === 'Partial';
            const isExpanded = expandedAgents[agent.commission_id];
            const pct = agent.total_commission > 0 ? Math.min(Math.round((agent.total_paid / parseFloat(agent.total_commission)) * 100), 100) : 0;

            return (
              <div key={agent.commission_id} className="relative flex gap-3">
                {/* Timeline spine + node */}
                <div className="flex flex-col items-center shrink-0 pt-2">
                  <div className={`relative z-10 w-9 h-9 rounded-full flex items-center justify-center border-2 shadow-sm ${
                    isCompleted ? 'bg-emerald-500 border-emerald-400 text-white' :
                    isPartial   ? 'bg-amber-500 border-amber-400 text-white' :
                    'bg-white border-slate-300 text-slate-400'
                  }`}>
                    {isCompleted ? <CheckCircle2 className="w-4 h-4" /> :
                     isPartial   ? <IndianRupee className="w-4 h-4" /> :
                     <Circle className="w-4 h-4" />}
                  </div>
                  {!isLast && (
                    <div className="w-0.5 flex-1 mt-1 min-h-4 bg-slate-200" />
                  )}
                </div>

                {/* Agent card */}
                <div className={`flex-1 ${isLast ? 'pb-1' : 'pb-4'}`}>
                  <div className={`rounded-2xl border overflow-hidden shadow-sm transition-all ${
                    isCompleted ? 'border-emerald-200 bg-white/95' :
                    isPartial   ? 'border-amber-200 bg-white/95' :
                    'border-slate-200 bg-white/95'
                  }`}>
                    {/* Card Header */}
                    <div
                      className="flex items-center gap-3 p-3.5 cursor-pointer hover:bg-black/[0.02] transition-colors"
                      onClick={() => toggleAgent(agent.commission_id)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-semibold text-slate-900 truncate">{agent.agent_name}</span>
                          {agent.agent_phone && (
                            <span className="text-[10px] text-slate-400 hidden sm:inline">{agent.agent_phone}</span>
                          )}
                          <Badge
                            className={`text-[9px] uppercase font-semibold ${
                              isCompleted ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                              isPartial   ? 'bg-amber-50 text-amber-700 border-amber-200' :
                              'bg-slate-50 text-slate-600 border-slate-200'
                            }`}
                            variant="outline"
                          >
                            {agent.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                          <span className="text-[11px] text-slate-500 tabular-nums">₹{formatCurrency(agent.total_commission)}</span>
                          <div className="flex items-center gap-1.5 max-w-[120px] flex-1">
                            <div className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  isCompleted ? 'bg-emerald-500' : isPartial ? 'bg-amber-400' : 'bg-slate-200'
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-slate-400 tabular-nums shrink-0">{pct}%</span>
                          </div>
                          {agent.total_paid > 0 ? (
                            <span className="text-[11px] text-emerald-600 font-medium tabular-nums">₹{formatCurrency(agent.total_paid)} paid</span>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">No payment yet</span>
                          )}
                          {agent.balance > 0 && (
                            <span className="text-[11px] text-amber-600 tabular-nums">₹{formatCurrency(agent.balance)} due</span>
                          )}
                        </div>
                      </div>
                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        {canWrite && !isCompleted && (
                          <Button
                            size="sm"
                            className="h-7 text-xs px-2.5 shadow-sm bg-emerald-600 hover:bg-emerald-700"
                            onClick={(e) => { e.stopPropagation(); openPaymentDialog(agent.commission_id); }}
                          >
                            <ArrowUpRight className="w-3 h-3 mr-1" /> Pay
                          </Button>
                        )}
                        {canWrite && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs px-2.5 border-cyan-200 text-cyan-700 hover:bg-cyan-50"
                            disabled={(parseFloat(agent.total_paid_all) || 0) <= 0}
                            onClick={(e) => { e.stopPropagation(); openPaymentDialog(agent.commission_id, 'get'); }}
                          >
                            <ArrowDownLeft className="w-3 h-3 mr-1" /> Get Money
                          </Button>
                        )}
                        {canUpdate && (
                          <Button
                            size="sm" variant="ghost"
                            className="h-7 w-7 p-0 text-slate-400 hover:text-blue-600"
                            onClick={(e) => { e.stopPropagation(); setEditCommission(agent); setEditCommissionForm({ total_commission: agent.total_commission, remarks: agent.remarks || '' }); }}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            size="sm" variant="ghost"
                            className="h-7 w-7 p-0 text-slate-400 hover:text-red-600"
                            onClick={(e) => { e.stopPropagation(); setDeleteCommissionId(agent.commission_id); }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        <div className="w-5 flex justify-center">
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                        </div>
                      </div>
                    </div>

                    {/* Payment Ledger (expandable) */}
                    {isExpanded && (
                      <div className="border-t border-slate-100">
                        {agent.remarks && (
                          <div className="px-4 py-2 bg-slate-50/80 text-xs text-slate-500 border-b border-slate-100 italic">
                            {agent.remarks}
                          </div>
                        )}
                        {agent.payments.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-10 text-center">
                            <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center mb-2">
                              <IndianRupee className="h-4 w-4 text-slate-300" />
                            </div>
                            <p className="text-sm font-medium text-slate-400">No payments recorded</p>
                            {canWrite && (
                              <div className="mt-3 flex items-center gap-2">
                                {!isCompleted && (
                                  <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={() => openPaymentDialog(agent.commission_id)}>
                                    <ArrowUpRight className="w-3 h-3 mr-1" /> Record Payment
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs border-cyan-200 text-cyan-700 hover:bg-cyan-50"
                                  disabled={(parseFloat(agent.total_paid_all) || 0) <= 0}
                                  onClick={() => openPaymentDialog(agent.commission_id, 'get')}
                                >
                                  <ArrowDownLeft className="w-3 h-3 mr-1" /> Get Money
                                </Button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <>
                            {/* Desktop Table */}
                            <div className="hidden md:block px-3 pb-3 pt-2">
                              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-3 py-2">
                                  <p className="text-xs font-semibold text-slate-700">Transaction Ledger</p>
                                  <p className="text-[11px] text-slate-500">{agent.payments.length} entries</p>
                                </div>
                                <div className="overflow-x-auto">
                                  <Table className="text-xs">
                                    <TableHeader className="bg-slate-50/40">
                                      <TableRow className="hover:bg-slate-50/40">
                                        <TableHead className="h-9 text-[11px] uppercase tracking-wider text-slate-500 w-24">Doc</TableHead>
                                        <TableHead className="h-9 text-[11px] uppercase tracking-wider text-slate-500">Date</TableHead>
                                        <TableHead className="h-9 text-[11px] uppercase tracking-wider text-slate-500">Mode</TableHead>
                                        <TableHead className="h-9 text-[11px] uppercase tracking-wider text-slate-500">Cheque</TableHead>
                                        <TableHead className="h-9 text-[11px] uppercase tracking-wider text-slate-500">Voucher</TableHead>
                                        <TableHead className="h-9 text-[11px] uppercase tracking-wider text-slate-500 text-right">Amount</TableHead>
                                        <TableHead className="h-9 text-[11px] uppercase tracking-wider text-slate-500">Assigned</TableHead>
                                        <TableHead className="h-9 text-[11px] uppercase tracking-wider text-slate-500">Created By</TableHead>
                                        <TableHead className="h-9 text-[11px] uppercase tracking-wider text-slate-500 text-center">Status</TableHead>
                                        {(canUpdate || canDelete) && <TableHead className="h-9 text-[11px] uppercase tracking-wider text-slate-500 text-center">Actions</TableHead>}
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {agent.payments.map((p) => {
                                        const receiveEntry = isReceiveAmount(p.amount);
                                        return (
                                          <TableRow key={p.id} className={`${receiveEntry ? 'bg-cyan-50/30' : ''} hover:bg-slate-50/80`}>
                                            <TableCell className="py-2.5">
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handlePrintReceipt(p, agent)}
                                                className="h-7 px-2 text-[11px] border-slate-200 text-slate-600 hover:text-emerald-700"
                                              >
                                                <Printer className="mr-1 h-3 w-3" /> Receipt
                                              </Button>
                                            </TableCell>
                                            <TableCell className="py-2.5">
                                              <span className="text-xs font-semibold text-slate-700">{formatDate(p.date)}</span>
                                            </TableCell>
                                            <TableCell className="py-2.5">
                                              <div className="flex flex-col gap-1.5">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                  <Badge variant={p.payment_mode === 'CASH' ? 'secondary' : 'outline'} className="text-[10px]">{p.payment_mode}</Badge>
                                                  <Badge
                                                    variant="outline"
                                                    className={`text-[10px] ${receiveEntry ? 'border-cyan-200 text-cyan-700 bg-cyan-50' : 'border-emerald-200 text-emerald-700 bg-emerald-50'}`}
                                                  >
                                                    {receiveEntry ? 'GET' : 'PAY'}
                                                  </Badge>
                                                </div>
                                                {p.cheque_status && <ChequeStatusControl chequeStatus={p.cheque_status} source="plot_commission_payment" entryId={p.id} isAdmin={isAdmin} onStatusChange={fetchData} />}
                                              </div>
                                            </TableCell>
                                            <TableCell className="py-2.5">
                                              <span className="text-[11px] font-mono text-slate-500">{p.cheque_no || '—'}</span>
                                            </TableCell>
                                            <TableCell className="py-2.5"><VoucherThumbnail url={p.voucher_url} /></TableCell>
                                            <TableCell className="text-right py-2.5">
                                              <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold tabular-nums ${receiveEntry ? 'bg-cyan-50 text-cyan-700' : 'bg-slate-100 text-slate-800'}`}>
                                                {receiveEntry ? <ArrowDownLeft className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                                                {formatSignedAmount(p.amount)}
                                              </span>
                                            </TableCell>
                                            <TableCell className="py-2.5">
                                              {p.assigned_admin_id ? (
                                                <span className="inline-flex items-center rounded-md border border-purple-200 bg-purple-50 px-2 py-1 text-[10px] font-medium text-purple-700">
                                                  {getAssignedAdminLabel(p) || '—'}
                                                </span>
                                              ) : (
                                                <span className="text-[10px] text-slate-400 italic">—</span>
                                              )}
                                            </TableCell>
                                            <TableCell className="py-2.5"><UserAvatar name={p.created_by_name} label="Created by" size="xs" /></TableCell>
                                            <TableCell className="text-center py-2.5">
                                              <Badge
                                                variant="outline"
                                                className={`uppercase text-[9px] ${
                                                  p.status === 'approved'
                                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                                    : p.status === 'rejected'
                                                    ? 'border-red-200 bg-red-50 text-red-700'
                                                    : 'border-amber-200 bg-amber-50 text-amber-700'
                                                }`}
                                              >
                                                {p.status}
                                              </Badge>
                                            </TableCell>
                                            {(canUpdate || canDelete) && (
                                              <TableCell className="text-center py-2.5">
                                                <div className="flex items-center justify-center gap-1">
                                                  {canUpdate && (
                                                    <Button
                                                      variant="outline"
                                                      size="sm"
                                                      className="h-7 w-7 p-0 border-slate-200 text-blue-600 hover:bg-blue-50"
                                                      onClick={() => handleEditPayment(p)}
                                                    >
                                                      <Edit2 className="h-3 w-3" />
                                                    </Button>
                                                  )}
                                                  {canDelete && (
                                                    <Button
                                                      variant="outline"
                                                      size="sm"
                                                      className="h-7 w-7 p-0 border-slate-200 text-red-600 hover:bg-red-50"
                                                      onClick={() => setDeletePaymentId(p.id)}
                                                    >
                                                      <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                  )}
                                                </div>
                                              </TableCell>
                                            )}
                                          </TableRow>
                                        );
                                      })}
                                    </TableBody>
                                  </Table>
                                </div>
                              </div>
                            </div>
                            {/* Mobile Cards */}
                            <div className="md:hidden p-3 space-y-2">
                              {agent.payments.map((p) => {
                                const receiveEntry = isReceiveAmount(p.amount);
                                return (
                                  <div key={p.id} className={`rounded-lg border p-3 space-y-2.5 ${receiveEntry ? 'border-cyan-200 bg-cyan-50/30' : 'border-slate-200 bg-white'}`}>
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="space-y-1">
                                        <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-bold tabular-nums ${receiveEntry ? 'bg-cyan-100 text-cyan-700' : 'bg-slate-100 text-slate-800'}`}>
                                          {receiveEntry ? <ArrowDownLeft className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
                                          {formatSignedAmount(p.amount)}
                                        </span>
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <Badge variant={p.payment_mode === 'CASH' ? 'secondary' : 'outline'} className="text-[10px]">{p.payment_mode}</Badge>
                                          <Badge
                                            variant="outline"
                                            className={`text-[10px] ${receiveEntry ? 'border-cyan-200 text-cyan-700 bg-cyan-50' : 'border-emerald-200 text-emerald-700 bg-emerald-50'}`}
                                          >
                                            {receiveEntry ? 'GET' : 'PAY'}
                                          </Badge>
                                        </div>
                                      </div>
                                      <Badge
                                        variant="outline"
                                        className={`uppercase text-[9px] ${
                                          p.status === 'approved'
                                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                            : p.status === 'rejected'
                                            ? 'border-red-200 bg-red-50 text-red-700'
                                            : 'border-amber-200 bg-amber-50 text-amber-700'
                                        }`}
                                      >
                                        {p.status}
                                      </Badge>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                                      <span className="font-medium text-slate-600">{formatDate(p.date)}</span>
                                      {p.cheque_no && <span className="font-mono">Chq: {p.cheque_no}</span>}
                                      {p.created_by_name && <span>by {p.created_by_name}</span>}
                                      {p.assigned_admin_id && <span className="text-purple-700">to {getAssignedAdminLabel(p) || '—'}</span>}
                                    </div>

                                    {p.cheque_status && <ChequeStatusControl chequeStatus={p.cheque_status} source="plot_commission_payment" entryId={p.id} isAdmin={isAdmin} onStatusChange={fetchData} />}

                                    <div className="flex items-center gap-2">
                                      <VoucherThumbnail url={p.voucher_url} />
                                      <div className="flex-1" />
                                      <Button variant="outline" size="sm" onClick={() => handlePrintReceipt(p, agent)} className="h-7 px-2 text-[11px] border-slate-200 text-slate-600">
                                        <Printer className="mr-1 h-3 w-3" /> Receipt
                                      </Button>
                                      {canUpdate && (
                                        <Button variant="outline" size="sm" className="h-7 w-7 p-0 border-slate-200 text-blue-600" onClick={() => handleEditPayment(p)}>
                                          <Edit2 className="h-3 w-3" />
                                        </Button>
                                      )}
                                      {canDelete && (
                                        <Button variant="outline" size="sm" className="h-7 w-7 p-0 border-slate-200 text-red-600" onClick={() => setDeletePaymentId(p.id)}>
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Record Payment Dialog ── */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{paymentAction === 'get' ? 'Get Money From Agent' : 'Record Payment'}</DialogTitle>
            <DialogDescription>
              {paymentAction === 'get'
                ? `Log money received back for Plot ${plot.plot_no}. This will reduce net paid amount.`
                : `Log a new payout installment for Plot ${plot.plot_no}.`}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePaymentSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-2 rounded-lg border p-1 bg-slate-50">
              <Button
                type="button"
                variant={paymentAction === 'pay' ? 'default' : 'ghost'}
                className={paymentAction === 'pay' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                onClick={() => setPaymentAction('pay')}
                disabled={submitLoading}
              >
                <ArrowUpRight className="w-4 h-4 mr-1" /> Pay Out
              </Button>
              <Button
                type="button"
                variant={paymentAction === 'get' ? 'default' : 'ghost'}
                className={paymentAction === 'get' ? 'bg-cyan-600 hover:bg-cyan-700' : ''}
                onClick={() => setPaymentAction('get')}
                disabled={submitLoading}
              >
                <ArrowDownLeft className="w-4 h-4 mr-1" /> Get Money
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={formData.date} onChange={(e) => setFormData(v => ({ ...v, date: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>
                  {paymentAction === 'get'
                    ? `Amount (Max recoverable: ₹${formatCurrency(getAgentPaidAll(paymentCommissionId))})`
                    : `Amount (Max due: ₹${formatCurrency(getAgentBalance(paymentCommissionId))})`}
                </Label>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="number"
                    step="0.01"
                    placeholder={paymentAction === 'get' ? 'Enter received amount' : 'Enter payout amount'}
                    value={formData.amount}
                    onChange={(e) => setFormData(v => ({ ...v, amount: e.target.value }))}
                    className="pl-9"
                    disabled={submitLoading}
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Payment Mode</Label>
              <div className="grid grid-cols-3 gap-2">
                <Button type="button" variant={formData.payment_mode === 'CASH' ? 'default' : 'outline'} onClick={() => setFormData(v => ({ ...v, payment_mode: 'CASH', bank_name: '', transaction_id: '', cheque_no: '' }))} disabled={submitLoading}>Cash</Button>
                <Button type="button" variant={formData.payment_mode === 'BANK' ? 'default' : 'outline'} onClick={() => setFormData(v => ({ ...v, payment_mode: 'BANK', cheque_no: '' }))} disabled={submitLoading}>Bank Transfer</Button>
                <Button type="button" variant={formData.payment_mode === 'CHEQUE' ? 'default' : 'outline'} onClick={() => setFormData(v => ({ ...v, payment_mode: 'CHEQUE', bank_name: '', transaction_id: '' }))} disabled={submitLoading}>Cheque</Button>
              </div>
            </div>
            {formData.payment_mode === 'CHEQUE' && (
              <div className="rounded-md border p-4 space-y-2">
                <Label className="text-xs">Cheque Number</Label>
                <Input placeholder="Enter cheque number" value={formData.cheque_no} onChange={(e) => setFormData(v => ({ ...v, cheque_no: e.target.value }))} disabled={submitLoading} />
              </div>
            )}
            {formData.payment_mode === 'BANK' && (
              <div className="grid grid-cols-2 gap-4 rounded-md border p-4">
                <div className="space-y-2">
                  <Label className="text-xs">Bank Name</Label>
                  <Input placeholder="e.g. ICICI" value={formData.bank_name} onChange={(e) => setFormData(v => ({ ...v, bank_name: e.target.value }))} disabled={submitLoading} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Transaction ID</Label>
                  <Input placeholder="TRN-00000" value={formData.transaction_id} onChange={(e) => setFormData(v => ({ ...v, transaction_id: e.target.value }))} disabled={submitLoading} />
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>Transaction Proof (Image)</Label>
              <div className="rounded-md border p-2">
                <VoucherUpload value={formData.voucher_url} onChange={(url) => setFormData(v => ({ ...v, voucher_url: url }))} disabled={submitLoading} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Remarks</Label>
              <Textarea placeholder="Optional context..." value={formData.remarks} onChange={(e) => setFormData(v => ({ ...v, remarks: e.target.value }))} className="min-h-[80px]" disabled={submitLoading} />
            </div>
            {approvers.length > 0 && (
              <div className="space-y-2">
                <Label>Send To Admin For Approval</Label>
                <Select value={formData.assigned_admin_id?.toString() || '_none'} onValueChange={(val) => setFormData(v => ({ ...v, assigned_admin_id: val === '_none' ? null : parseInt(val) }))}>
                  <SelectTrigger><SelectValue placeholder="Select approver" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">- Auto-assign or no preference -</SelectItem>
                    {approvers.map((app) => (
                      <SelectItem key={app.id} value={String(app.id)}>{app.full_name || app.name || app.email || `Admin #${app.id}`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setPaymentDialogOpen(false)} disabled={submitLoading}>Cancel</Button>
              <Button type="submit" disabled={submitLoading || !formData.amount} className={paymentAction === 'get' ? 'bg-cyan-600 hover:bg-cyan-700' : ''}>
                {submitLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {paymentAction === 'get' ? 'Save Money Received' : 'Save Payment'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Overpayment Confirmation ── */}
      <Dialog open={overpayConfirmOpen} onOpenChange={setOverpayConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-700 flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-red-100">
                <IndianRupee className="h-4 w-4 text-red-600" />
              </span>
              {paymentAction === 'get' ? 'High Recovery Warning' : 'Overpayment Warning'}
            </DialogTitle>
            <DialogDescription className="pt-2 text-sm text-slate-600">
              {paymentAction === 'get'
                ? `This amount exceeds total recorded payouts (₹${formatCurrency(getAgentPaidAll(paymentCommissionId))}). Confirm only if this adjustment is intentional.`
                : `This amount exceeds the remaining due (₹${formatCurrency(getAgentBalance(paymentCommissionId))}). Confirm only if this payout is intentional.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setOverpayConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => { setOverpayConfirmOpen(false); handlePaymentSubmit(new Event('submit')); }}>
              {paymentAction === 'get' ? 'Confirm High Recovery' : 'Confirm Overpayment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Payment Dialog ── */}
      <Dialog open={!!editingPayment} onOpenChange={(open) => !open && setEditingPayment(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Entry</DialogTitle>
            <DialogDescription>Update payout or money-received details.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditPaymentSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-2 rounded-lg border p-1 bg-slate-50">
              <Button
                type="button"
                variant={!editPaymentForm.is_receive_entry ? 'default' : 'ghost'}
                className={!editPaymentForm.is_receive_entry ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                onClick={() => setEditPaymentForm(v => ({ ...v, is_receive_entry: false }))}
                disabled={editPaymentLoading}
              >
                <ArrowUpRight className="w-4 h-4 mr-1" /> Pay Out
              </Button>
              <Button
                type="button"
                variant={editPaymentForm.is_receive_entry ? 'default' : 'ghost'}
                className={editPaymentForm.is_receive_entry ? 'bg-cyan-600 hover:bg-cyan-700' : ''}
                onClick={() => setEditPaymentForm(v => ({ ...v, is_receive_entry: true }))}
                disabled={editPaymentLoading}
              >
                <ArrowDownLeft className="w-4 h-4 mr-1" /> Get Money
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={editPaymentForm.date} onChange={(e) => setEditPaymentForm(v => ({ ...v, date: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>{editPaymentForm.is_receive_entry ? 'Received Amount' : 'Payout Amount'}</Label>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input type="number" step="0.01" value={editPaymentForm.amount} onChange={(e) => setEditPaymentForm(v => ({ ...v, amount: e.target.value }))} className="pl-9" disabled={editPaymentLoading} />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Payment Mode</Label>
              <div className="grid grid-cols-3 gap-2">
                <Button type="button" variant={editPaymentForm.payment_mode === 'CASH' ? 'default' : 'outline'} onClick={() => setEditPaymentForm(v => ({ ...v, payment_mode: 'CASH', bank_name: '', transaction_id: '', cheque_no: '' }))} disabled={editPaymentLoading}>Cash</Button>
                <Button type="button" variant={editPaymentForm.payment_mode === 'BANK' ? 'default' : 'outline'} onClick={() => setEditPaymentForm(v => ({ ...v, payment_mode: 'BANK', cheque_no: '' }))} disabled={editPaymentLoading}>Bank Transfer</Button>
                <Button type="button" variant={editPaymentForm.payment_mode === 'CHEQUE' ? 'default' : 'outline'} onClick={() => setEditPaymentForm(v => ({ ...v, payment_mode: 'CHEQUE', bank_name: '', transaction_id: '' }))} disabled={editPaymentLoading}>Cheque</Button>
              </div>
            </div>
            {editPaymentForm.payment_mode === 'CHEQUE' && (
              <div className="rounded-md border p-4 space-y-2">
                <Label className="text-xs">Cheque Number</Label>
                <Input placeholder="Enter cheque number" value={editPaymentForm.cheque_no} onChange={(e) => setEditPaymentForm(v => ({ ...v, cheque_no: e.target.value }))} disabled={editPaymentLoading} />
              </div>
            )}
            {editPaymentForm.payment_mode === 'BANK' && (
              <div className="grid grid-cols-2 gap-4 rounded-md border p-4">
                <div className="space-y-2">
                  <Label className="text-xs">Bank Name</Label>
                  <Input placeholder="e.g. ICICI" value={editPaymentForm.bank_name} onChange={(e) => setEditPaymentForm(v => ({ ...v, bank_name: e.target.value }))} disabled={editPaymentLoading} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Transaction ID</Label>
                  <Input placeholder="TRN-00000" value={editPaymentForm.transaction_id} onChange={(e) => setEditPaymentForm(v => ({ ...v, transaction_id: e.target.value }))} disabled={editPaymentLoading} />
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>Transaction Proof (Image)</Label>
              <div className="rounded-md border p-2">
                <VoucherUpload value={editPaymentForm.voucher_url} onChange={(url) => setEditPaymentForm(v => ({ ...v, voucher_url: url }))} disabled={editPaymentLoading} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Remarks</Label>
              <Textarea placeholder="Optional context..." value={editPaymentForm.remarks} onChange={(e) => setEditPaymentForm(v => ({ ...v, remarks: e.target.value }))} className="min-h-[80px]" disabled={editPaymentLoading} />
            </div>
            {approvers.length > 0 && (
              <div className="space-y-2">
                <Label>Assigned Admin</Label>
                <Select value={editPaymentForm.assigned_admin_id?.toString() || '_none'} onValueChange={(val) => setEditPaymentForm(v => ({ ...v, assigned_admin_id: val === '_none' ? null : parseInt(val) }))}>
                  <SelectTrigger><SelectValue placeholder="Select admin" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">- None -</SelectItem>
                    {approvers.map((app) => (
                      <SelectItem key={app.id} value={String(app.id)}>{app.full_name || app.name || app.email || `Admin #${app.id}`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setEditingPayment(null)} disabled={editPaymentLoading}>Cancel</Button>
              <Button type="submit" disabled={editPaymentLoading || !editPaymentForm.amount} className={editPaymentForm.is_receive_entry ? 'bg-cyan-600 hover:bg-cyan-700' : ''}>
                {editPaymentLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Update Entry
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete Payment Confirmation ── */}
      <Dialog open={!!deletePaymentId} onOpenChange={(open) => !open && setDeletePaymentId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-700 flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-red-100">
                <Trash2 className="h-4 w-4 text-red-600" />
              </span>
              Delete Payment
            </DialogTitle>
            <DialogDescription className="pt-2 text-sm text-slate-600">
              Are you sure? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeletePaymentId(null)} disabled={deletePaymentLoading}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeletePayment} disabled={deletePaymentLoading}>
              {deletePaymentLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Commission Dialog ── */}
      <Dialog open={!!editCommission} onOpenChange={(open) => !open && setEditCommission(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Commission</DialogTitle>
            <DialogDescription>Update commission for {editCommission?.agent_name}.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditCommissionSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-500 uppercase">Total Commission Value</Label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input type="number" value={editCommissionForm.total_commission} onChange={(e) => setEditCommissionForm(v => ({ ...v, total_commission: e.target.value }))} className="pl-9 h-11" required />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-500 uppercase">Remarks</Label>
              <Input value={editCommissionForm.remarks} onChange={(e) => setEditCommissionForm(v => ({ ...v, remarks: e.target.value }))} className="h-11" />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setEditCommission(null)} disabled={editCommissionLoading}>Cancel</Button>
              <Button type="submit" disabled={editCommissionLoading} className="bg-slate-900 border-none">
                {editCommissionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete Commission Confirmation ── */}
      <Dialog open={!!deleteCommissionId} onOpenChange={(open) => !open && setDeleteCommissionId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="w-5 h-5" /> Delete Commission
            </DialogTitle>
            <DialogDescription>
              This will permanently delete this agent's commission and ALL associated payments.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-red-50 p-4 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
            <p className="text-xs text-red-700 leading-relaxed font-medium">
              All historical ledger data and approved vouchers for this agent will be purged.
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteCommissionId(null)} disabled={deleteCommissionLoading}>Cancel</Button>
            <Button onClick={handleDeleteCommission} variant="destructive" disabled={deleteCommissionLoading}>
              {deleteCommissionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Assign New Agent Dialog ── */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign New Agent</DialogTitle>
            <DialogDescription>Assign a new commission agent to Plot {plot.plot_no}.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAssignSubmit} className="space-y-4">
            <div className="space-y-2" ref={dropdownRef}>
              <Label className="text-xs font-semibold text-slate-600 uppercase">Agent (Receiver) *</Label>
              <div className="relative">
                {selectedClient ? (
                  <div className="flex items-center gap-2 h-10 px-3 border border-slate-200 rounded-md bg-slate-50">
                    <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="text-sm font-medium text-slate-800 truncate flex-1">{selectedClient.full_name}</span>
                    {selectedClient.phone && <span className="text-[11px] text-slate-400">{selectedClient.phone}</span>}
                    <button type="button" onClick={handleClearClient} className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600">
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
                    {clientLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />}
                  </>
                )}
                {showDropdown && clientResults.length > 0 && !selectedClient && (
                  <div className="absolute z-50 w-full mt-1 max-h-48 overflow-auto rounded-md border bg-white shadow-lg">
                    {clientResults.map(client => (
                      <div
                        key={client.id}
                        className="px-3 py-2 cursor-pointer hover:bg-slate-100 text-sm flex items-center justify-between"
                        onClick={() => handleSelectClient(client)}
                      >
                        <span className="font-medium">{client.full_name}</span>
                        {client.phone && <span className="text-[11px] text-slate-400">{client.phone}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-600 uppercase">Total Commission *</Label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input type="number" min="1" step="0.01" placeholder="0.00" value={assignFormData.total_commission} onChange={(e) => setAssignFormData(v => ({ ...v, total_commission: e.target.value }))} className="pl-9 h-10" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-600 uppercase">Remarks</Label>
              <Input placeholder="Optional..." value={assignFormData.remarks} onChange={(e) => setAssignFormData(v => ({ ...v, remarks: e.target.value }))} className="h-10" />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setAssignDialogOpen(false)} disabled={assignLoading}>Cancel</Button>
              <Button type="submit" disabled={assignLoading || !selectedClient || !assignFormData.total_commission}>
                {assignLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Assign Agent
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
};

export default PlotCommissionDetail;
