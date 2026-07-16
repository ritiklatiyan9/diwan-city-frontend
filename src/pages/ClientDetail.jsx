import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Separator } from '../components/ui/separator';
import { Card, CardContent } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '../components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import {
  ArrowLeft, Edit2, Trash2, Phone, Mail, MapPin, User, Users,
  Camera, X, Check, AlertCircle, Loader2, Calendar, CreditCard,
  Briefcase, Shield, Hash, Heart, UserCheck, Tractor, Handshake,
  Store, HelpCircle, FileText, Upload, GraduationCap, BadgeCheck,
  UserCog, IndianRupee, Contact, FileCheck, Building2,
  Receipt, Landmark, Wallet, TrendingUp, ChevronRight,
  BookOpen, ExternalLink,
} from 'lucide-react';

// ── Constants ──
const MEMBER_TYPES = [
  { value: 'CLIENT', label: 'Client', icon: UserCheck, color: 'bg-blue-100 text-blue-700' },
  { value: 'FARMER', label: 'Farmer', icon: Tractor, color: 'bg-emerald-100 text-emerald-700' },
  { value: 'MEMBER', label: 'Member', icon: Users, color: 'bg-purple-100 text-purple-700' },
  { value: 'BROKER', label: 'Broker', icon: Handshake, color: 'bg-amber-100 text-amber-700' },
  { value: 'PARTNER', label: 'Partner', icon: Users, color: 'bg-cyan-100 text-cyan-700' },
  { value: 'VENDOR', label: 'Vendor', icon: Store, color: 'bg-orange-100 text-orange-700' },
  { value: 'EMPLOYEE', label: 'Employee', icon: UserCog, color: 'bg-indigo-100 text-indigo-700' },
  { value: 'OTHER', label: 'Other', icon: HelpCircle, color: 'bg-slate-100 text-slate-700' },
];

const GENDER_OPTIONS = ['MALE', 'FEMALE', 'OTHER'];
const BLOOD_OPTIONS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const STATUS_OPTIONS = ['ACTIVE', 'INACTIVE', 'BLOCKED'];
const MARITAL_OPTIONS = ['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED'];
const EMPLOYMENT_TYPE_OPTIONS = ['FULL-TIME', 'PART-TIME', 'CONTRACT', 'INTERN', 'PROBATION', 'FREELANCE'];

// Transaction-source accents. Literal class strings — Tailwind's scanner cannot
// see interpolated names. Keys match the `source` the API emits.
const TXN_SOURCE_TONE = {
  'EXPENSE': 'bg-orange-50 text-orange-600 border border-orange-100',
  'PLOT PAYMENT': 'bg-cyan-50 text-cyan-700 border border-cyan-100',
  'DAYBOOK': 'bg-blue-50 text-blue-600 border border-blue-100',
};

const STATUS_COLORS = {
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  INACTIVE: 'bg-slate-100 text-slate-600',
  BLOCKED: 'bg-red-100 text-red-700',
};

const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};
const fmtCur = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const KYC_DOC_FIELDS = [
  { key: 'aadhar_front_url', label: 'Aadhar Card (Front)', accept: 'image/jpeg,image/png,image/jpg,application/pdf' },
  { key: 'aadhar_back_url', label: 'Aadhar Card (Back)', accept: 'image/jpeg,image/png,image/jpg,application/pdf' },
  { key: 'pan_card_url', label: 'PAN Card', accept: 'image/jpeg,image/png,image/jpg,application/pdf' },
  { key: 'voter_id_url', label: 'Voter ID Card', accept: 'image/jpeg,image/png,image/jpg,application/pdf' },
  { key: 'passport_url', label: 'Passport', accept: 'image/jpeg,image/png,image/jpg,application/pdf' },
  { key: 'driving_license_url', label: 'Driving License', accept: 'image/jpeg,image/png,image/jpg,application/pdf' },
  { key: 'cheque_url', label: 'Cancelled Cheque', accept: 'image/jpeg,image/png,image/jpg,application/pdf' },
  { key: 'other_kyc_url', label: 'Other KYC Document', accept: 'image/jpeg,image/png,image/jpg,application/pdf' },
];

const EMPLOYEE_DOC_FIELDS = [
  { key: 'resume_url', label: 'Resume / CV', accept: 'image/jpeg,image/png,image/jpg,application/pdf' },
  { key: 'marksheet_10th_url', label: '10th Marksheet', accept: 'image/jpeg,image/png,image/jpg,application/pdf' },
  { key: 'marksheet_12th_url', label: '12th Marksheet', accept: 'image/jpeg,image/png,image/jpg,application/pdf' },
  { key: 'degree_certificate_url', label: 'Degree / Diploma Certificate', accept: 'image/jpeg,image/png,image/jpg,application/pdf' },
  { key: 'experience_certificate_url', label: 'Experience Certificate', accept: 'image/jpeg,image/png,image/jpg,application/pdf' },
  { key: 'offer_letter_url', label: 'Offer Letter', accept: 'image/jpeg,image/png,image/jpg,application/pdf' },
  { key: 'other_certificate_url', label: 'Other Certificate', accept: 'image/jpeg,image/png,image/jpg,application/pdf' },
];

const EMPTY_FORM = {
  member_type: 'CLIENT', full_name: '', father_name: '', gender: '', date_of_birth: '',
  blood_group: '', phone: '', alt_phone: '', email: '', whatsapp: '',
  address: '', city: '', state: '', pincode: '',
  aadhar_no: '', pan_no: '', voter_id: '',
  bank_name: '', account_no: '', ifsc_code: '', branch: '',
  occupation: '', company_name: '', reference: '', notes: '', status: 'ACTIVE',
  mother_name: '', spouse_name: '', nationality: '', religion: '', caste: '',
  marital_status: '', anniversary_date: '', qualification: '',
  passport_no: '', driving_license_no: '', gst_no: '', tin_no: '',
  emergency_contact_name: '', emergency_contact_phone: '', emergency_contact_relation: '',
  nominee_name: '', nominee_relation: '', nominee_phone: '',
  employee_id: '', designation: '', department: '', date_of_joining: '', salary: '', employment_type: '',
  // Team (for broker/member/employee/partner)
  team: '',
};

const Avatar = ({ src, name, size = 'md' }) => {
  const sizes = { sm: 'w-8 h-8 text-xs', md: 'w-12 h-12 text-sm', lg: 'w-20 h-20 text-xl', xl: 'w-28 h-28 text-3xl' };
  const initials = (name || '??').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  if (src) return <img src={src} alt={name} className={`${sizes[size]} rounded-full object-cover ring-2 ring-white shadow-sm`} />;
  return (
    <div className={`${sizes[size]} rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-white flex items-center justify-center font-bold ring-2 ring-white shadow-sm`}>
      {initials}
    </div>
  );
};

const TypeBadge = ({ type }) => {
  const t = MEMBER_TYPES.find(mt => mt.value === type) || MEMBER_TYPES[7];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full ${t.color}`}>
      <t.icon className="w-3 h-3" />
      {t.label}
    </span>
  );
};

const DetailRow = ({ icon: Icon, label, value, mono }) => {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2.5">
      <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="w-3.5 h-3.5 text-slate-400" />
      </div>
      <div>
        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">{label}</p>
        <p className={`text-sm font-medium text-slate-800 mt-0.5 ${mono ? 'font-mono tracking-wider' : ''}`}>{value}</p>
      </div>
    </div>
  );
};

const ClientDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentSite, canManage } = useAuth();
  const siteId = currentSite?.id;

  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);
  const [memberTxns, setMemberTxns] = useState([]);
  const [memberTxnSummary, setMemberTxnSummary] = useState({ total_debit: 0, total_credit: 0, net: 0, count: 0 });
  const [txnLoading, setTxnLoading] = useState(false);

  // Financial info state
  const [finData, setFinData] = useState(null);
  const [finLoading, setFinLoading] = useState(false);
  const [finTab, setFinTab] = useState('expenses');

  // Edit dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [docFiles, setDocFiles] = useState({});
  const [docPreviews, setDocPreviews] = useState({});
  const [removeDocs, setRemoveDocs] = useState({});
  const [message, setMessage] = useState({ type: '', text: '' });
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  // Fetch member details
  const fetchMember = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const res = await api.get(`/members/${id}`);
      setMember(res.data.member);
    } catch (err) {
      console.error('Failed to fetch member:', err);
      setMember(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Fetch transactions
  const fetchTransactions = useCallback(async () => {
    if (!id || !siteId) return;
    try {
      setTxnLoading(true);
      const res = await api.get(`/members/${id}/transactions`, { params: { site_id: siteId } });
      setMemberTxns(res.data.transactions || []);
      setMemberTxnSummary(res.data.summary || { total_debit: 0, total_credit: 0, net: 0, count: 0 });
    } catch (err) {
      console.error('Failed to fetch txns:', err);
    } finally {
      setTxnLoading(false);
    }
  }, [id, siteId]);

  useEffect(() => { fetchMember(); }, [fetchMember]);
  useEffect(() => { if (member) fetchTransactions(); }, [member, fetchTransactions]);

  // Fetch financial info
  const fetchFinancialInfo = useCallback(async () => {
    if (!siteId || !id) return;
    setFinLoading(true);
    try {
      const res = await api.get(`/members/${id}/financial-info`, { params: { site_id: siteId } });
      setFinData(res.data);
    } catch { setFinData(null); }
    finally { setFinLoading(false); }
  }, [id, siteId]);

  useEffect(() => { if (member) fetchFinancialInfo(); }, [member, fetchFinancialInfo]);

  // Form helpers
  const resetForm = () => {
    setForm({ ...EMPTY_FORM });
    setPhotoFile(null);
    setPhotoPreview(null);
    setRemovePhoto(false);
    setDocFiles({});
    setDocPreviews({});
    setRemoveDocs({});
    setMessage({ type: '', text: '' });
  };

  const handleOpenEdit = () => {
    const m = member;
    setForm({
      member_type: m.member_type || 'CLIENT',
      full_name: m.full_name || '', father_name: m.father_name || '',
      gender: m.gender || '', date_of_birth: m.date_of_birth ? m.date_of_birth.split('T')[0] : '',
      blood_group: m.blood_group || '', phone: m.phone || '', alt_phone: m.alt_phone || '',
      email: m.email || '', whatsapp: m.whatsapp || '',
      address: m.address || '', city: m.city || '', state: m.state || '', pincode: m.pincode || '',
      aadhar_no: m.aadhar_no || '', pan_no: m.pan_no || '', voter_id: m.voter_id || '',
      bank_name: m.bank_name || '', account_no: m.account_no || '', ifsc_code: m.ifsc_code || '', branch: m.branch || '',
      occupation: m.occupation || '', company_name: m.company_name || '', reference: m.reference || '',
      notes: m.notes || '', status: m.status || 'ACTIVE',
      mother_name: m.mother_name || '', spouse_name: m.spouse_name || '',
      nationality: m.nationality || '', religion: m.religion || '', caste: m.caste || '',
      marital_status: m.marital_status || '',
      anniversary_date: m.anniversary_date ? m.anniversary_date.split('T')[0] : '',
      qualification: m.qualification || '',
      passport_no: m.passport_no || '', driving_license_no: m.driving_license_no || '',
      gst_no: m.gst_no || '', tin_no: m.tin_no || '',
      emergency_contact_name: m.emergency_contact_name || '',
      emergency_contact_phone: m.emergency_contact_phone || '',
      emergency_contact_relation: m.emergency_contact_relation || '',
      nominee_name: m.nominee_name || '', nominee_relation: m.nominee_relation || '',
      nominee_phone: m.nominee_phone || '',
      employee_id: m.employee_id || '', designation: m.designation || '',
      department: m.department || '',
      date_of_joining: m.date_of_joining ? m.date_of_joining.split('T')[0] : '',
      salary: m.salary || '', employment_type: m.employment_type || '',
      team: m.team || '',
    });
    setPhotoPreview(m.photo || null);
    setPhotoFile(null);
    setRemovePhoto(false);
    const existingDocs = {};
    [...KYC_DOC_FIELDS, ...EMPLOYEE_DOC_FIELDS].forEach(d => {
      if (m[d.key]) existingDocs[d.key] = m[d.key];
    });
    setDocPreviews(existingDocs);
    setDocFiles({});
    setRemoveDocs({});
    setDialogOpen(true);
  };

  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setRemovePhoto(false);
    const reader = new FileReader();
    reader.onloadend = () => setPhotoPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleClearPhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    setRemovePhoto(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDocSelect = (fieldKey, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDocFiles(prev => ({ ...prev, [fieldKey]: file }));
    setRemoveDocs(prev => ({ ...prev, [fieldKey]: false }));
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => setDocPreviews(prev => ({ ...prev, [fieldKey]: reader.result }));
      reader.readAsDataURL(file);
    } else {
      setDocPreviews(prev => ({ ...prev, [fieldKey]: 'pdf' }));
    }
  };

  const handleDocRemove = (fieldKey) => {
    setDocFiles(prev => { const n = { ...prev }; delete n[fieldKey]; return n; });
    setDocPreviews(prev => { const n = { ...prev }; delete n[fieldKey]; return n; });
    setRemoveDocs(prev => ({ ...prev, [fieldKey]: true }));
  };

  const DocUploadCard = ({ fieldDef }) => {
    const { key, label, accept } = fieldDef;
    const preview = docPreviews[key];
    const inputRef = useRef(null);
    return (
      <div className="border border-slate-200 rounded-lg p-3 space-y-2">
        <p className="text-xs font-medium text-slate-600">{label}</p>
        {preview ? (
          <div className="relative group">
            {preview === 'pdf' ? (
              <div className="w-full h-20 rounded-md bg-red-50 flex items-center justify-center">
                <FileText className="w-6 h-6 text-red-400" />
                <span className="text-xs text-red-500 ml-1">PDF</span>
              </div>
            ) : (
              <img src={preview} alt={label} className="w-full h-20 object-cover rounded-md border" />
            )}
            <button type="button" onClick={() => handleDocRemove(key)}
              className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => inputRef.current?.click()}
            className="w-full h-20 rounded-md border-2 border-dashed border-slate-200 hover:border-slate-400 transition-colors flex flex-col items-center justify-center gap-1">
            <Upload className="w-4 h-4 text-slate-400" />
            <span className="text-[10px] text-slate-400">Upload</span>
          </button>
        )}
        <input ref={inputRef} type="file" accept={accept} onChange={(e) => handleDocSelect(key, e)} className="hidden" />
        {preview && (
          <button type="button" onClick={() => inputRef.current?.click()} className="text-[10px] text-blue-500 hover:text-blue-700 font-medium">
            Replace
          </button>
        )}
      </div>
    );
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    setMessage({ type: '', text: '' });
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('site_id', siteId);
      Object.entries(form).forEach(([key, val]) => {
        if (val !== null && val !== undefined && val !== '') formData.append(key, val);
      });
      if (photoFile) formData.append('photo', photoFile);
      if (removePhoto) formData.append('remove_photo', 'true');
      Object.entries(docFiles).forEach(([fieldKey, file]) => {
        if (file) formData.append(fieldKey, file);
      });
      Object.entries(removeDocs).forEach(([fieldKey, val]) => {
        if (val) formData.append(`remove_${fieldKey}`, 'true');
      });

      const config = { headers: { 'Content-Type': 'multipart/form-data' } };
      const { data } = await api.put(`/members/${id}`, formData, config);
      setMessage({ type: 'success', text: 'Member updated successfully' });
      setMember(data.member);
      setTimeout(() => setDialogOpen(false), 600);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to save' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete ${member.full_name}? This cannot be undone.`)) return;
    try {
      await api.delete(`/members/${id}`);
      navigate('/clients');
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  // Loading
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!member) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <User className="w-10 h-10 text-slate-200 mb-3" />
        <p className="text-sm text-slate-500">Member not found</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate('/clients')}>
          <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back to Members
        </Button>
      </div>
    );
  }

  const m = member;

  return (
    <div className="max-w-6xl space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/clients')} className="h-8 w-8 p-0">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-xl font-semibold text-slate-900">Member Profile</h1>
        </div>
        {/* Read action — deliberately outside the canManage guard below, since
            view-only users are exactly who needs the ledger. */}
        <Button asChild size="sm" className="shrink-0 gap-1.5 bg-slate-900 text-white hover:bg-slate-800">
          <a href={`/clients/${id}/ledger`} target="_blank" rel="noopener noreferrer">
            <BookOpen className="w-4 h-4" /> Ledger
            <ExternalLink className="w-3 h-3 opacity-60" />
          </a>
        </Button>
      </div>

      {/* Profile Card */}
      <Card className="border-slate-200/80 overflow-hidden shadow-[0_2px_16px_-8px_rgba(30,41,59,0.12)]">
        <div className="h-24 relative overflow-hidden bg-gradient-to-br from-slate-800 via-indigo-900 to-slate-900">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -top-16 right-8 h-40 w-40 rounded-full bg-indigo-400/20 blur-3xl" />
            <div className="absolute -bottom-20 left-24 h-40 w-40 rounded-full bg-sky-300/15 blur-3xl" />
          </div>
          <div className="absolute -bottom-10 left-6">
            <Avatar src={m.photo} name={m.full_name} size="xl" />
          </div>
        </div>
        <CardContent className="pt-14 pb-5 px-6">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-bold text-slate-900">{m.full_name}</h2>
                <TypeBadge type={m.member_type} />
                <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${STATUS_COLORS[m.status] || 'bg-slate-100 text-slate-600'}`}>
                  {m.status}
                </span>
                {m.team && (
                  <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-indigo-100 text-indigo-700">
                    Team {m.team}
                  </span>
                )}
              </div>
              {m.father_name && <p className="text-sm text-slate-500 mt-1">S/O {m.father_name}</p>}
              <div className="flex items-center gap-4 mt-2.5 flex-wrap">
                {m.phone && (
                  <a href={`tel:${m.phone}`} className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-blue-600 transition-colors">
                    <Phone className="w-3.5 h-3.5" /> {m.phone}
                  </a>
                )}
                {m.email && (
                  <a href={`mailto:${m.email}`} className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-blue-600 transition-colors">
                    <Mail className="w-3.5 h-3.5" /> {m.email}
                  </a>
                )}
                {m.city && (
                  <span className="flex items-center gap-1.5 text-xs text-slate-500">
                    <MapPin className="w-3.5 h-3.5" /> {m.city}{m.state ? `, ${m.state}` : ''}
                  </span>
                )}
              </div>
            </div>
            {canManage && (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleOpenEdit} className="text-xs">
                  <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit
                </Button>
                <Button variant="outline" size="sm" onClick={handleDelete} className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50">
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Detail Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Personal */}
        <Card className="border-slate-200/80 shadow-[0_2px_16px_-8px_rgba(30,41,59,0.12)]">
          <CardContent className="p-5">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" /> Personal
            </p>
            <div className="divide-y divide-slate-100">
              <DetailRow icon={User} label="Full Name" value={m.full_name} />
              <DetailRow icon={User} label="Father / Husband" value={m.father_name} />
              <DetailRow icon={User} label="Mother's Name" value={m.mother_name} />
              <DetailRow icon={User} label="Spouse Name" value={m.spouse_name} />
              <DetailRow icon={User} label="Gender" value={m.gender} />
              <DetailRow icon={Calendar} label="Date of Birth" value={fmtDate(m.date_of_birth)} />
              <DetailRow icon={Heart} label="Blood Group" value={m.blood_group} />
              <DetailRow icon={User} label="Marital Status" value={m.marital_status} />
              <DetailRow icon={Calendar} label="Anniversary" value={fmtDate(m.anniversary_date)} />
              <DetailRow icon={GraduationCap} label="Qualification" value={m.qualification} />
              <DetailRow icon={Briefcase} label="Occupation" value={m.occupation} />
              <DetailRow icon={Building2} label="Company" value={m.company_name} />
              <DetailRow icon={Users} label="Team" value={m.team} />
              <DetailRow icon={User} label="Nationality" value={m.nationality} />
              <DetailRow icon={User} label="Religion" value={m.religion} />
              <DetailRow icon={User} label="Caste" value={m.caste} />
            </div>
          </CardContent>
        </Card>

        {/* Contact & Address */}
        <Card className="border-slate-200/80 shadow-[0_2px_16px_-8px_rgba(30,41,59,0.12)]">
          <CardContent className="p-5">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5" /> Contact & Address
            </p>
            <div className="divide-y divide-slate-100">
              <DetailRow icon={Phone} label="Phone" value={m.phone} />
              <DetailRow icon={Phone} label="Alt Phone" value={m.alt_phone} />
              <DetailRow icon={Phone} label="WhatsApp" value={m.whatsapp} />
              <DetailRow icon={Mail} label="Email" value={m.email} />
              <DetailRow icon={MapPin} label="Address" value={m.address} />
              <DetailRow icon={MapPin} label="City / State" value={[m.city, m.state, m.pincode].filter(Boolean).join(', ') || null} />
            </div>
            {(m.emergency_contact_name || m.emergency_contact_phone) && (
              <>
                <Separator className="my-3" />
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Emergency Contact</p>
                <div className="divide-y divide-slate-100">
                  <DetailRow icon={User} label="Name" value={m.emergency_contact_name} />
                  <DetailRow icon={Phone} label="Phone" value={m.emergency_contact_phone} />
                  <DetailRow icon={User} label="Relation" value={m.emergency_contact_relation} />
                </div>
              </>
            )}
            {(m.nominee_name || m.nominee_phone) && (
              <>
                <Separator className="my-3" />
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Nominee</p>
                <div className="divide-y divide-slate-100">
                  <DetailRow icon={User} label="Nominee Name" value={m.nominee_name} />
                  <DetailRow icon={User} label="Relation" value={m.nominee_relation} />
                  <DetailRow icon={Phone} label="Phone" value={m.nominee_phone} />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Identity */}
        <Card className="border-slate-200/80 shadow-[0_2px_16px_-8px_rgba(30,41,59,0.12)]">
          <CardContent className="p-5">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" /> Identity Documents
            </p>
            <div className="divide-y divide-slate-100">
              <DetailRow icon={Hash} label="Aadhar Number" value={m.aadhar_no} mono />
              <DetailRow icon={Hash} label="PAN Number" value={m.pan_no} mono />
              <DetailRow icon={Hash} label="Voter ID" value={m.voter_id} mono />
              <DetailRow icon={Hash} label="Passport No" value={m.passport_no} mono />
              <DetailRow icon={Hash} label="Driving License" value={m.driving_license_no} mono />
              <DetailRow icon={Hash} label="GST Number" value={m.gst_no} mono />
              <DetailRow icon={Hash} label="TIN Number" value={m.tin_no} mono />
            </div>
            {!m.aadhar_no && !m.pan_no && !m.voter_id && !m.passport_no && !m.driving_license_no && (
              <p className="text-xs text-slate-400 text-center py-4">No identity documents added</p>
            )}
          </CardContent>
        </Card>

        {/* Bank */}
        <Card className="border-slate-200/80 shadow-[0_2px_16px_-8px_rgba(30,41,59,0.12)]">
          <CardContent className="p-5">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5" /> Bank Details
            </p>
            <div className="divide-y divide-slate-100">
              <DetailRow icon={Building2} label="Bank Name" value={m.bank_name} />
              <DetailRow icon={Hash} label="Account Number" value={m.account_no} mono />
              <DetailRow icon={Hash} label="IFSC Code" value={m.ifsc_code} mono />
              <DetailRow icon={MapPin} label="Branch" value={m.branch} />
            </div>
            {!m.bank_name && !m.account_no && (
              <p className="text-xs text-slate-400 text-center py-4">No bank details added</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Employee Details */}
      {m.member_type === 'EMPLOYEE' && (m.employee_id || m.designation || m.department || m.date_of_joining || m.salary) && (
        <Card className="border-slate-200/80 shadow-[0_2px_16px_-8px_rgba(30,41,59,0.12)]">
          <CardContent className="p-5">
            <p className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <UserCog className="w-3.5 h-3.5" /> Employee Details
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {m.employee_id && (
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Employee ID</p>
                  <p className="text-sm font-medium text-slate-700 mt-1 font-mono">{m.employee_id}</p>
                </div>
              )}
              {m.designation && (
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Designation</p>
                  <p className="text-sm font-medium text-slate-700 mt-1">{m.designation}</p>
                </div>
              )}
              {m.department && (
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Department</p>
                  <p className="text-sm font-medium text-slate-700 mt-1">{m.department}</p>
                </div>
              )}
              {m.date_of_joining && (
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Date of Joining</p>
                  <p className="text-sm font-medium text-slate-700 mt-1">{fmtDate(m.date_of_joining)}</p>
                </div>
              )}
              {m.salary && (
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Salary</p>
                  <p className="text-sm font-medium text-slate-700 mt-1">₹{Number(m.salary).toLocaleString('en-IN')}</p>
                </div>
              )}
              {m.employment_type && (
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Employment Type</p>
                  <p className="text-sm font-medium text-slate-700 mt-1">{m.employment_type}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* KYC Documents */}
      {(() => {
        const kycDocs = KYC_DOC_FIELDS.filter(d => m[d.key]);
        if (kycDocs.length === 0) return null;
        return (
          <Card className="border-slate-200/80 shadow-[0_2px_16px_-8px_rgba(30,41,59,0.12)]">
            <CardContent className="p-5">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <FileCheck className="w-3.5 h-3.5" /> KYC Documents
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {kycDocs.map(doc => (
                  <a key={doc.key} href={m[doc.key]} target="_blank" rel="noopener noreferrer"
                    className="border border-slate-200 rounded-lg p-2 hover:border-blue-300 hover:shadow-sm transition-all group">
                    {m[doc.key]?.endsWith('.pdf') ? (
                      <div className="w-full h-24 rounded-md bg-red-50 flex items-center justify-center">
                        <FileText className="w-8 h-8 text-red-400" />
                      </div>
                    ) : (
                      <img src={m[doc.key]} alt={doc.label} className="w-full h-24 object-cover rounded-md" />
                    )}
                    <p className="text-[10px] font-medium text-slate-600 mt-2 text-center group-hover:text-blue-600">{doc.label}</p>
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Employee Documents */}
      {m.member_type === 'EMPLOYEE' && (() => {
        const empDocs = EMPLOYEE_DOC_FIELDS.filter(d => m[d.key]);
        if (empDocs.length === 0) return null;
        return (
          <Card className="border-slate-200/80 shadow-[0_2px_16px_-8px_rgba(30,41,59,0.12)]">
            <CardContent className="p-5">
              <p className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5" /> Employee Documents
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {empDocs.map(doc => (
                  <a key={doc.key} href={m[doc.key]} target="_blank" rel="noopener noreferrer"
                    className="border border-slate-200 rounded-lg p-2 hover:border-indigo-300 hover:shadow-sm transition-all group">
                    {m[doc.key]?.endsWith('.pdf') ? (
                      <div className="w-full h-24 rounded-md bg-red-50 flex items-center justify-center">
                        <FileText className="w-8 h-8 text-red-400" />
                      </div>
                    ) : (
                      <img src={m[doc.key]} alt={doc.label} className="w-full h-24 object-cover rounded-md" />
                    )}
                    <p className="text-[10px] font-medium text-slate-600 mt-2 text-center group-hover:text-indigo-600">{doc.label}</p>
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Notes & Meta */}
      {(m.reference || m.notes || m.created_at) && (
        <Card className="border-slate-200/80 shadow-[0_2px_16px_-8px_rgba(30,41,59,0.12)]">
          <CardContent className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {m.reference && (
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Reference</p>
                  <p className="text-sm font-medium text-slate-700 mt-1">{m.reference}</p>
                </div>
              )}
              {m.notes && (
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Notes</p>
                  <p className="text-sm text-slate-600 mt-1">{m.notes}</p>
                </div>
              )}
              {m.created_at && (
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Registered On</p>
                  <p className="text-sm text-slate-600 mt-1">{fmtDate(m.created_at)}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Financial Info */}
      <Card className="border-slate-200/80 shadow-[0_2px_16px_-8px_rgba(30,41,59,0.12)] overflow-hidden">
        <CardContent className="p-0">
          {/* Header */}
          <div className="px-5 pt-5 pb-3">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5" /> Financial Overview
            </p>
          </div>

          {finLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : !finData ? (
            <p className="text-xs text-slate-400 text-center py-8 pb-5">Failed to load financial info</p>
          ) : (
            <>
              {/* Summary cards */}
              <div className="px-5 grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3">
                {[
                  { key: 'expenses', label: 'Expenses', icon: Receipt, count: finData.summary.expenses.count, amount: finData.summary.expenses.debit || finData.summary.expenses.credit, activeBg: 'bg-orange-50 border-orange-300 ring-1 ring-orange-200', iconCls: 'text-orange-500' },
                  { key: 'commissions', label: 'Commissions', icon: TrendingUp, count: finData.summary.commissions.count, amount: finData.summary.commissions.total, activeBg: 'bg-blue-50 border-blue-300 ring-1 ring-blue-200', iconCls: 'text-blue-500' },
                  { key: 'plot_payments', label: 'Plot Payments', icon: Landmark, count: finData.summary.plot_payments.count, amount: finData.summary.plot_payments.total, activeBg: 'bg-emerald-50 border-emerald-300 ring-1 ring-emerald-200', iconCls: 'text-emerald-500' },
                  { key: 'farmer_payments', label: 'Farmer Pay', icon: Tractor, count: finData.summary.farmer_payments.count, amount: finData.summary.farmer_payments.total, activeBg: 'bg-amber-50 border-amber-300 ring-1 ring-amber-200', iconCls: 'text-amber-500' },
                  { key: 'firm_transactions', label: 'Firm Txns', icon: Building2, count: finData.summary.firm_transactions.count, amount: finData.summary.firm_transactions.debit || finData.summary.firm_transactions.credit, activeBg: 'bg-violet-50 border-violet-300 ring-1 ring-violet-200', iconCls: 'text-violet-500' },
                ].map(({ key, label, icon: Ic, count, amount, activeBg, iconCls }) => (
                  <button
                    key={key}
                    onClick={() => setFinTab(key)}
                    className={`p-2.5 rounded-lg border text-left transition-all ${
                      finTab === key ? activeBg : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <Ic className={`w-3 h-3 ${iconCls}`} />
                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{label}</span>
                    </div>
                    <p className="text-sm font-bold text-slate-800 tabular-nums">{fmtCur(amount)}</p>
                    <p className="text-[10px] text-slate-400">{count} entr{count === 1 ? 'y' : 'ies'}</p>
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="px-5 pb-5">
                {/* Expenses tab */}
                {finTab === 'expenses' && (
                  finData.expenses.length === 0
                    ? <p className="text-xs text-slate-400 text-center py-6">No expenses found</p>
                    : <div className="border rounded-lg overflow-hidden">
                        <div className="max-h-[350px] overflow-y-auto">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-slate-50/80">
                                <TableHead className="text-[10px] font-semibold w-[80px]">Date</TableHead>
                                <TableHead className="text-[10px] font-semibold">Category</TableHead>
                                <TableHead className="text-[10px] font-semibold">From → To</TableHead>
                                <TableHead className="text-[10px] font-semibold">Mode</TableHead>
                                <TableHead className="text-[10px] font-semibold">Remark</TableHead>
                                <TableHead className="text-[10px] font-semibold text-right">Debit</TableHead>
                                <TableHead className="text-[10px] font-semibold text-right">Credit</TableHead>
                                <TableHead className="text-[10px] font-semibold text-center">Status</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {finData.expenses.map(e => (
                                <TableRow key={e.id} className="hover:bg-slate-50/50">
                                  <TableCell className="text-[11px] text-slate-600 tabular-nums py-2">{fmtDate(e.date)}</TableCell>
                                  <TableCell className="text-[11px] text-slate-700 py-2">{e.category || '—'}</TableCell>
                                  <TableCell className="text-[11px] text-slate-600 py-2 max-w-[150px] truncate">{e.from_entity} → {e.to_entity}</TableCell>
                                  <TableCell className="text-[11px] text-slate-500 py-2">{e.payment_mode || '—'}</TableCell>
                                  <TableCell className="text-[11px] text-slate-500 py-2 max-w-[120px] truncate">{e.remark || '—'}</TableCell>
                                  <TableCell className="text-[11px] text-right tabular-nums py-2 font-medium text-red-600">
                                    {parseFloat(e.debit) > 0 ? fmtCur(e.debit) : ''}
                                  </TableCell>
                                  <TableCell className="text-[11px] text-right tabular-nums py-2 font-medium text-emerald-600">
                                    {parseFloat(e.credit) > 0 ? fmtCur(e.credit) : ''}
                                  </TableCell>
                                  <TableCell className="text-center py-2">
                                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${
                                      e.status === 'approved' ? 'bg-emerald-50 text-emerald-600' :
                                      e.status === 'rejected' ? 'bg-red-50 text-red-600' :
                                      'bg-amber-50 text-amber-600'
                                    }`}>{e.status}</span>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                )}

                {/* Commissions tab */}
                {finTab === 'commissions' && (
                  finData.commissions.length === 0
                    ? <p className="text-xs text-slate-400 text-center py-6">No commissions found</p>
                    : <div className="border rounded-lg overflow-hidden">
                        <div className="max-h-[350px] overflow-y-auto">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-slate-50/80">
                                <TableHead className="text-[10px] font-semibold w-[80px]">Date</TableHead>
                                <TableHead className="text-[10px] font-semibold">Plot</TableHead>
                                <TableHead className="text-[10px] font-semibold">Particular</TableHead>
                                <TableHead className="text-[10px] font-semibold">By Note</TableHead>
                                <TableHead className="text-[10px] font-semibold">Remarks</TableHead>
                                <TableHead className="text-[10px] font-semibold text-right">Amount</TableHead>
                                <TableHead className="text-[10px] font-semibold text-center">Status</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {finData.commissions.map(c => (
                                <TableRow key={c.id} className="hover:bg-slate-50/50">
                                  <TableCell className="text-[11px] text-slate-600 tabular-nums py-2">{fmtDate(c.date)}</TableCell>
                                  <TableCell className="text-[11px] text-slate-700 py-2 font-medium">{c.plot_no || '—'}</TableCell>
                                  <TableCell className="text-[11px] text-slate-600 py-2">{c.particular}</TableCell>
                                  <TableCell className="text-[11px] text-slate-500 py-2">{c.by_note || '—'}</TableCell>
                                  <TableCell className="text-[11px] text-slate-500 py-2 max-w-[120px] truncate">{c.remarks || '—'}</TableCell>
                                  <TableCell className="text-[11px] text-right tabular-nums py-2 font-medium text-blue-600">{fmtCur(c.amount)}</TableCell>
                                  <TableCell className="text-center py-2">
                                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${
                                      c.status === 'approved' ? 'bg-emerald-50 text-emerald-600' :
                                      c.status === 'rejected' ? 'bg-red-50 text-red-600' :
                                      'bg-amber-50 text-amber-600'
                                    }`}>{c.status || 'pending'}</span>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                )}

                {/* Plot Payments tab */}
                {finTab === 'plot_payments' && (
                  finData.plot_payments.length === 0
                    ? <p className="text-xs text-slate-400 text-center py-6">No plot payments found</p>
                    : <div className="border rounded-lg overflow-hidden">
                        <div className="max-h-[350px] overflow-y-auto">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-slate-50/80">
                                <TableHead className="text-[10px] font-semibold w-[80px]">Date</TableHead>
                                <TableHead className="text-[10px] font-semibold">Plot</TableHead>
                                <TableHead className="text-[10px] font-semibold">From</TableHead>
                                <TableHead className="text-[10px] font-semibold">Type</TableHead>
                                <TableHead className="text-[10px] font-semibold">Bank Details</TableHead>
                                <TableHead className="text-[10px] font-semibold">Narration</TableHead>
                                <TableHead className="text-[10px] font-semibold text-right">Amount</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {finData.plot_payments.map(p => (
                                <TableRow key={p.id} className="hover:bg-slate-50/50">
                                  <TableCell className="text-[11px] text-slate-600 tabular-nums py-2">{fmtDate(p.date)}</TableCell>
                                  <TableCell className="text-[11px] text-slate-700 py-2 font-medium">{p.plot_no}{p.block ? ` (${p.block})` : ''}</TableCell>
                                  <TableCell className="text-[11px] text-slate-600 py-2">{p.payment_from || '—'}</TableCell>
                                  <TableCell className="text-[11px] text-slate-500 py-2">
                                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${
                                      p.payment_type === 'BANK' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'
                                    }`}>{p.payment_type}</span>
                                  </TableCell>
                                  <TableCell className="text-[11px] text-slate-500 py-2 max-w-[120px] truncate">{p.bank_details || '—'}</TableCell>
                                  <TableCell className="text-[11px] text-slate-500 py-2 max-w-[120px] truncate">{p.narration || '—'}</TableCell>
                                  <TableCell className="text-[11px] text-right tabular-nums py-2 font-medium text-emerald-600">{fmtCur(p.amount)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                )}

                {/* Farmer Payments tab */}
                {finTab === 'farmer_payments' && (
                  finData.farmer_payments.length === 0
                    ? <p className="text-xs text-slate-400 text-center py-6">No farmer payments found</p>
                    : <div className="border rounded-lg overflow-hidden">
                        <div className="max-h-[350px] overflow-y-auto">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-slate-50/80">
                                <TableHead className="text-[10px] font-semibold w-[80px]">Date</TableHead>
                                <TableHead className="text-[10px] font-semibold">Farmer</TableHead>
                                <TableHead className="text-[10px] font-semibold">Particular</TableHead>
                                <TableHead className="text-[10px] font-semibold">Mode</TableHead>
                                <TableHead className="text-[10px] font-semibold">By Note</TableHead>
                                <TableHead className="text-[10px] font-semibold">Remarks</TableHead>
                                <TableHead className="text-[10px] font-semibold text-right">Amount</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {finData.farmer_payments.map(fp => (
                                <TableRow key={fp.id} className="hover:bg-slate-50/50">
                                  <TableCell className="text-[11px] text-slate-600 tabular-nums py-2">{fmtDate(fp.date)}</TableCell>
                                  <TableCell className="text-[11px] text-slate-700 py-2 font-medium">{fp.farmer_name || '—'}</TableCell>
                                  <TableCell className="text-[11px] text-slate-600 py-2">{fp.particular || '—'}</TableCell>
                                  <TableCell className="text-[11px] text-slate-500 py-2">
                                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${
                                      fp.payment_mode === 'BANK' ? 'bg-blue-50 text-blue-600' :
                                      fp.payment_mode === 'SPLIT' ? 'bg-purple-50 text-purple-600' :
                                      'bg-emerald-50 text-emerald-600'
                                    }`}>{fp.payment_mode}</span>
                                  </TableCell>
                                  <TableCell className="text-[11px] text-slate-500 py-2">{fp.by_note || '—'}</TableCell>
                                  <TableCell className="text-[11px] text-slate-500 py-2 max-w-[120px] truncate">{fp.remarks || '—'}</TableCell>
                                  <TableCell className="text-[11px] text-right tabular-nums py-2 font-medium text-amber-600">{fmtCur(fp.amount)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                )}

                {/* Firm Transactions tab */}
                {finTab === 'firm_transactions' && (
                  finData.firm_transactions.length === 0
                    ? <p className="text-xs text-slate-400 text-center py-6">No firm transactions found</p>
                    : <div className="border rounded-lg overflow-hidden">
                        <div className="max-h-[350px] overflow-y-auto">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-slate-50/80">
                                <TableHead className="text-[10px] font-semibold w-[80px]">Date</TableHead>
                                <TableHead className="text-[10px] font-semibold">Firm</TableHead>
                                <TableHead className="text-[10px] font-semibold">Name</TableHead>
                                <TableHead className="text-[10px] font-semibold">Purpose</TableHead>
                                <TableHead className="text-[10px] font-semibold">Remark</TableHead>
                                <TableHead className="text-[10px] font-semibold text-right">Debit</TableHead>
                                <TableHead className="text-[10px] font-semibold text-right">Credit</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {finData.firm_transactions.map(ft => (
                                <TableRow key={ft.id} className="hover:bg-slate-50/50">
                                  <TableCell className="text-[11px] text-slate-600 tabular-nums py-2">{fmtDate(ft.date)}</TableCell>
                                  <TableCell className="text-[11px] text-slate-700 py-2 font-medium">{ft.firm_name || '—'}</TableCell>
                                  <TableCell className="text-[11px] text-slate-600 py-2">{ft.name || '—'}</TableCell>
                                  <TableCell className="text-[11px] text-slate-500 py-2">{ft.purpose || '—'}</TableCell>
                                  <TableCell className="text-[11px] text-slate-500 py-2 max-w-[120px] truncate">{ft.remark || '—'}</TableCell>
                                  <TableCell className="text-[11px] text-right tabular-nums py-2 font-medium text-red-600">
                                    {parseFloat(ft.debit) > 0 ? fmtCur(ft.debit) : ''}
                                  </TableCell>
                                  <TableCell className="text-[11px] text-right tabular-nums py-2 font-medium text-emerald-600">
                                    {parseFloat(ft.credit) > 0 ? fmtCur(ft.credit) : ''}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Transactions */}
      <Card className="border-slate-200/80 shadow-[0_2px_16px_-8px_rgba(30,41,59,0.12)]">
        <CardContent className="p-5">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <IndianRupee className="w-3.5 h-3.5" /> All Transactions
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="p-3 rounded-lg bg-red-50 border border-red-100">
              <p className="text-[10px] text-red-500 font-semibold uppercase">Total Debit</p>
              <p className="text-lg font-bold text-red-700 tabular-nums mt-0.5">
                ₹{Number(memberTxnSummary.total_debit).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-100">
              <p className="text-[10px] text-emerald-500 font-semibold uppercase">Total Credit</p>
              <p className="text-lg font-bold text-emerald-700 tabular-nums mt-0.5">
                ₹{Number(memberTxnSummary.total_credit).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className={`p-3 rounded-lg border ${memberTxnSummary.net >= 0 ? 'bg-emerald-50/50 border-emerald-100' : 'bg-red-50/50 border-red-100'}`}>
              <p className="text-[10px] text-slate-500 font-semibold uppercase">Net Balance</p>
              <p className={`text-lg font-bold tabular-nums mt-0.5 ${memberTxnSummary.net >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                ₹{Math.abs(Number(memberTxnSummary.net)).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                <span className="text-[10px] font-medium ml-1">{memberTxnSummary.net >= 0 ? 'CR' : 'DR'}</span>
              </p>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <p className="text-[10px] text-slate-500 font-semibold uppercase">Entries</p>
              <p className="text-lg font-bold text-slate-700 tabular-nums mt-0.5">{memberTxnSummary.count}</p>
            </div>
          </div>

          {txnLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : memberTxns.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-8">No transactions found for this member</p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <div className="max-h-[400px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80">
                      <TableHead className="text-[10px] font-semibold w-[80px]">Date</TableHead>
                      <TableHead className="text-[10px] font-semibold">Type</TableHead>
                      <TableHead className="text-[10px] font-semibold">From → To</TableHead>
                      <TableHead className="text-[10px] font-semibold">Mode</TableHead>
                      <TableHead className="text-[10px] font-semibold">Remark</TableHead>
                      <TableHead className="text-[10px] font-semibold text-right">Debit</TableHead>
                      <TableHead className="text-[10px] font-semibold text-right">Credit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {memberTxns.map((t) => (
                      <TableRow key={`${t.source}-${t.id}`} className="hover:bg-slate-50/50">
                        <TableCell className="text-[11px] text-slate-600 tabular-nums py-2">{fmtDate(t.date)}</TableCell>
                        <TableCell className="py-2">
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold uppercase whitespace-nowrap ${TXN_SOURCE_TONE[t.source] || TXN_SOURCE_TONE.DAYBOOK}`}>
                            {t.entry_type || t.source}
                          </span>
                          {/* Plot payments reach this member by name (booked_by /
                              buyer_name / received_by), so name the plot too. */}
                          {t.source === 'PLOT PAYMENT' && t.plot_no && (
                            <span className="ml-1 text-[9px] font-medium text-slate-400">{t.plot_no}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-[11px] text-slate-700 py-2 max-w-[160px] truncate">
                          {t.from_entity && t.to_entity ? `${t.from_entity} → ${t.to_entity}` :
                           t.from_entity || t.to_entity || '—'}
                        </TableCell>
                        <TableCell className="text-[11px] text-slate-500 py-2">{t.payment_mode || '—'}</TableCell>
                        <TableCell className="text-[11px] text-slate-500 py-2 max-w-[140px] truncate">{t.remark || '—'}</TableCell>
                        <TableCell className="text-[11px] text-right tabular-nums py-2 font-medium text-red-600">
                          {parseFloat(t.debit) > 0 ? `₹${Number(t.debit).toLocaleString('en-IN')}` : ''}
                        </TableCell>
                        <TableCell className="text-[11px] text-right tabular-nums py-2 font-medium text-emerald-600">
                          {parseFloat(t.credit) > 0 ? `₹${Number(t.credit).toLocaleString('en-IN')}` : ''}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">Edit Member</DialogTitle>
            <DialogDescription className="text-sm">Update member details, documents and KYC.</DialogDescription>
          </DialogHeader>

          {message.text && (
            <div className={`flex gap-2 p-3 rounded-lg text-sm ${
              message.type === 'success' ? 'bg-emerald-50 border border-emerald-100 text-emerald-700'
                : 'bg-red-50 border border-red-100 text-red-700'
            }`}>
              {message.type === 'success' ? <Check className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
              {message.text}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Photo + Type */}
            <div className="flex items-start gap-5">
              <div className="flex flex-col items-center gap-2">
                <div className="relative group">
                  {photoPreview ? (
                    <img src={photoPreview} alt="Preview" className="w-24 h-24 rounded-xl object-cover border-2 border-slate-200 shadow-sm" />
                  ) : (
                    <div className="w-24 h-24 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 border-2 border-dashed border-slate-300 flex items-center justify-center">
                      <Camera className="w-6 h-6 text-slate-400" />
                    </div>
                  )}
                  <input type="file" ref={fileInputRef} accept="image/jpeg,image/png,image/jpg" onChange={handlePhotoSelect} className="hidden" />
                  <button type="button" onClick={() => fileInputRef.current?.click()}
                    className="absolute inset-0 rounded-xl bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <Camera className="w-5 h-5 text-white" />
                  </button>
                </div>
                {photoPreview && (
                  <button type="button" onClick={handleClearPhoto} className="text-[10px] text-red-500 hover:text-red-700 font-medium">Remove Photo</button>
                )}
              </div>
              <div className="flex-1 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Member Type</Label>
                    <Select value={form.member_type} onValueChange={(v) => setForm({ ...form, member_type: v })}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {MEMBER_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Status</Label>
                    <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Full Name</Label>
                    <Input placeholder="RAJESH KUMAR" value={form.full_name}
                      onChange={(e) => setForm({ ...form, full_name: e.target.value.toUpperCase() })} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Father / Husband Name</Label>
                    <Input placeholder="S/O RAMESH KUMAR" value={form.father_name}
                      onChange={(e) => setForm({ ...form, father_name: e.target.value.toUpperCase() })} />
                  </div>
                </div>
                {['BROKER', 'MEMBER', 'EMPLOYEE', 'PARTNER'].includes(form.member_type) && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" /> Team
                      </Label>
                      <Input placeholder="TEAM A, TEAM B..." value={form.team}
                        onChange={(e) => setForm({ ...form, team: e.target.value.toUpperCase() })} />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Personal */}
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" /> Personal Details
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Gender</Label>
                  <Select value={form.gender || 'none'} onValueChange={(v) => setForm({ ...form, gender: v === 'none' ? '' : v })}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not Specified</SelectItem>
                      {GENDER_OPTIONS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Date of Birth</Label>
                  <Input type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Blood Group</Label>
                  <Select value={form.blood_group || 'none'} onValueChange={(v) => setForm({ ...form, blood_group: v === 'none' ? '' : v })}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not Specified</SelectItem>
                      {BLOOD_OPTIONS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Marital Status</Label>
                  <Select value={form.marital_status || 'none'} onValueChange={(v) => setForm({ ...form, marital_status: v === 'none' ? '' : v })}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not Specified</SelectItem>
                      {MARITAL_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Mother's Name</Label>
                  <Input placeholder="MOTHER NAME" value={form.mother_name} onChange={(e) => setForm({ ...form, mother_name: e.target.value.toUpperCase() })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Spouse Name</Label>
                  <Input placeholder="SPOUSE NAME" value={form.spouse_name} onChange={(e) => setForm({ ...form, spouse_name: e.target.value.toUpperCase() })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Anniversary</Label>
                  <Input type="date" value={form.anniversary_date} onChange={(e) => setForm({ ...form, anniversary_date: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Qualification</Label>
                  <Input placeholder="B.TECH, MBA..." value={form.qualification} onChange={(e) => setForm({ ...form, qualification: e.target.value.toUpperCase() })} />
                </div>
              </div>
            </div>

            <Separator />

            {/* Contact */}
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" /> Contact Details
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Phone</Label>
                  <Input placeholder="9876543210" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Alt Phone</Label>
                  <Input placeholder="Alternate" value={form.alt_phone} onChange={(e) => setForm({ ...form, alt_phone: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">WhatsApp</Label>
                  <Input placeholder="WhatsApp" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Email</Label>
                  <Input type="email" placeholder="email@example.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value.toLowerCase() })} />
                </div>
              </div>
            </div>

            <Separator />

            {/* Address */}
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" /> Address
              </p>
              <div className="space-y-3">
                <Textarea placeholder="House No, Street, Locality..." value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} />
                <div className="grid grid-cols-3 gap-3">
                  <Input placeholder="CITY" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value.toUpperCase() })} />
                  <Input placeholder="STATE" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })} />
                  <Input placeholder="PINCODE" value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} />
                </div>
              </div>
            </div>

            <Separator />

            {/* Identity */}
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" /> Identity Documents
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Input placeholder="Aadhar Number" value={form.aadhar_no} onChange={(e) => setForm({ ...form, aadhar_no: e.target.value })} />
                <Input placeholder="PAN Number" value={form.pan_no} onChange={(e) => setForm({ ...form, pan_no: e.target.value.toUpperCase() })} />
                <Input placeholder="Voter ID" value={form.voter_id} onChange={(e) => setForm({ ...form, voter_id: e.target.value.toUpperCase() })} />
                <Input placeholder="Passport No" value={form.passport_no} onChange={(e) => setForm({ ...form, passport_no: e.target.value.toUpperCase() })} />
                <Input placeholder="DL Number" value={form.driving_license_no} onChange={(e) => setForm({ ...form, driving_license_no: e.target.value.toUpperCase() })} />
                <Input placeholder="GST Number" value={form.gst_no} onChange={(e) => setForm({ ...form, gst_no: e.target.value.toUpperCase() })} />
              </div>
            </div>

            <Separator />

            {/* KYC Uploads */}
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <FileCheck className="w-3.5 h-3.5" /> KYC Document Photos
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {KYC_DOC_FIELDS.map(doc => <DocUploadCard key={doc.key} fieldDef={doc} />)}
              </div>
            </div>

            <Separator />

            {/* Bank */}
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5" /> Bank Details
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Input placeholder="Bank Name" value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value.toUpperCase() })} />
                <Input placeholder="Account No" value={form.account_no} onChange={(e) => setForm({ ...form, account_no: e.target.value })} />
                <Input placeholder="IFSC Code" value={form.ifsc_code} onChange={(e) => setForm({ ...form, ifsc_code: e.target.value.toUpperCase() })} />
                <Input placeholder="Branch" value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value.toUpperCase() })} />
              </div>
            </div>

            <Separator />

            {/* Emergency Contact */}
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" /> Emergency Contact
              </p>
              <div className="grid grid-cols-3 gap-3">
                <Input placeholder="Contact Name" value={form.emergency_contact_name} onChange={(e) => setForm({ ...form, emergency_contact_name: e.target.value.toUpperCase() })} />
                <Input placeholder="Phone" value={form.emergency_contact_phone} onChange={(e) => setForm({ ...form, emergency_contact_phone: e.target.value })} />
                <Input placeholder="Relation" value={form.emergency_contact_relation} onChange={(e) => setForm({ ...form, emergency_contact_relation: e.target.value.toUpperCase() })} />
              </div>
            </div>

            <Separator />

            {/* Nominee */}
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Contact className="w-3.5 h-3.5" /> Nominee
              </p>
              <div className="grid grid-cols-3 gap-3">
                <Input placeholder="Nominee Name" value={form.nominee_name} onChange={(e) => setForm({ ...form, nominee_name: e.target.value.toUpperCase() })} />
                <Input placeholder="Relation" value={form.nominee_relation} onChange={(e) => setForm({ ...form, nominee_relation: e.target.value.toUpperCase() })} />
                <Input placeholder="Phone" value={form.nominee_phone} onChange={(e) => setForm({ ...form, nominee_phone: e.target.value })} />
              </div>
            </div>

            {/* Employee Section */}
            {form.member_type === 'EMPLOYEE' && (
              <>
                <Separator />
                <div>
                  <p className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <UserCog className="w-3.5 h-3.5" /> Employee Details
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <Input placeholder="Employee ID" value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value.toUpperCase() })} />
                    <Input placeholder="Designation" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value.toUpperCase() })} />
                    <Input placeholder="Department" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value.toUpperCase() })} />
                    <Input type="date" value={form.date_of_joining} onChange={(e) => setForm({ ...form, date_of_joining: e.target.value })} />
                    <Input type="number" placeholder="Salary" value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} />
                    <Select value={form.employment_type || 'none'} onValueChange={(v) => setForm({ ...form, employment_type: v === 'none' ? '' : v })}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Type" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Not Specified</SelectItem>
                        {EMPLOYMENT_TYPE_OPTIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Separator />
                <div>
                  <p className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <GraduationCap className="w-3.5 h-3.5" /> Employee Documents
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {EMPLOYEE_DOC_FIELDS.map(doc => <DocUploadCard key={doc.key} fieldDef={doc} />)}
                  </div>
                </div>
              </>
            )}

            <Separator />

            {/* Additional */}
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5" /> Additional Info
              </p>
              <div className="grid grid-cols-3 gap-3">
                <Input placeholder="Company / Firm" value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value.toUpperCase() })} />
                <Input placeholder="Reference" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value.toUpperCase() })} />
                <Input placeholder="TIN Number" value={form.tin_no} onChange={(e) => setForm({ ...form, tin_no: e.target.value.toUpperCase() })} />
              </div>
              <div className="mt-3">
                <Textarea placeholder="Notes / Remarks..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setDialogOpen(false)} disabled={submitting}>Cancel</Button>
              <Button type="submit" size="sm" disabled={submitting}>
                {submitting ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Updating...</> : 'Update Member'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientDetail;
