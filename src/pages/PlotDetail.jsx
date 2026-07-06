import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import QRCode from 'qrcode';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';
import { Progress } from '../components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader,
  DialogTitle, DialogFooter,
} from '../components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../components/ui/table';

import {
  ArrowLeft, IndianRupee, Calendar, Ruler, Tag, FileText, Loader2,
  Edit2, Plus, Trash2, CreditCard, TrendingUp, CheckCircle2, AlertTriangle,
  Clock, CalendarClock, Banknote, Landmark, Wallet, Percent, Hash,
  ArrowDownRight, ArrowUpRight, CircleDollarSign, ChevronDown, X, Eye, Settings, Printer,
  Check, ChevronsUpDown, User, Search, UserPlus,
} from 'lucide-react';
import { Textarea } from '../components/ui/textarea';
import VoucherUpload, { VoucherThumbnail } from '../components/VoucherUpload';
import ApprovalStatusBadge from '../components/ApprovalStatusBadge';
import ChequeStatusControl from '../components/ChequeStatusControl';

// ── Constants ──
const STATUS_COLORS = {
  'CREATED': 'bg-purple-50 text-purple-700 border-purple-200',
  'BOOKED': 'bg-blue-50 text-blue-700 border-blue-200',
  'AGREEMENT': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'PENDING PAYMENT': 'bg-orange-50 text-orange-700 border-orange-200',
  'PARTIAL PAYMENT': 'bg-amber-50 text-amber-700 border-amber-200',
  'IN PROGRESS': 'bg-yellow-50 text-yellow-700 border-yellow-200',
  'CONSTRUCTION': 'bg-cyan-50 text-cyan-700 border-cyan-200',
  'POSSESSION': 'bg-teal-50 text-teal-700 border-teal-200',
  'REGISTRY': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'REGISTERED': 'bg-green-50 text-green-700 border-green-200',
  'COMPLETED': 'bg-green-50 text-green-800 border-green-300',
  'CANCELLED': 'bg-red-50 text-red-700 border-red-200',
  'HOLD': 'bg-slate-50 text-slate-600 border-slate-200',
  'DISPUTED': 'bg-rose-50 text-rose-700 border-rose-200',
  'RESALE': 'bg-violet-50 text-violet-700 border-violet-200',
  'TRANSFERRED': 'bg-sky-50 text-sky-700 border-sky-200',
};

const INST_STATUS = {
  paid:           { label: 'Paid',    color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2, bg: 'bg-emerald-50', iconColor: 'text-emerald-600' },
  partially_paid: { label: 'Partial', color: 'bg-amber-50 text-amber-700 border-amber-200',      icon: Clock,        bg: 'bg-amber-50',   iconColor: 'text-amber-600' },
  overdue:        { label: 'Overdue', color: 'bg-red-50 text-red-700 border-red-200',            icon: AlertTriangle,bg: 'bg-red-50',     iconColor: 'text-red-600' },
  pending:        { label: 'Pending', color: 'bg-slate-50 text-slate-600 border-slate-200',      icon: CalendarClock,bg: 'bg-slate-50',   iconColor: 'text-slate-500' },
};

const INTEREST_TYPES = [
  { value: 'per_day', label: 'Per Day' },
  { value: 'per_month', label: 'Per Month' },
  { value: 'per_quarter', label: 'Per Quarter' },
  { value: 'per_year', label: 'Per Year' },
];

const PAYMENT_FROM_OPTIONS = [
  'BOOKING', 'CASH', 'BANK', 'TRANSFER', 'CHEQUE', 'UPI',
  'NEFT', 'RTGS', 'IMPS', 'ADJUST', 'RETURN', 'REFUND',
];
const BANK_TYPE_FROMS = ['BANK', 'TRANSFER', 'CHEQUE', 'UPI', 'NEFT', 'RTGS', 'IMPS'];
const derivePaymentType = (from) => from === 'CHEQUE' ? 'CHEQUE' : BANK_TYPE_FROMS.includes(from) ? 'BANK' : 'CASH';

const FROM_COLORS = {
  'BOOKING': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'CASH': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'BANK': 'bg-blue-50 text-blue-700 border-blue-200',
  'TRANSFER': 'bg-purple-50 text-purple-700 border-purple-200',
  'CHEQUE': 'bg-teal-50 text-teal-700 border-teal-200',
  'UPI': 'bg-green-50 text-green-700 border-green-200',
  'NEFT': 'bg-cyan-50 text-cyan-700 border-cyan-200',
  'RTGS': 'bg-sky-50 text-sky-700 border-sky-200',
  'ADJUST': 'bg-orange-50 text-orange-700 border-orange-200',
  'IMPS': 'bg-amber-50 text-amber-700 border-amber-200',
  'RETURN': 'bg-pink-50 text-pink-700 border-pink-200',
  'REFUND': 'bg-red-50 text-red-700 border-red-200',
};

const fmt = (n) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
const todayStr = () => new Date().toISOString().split('T')[0];
const progressPct = (paid, total) => total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;

// ══════════════════════════════════════════════════
export default function PlotDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canManage, hasPermission, currentSite, user } = useAuth();
  const canWrite  = canManage && hasPermission('plot_payments', 'write');
  const canUpdate = canManage && hasPermission('plot_payments', 'update');
  const canDelete = canManage && hasPermission('plot_payments', 'delete');

  // ─── Data ───
  const [plot, setPlot] = useState(null);
  const [payments, setPayments] = useState([]);
  const [fromBreakdown, setFromBreakdown] = useState([]);
  const [receivedByBreakdown, setReceivedByBreakdown] = useState([]);
  const [installments, setInstallments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [approvers, setApprovers] = useState([]);
  const [autocomplete, setAutocomplete] = useState({ members: [] });
  const [message, setMessage] = useState({ type: '', text: '' });

  // ─── Create Installments Dialog ───
  const [instOpen, setInstOpen] = useState(false);
  const [instRows, setInstRows] = useState([{ installment_name: '', percentage: '', amount: '', due_date: '' }]);
  const [instSubmitting, setInstSubmitting] = useState(false);

  // ─── Edit Installment Dialog ───
  const [editInstOpen, setEditInstOpen] = useState(false);
  const [editInstForm, setEditInstForm] = useState({ id: null, installment_name: '', amount: '', due_date: '' });
  const [editInstSubmitting, setEditInstSubmitting] = useState(false);

  // ─── Settings Dialog ───
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsForm, setSettingsForm] = useState({ installments_enabled: false, interest_enabled: false, interest_rate: '', interest_type: 'per_month', penalty_enabled: false, penalty_rate: '', penalty_type: 'per_day', free_to_sale_days: '0' });
  const [settingsSubmitting, setSettingsSubmitting] = useState(false);

  // ─── Confirm ───
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);

  // ─── Tab ───
  const [activeTab, setActiveTab] = useState('payments');

  // ─── Print Receipt ───
  const printReceipt = async (pay) => {
    const amt = parseFloat(pay.amount) || 0;
    const isNegative = amt < 0;
    const absAmt = Math.abs(amt);
    const fromMode = String(pay.payment_from || '').toUpperCase();
    const isRefundEntry = fromMode === 'REFUND';
    const amountColor = isRefundEntry ? '#2563eb' : (isNegative ? '#dc2626' : '#059669');
    const siteName = (currentSite?.name || 'ALLOTMENT DIVISION').toUpperCase();
    const siteAddr = [currentSite?.address, currentSite?.city, currentSite?.state].filter(Boolean).join(', ').toUpperCase();
    const fmtINR = (v) => parseFloat(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 });
    const payDate = pay.date ? new Date(pay.date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
    const printedAt = new Date().toLocaleString('en-IN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
    const plotMeasure = plot?.plot_size ? String(plot.plot_size).toUpperCase() : '—';
    const instrumentRef = (pay.payment_from || pay.payment_type || '—').toUpperCase();
    const bankName = pay.payment_type === 'BANK'
      ? ((pay.bank_name || pay.bank_details || '—').toUpperCase())
      : '—';
    const branchName = pay.payment_type === 'BANK'
      ? ((pay.branch || '—').toUpperCase())
      : '—';

    const isCash = pay.payment_from?.toUpperCase() === 'CASH';
    const signerName = user?.full_name || user?.name || '';

    let qrDataUrl = null;
    if (pay.verifyUrl) {
      try {
        qrDataUrl = await QRCode.toDataURL(pay.verifyUrl, {
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
            <p>${siteAddr || 'ESTABLISHED REAL PROPERTY DIVISION'}</p>
          </div>

          <div class="doc-type">
            <h2>Receipt</h2>
          </div>

          <div class="meta-info">
            <div class="meta-item"><b>Ref:</b> ACK-${pay.id}</div>
            <div class="meta-item"><b>Date:</b> ${payDate}</div>
          </div>

          <div class="kv-qr-wrap">
            <div class="kv-section">
              <div class="kv-row">
                <div class="k">Received a sum of</div>
                <div class="c">:</div>
                <div class="v" style="color:${amountColor}">RS ${fmtINR(absAmt)}/-</div>
              </div>
              <div class="kv-row">
                <div class="k">From</div>
                <div class="c">:</div>
                <div class="v">${(plot?.buyer_name || 'UNDEFINED ENTITY').toUpperCase()}</div>
              </div>
              <div class="kv-row">
                <div class="k">Measuring</div>
                <div class="c">:</div>
                <div class="v">${plotMeasure}</div>
              </div>
            </div>
            ${qrSection}
          </div>

          <div class="settlement-title">As a full and final settlement in the following manner:</div>

          <table class="data-table">
            <tr><th>S.No.</th><td>#${pay.id}</td></tr>
            <tr><th>Date</th><td>${payDate || '—'}</td></tr>
            <tr><th>Ch./DD No</th><td>${instrumentRef}</td></tr>
            <tr><th>Name of the Bank</th><td>${bankName}</td></tr>
            <tr><th>Branch</th><td>${branchName}</td></tr>
            <tr><th>In favour of</th><td>${siteName}</td></tr>
            <tr><th>Amount</th><td style="color:${amountColor}">RS ${fmtINR(absAmt)}/-</td></tr>
          </table>

          ${isCash ? `
          <div class="bank-proviso">
            STATUTORY PROVISO: Be it enacted and known that any consideration tendered in the form of liquid currency (Cash) 
            is hereby received exclusively as a temporary custodian on the behalf of our designated banking institution 
            for immediate reconciliation and subsequent ledger entry in the relevant account of the bank.
          </div>
          ` : ''}

          <div class="footer">
            <div class="sig-box">
              <div class="sig-line">Signature of the Remitter</div>
            </div>
            <div class="sig-box">
              <div class="digital-signature">${signerName}</div>
              <div class="sig-line">Authorized Signatory & Seal</div>
            </div>
          </div>
          <div class="print-meta">Printed on: <b>${printedAt}</b></div>
        </div>
      </div>
    `;

    const html = `<!DOCTYPE html>
<html>
<head>
  <title>OFFICIAL INSTRUMENT OF RECEIPT - ${pay.id}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Inter:wght@400;500;600;700&family=Dancing+Script:wght@400;500;600;700&display=swap');
    
    @page { size: A4 portrait; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Inter', -apple-system, sans-serif; 
      color: #1a1a1a; 
      background: #f1f5f9; 
      display: flex;
      justify-content: center;
      padding: 10mm 0;
    }
    .document {
      background: #fff;
      width: 210mm;
      min-height: 297mm;
      padding: 8mm 15mm;
      position: relative;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
      border: 1px solid #e2e8f0;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .receipt-copy {
      position: relative;
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: 5mm 5mm;
      overflow: hidden;
    }

    .copy-label {
      position: absolute;
      top: 2mm;
      right: 3mm;
      font-size: 8px;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 1px;
      font-weight: 700;
    }

    .scissor-line {
      position: relative;
      border: none;
      border-top: 1.5px dashed #94a3b8;
      margin: 2mm 0;
      overflow: visible;
    }
    .scissor-line::before {
      content: '✂';
      position: absolute;
      top: -10px;
      left: -2px;
      font-size: 16px;
      color: #94a3b8;
      line-height: 1;
    }
    
    .border-frame {
      position: absolute;
      top: 2mm; left: 2mm; right: 2mm; bottom: 2mm;
      border: 1px solid #cbd5e1;
      pointer-events: none;
    }

    .watermark {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-45deg);
      font-family: 'Cinzel', serif;
      font-size: 60px;
      color: rgba(226, 232, 240, 0.25);
      font-weight: 700;
      z-index: 1;
      pointer-events: none;
      white-space: nowrap;
      text-transform: uppercase;
    }

    .content {
      position: relative;
      z-index: 10;
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    .header {
      text-align: center;
      margin-bottom: 3mm;
      border-bottom: 2px double #0f172a;
      padding-bottom: 2.5mm;
      background: #f0fdf4;
      border-radius: 4px;
      padding: 3mm 3mm 2.5mm;
    }
    .header h1 {
      font-family: 'Cinzel', serif;
      font-size: 18px;
      color: #166534;
      letter-spacing: 2px;
      margin-bottom: 2px;
      text-transform: uppercase;
    }
    .header p {
      font-size: 9px;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 1px;
      font-weight: 600;
      max-width: 80%;
      margin: 0 auto;
    }

    .doc-type {
      text-align: center;
      margin-bottom: 3mm;
    }
    .doc-type h2 {
      font-family: 'Cinzel', serif;
      font-size: 12px;
      color: #64748b;
      letter-spacing: 4px;
      text-transform: uppercase;
      display: inline-block;
      padding: 1px 15px;
      border-bottom: 1px solid #cbd5e1;
    }

    .meta-info {
      display: flex;
      justify-content: space-between;
      margin-bottom: 3mm;
      font-size: 10px;
      padding: 0 3mm;
    }
    .meta-item b { color: #64748b; font-size: 8px; text-transform: uppercase; margin-right: 3px; }

    .kv-qr-wrap { display: flex; align-items: flex-start; gap: 4mm; padding: 0 3mm; margin-bottom: 2mm; }
    .kv-section { flex: 1; min-width: 0; }
    .kv-row {
      display: grid;
      grid-template-columns: 44% 4% 52%;
      gap: 1px;
      align-items: baseline;
      margin: 1mm 0;
      font-size: 10px;
    }
    .kv-row .k { color: #0f172a; font-weight: 600; }
    .kv-row .c { text-align: center; color: #475569; font-weight: 700; }
    .kv-row .v { color: #0f172a; font-weight: 600; text-transform: uppercase; }
    .qr-section { flex-shrink: 0; display: flex; flex-direction: column; align-items: center; background: #fff; padding: 1.5mm; border: 1px solid #0f172a; border-radius: 3px; }
    .qr-section img { display: block; width: 30mm; height: 30mm; image-rendering: pixelated; image-rendering: crisp-edges; }
    .qr-label { font-size: 7px; color: #166534; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 800; margin-top: 1mm; }
    .print-meta { flex-shrink: 0; text-align: center; font-size: 7.5px; color: #64748b; margin-top: 1.5mm; padding: 0.8mm 0 0; border-top: 1px dashed #e2e8f0; letter-spacing: 0.3px; }
    .print-meta b { color: #0f172a; font-weight: 600; }

    .settlement-title {
      margin: 2mm 3mm 1mm;
      font-size: 10px;
      color: #0f172a;
      font-weight: 700;
    }

    .highlight {
      font-weight: 700;
      color: #0f172a;
    }

    .data-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 3mm;
    }
    .data-table th, .data-table td {
      border: 1px solid #e2e8f0;
      padding: 1.5mm 3mm;
      text-align: left;
    }
    .data-table th {
      background: #f8fafc;
      font-size: 8px;
      text-transform: uppercase;
      color: #64748b;
      width: 35%;
    }
    .data-table td {
      font-size: 10px;
      font-weight: 600;
      color: #0f172a;
    }

    .bank-proviso {
      margin-top: 2mm;
      padding: 3mm;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      font-size: 8px;
      font-style: italic;
      color: #64748b;
      text-align: center;
      line-height: 1.5;
    }

    .footer {
      flex-shrink: 0;
      margin-top: auto;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      padding: 3mm 5mm 1mm;
    }
    .sig-box {
      text-align: center;
      width: 55mm;
      min-height: 14mm;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
    }
    .sig-line {
      border-top: 1.5px solid #0f172a;
      padding-top: 3px;
      font-size: 8px;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .digital-signature {
      font-family: 'Dancing Script', 'Brush Script MT', cursive;
      font-size: 22px;
      font-weight: 700;
      color: #1a237e;
      margin-bottom: 1px;
      line-height: 1;
      height: 8mm;
      display: flex;
      align-items: flex-end;
      justify-content: center;
    }

    @media print {
      body { background: white; padding: 0; }
      .document {
        box-shadow: none !important;
        border: none !important;
        width: 210mm;
        height: 297mm;
        margin: 0 !important;
        padding: 8mm 15mm !important;
      }
      .receipt-copy { padding: 3mm 5mm !important; }
      .header { padding: 2mm 3mm !important; margin-bottom: 1.5mm !important; }
      .header h1 { font-size: 16px !important; }
      .doc-type { margin-bottom: 1.5mm !important; }
      .meta-info { margin-bottom: 1.5mm !important; }
      .kv-qr-wrap { margin-bottom: 1mm !important; }
      .qr-section img { width: 24mm !important; height: 24mm !important; }
      .settlement-title { margin: 1mm 3mm 0.5mm !important; }
      .data-table { margin-bottom: 1.5mm !important; }
      .data-table th, .data-table td { padding: 0.8mm 3mm !important; }
      .bank-proviso { margin-top: 1mm !important; padding: 1.5mm 2mm !important; font-size: 7px !important; line-height: 1.35 !important; }
      .footer { padding: 1.5mm 5mm 0 !important; }
      .sig-box { min-height: 11mm !important; }
      .digital-signature { font-size: 18px !important; height: 6mm !important; }
      .print-meta { margin-top: 0.5mm !important; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="document">
    ${receiptBlock('Office Copy')}
    <hr class="scissor-line" />
    ${receiptBlock('Customer Copy')}
  </div>

  <div class="no-print" style="position:fixed; bottom: 30px; left:0; right:0; text-align:center; z-index:1000;">
    <button onclick="(async () => { try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch(e){} window.print(); })()" style="padding:12px 50px; font-size:15px; font-weight:700; background:#0f172a; color:#fff; border:none; border-radius:10px; cursor:pointer; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.2);">
      EXECUTE PRINT (A4)
    </button>
    <button onclick="window.close()" style="padding:12px 50px; font-size:15px; font-weight:700; background:#fff; color:#475569; border:1px solid #e2e8f0; border-radius:10px; cursor:pointer; margin-left:15px;">
      TERMINATE
    </button>
  </div>
</body>
</html>`;

    const printWindow = window.open('', '_blank', 'width=1000,height=750');
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const printStatement = () => {
    if (!plot) return;
    const siteName = (currentSite?.name || '').toUpperCase();
    const siteAddr = [currentSite?.address, currentSite?.city, currentSite?.state].filter(Boolean).join(', ').toUpperCase();
    const fmtINR = (v) => parseFloat(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 });
    const selected = payments; // For now all, selected logic can be added later if needed
    if (selected.length === 0) return;

    const grandTotal = totalReceived;
    const balanceAmt = balance;
    const grandTotalSign = grandTotal < 0 ? '-' : '';
    const balanceSign = balanceAmt < 0 ? '-' : '';
    const balanceColor = balanceAmt >= 0 ? '#059669' : '#dc2626';

    const html = `<!DOCTYPE html>
<html>
<head>
  <title>STATEMENT OF ACCOUNT - ${plot.plot_no}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Inter:wght@400;500;600;700&display=swap');
    @page { size: A4 portrait; margin: 10mm; }
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: 'Inter', sans-serif; color: #1e293b; background: #f8fafc; padding: 15mm 0; display: flex; justify-content: center; }
    .document { background: white; width: 210mm; min-height: 297mm; padding: 15mm; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1); border: 1px solid #e2e8f0; position: relative; }
    .header { text-align: center; margin-bottom: 10mm; border-bottom: 3px double #0f172a; padding-bottom: 8mm; }
    .header h1 { font-family: 'Cinzel', serif; font-size: 28px; color: #0f172a; text-transform: uppercase; letter-spacing: 2px; }
    .header p { font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 600; margin-top: 4px; }
    .stmt-title { text-align: center; margin-bottom: 8mm; font-family: 'Cinzel', serif; font-size: 16px; color: #64748b; text-decoration: underline; text-underline-offset: 4px; letter-spacing: 4px; text-transform: uppercase; }
    .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4mm; margin-bottom: 8mm; background: #f8fafc; padding: 4mm; border: 1px solid #e2e8f0; border-radius: 4px; }
    .info-item { display: flex; flex-direction: column; }
    .info-lbl { font-size: 9px; text-transform: uppercase; color: #94a3b8; font-weight: 700; margin-bottom: 1px; }
    .info-val { font-size: 12px; font-weight: 700; color: #0f172a; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 10mm; font-size: 11px; }
    th { background: #f1f5f9; padding: 3mm 2mm; text-align: left; text-transform: uppercase; font-size: 9px; font-weight: 800; color: #475569; border: 1px solid #cbd5e1; }
    td { padding: 3mm 2mm; border: 1px solid #e2e8f0; color: #334155; }
    tr:nth-child(even) { background: #fbfcfd; }
    .total-row td { background: #f8fafc; font-weight: 800; border-top: 2px solid #0f172a; font-size: 12px; color: #0f172a; }
    .bal-row td { background: #fff; font-weight: 800; font-size: 13px; }
    .footer { margin-top: 15mm; padding-top: 10mm; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8; }
    @media print { body { background: white; padding: 0; } .document { box-shadow: none; border: none; width: 100%; } .no-print { display: none !important; } }
  </style>
</head>
<body>
  <div class="document">
    <div class="header">
      <h1>${siteName}</h1>
      <p>${siteAddr || 'STATUTORY REAL PROPERTY DIVISION'}</p>
    </div>
    <div class="stmt-title">Statement of Account</div>
    <div class="info-grid">
      <div class="info-item"><div class="info-lbl">Plot Identifier</div><div class="info-val">${plot.plot_no}${plot.block ? ' (Block ' + plot.block + ')' : ''}</div></div>
      <div class="info-item"><div class="info-lbl">Primary Allottee</div><div class="info-val">${(plot.buyer_name || 'UNDEFINED').toUpperCase()}</div></div>
      <div class="info-item"><div class="info-lbl">Allotment Date</div><div class="info-val">${new Date(plot.booking_date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}</div></div>
      <div class="info-item"><div class="info-lbl">Total Consideration</div><div class="info-val">₹${fmtINR(salePrice)}</div></div>
      <div class="info-item"><div class="info-lbl">Aggregated Credits</div><div class="info-val" style="color:${grandTotal < 0 ? '#dc2626' : '#059669'}">${grandTotalSign}₹${fmtINR(Math.abs(grandTotal))}</div></div>
      <div class="info-item"><div class="info-lbl">Outstanding Balance</div><div class="info-val" style="color:${balanceColor}">${balanceSign}₹${fmtINR(Math.abs(balanceAmt))}</div></div>
    </div>
    <table>
      <thead>
        <tr>
          <th style="width:30px; text-align:center">#</th>
          <th style="width:80px">Date</th>
          <th style="width:100px">Remitter</th>
          <th style="width:180px">Instrument Details</th>
          <th>Buyer</th>
          <th>Booked By</th>
          <th style="text-align:right">Quantum (₹)</th>
          <th style="text-align:right; width:120px">Cumulative (₹)</th>
        </tr>
      </thead>
      <tbody>
        ${selected.map((pay, idx) => {
          const amt = parseFloat(pay.amount) || 0;
          const currSum = selected.slice(0, idx + 1).reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
          const fromMode = String(pay.payment_from || '').toUpperCase();
          const isRefundEntry = fromMode === 'REFUND';
          const amountColor = isRefundEntry ? '#ca8a04' : (amt < 0 ? '#dc2626' : '#059669');
          const cumulativeColor = currSum < 0 ? '#dc2626' : '#059669';
          return `<tr>
            <td style="text-align:center">${idx + 1}</td>
            <td style="white-space:nowrap">${pay.date ? new Date(pay.date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''}</td>
            <td>${(pay.payment_from || 'LIQUID').toUpperCase()}</td>
            <td style="font-family:monospace; font-size:10px">${(pay.bank_details || 'DIRECT').toUpperCase()}</td>
            <td>${(pay.buyer_name || '').toUpperCase()}</td>
            <td>${(pay.booked_by || '').toUpperCase()}</td>
            <td style="text-align:right; font-weight:700; color:${amountColor}">${amt < 0 ? '-' : ''}${fmtINR(Math.abs(amt))}</td>
            <td style="text-align:right; font-weight:700; color:${cumulativeColor}">${currSum < 0 ? '-' : ''}₹${fmtINR(Math.abs(currSum))}</td>
          </tr>`;
        }).join('')}
        <tr class="total-row">
          <td colspan="6" style="text-align:right">CUMULATIVE REMITTANCE</td>
          <td style="text-align:right; color:${grandTotal < 0 ? '#dc2626' : '#059669'}">${grandTotalSign}₹${fmtINR(Math.abs(grandTotal))}</td>
          <td></td>
        </tr>
        <tr class="bal-row">
          <td colspan="6" style="text-align:right">NET FISCAL LIABILITY</td>
          <td style="text-align:right; color:${balanceColor}">${balanceSign}₹${fmtINR(Math.abs(balanceAmt))}</td>
          <td></td>
        </tr>
      </tbody>
    </table>
    <div class="footer">
      <span>Instrument Generated on ${new Date().toLocaleString('en-IN')}</span>
      <span>${siteName} · Authorized Statement</span>
    </div>
  </div>
  <div class="no-print" style="position:fixed; bottom: 30px; left:0; right:0; text-align:center;">
    <button onclick="(async () => { try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch(e){} window.print(); })()" style="padding:12px 50px; font-size:15px; font-weight:700; background:#0f172a; color:#fff; border:none; border-radius:10px; cursor:pointer; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.2);">
      EXECUTE PRINT (A4)
    </button>
    <button onclick="window.close()" style="padding:12px 50px; font-size:15px; font-weight:700; background:#fff; color:#475569; border:1px solid #e2e8f0; border-radius:10px; cursor:pointer; margin-left:15px;">
      TERMINATE
    </button>
  </div>
</body>
</html>`;

    const w = window.open('', '_blank', 'width=1100,height=700');
    w.document.write(html);
    w.document.close();
  };

  // ─── Take Payment Dialog ───
  const [payOpen, setPayOpen] = useState(false);
  const [payMode, setPayMode] = useState('receive');
  const [payForm, setPayForm] = useState({
    date: todayStr(),
    payment_from: '',
    payment_type: 'CASH',
    bank_name: '',
    branch: '',
    bank_details: '',
    narration: '',
    buyer_name: '',
    booked_by: '',
    amount: '',
    voucher_url: '',
    assigned_admin_id: null,
    cheque_no: '',
    received_by: '',
  });
  const [editingPaymentId, setEditingPaymentId] = useState(null);
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [payBuyerOpen, setPayBuyerOpen] = useState(false);
  const [payBookedByOpen, setPayBookedByOpen] = useState(false);
  const [payBuyerSearch, setPayBuyerSearch] = useState('');
  const [payBookedBySearch, setPayBookedBySearch] = useState('');
  const bookedByRef = useRef(null);
  const bookedByInputRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    if (!payBookedByOpen) return;
    const handler = (e) => {
      if (bookedByRef.current && !bookedByRef.current.contains(e.target)) {
        setPayBookedByOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [payBookedByOpen]);

  // Auto-focus search input when dropdown opens
  useEffect(() => {
    if (payBookedByOpen && bookedByInputRef.current) {
      setTimeout(() => bookedByInputRef.current?.focus(), 0);
    }
  }, [payBookedByOpen]);

  const filteredBookedByMembers = useMemo(() => {
    const q = (payBookedBySearch || '').trim().toLowerCase();
    const members = autocomplete?.members || [];
    if (!q) return members;
    const words = q.split(/\s+/).filter(Boolean);
    const scored = [];
    for (const m of members) {
      const name = (m.name || '').toLowerCase();
      const phone = (m.phone || '').toLowerCase();
      const nameLC = name;
      // Every query word must match name or phone
      const allMatch = words.every(w => nameLC.includes(w) || phone.includes(w));
      if (!allMatch) continue;
      // Score: exact start > word-start > contains
      let score = 0;
      if (nameLC === q) score = 100;
      else if (nameLC.startsWith(q)) score = 80;
      else if (nameLC.split(/\s+/).some(w => w.startsWith(words[0]))) score = 60;
      else score = 40;
      scored.push({ m, score });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.map(s => s.m);
  }, [payBookedBySearch, autocomplete?.members]);

  const resetPayForm = () => {
    setPayForm({ date: todayStr(), payment_from: '', payment_type: 'CASH', bank_name: '', branch: '', bank_details: '', narration: '', buyer_name: plot?.buyer_name || '', booked_by: '', amount: '', voucher_url: '', assigned_admin_id: null, cheque_no: '', received_by: '' });
    setEditingPaymentId(null);
    setPayMode('receive');
    setPayBuyerSearch('');
    setPayBookedBySearch('');
  };

  const handleOpenPay = () => { resetPayForm(); setPayOpen(true); };

  const handleEditPayment = (p) => {
    setEditingPaymentId(p.id);
    setPayMode(parseFloat(p.amount) < 0 ? 'refund' : 'receive');
    setPayForm({
      date: p.date ? p.date.split('T')[0] : todayStr(),
      payment_from: p.payment_from || '',
      payment_type: p.payment_type || 'CASH',
      bank_name: p.bank_name || '',
      branch: p.branch || '',
      bank_details: p.bank_details || '',
      narration: p.narration || '',
      buyer_name: p.buyer_name || '',
      booked_by: p.booked_by || '',
      amount: String(Math.abs(parseFloat(p.amount) || 0)),
      voucher_url: p.voucher_url || '',
      assigned_admin_id: p.assigned_admin_id || null,
      cheque_no: p.cheque_no || '',
      received_by: p.received_by || '',
    });
    setPayOpen(true);
  };

  const handleDeletePayment = async (payId) => {
    if (!window.confirm('Delete this payment? This cannot be undone.')) return;
    try {
      await api.delete(`/plots/payments/${payId}`);
      showMsg('success', 'Payment deleted');
      fetchAll();
    } catch (err) {
      showMsg('error', err.response?.data?.message || 'Failed to delete payment');
    }
  };

  const handleSubmitPayment = async (e) => {
    e.preventDefault();
    setPaySubmitting(true);
    try {
      const rawAmt = Math.abs(parseFloat(payForm.amount) || 0);
      const payload = {
        date: payForm.date,
        payment_from: payForm.payment_from,
        payment_type: payForm.payment_type,
        bank_name: payForm.payment_type === 'BANK' ? (payForm.bank_name || null) : null,
        branch: payForm.payment_type === 'BANK' ? (payForm.branch || null) : null,
        bank_details: payForm.bank_details,
        narration: payForm.narration,
        buyer_name: payForm.buyer_name,
        booked_by: payForm.booked_by,
        amount: payMode === 'refund' ? -rawAmt : rawAmt,
        voucher_url: payForm.voucher_url || null,
        assigned_admin_id: payForm.assigned_admin_id,
        cheque_no: payForm.cheque_no || null,
        cheque_status: payForm.payment_from === 'CHEQUE' ? 'PENDING' : null,
        received_by: payForm.received_by || null,
      };
      if (editingPaymentId) {
        await api.put(`/plots/payments/${editingPaymentId}`, payload);
        showMsg('success', 'Payment updated');
      } else {
        await api.post('/plots/payments', { ...payload, plot_id: id });
        showMsg('success', payMode === 'refund' ? 'Refund recorded' : 'Payment recorded');
      }
      setPayOpen(false);
      fetchAll();
    } catch (err) {
      showMsg('error', err.response?.data?.message || 'Failed to save payment');
    } finally {
      setPaySubmitting(false);
    }
  };

  // ══════════════════════════════════════════════════
  //  FETCH
  // ══════════════════════════════════════════════════

  const fetchAll = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [plotRes, payRes, instRes, appRes, acRes] = await Promise.all([
        api.get(`/plots/${id}`),
        api.get(`/plots/payments/list?plot_id=${id}`),
        api.get(`/plots/${id}/installments`),
        api.get(currentSite?.id ? `/admin/approvers?site_id=${currentSite.id}` : '/admin/approvers').catch(() => ({ data: { approvers: [] } })),
        currentSite?.id ? api.get(`/plots/autocomplete?site_id=${currentSite.id}`).catch(() => ({ data: { members: [] } })) : Promise.resolve({ data: { members: [] } }),
      ]);
      setPlot(plotRes.data.plot || plotRes.data);
      setPayments(payRes.data.payments || []);
      setFromBreakdown(payRes.data.fromBreakdown || []);
      setReceivedByBreakdown(payRes.data.receivedByBreakdown || []);
      setInstallments(instRes.data.installments || []);
      setApprovers(appRes.data.approvers || []);
      setAutocomplete(acRes.data || { members: [] });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to load plot data' });
    } finally {
      setLoading(false);
    }
  }, [id, currentSite?.id]);

  const getAssignedAdminLabel = (payment) => {
    if (!payment.assigned_admin_id || approvers.length === 0) return null;
    const admin = approvers.find((a) => String(a.id) === String(payment.assigned_admin_id));
    if (!admin) return `Admin #${payment.assigned_admin_id}`;
    return admin.full_name || admin.name || admin.email || `Admin #${admin.id}`;
  };

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Computed ──
  const isActivePayment = (p) => !p.cheque_status || !['BOUNCED', 'RETURNED'].includes(p.cheque_status);
  const salePrice = parseFloat(plot?.sale_price) || 0;
  const totalReceived = useMemo(() => payments.filter(isActivePayment).reduce((s, p) => s + (parseFloat(p.amount) || 0), 0), [payments]);
  const balance = salePrice - totalReceived;
  const pctReceived = salePrice > 0 ? (totalReceived / salePrice) * 100 : 0;
  const toReceiveBank = parseFloat(plot?.to_receive_bank) || 0;
  const toReceiveCash = salePrice - toReceiveBank;
  const receivedBank = parseFloat(plot?.received_bank) || 0;
  const receivedCash = parseFloat(plot?.received_cash) || 0;
  const balanceBank = toReceiveBank - receivedBank;
  const balanceCash = toReceiveCash - receivedCash;
  const firstInstallment = parseFloat(plot?.first_installment) || 0;
  const balanceFirstInstallment = firstInstallment - totalReceived;
  const registryArea = parseFloat(plot?.registry_area) || 0;
  const circleRate = parseFloat(plot?.circle_rate) || 0;
  const toReceiveCircle = registryArea * circleRate;

  const instTotal = useMemo(() => installments.reduce((s, i) => s + parseFloat(i.amount || 0), 0), [installments]);
  const instPaid = useMemo(() => installments.reduce((s, i) => s + parseFloat(i.paid_amount || 0), 0), [installments]);
  const instRemaining = instTotal - instPaid;
  const instInterest = useMemo(() => installments.reduce((s, i) => s + (i.interest_due || 0), 0), [installments]);
  const instOverdue = useMemo(() => installments.filter(i => i.status === 'overdue').length, [installments]);
  const instOverdueAmt = useMemo(() => installments.filter(i => i.status === 'overdue' || i.status === 'partially_paid').reduce((s, i) => s + Math.max(parseFloat(i.amount || 0) - parseFloat(i.paid_amount || 0), 0), 0), [installments]);
  const instPaidPct = instTotal > 0 ? (instPaid / instTotal) * 100 : 0;
  const nextDueInst = useMemo(() => installments.find(i => i.status === 'pending' || i.status === 'partially_paid' || i.status === 'overdue'), [installments]);

  // ══════════════════════════════════════════════════
  //  HELPERS
  // ══════════════════════════════════════════════════

  const getStatusBadge = (status) => (
    <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[status] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>{status}</Badge>
  );

  const instStatusBadge = (status) => {
    const cfg = INST_STATUS[status] || INST_STATUS.pending;
    const Icon = cfg.icon;
    return <Badge variant="outline" className={`text-[10px] font-semibold ${cfg.color} gap-1`}><Icon className="w-3 h-3" /> {cfg.label}</Badge>;
  };

  const showMsg = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  };

  // ══════════════════════════════════════════════════
  //  INSTALLMENT ACTIONS
  // ══════════════════════════════════════════════════

  // Create installments
  const addInstRow = () => setInstRows(prev => [...prev, { installment_name: '', percentage: '', amount: '', due_date: '' }]);
  const removeInstRow = (i) => setInstRows(prev => prev.filter((_, idx) => idx !== i));
  const updateInstRow = (i, field, val) => setInstRows(prev => prev.map((r, idx) => {
    if (idx !== i) return r;
    const updated = { ...r, [field]: val };
    if (field === 'percentage' && val !== '' && salePrice > 0) {
      updated.amount = ((parseFloat(val) / 100) * salePrice).toFixed(2);
    } else if (field === 'amount' && val !== '' && salePrice > 0) {
      updated.percentage = ((parseFloat(val) / salePrice) * 100).toFixed(2);
    }
    return updated;
  }));

  const handleCreateInstallments = async (e) => {
    e.preventDefault();
    const valid = instRows.filter(r => r.amount && r.due_date);
    if (valid.length === 0) return showMsg('error', 'Add at least one valid installment');
    setInstSubmitting(true);
    try {
      await api.post(`/plots/${id}/installments`, { installments: valid });
      showMsg('success', `${valid.length} installment(s) created`);
      setInstOpen(false);
      setInstRows([{ installment_name: '', percentage: '', amount: '', due_date: '' }]);
      fetchAll();
    } catch (err) {
      showMsg('error', err.response?.data?.message || 'Failed to create installments');
    } finally {
      setInstSubmitting(false);
    }
  };

  // Edit installment
  const openEditInst = (inst) => {
    setEditInstForm({
      id: inst.id,
      installment_name: inst.installment_name || '',
      amount: inst.amount || '',
      due_date: inst.due_date ? new Date(inst.due_date).toISOString().split('T')[0] : '',
    });
    setEditInstOpen(true);
  };

  const handleUpdateInstallment = async (e) => {
    e.preventDefault();
    setEditInstSubmitting(true);
    try {
      await api.put(`/plots/installments/${editInstForm.id}`, {
        installment_name: editInstForm.installment_name,
        amount: parseFloat(editInstForm.amount) || 0,
        due_date: editInstForm.due_date,
      });
      showMsg('success', 'Installment updated');
      setEditInstOpen(false);
      fetchAll();
    } catch (err) {
      showMsg('error', err.response?.data?.message || 'Update failed');
    } finally {
      setEditInstSubmitting(false);
    }
  };

  // Delete installment
  const handleDeleteInstallment = async (instId) => {
    try {
      await api.delete(`/plots/installments/${instId}`);
      showMsg('success', 'Installment deleted');
      fetchAll();
    } catch (err) {
      showMsg('error', err.response?.data?.message || 'Delete failed');
    }
  };

  // Settings
  const openSettings = () => {
    setSettingsForm({
      installments_enabled: !!plot?.installments_enabled,
      interest_enabled: !!plot?.interest_enabled,
      interest_rate: plot?.interest_rate || '',
      interest_type: plot?.interest_type || 'per_month',
      penalty_enabled: !!plot?.penalty_enabled,
      penalty_rate: plot?.penalty_rate != null ? String(plot.penalty_rate) : '',
      penalty_type: plot?.penalty_type || 'per_day',
      free_to_sale_days: plot?.free_to_sale_days != null ? String(plot.free_to_sale_days) : '0',
    });
    setSettingsOpen(true);
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSettingsSubmitting(true);
    try {
      await api.put(`/plots/${id}/installment-settings`, settingsForm);
      showMsg('success', 'Settings updated');
      setSettingsOpen(false);
      fetchAll();
    } catch (err) {
      showMsg('error', err.response?.data?.message || 'Failed to save settings');
    } finally {
      setSettingsSubmitting(false);
    }
  };

  // Confirm
  const confirmAndDo = (action) => { setConfirmAction(() => action); setConfirmOpen(true); };
  const executeConfirm = () => { if (confirmAction) confirmAction(); setConfirmOpen(false); setConfirmAction(null); };

  // ══════════════════════════════════════════════════
  //  LOADING / ERROR
  // ══════════════════════════════════════════════════

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <div className="w-6 h-6 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!plot) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-slate-400 gap-3">
        <AlertTriangle className="w-10 h-10" />
        <p className="text-sm">Plot not found</p>
        <Button variant="outline" size="sm" onClick={() => navigate('/plot-payments')}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
      </div>
    );
  }

  // ══════════════════════════════════════════════════
  //  RENDER
  // ══════════════════════════════════════════════════

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/plot-payments')} className="h-8 w-8 p-0">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-slate-900">
                Plot {plot.plot_no}{plot.block ? ` — Block ${plot.block}` : ''}
              </h1>
              {getStatusBadge(plot.status)}
              {plot.installments_enabled && (
                <Badge variant="outline" className="text-[10px] bg-indigo-50 text-indigo-700 border-indigo-200">Installments</Badge>
              )}
            </div>
            <p className="text-sm text-slate-500 mt-0.5">
              {plot.buyer_name && <span className="font-medium text-slate-600">{plot.buyer_name}</span>}
              {plot.booking_by && <span className="text-slate-400"> · Booked by {plot.booking_by}</span>}
              {plot.booking_date && <span className="text-slate-400"> · {fmtDate(plot.booking_date)}</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={printStatement} className="text-xs h-8 border-blue-200 text-blue-700 hover:bg-blue-50">
            <Printer className="w-3.5 h-3.5 mr-1.5" /> Print Statement
          </Button>

          <Button size="sm" className="text-xs h-8" onClick={handleOpenPay}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Take Payment
          </Button>
          <Button variant="outline" size="sm" className="text-xs h-8" onClick={openSettings}>
            <Settings className="w-3.5 h-3.5 mr-1" /> Settings
          </Button>
        </div>
      </div>

      {/* ── Message ── */}
      {message.text && (
        <div className={`rounded-lg px-4 py-3 text-sm flex items-center gap-2 ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {message.text}
          <X className="w-4 h-4 ml-auto cursor-pointer" onClick={() => setMessage({ type: '', text: '' })} />
        </div>
      )}

      {/* ── Plot Info Strip ── */}
      <Card className="shadow-none border-slate-200 bg-slate-50/60">
        <CardContent className="p-3">
          <div className="flex items-center gap-6 flex-wrap text-xs">
            <div className="flex items-center gap-1.5">
              <Ruler className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-500">Size:</span>
              <span className="font-semibold text-slate-700">{plot.plot_size || '—'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <IndianRupee className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-500">Rate:</span>
              <span className="font-semibold text-slate-700">₹{fmt(plot.plot_rate)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Ruler className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-slate-500">Reg. Area:</span>
              <span className="font-semibold text-slate-700">{plot.registry_area || '—'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CircleDollarSign className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-slate-500">Circle Rate:</span>
              <span className="font-semibold text-slate-700">₹{fmt(plot.circle_rate)}</span>
            </div>
            {plot.team && (
              <div className="flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-slate-500">Team:</span>
                <span className="font-semibold text-indigo-700">{plot.team}</span>
              </div>
            )}
            {plot.notes && (
              <div className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-500 truncate max-w-xs">{plot.notes}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Rate Change Tracker (shows when discount was applied during booking) ── */}
      {parseFloat(plot.original_plot_rate) > 0 && parseFloat(plot.original_plot_rate) !== (parseFloat(plot.plot_rate) || 0) && (
        <Card className="shadow-none border-amber-200 bg-amber-50/50">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-3.5 h-3.5 text-amber-600" />
              <p className="text-xs font-semibold text-amber-800">Rate Change on Booking</p>
            </div>
            <div className="flex items-center gap-6 flex-wrap text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500">Original Rate:</span>
                <span className="font-semibold text-slate-600 line-through">₹{fmt(plot.original_plot_rate)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500">Discount:</span>
                <span className="font-semibold text-red-600">-₹{fmt(plot.discount_rate)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500">Booking Rate:</span>
                <span className="font-bold text-emerald-700">₹{fmt(plot.plot_rate)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500">Original Price:</span>
                <span className="font-semibold text-slate-600 line-through">₹{fmt((parseFloat(plot.plot_size) || 0) * (parseFloat(plot.original_plot_rate) || 0))}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500">Current Price:</span>
                <span className="font-bold text-blue-700">₹{fmt(plot.sale_price)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        <Card className="shadow-none border-slate-200">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Sale Price</p>
              <div className="w-6 h-6 rounded-md bg-blue-50 flex items-center justify-center"><IndianRupee className="w-3 h-3 text-blue-600" /></div>
            </div>
            <p className="text-lg font-bold text-slate-900 mt-1">₹{fmt(salePrice)}</p>
          </CardContent>
        </Card>
        <Card className="shadow-none border-slate-200">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Received</p>
              <div className="w-6 h-6 rounded-md bg-emerald-50 flex items-center justify-center"><ArrowDownRight className="w-3 h-3 text-emerald-600" /></div>
            </div>
            <p className="text-lg font-bold text-emerald-700 mt-1">₹{fmt(totalReceived)}</p>
          </CardContent>
        </Card>
        <Card className="shadow-none border-slate-200">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Balance</p>
              <div className={`w-6 h-6 rounded-md flex items-center justify-center ${balance <= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
                <Banknote className={`w-3 h-3 ${balance <= 0 ? 'text-emerald-600' : 'text-red-500'}`} /></div>
            </div>
            <p className={`text-lg font-bold mt-1 ${balance <= 0 ? 'text-emerald-700' : 'text-red-600'}`}>₹{fmt(balance)}</p>
          </CardContent>
        </Card>
        <Card className="shadow-none border-slate-200">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">% Received</p>
              <div className="w-6 h-6 rounded-md bg-purple-50 flex items-center justify-center"><Percent className="w-3 h-3 text-purple-600" /></div>
            </div>
            <p className="text-lg font-bold text-purple-700 mt-1">{pctReceived.toFixed(1)}%</p>
            <div className="w-full h-1 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
              <div className={`h-full rounded-full transition-all ${pctReceived >= 100 ? 'bg-emerald-500' : pctReceived >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${Math.min(pctReceived, 100)}%` }} />
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-none border-slate-200">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Payments</p>
              <div className="w-6 h-6 rounded-md bg-slate-100 flex items-center justify-center"><Hash className="w-3 h-3 text-slate-600" /></div>
            </div>
            <p className="text-lg font-bold text-slate-900 mt-1">{payments.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Bank / Cash Split ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="shadow-none border-blue-200 bg-blue-50/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-md bg-blue-100 flex items-center justify-center"><Landmark className="w-3 h-3 text-blue-700" /></div>
              <p className="text-xs font-bold text-blue-900 uppercase tracking-wide">Bank Split</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><p className="text-[9px] uppercase tracking-wider text-blue-400 font-medium text-nowrap">Goal</p><p className="text-sm font-bold text-blue-800">₹{fmt(toReceiveBank)}</p></div>
              <div><p className="text-[9px] uppercase tracking-wider text-blue-400 font-medium text-nowrap">Recvd</p><p className="text-sm font-bold text-emerald-700">₹{fmt(receivedBank)}</p></div>
              <div><p className="text-[9px] uppercase tracking-wider text-blue-400 font-medium text-nowrap">Bal</p><p className={`text-sm font-bold ${balanceBank <= 0 ? 'text-emerald-700' : 'text-red-600'}`}>₹{fmt(balanceBank)}</p></div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-none border-emerald-200 bg-emerald-50/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-md bg-emerald-100 flex items-center justify-center"><Wallet className="w-3 h-3 text-emerald-700" /></div>
              <p className="text-xs font-bold text-emerald-900 uppercase tracking-wide">Cash Split</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><p className="text-[9px] uppercase tracking-wider text-emerald-400 font-medium text-nowrap">Goal</p><p className="text-sm font-bold text-emerald-800">₹{fmt(toReceiveCash)}</p></div>
              <div><p className="text-[9px] uppercase tracking-wider text-emerald-400 font-medium text-nowrap">Recvd</p><p className="text-sm font-bold text-emerald-700">₹{fmt(receivedCash)}</p></div>
              <div><p className="text-[9px] uppercase tracking-wider text-emerald-400 font-medium text-nowrap">Bal</p><p className={`text-sm font-bold ${balanceCash <= 0 ? 'text-emerald-700' : 'text-red-600'}`}>₹{fmt(balanceCash)}</p></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── 1st Installment & Circle Rate Strip ── */}
      {(firstInstallment > 0 || toReceiveCircle > 0) && (
        <Card className="shadow-none border-slate-200 bg-slate-50/40">
          <CardContent className="p-3">
            <div className="flex items-center gap-6 flex-wrap text-xs">
              {toReceiveCircle > 0 && (
                <div className="flex items-center gap-1.5">
                  <CircleDollarSign className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-slate-500">To Receive (Area × Circle):</span>
                  <span className="font-bold text-amber-700">₹{fmt(toReceiveCircle)}</span>
                </div>
              )}
              {firstInstallment > 0 && (
                <>
                  <div className="flex items-center gap-1.5">
                    <Banknote className="w-3.5 h-3.5 text-indigo-500" />
                    <span className="text-slate-500">1st Installment:</span>
                    <span className="font-bold text-indigo-700">₹{fmt(firstInstallment)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Banknote className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-slate-500">Bal. of 1st Inst.:</span>
                    <span className={`font-bold ${balanceFirstInstallment <= 0 ? 'text-emerald-700' : 'text-red-600'}`}>₹{fmt(balanceFirstInstallment)}</span>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══════════ TABS: Installments / Payment History ═══════════ */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-100 h-9">
          {!!plot?.installments_enabled && (
          <TabsTrigger value="installments" className="text-xs">
            <CalendarClock className="w-3.5 h-3.5 mr-1.5" />
            Installments {installments.length > 0 && `(${installments.length})`}
          </TabsTrigger>
          )}
          <TabsTrigger value="payments" className="text-xs">
            <CreditCard className="w-3.5 h-3.5 mr-1.5" />
            Payment History ({payments.length})
          </TabsTrigger>
        </TabsList>

        {/* ─── TAB: Installments ─── */}
        <TabsContent value="installments" className="mt-4 space-y-4">
          {/* Installment Analytics Cards */}
          {installments.length > 0 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {/* Total Scheduled */}
                <Card className="shadow-none border-slate-200">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Scheduled</p>
                      <div className="w-6 h-6 rounded-md bg-blue-50 flex items-center justify-center"><CalendarClock className="w-3 h-3 text-blue-600" /></div>
                    </div>
                    <p className="text-lg font-bold text-slate-900">₹{fmt(instTotal)}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{installments.length} installment{installments.length > 1 ? 's' : ''}</p>
                  </CardContent>
                </Card>

                {/* Paid */}
                <Card className="shadow-none border-emerald-200 bg-emerald-50/20">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] uppercase tracking-wider text-emerald-500 font-medium">Paid</p>
                      <div className="w-6 h-6 rounded-md bg-emerald-50 flex items-center justify-center"><CheckCircle2 className="w-3 h-3 text-emerald-600" /></div>
                    </div>
                    <p className="text-lg font-bold text-emerald-700">₹{fmt(instPaid)}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <div className="w-full h-1 bg-emerald-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(instPaidPct, 100)}%` }} />
                      </div>
                      <span className="text-[10px] text-emerald-600 font-medium w-8 text-right">{instPaidPct.toFixed(0)}%</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Remaining */}
                <Card className="shadow-none border-slate-200">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Remaining</p>
                      <div className="w-6 h-6 rounded-md bg-slate-100 flex items-center justify-center"><Banknote className="w-3 h-3 text-slate-500" /></div>
                    </div>
                    <p className={`text-lg font-bold ${instRemaining > 0 ? 'text-slate-700' : 'text-emerald-700'}`}>₹{fmt(instRemaining)}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{installments.filter(i => i.status !== 'paid').length} unpaid</p>
                  </CardContent>
                </Card>

                {/* Overdue Amount */}
                <Card className={`shadow-none ${instOverdue > 0 ? 'border-red-200 bg-red-50/20' : 'border-slate-200'}`}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className={`text-[10px] uppercase tracking-wider font-medium ${instOverdue > 0 ? 'text-red-500' : 'text-slate-400'}`}>Late Due</p>
                      <div className={`w-6 h-6 rounded-md flex items-center justify-center ${instOverdue > 0 ? 'bg-red-50' : 'bg-slate-100'}`}><AlertTriangle className={`w-3 h-3 ${instOverdue > 0 ? 'text-red-500' : 'text-slate-400'}`} /></div>
                    </div>
                    <p className={`text-lg font-bold ${instOverdue > 0 ? 'text-red-600' : 'text-slate-400'}`}>₹{fmt(instOverdueAmt)}</p>
                    <p className={`text-[10px] mt-1 ${instOverdue > 0 ? 'text-red-400' : 'text-slate-400'}`}>{instOverdue} overdue installment{instOverdue !== 1 ? 's' : ''}</p>
                  </CardContent>
                </Card>

                {/* Interest Due */}
                <Card className={`shadow-none ${instInterest > 0 ? 'border-amber-200 bg-amber-50/20' : 'border-slate-200'}`}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className={`text-[10px] uppercase tracking-wider font-medium ${instInterest > 0 ? 'text-amber-600' : 'text-slate-400'}`}>Interest Due</p>
                      <div className={`w-6 h-6 rounded-md flex items-center justify-center ${instInterest > 0 ? 'bg-amber-50' : 'bg-slate-100'}`}><TrendingUp className={`w-3 h-3 ${instInterest > 0 ? 'text-amber-600' : 'text-slate-400'}`} /></div>
                    </div>
                    <p className={`text-lg font-bold ${instInterest > 0 ? 'text-amber-700' : 'text-slate-400'}`}>₹{fmt(instInterest)}</p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {plot.interest_enabled ? `${plot.interest_rate}% ${INTEREST_TYPES.find(t => t.value === plot.interest_type)?.label || ''}` : 'Interest off'}
                    </p>
                  </CardContent>
                </Card>

                {/* Next Due */}
                <Card className="shadow-none border-indigo-200 bg-indigo-50/20">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] uppercase tracking-wider text-indigo-500 font-medium">Next Due</p>
                      <div className="w-6 h-6 rounded-md bg-indigo-50 flex items-center justify-center"><Calendar className="w-3 h-3 text-indigo-600" /></div>
                    </div>
                    {nextDueInst ? (
                      <>
                        <p className="text-lg font-bold text-indigo-700">₹{fmt(Math.max(parseFloat(nextDueInst.amount) - parseFloat(nextDueInst.paid_amount), 0))}</p>
                        <p className="text-[10px] text-indigo-400 mt-1">{fmtDate(nextDueInst.due_date)} · {nextDueInst.installment_name || 'Next'}</p>
                      </>
                    ) : (
                      <>
                        <p className="text-lg font-bold text-emerald-600">All Paid</p>
                        <p className="text-[10px] text-emerald-400 mt-1">No pending dues</p>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* Action buttons */}
          {canWrite && (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => { setInstRows([{ installment_name: '', percentage: '', amount: '', due_date: '' }]); setInstOpen(true); }}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Installments
              </Button>
            </div>
          )}

          {/* Installment Timeline */}
          {installments.length === 0 ? (
            <Card className="shadow-none border-slate-200">
              <CardContent className="py-12 text-center">
                <CalendarClock className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-slate-500">No installments defined yet</p>
                <p className="text-xs text-slate-400 mt-1">Click "Add Installments" to create an installment schedule</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {installments.map((inst, idx) => {
                const cfg = INST_STATUS[inst.status] || INST_STATUS.pending;
                const pct = progressPct(inst.paid_amount, inst.amount);
                const remaining = Math.max(parseFloat(inst.amount) - parseFloat(inst.paid_amount), 0);
                const isOverdue = new Date(inst.due_date) < new Date() && inst.status !== 'paid';
                return (
                  <Card key={inst.id} className={`shadow-none border-slate-200 ${isOverdue ? 'border-l-4 border-l-red-400' : ''}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className={`w-9 h-9 rounded-full ${cfg.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                            <span className="text-xs font-bold text-slate-600">{idx + 1}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold text-slate-900">{inst.installment_name || `Installment ${idx + 1}`}</p>
                              {instStatusBadge(inst.status)}
                            </div>
                            <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Due: {fmtDate(inst.due_date)}</span>
                              <span>Amount: <strong className="text-slate-700">₹{fmt(inst.amount)}</strong></span>
                              <span>Paid: <strong className="text-emerald-600">₹{fmt(inst.paid_amount)}</strong></span>
                              <span>Remaining: <strong className={remaining > 0 ? 'text-red-600' : 'text-emerald-600'}>₹{fmt(remaining)}</strong></span>
                            </div>
                            {inst.interest_due > 0 && (
                              <p className="text-[10px] text-red-500 mt-1 flex items-center gap-1">
                                <TrendingUp className="w-3 h-3" /> Interest due: ₹{fmt(inst.interest_due)}
                              </p>
                            )}
                            <div className="mt-2 flex items-center gap-2">
                              <Progress value={pct} className="h-1.5 flex-1" />
                              <span className="text-[10px] text-slate-500 w-8 text-right">{pct}%</span>
                            </div>
                          </div>
                        </div>
                        {/* Actions */}
                        {(canUpdate || canDelete) && (
                          <div className="flex items-center gap-1 shrink-0">
                            {canUpdate && <Button variant="ghost" size="icon" className="h-7 w-7" title="Edit" onClick={() => openEditInst(inst)}>
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>}
                            {canDelete && <Button variant="ghost" size="icon" className="h-7 w-7" title="Delete" onClick={() => confirmAndDo(() => handleDeleteInstallment(inst.id))}>
                              <Trash2 className="w-3.5 h-3.5 text-red-400" />
                            </Button>}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ─── TAB: Payment History ─── */}
        <TabsContent value="payments" className="mt-4">
          <Card className="shadow-none border-slate-200">
            <CardContent className="p-0">
              {payments.length === 0 ? (
                <div className="text-center py-12">
                  <CreditCard className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">No payments recorded yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent bg-slate-50/80">
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-10">#</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-24">Date</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-28">From</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-20">Type</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right w-32">Amount (₹)</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Assigned To</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Created By</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Bank Details</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Narration</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Received By</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Buyer</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Booked By</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Status</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Cheque No</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Cheque</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Voucher</TableHead>
                        <TableHead className="w-28 text-right text-[11px] font-semibold uppercase text-slate-500">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((p, i) => (
                        <TableRow key={p.id}>
                          <TableCell className="text-xs text-slate-400 tabular-nums">{i + 1}</TableCell>
                          <TableCell className="text-xs tabular-nums">{fmtDate(p.date)}</TableCell>
                          <TableCell>
                            {p.payment_from && (
                              <Badge variant="outline" className={`text-[10px] font-medium ${FROM_COLORS[p.payment_from] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>{p.payment_from}</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-[10px] font-medium ${p.payment_type === 'BANK' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                              {p.payment_type}
                            </Badge>
                          </TableCell>
                           <TableCell className={`text-sm text-right font-semibold tabular-nums ${String(p.payment_from || '').toUpperCase() === 'REFUND' ? 'text-amber-600' : p.amount < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{p.amount < 0 ? '-' : ''}₹{fmt(Math.abs(p.amount))}</TableCell>
                          <TableCell>
                            {p.assigned_admin_id ? (
                              <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-100 italic">
                                {getAssignedAdminLabel(p) || '—'}
                              </Badge>
                            ) : (
                              <span className="text-[10px] text-slate-300 italic">Unassigned</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-slate-600">{p.created_by_name || '—'}</span>
                          </TableCell>
                          <TableCell className="text-xs text-slate-500 max-w-[120px] truncate font-mono">{p.bank_details || '—'}</TableCell>
                          <TableCell className="text-xs text-slate-500 max-w-[150px] truncate">{p.narration || '—'}</TableCell>
                          <TableCell className="text-xs font-medium">{p.received_by || '—'}</TableCell>
                          <TableCell className="text-xs font-medium">{p.buyer_name || '—'}</TableCell>
                          <TableCell className="text-xs font-medium">{p.booked_by || '—'}</TableCell>
                          <TableCell>
                            <ApprovalStatusBadge status={p.status} />
                          </TableCell>
                          <TableCell>
                            {p.cheque_no ? <span className="text-xs font-mono font-medium text-slate-700">{p.cheque_no}</span> : <span className="text-xs text-slate-300">—</span>}
                          </TableCell>
                          <TableCell>
                            {p.cheque_status ? (
                              <ChequeStatusControl
                                chequeStatus={p.cheque_status}
                                source="plot_payment"
                                entryId={p.id}
                                isAdmin={canManage}
                                onStatusChange={fetchAll}
                              />
                            ) : <span className="text-xs text-slate-300">—</span>}
                          </TableCell>
                          <TableCell>
                            {p.voucher_url ? <VoucherThumbnail url={p.voucher_url} /> : <span className="text-xs text-slate-300">—</span>}
                          </TableCell>
                          <TableCell className="text-right px-2">
                            <div className="flex items-center justify-end gap-1">
                              {canUpdate && (
                                <Button variant="ghost" size="sm" onClick={() => handleEditPayment(p)} className="h-7 w-7 p-0 text-slate-400 hover:text-amber-600 hover:bg-amber-50" title="Edit Payment">
                                  <Edit2 className="w-3.5 h-3.5" />
                                </Button>
                              )}
                              <Button variant="ghost" size="sm" onClick={() => printReceipt(p)} className="h-7 w-7 p-0 text-slate-400 hover:text-blue-600 hover:bg-blue-50" title="Print Receipt">
                                <Printer className="w-3.5 h-3.5" />
                              </Button>
                              {canDelete && (
                                <Button variant="ghost" size="sm" onClick={() => handleDeletePayment(p.id)} className="h-7 w-7 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50" title="Delete Payment">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {/* Totals row */}
                      <TableRow className="bg-slate-50 hover:bg-slate-50 border-t-2 border-slate-200">
                        <TableCell colSpan={4} className="text-xs font-semibold text-slate-600 px-4 py-3">Total Cumulative Received (${payments.length} entries)</TableCell>
                        <TableCell className={`text-sm text-right font-bold px-4 py-3 ${totalReceived < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{totalReceived < 0 ? '-' : ''}₹{fmt(Math.abs(totalReceived))}</TableCell>
                        <TableCell colSpan={11} />
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ═══════════ DIALOGS ═══════════ */}

      {/* ── Create Installments ── */}
      <Dialog open={instOpen} onOpenChange={setInstOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Installments</DialogTitle>
            <DialogDescription>Plot {plot.plot_no} · Sale Price: ₹{fmt(salePrice)}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateInstallments} className="space-y-4">
            <div className="space-y-2">
              {instRows.map((row, i) => (
                <div key={i} className="flex items-end gap-2 bg-slate-50 rounded-lg p-3">
                  <div className="flex-1 space-y-1.5">
                    <Label className="text-xs font-medium">Name</Label>
                    <Input value={row.installment_name} onChange={(e) => updateInstRow(i, 'installment_name', e.target.value)} placeholder={`Installment ${i + 1}`} className="h-8 text-sm" />
                  </div>
                  <div className="w-24 space-y-1.5">
                    <Label className="text-xs font-medium">% of Sale</Label>
                    <Input type="number" step="0.01" min="0" max="100" value={row.percentage} onChange={(e) => updateInstRow(i, 'percentage', e.target.value)} placeholder="0%" className="h-8 text-sm" />
                  </div>
                  <div className="w-32 space-y-1.5">
                    <Label className="text-xs font-medium">Amount *</Label>
                    <Input type="number" step="0.01" min="0.01" value={row.amount} onChange={(e) => updateInstRow(i, 'amount', e.target.value)} placeholder="₹0.00" className="h-8 text-sm" required />
                  </div>
                  <div className="w-36 space-y-1.5">
                    <Label className="text-xs font-medium">Due Date *</Label>
                    <Input type="date" value={row.due_date} onChange={(e) => updateInstRow(i, 'due_date', e.target.value)} className="h-8 text-sm" required />
                  </div>
                  {instRows.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeInstRow(i)}>
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" className="w-full" onClick={addInstRow}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Row
            </Button>
            <DialogFooter>
              <Button type="submit" disabled={instSubmitting}>
                {instSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Create {instRows.length} Installment{instRows.length > 1 ? 's' : ''}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Edit Installment ── */}
      <Dialog open={editInstOpen} onOpenChange={setEditInstOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Installment</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateInstallment} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Name</Label>
              <Input value={editInstForm.installment_name} onChange={(e) => setEditInstForm(p => ({ ...p, installment_name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Amount *</Label>
                <Input type="number" step="0.01" min="0.01" value={editInstForm.amount} onChange={(e) => setEditInstForm(p => ({ ...p, amount: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Due Date *</Label>
                <Input type="date" value={editInstForm.due_date} onChange={(e) => setEditInstForm(p => ({ ...p, due_date: e.target.value }))} required />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={editInstSubmitting}>
                {editInstSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Update
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Installment & Interest Settings ── */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Installment Settings</DialogTitle>
            <DialogDescription>Configure installments & interest for this plot</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div className="flex items-center gap-3 bg-slate-50 rounded-lg p-3">
              <input type="checkbox" id="inst_enabled" checked={settingsForm.installments_enabled} onChange={(e) => setSettingsForm(p => ({ ...p, installments_enabled: e.target.checked }))} className="rounded" />
              <Label htmlFor="inst_enabled" className="text-sm cursor-pointer">Enable installment tracking</Label>
            </div>
            <div className="flex items-center gap-3 bg-slate-50 rounded-lg p-3">
              <input type="checkbox" id="int_enabled" checked={settingsForm.interest_enabled} onChange={(e) => setSettingsForm(p => ({ ...p, interest_enabled: e.target.checked }))} className="rounded" />
              <Label htmlFor="int_enabled" className="text-sm cursor-pointer">Enable overdue interest calculation</Label>
            </div>
            {settingsForm.interest_enabled && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Interest Rate (%)</Label>
                  <Input type="number" step="0.01" min="0" value={settingsForm.interest_rate} onChange={(e) => setSettingsForm(p => ({ ...p, interest_rate: e.target.value }))} placeholder="e.g. 1.5" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Period</Label>
                  <Select value={settingsForm.interest_type} onValueChange={(v) => setSettingsForm(p => ({ ...p, interest_type: v }))}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{INTEREST_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3 bg-slate-50 rounded-lg p-3">
              <input type="checkbox" id="pen_enabled" checked={settingsForm.penalty_enabled} onChange={(e) => setSettingsForm(p => ({ ...p, penalty_enabled: e.target.checked }))} className="rounded" />
              <Label htmlFor="pen_enabled" className="text-sm cursor-pointer">Enable penalty on overdue installments</Label>
            </div>
            {settingsForm.penalty_enabled && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Penalty Rate (₹)</Label>
                  <Input type="number" step="0.01" min="0" value={settingsForm.penalty_rate} onChange={(e) => setSettingsForm(p => ({ ...p, penalty_rate: e.target.value }))} placeholder="e.g. 500" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Penalty Type</Label>
                  <Select value={settingsForm.penalty_type} onValueChange={(v) => setSettingsForm(p => ({ ...p, penalty_type: v }))}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="per_day">Per Day</SelectItem>
                      <SelectItem value="per_week">Per Week</SelectItem>
                      <SelectItem value="per_month">Per Month</SelectItem>
                      <SelectItem value="percentage">Percentage (%)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Free to Sale (Days after bench period overdue)</Label>
              <Input type="number" min="0" value={settingsForm.free_to_sale_days} onChange={(e) => setSettingsForm(p => ({ ...p, free_to_sale_days: e.target.value }))} placeholder="0 = disabled" />
              <p className="text-[10px] text-slate-400">Plot auto-eligible for free-to-sale after this many days past bench period overdue. 0 = disabled.</p>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={settingsSubmitting}>
                {settingsSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Save Settings
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Take Payment Dialog ── */}
      <Dialog open={payOpen} onOpenChange={(open) => { setPayOpen(open); if (!open) resetPayForm(); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] p-0 gap-0 overflow-hidden flex flex-col" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Header strip */}
          <div className={`shrink-0 px-5 py-3 border-b ${payMode === 'refund' ? 'bg-red-50 border-red-100' : 'bg-emerald-50/80 border-emerald-100'}`}>
            <h2 className={`text-sm font-semibold ${payMode === 'refund' ? 'text-red-800' : 'text-emerald-800'}`}>
              {editingPaymentId ? 'Edit Payment' : payMode === 'refund' ? 'Record Refund / Return' : 'Record Payment'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Plot <span className="font-semibold text-slate-700">{plot.plot_no}</span>
              {plot.buyer_name && <> · <span className="text-slate-600">{plot.buyer_name}</span></>}
            </p>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0">
            <form id="pay-form" onSubmit={handleSubmitPayment} className="space-y-4">
              {/* ── Receive / Refund mode toggle ── */}
              {!editingPaymentId && (
                <div className="flex gap-1 p-0.5 bg-slate-100 rounded-lg">
                  <button type="button" onClick={() => setPayMode('receive')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-semibold transition-all ${payMode === 'receive' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:bg-white'}`}>
                    <ArrowDownRight className="w-3.5 h-3.5" /> Receive
                  </button>
                  <button type="button" onClick={() => setPayMode('refund')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-semibold transition-all ${payMode === 'refund' ? 'bg-red-600 text-white shadow-sm' : 'text-slate-500 hover:bg-white'}`}>
                    <ArrowUpRight className="w-3.5 h-3.5" /> Refund / Return
                  </button>
                </div>
              )}
              {/* ── Amount & Date row ── */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-600">Date *</Label>
                  <Input type="date" value={payForm.date}
                    onChange={(e) => setPayForm({ ...payForm, date: e.target.value })}
                    required className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-600">
                    {payMode === 'refund' ? 'Refund ₹ *' : 'Amount ₹ *'}
                  </Label>
                  <div className="relative">
                    <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold ${payMode === 'refund' ? 'text-red-500' : 'text-emerald-600'}`}>
                      {payMode === 'refund' ? '−' : '+'}
                    </span>
                    <Input type="number" step="0.01" min="0" placeholder="0"
                      value={payForm.amount}
                      onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
                      required
                      className={`h-9 pl-7 font-semibold tabular-nums text-sm ${payMode === 'refund' ? 'border-red-200 text-red-700 focus-visible:ring-red-300' : 'border-emerald-200 text-emerald-700 focus-visible:ring-emerald-300'}`} />
                  </div>
                  {payForm.amount && (
                    <p className={`text-[10px] font-semibold ${payMode === 'refund' ? 'text-red-500' : 'text-emerald-600'}`}>
                      {payMode === 'refund' ? '−' : '+'} ₹{fmt(Math.abs(parseFloat(payForm.amount) || 0))}
                    </p>
                  )}
                </div>
              </div>

              {/* ── Payment Channel ── */}
              <div className="space-y-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Payment Channel</p>
                <div className="flex gap-1 p-0.5 bg-slate-100 rounded-lg">
                  <button type="button" onClick={() => setPayForm({ ...payForm, payment_type: 'BANK' })}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-semibold transition-all ${payForm.payment_type === 'BANK' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-white'}`}>
                    <Landmark className="w-3.5 h-3.5" /> Bank
                  </button>
                  <button type="button" onClick={() => setPayForm({ ...payForm, payment_type: 'CASH', payment_from: 'CASH' })}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-semibold transition-all ${payForm.payment_type === 'CASH' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:bg-white'}`}>
                    <Wallet className="w-3.5 h-3.5" /> Cash
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {PAYMENT_FROM_OPTIONS.map((f) => (
                    <button key={f} type="button"
                      onClick={() => {
                        const newFrom = payForm.payment_from === f ? '' : f;
                        const newType = newFrom ? derivePaymentType(newFrom) : payForm.payment_type;
                        if (newFrom === 'REFUND' || newFrom === 'RETURN') setPayMode('refund');
                        else if (newFrom) setPayMode('receive');
                        setPayForm({ ...payForm, payment_from: newFrom, payment_type: newType });
                      }}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-full border transition-all ${payForm.payment_from === f ? 'border-slate-800 bg-slate-800 text-white' : FROM_COLORS[f] || 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>
                      {f}
                    </button>
                  ))}
                </div>
                {(payForm.payment_from === 'CHEQUE' || payForm.payment_type === 'CHEQUE' || payForm.cheque_no || (payForm.payment_from !== 'CASH' && payForm.payment_type !== 'CASH')) && (
                  <div className="grid grid-cols-2 gap-2">
                    {(payForm.payment_from === 'CHEQUE' || payForm.payment_type === 'CHEQUE' || payForm.cheque_no) && (
                      <div className="space-y-1">
                        <Label className="text-xs font-medium text-slate-600">Cheque No</Label>
                        <Input placeholder="Cheque number" value={payForm.cheque_no}
                          onChange={(e) => setPayForm({ ...payForm, cheque_no: e.target.value })}
                          className="h-9 text-sm" />
                      </div>
                    )}
                    {payForm.payment_from !== 'CASH' && payForm.payment_type !== 'CASH' && (
                      <div className="space-y-1">
                        <Label className="text-xs font-medium text-slate-600">Bank Details</Label>
                        <Input placeholder="SBI-613266 / UNB-037191" value={payForm.bank_details}
                          onChange={(e) => setPayForm({ ...payForm, bank_details: e.target.value.toUpperCase() })}
                          list="pay-bank-suggestions-d" className="h-9 text-sm" />
                        <datalist id="pay-bank-suggestions-d">
                          {autocomplete.bankDetails?.map((b) => <option key={b} value={b} />)}
                        </datalist>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ── Booked By — inline dropdown (no Popover portal) ── */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">Payment Booked By</Label>
                <div className="relative" ref={bookedByRef}>
                  <button type="button"
                    onClick={() => { setPayBookedByOpen(prev => !prev); setPayBookedBySearch(''); }}
                    className="h-9 w-full flex items-center justify-between px-3 border rounded-md text-sm bg-white hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1">
                    {payForm.booked_by ? (
                      <span className="flex items-center gap-1.5 truncate text-slate-800">
                        <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        {(() => { const m = autocomplete?.members?.find(x => x.name === payForm.booked_by); return m?.phone ? `${m.name} (${m.phone})` : payForm.booked_by; })()}
                      </span>
                    ) : (
                      <span className="text-slate-400">Select person...</span>
                    )}
                    <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                  </button>

                  {payBookedByOpen && (
                    <div className="absolute z-[200] left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl animate-in fade-in-0 zoom-in-95 duration-100">
                      {/* Search input */}
                      <div className="flex items-center gap-2 border-b border-slate-100 px-3">
                        <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <input
                          ref={bookedByInputRef}
                          type="text"
                          placeholder="Search name or phone..."
                          value={payBookedBySearch}
                          onChange={(e) => setPayBookedBySearch(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') { setPayBookedByOpen(false); }
                            if (e.key === 'Enter' && filteredBookedByMembers.length > 0) {
                              e.preventDefault();
                              const first = filteredBookedByMembers[0];
                              setPayForm(prev => ({ ...prev, booked_by: first.name }));
                              setPayBookedByOpen(false);
                              setPayBookedBySearch('');
                            }
                          }}
                          className="flex-1 h-9 text-sm outline-none bg-transparent placeholder:text-slate-400"
                        />
                        {payBookedBySearch && (
                          <button type="button" onClick={() => setPayBookedBySearch('')} className="p-0.5 rounded hover:bg-slate-100">
                            <X className="w-3 h-3 text-slate-400" />
                          </button>
                        )}
                      </div>
                      {/* Scrollable list */}
                      <div className="max-h-[180px] overflow-y-auto overscroll-contain p-1">
                        {filteredBookedByMembers.length === 0 ? (
                          <p className="py-4 text-center text-xs text-slate-400">No members found</p>
                        ) : (
                          filteredBookedByMembers.map((m) => (
                            <button
                              key={`booked-${m.name}-${m.phone || ''}`}
                              type="button"
                              onClick={() => {
                                setPayForm(prev => ({ ...prev, booked_by: prev.booked_by === m.name ? '' : m.name }));
                                setPayBookedByOpen(false);
                                setPayBookedBySearch('');
                              }}
                              className={`w-full flex items-center gap-2 text-xs px-2 py-1.5 rounded-md cursor-pointer transition-colors ${
                                payForm.booked_by === m.name ? 'bg-emerald-50 text-emerald-800' : 'hover:bg-slate-50 text-slate-700'
                              }`}
                            >
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-semibold ${
                                payForm.booked_by === m.name ? 'bg-emerald-200 text-emerald-700' : 'bg-slate-100 text-slate-500'
                              }`}>
                                {(m.name || '?')[0].toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0 text-left">
                                <p className="font-medium truncate">{m.name}</p>
                                {(m.phone || m.team) && (
                                  <p className="text-[10px] text-slate-400 truncate">
                                    {[m.phone, m.team].filter(Boolean).join(' · ')}
                                  </p>
                                )}
                              </div>
                              {payForm.booked_by === m.name && (
                                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              )}
                            </button>
                          ))
                        )}
                      </div>
                      {payForm.booked_by && (
                        <div className="border-t border-slate-100 p-1">
                          <button type="button"
                            onClick={() => { setPayForm(prev => ({ ...prev, booked_by: '' })); setPayBookedByOpen(false); }}
                            className="w-full text-xs text-red-500 hover:bg-red-50 rounded-md py-1.5 px-2 text-left transition-colors">
                            Clear selection
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Narration ── */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">Narration</Label>
                <Textarea placeholder={payMode === 'refund' ? 'REFUND, RETURN A19 DG, TRF TO A38...' : 'REGISTRY, BOOKING, INSTALLMENT...'}
                  value={payForm.narration}
                  onChange={(e) => setPayForm({ ...payForm, narration: e.target.value.toUpperCase() })}
                  rows={2} className="text-sm resize-none" />
              </div>

              {/* ── Voucher ── */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">Voucher / Receipt</Label>
                <VoucherUpload value={payForm.voucher_url} onChange={(url) => setPayForm({ ...payForm, voucher_url: url })} />
              </div>

              {/* ── Admin Approval ── */}
              {approvers.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-600">Assign For Approval</Label>
                  <Select value={payForm.assigned_admin_id?.toString() || '_none'}
                    onValueChange={(val) => setPayForm({ ...payForm, assigned_admin_id: val === '_none' ? null : parseInt(val) })}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select admin" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">— Auto-assign or none —</SelectItem>
                      {approvers.map((admin) => (
                        <SelectItem key={admin.id} value={String(admin.id)}>
                          {admin.full_name || admin.name || admin.email || `Admin #${admin.id}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </form>
          </div>

          {/* Sticky footer */}
          <div className="shrink-0 border-t bg-slate-50/80 px-5 py-3 flex items-center justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setPayOpen(false)} disabled={paySubmitting}>
              Cancel
            </Button>
            <Button form="pay-form" type="submit" size="sm" disabled={paySubmitting}
              className={payMode === 'refund' ? 'bg-red-600 hover:bg-red-700 min-w-[130px]' : 'min-w-[130px]'}>
              {paySubmitting
                ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Recording...</>
                : payMode === 'refund' ? 'Record Refund' : 'Record Payment'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Confirm ── */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirm Action</DialogTitle>
            <DialogDescription>Are you sure? This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={executeConfirm}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
