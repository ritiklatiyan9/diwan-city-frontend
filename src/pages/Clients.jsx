import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Separator } from '../components/ui/separator';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '../components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import {
  Building2, Plus, Search, Edit2, Trash2, ArrowLeft, Download,
  Eye, Phone, Mail, MapPin, User, Users, Camera, X, Check,
  AlertCircle, Loader2, Calendar, CreditCard, Briefcase,
  Shield, Hash, Heart, UserCheck, Tractor, Handshake,
  Store, HelpCircle, FileText, Upload, Trash, GraduationCap,
  BadgeCheck, UserCog, Clock, IndianRupee, Contact, FileCheck, ArrowUpDown
} from 'lucide-react';
import * as XLSX from 'xlsx';

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

const STATUS_COLORS = {
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  INACTIVE: 'bg-slate-100 text-slate-600',
  BLOCKED: 'bg-red-100 text-red-700',
};

const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

// ── Avatar (outside component to avoid remount) ──
const Avatar = ({ src, name, size = 'md' }) => {
  const sizes = { sm: 'w-8 h-8 text-xs', md: 'w-12 h-12 text-sm', lg: 'w-20 h-20 text-xl', xl: 'w-28 h-28 text-3xl' };
  const initials = (name || '??').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  if (src) {
    return <img src={src} alt={name} className={`${sizes[size]} rounded-full object-cover ring-2 ring-white shadow-sm`} />;
  }
  return (
    <div className={`${sizes[size]} rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-white flex items-center justify-center font-bold ring-2 ring-white shadow-sm`}>
      {initials}
    </div>
  );
};

// ── Type badge (outside component to avoid remount) ──
const TypeBadge = ({ type }) => {
  const t = MEMBER_TYPES.find(mt => mt.value === type) || MEMBER_TYPES[6];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full ${t.color}`}>
      <t.icon className="w-3 h-3" />
      {t.label}
    </span>
  );
};

/** Check if a member has incomplete KYC */
const isKycIncomplete = (m) => {
  const hasContact = m.phone || m.email;
  const hasAddress = m.address || m.city;
  const hasIdentity = m.aadhar_no || m.pan_no || m.voter_id || m.passport_no || m.driving_license_no;
  const hasKycPhoto = m.aadhar_front_url || m.aadhar_back_url || m.pan_card_url || m.voter_id_url || m.passport_url || m.driving_license_url || m.cheque_url || m.other_kyc_url;
  return !hasContact || !hasAddress || !hasIdentity || !hasKycPhoto;
};

const EMPTY_FORM = {
  member_type: 'CLIENT', full_name: '', father_name: '', gender: '', date_of_birth: '',
  blood_group: '', phone: '', alt_phone: '', email: '', whatsapp: '',
  address: '', city: '', state: '', pincode: '',
  aadhar_no: '', pan_no: '', voter_id: '',
  bank_name: '', account_no: '', ifsc_code: '', branch: '',
  occupation: '', company_name: '', reference: '', notes: '', status: 'ACTIVE',
  // New personal
  mother_name: '', spouse_name: '', nationality: '', religion: '', caste: '',
  marital_status: '', anniversary_date: '', qualification: '',
  // Additional identity
  passport_no: '', driving_license_no: '', gst_no: '', tin_no: '',
  // Emergency contact
  emergency_contact_name: '', emergency_contact_phone: '', emergency_contact_relation: '',
  // Nominee
  nominee_name: '', nominee_relation: '', nominee_phone: '',
  // Employee-specific
  employee_id: '', designation: '', department: '', date_of_joining: '', salary: '', employment_type: '',
  // Team (for broker/member/employee/partner)
  team: '',
};

// KYC document definitions
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

// Employee document definitions (shown only when member_type is EMPLOYEE)
const EMPLOYEE_DOC_FIELDS = [
  { key: 'resume_url', label: 'Resume / CV', accept: 'image/jpeg,image/png,image/jpg,application/pdf' },
  { key: 'marksheet_10th_url', label: '10th Marksheet', accept: 'image/jpeg,image/png,image/jpg,application/pdf' },
  { key: 'marksheet_12th_url', label: '12th Marksheet', accept: 'image/jpeg,image/png,image/jpg,application/pdf' },
  { key: 'degree_certificate_url', label: 'Degree / Diploma Certificate', accept: 'image/jpeg,image/png,image/jpg,application/pdf' },
  { key: 'experience_certificate_url', label: 'Experience Certificate', accept: 'image/jpeg,image/png,image/jpg,application/pdf' },
  { key: 'offer_letter_url', label: 'Offer Letter', accept: 'image/jpeg,image/png,image/jpg,application/pdf' },
  { key: 'other_certificate_url', label: 'Other Certificate', accept: 'image/jpeg,image/png,image/jpg,application/pdf' },
];

export const Clients = () => {
  const { currentSite, isAdmin, canManage, hasPermission } = useAuth();
  const canWrite  = canManage && hasPermission('clients', 'write');
  const canUpdate = canManage && hasPermission('clients', 'update');
  const canDelete = canManage && hasPermission('clients', 'delete');
  const navigate = useNavigate();
  const location = useLocation();
  const siteId = currentSite?.id;

  // ── State ──
  const [members, setMembers] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(false);
  const [autocomplete, setAutocomplete] = useState({ cities: [], occupations: [], companies: [], references: [] });
  const [message, setMessage] = useState({ type: '', text: '' });
  const [submitting, setSubmitting] = useState(false);

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const fileInputRef = useRef(null);
  // KYC & Employee document files
  const [docFiles, setDocFiles] = useState({});        // { field_key: File }
  const [docPreviews, setDocPreviews] = useState({});   // { field_key: url_string }
  const [removeDocs, setRemoveDocs] = useState({});     // { field_key: true }

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [sortOrder, setSortOrder] = useState('desc');

  useEffect(() => {
    const queryFromUrl = new URLSearchParams(location.search).get('q') || '';
    setSearchQuery(queryFromUrl);
  }, [location.search]);

  // ── Fetchers ──
  // Refresh members list only (used after create/update/delete). Does NOT toggle the
  // page-wide loader, so the table stays interactive while the latest data loads.
  const refreshMembers = useCallback(async () => {
    if (!siteId) return;
    try {
      const memRes = await api.get('/members', { params: { site_id: siteId } });
      setMembers(memRes.data.members || []);
      setSummary(memRes.data.summary || {});
    } catch (err) {
      console.error('Failed to refresh members:', err);
    }
  }, [siteId]);

  // Initial load (members + autocomplete). Autocomplete is fetched once per site;
  // it does not need to be refreshed after every form submit.
  const loadInitial = useCallback(async () => {
    if (!siteId) return;
    setLoading(true);
    // Safety watchdog — never let the loader hang past 15s if a request silently stalls
    const watchdog = setTimeout(() => setLoading(false), 15000);
    try {
      const [memRes, acRes] = await Promise.all([
        api.get('/members', { params: { site_id: siteId } }),
        api.get('/members/autocomplete', { params: { site_id: siteId } }),
      ]);
      setMembers(memRes.data.members || []);
      setSummary(memRes.data.summary || {});
      setAutocomplete(acRes.data || { cities: [], occupations: [], companies: [], references: [] });
    } catch (err) {
      console.error('Failed to fetch members:', err);
    } finally {
      clearTimeout(watchdog);
      setLoading(false);
    }
  }, [siteId]);

  // Backwards-compatible name still used inside this file.
  const fetchMembers = loadInitial;

  useEffect(() => {
    setMembers([]);
    loadInitial();
  }, [siteId, loadInitial]);

  // ── Form Handlers ──
  const resetForm = () => {
    setForm({ ...EMPTY_FORM });
    setEditingId(null);
    setPhotoFile(null);
    setPhotoPreview(null);
    setRemovePhoto(false);
    setDocFiles({});
    setDocPreviews({});
    setRemoveDocs({});
    setMessage({ type: '', text: '' });
  };

  const handleOpenCreate = () => { resetForm(); setDialogOpen(true); };

  const handleOpenEdit = (m) => {
    setForm({
      member_type: m.member_type || 'CLIENT',
      full_name: m.full_name || '',
      father_name: m.father_name || '',
      gender: m.gender || '',
      date_of_birth: m.date_of_birth ? m.date_of_birth.split('T')[0] : '',
      blood_group: m.blood_group || '',
      phone: m.phone || '',
      alt_phone: m.alt_phone || '',
      email: m.email || '',
      whatsapp: m.whatsapp || '',
      address: m.address || '',
      city: m.city || '',
      state: m.state || '',
      pincode: m.pincode || '',
      aadhar_no: m.aadhar_no || '',
      pan_no: m.pan_no || '',
      voter_id: m.voter_id || '',
      bank_name: m.bank_name || '',
      account_no: m.account_no || '',
      ifsc_code: m.ifsc_code || '',
      branch: m.branch || '',
      occupation: m.occupation || '',
      company_name: m.company_name || '',
      reference: m.reference || '',
      notes: m.notes || '',
      status: m.status || 'ACTIVE',
      // New personal
      mother_name: m.mother_name || '',
      spouse_name: m.spouse_name || '',
      nationality: m.nationality || '',
      religion: m.religion || '',
      caste: m.caste || '',
      marital_status: m.marital_status || '',
      anniversary_date: m.anniversary_date ? m.anniversary_date.split('T')[0] : '',
      qualification: m.qualification || '',
      // Additional identity
      passport_no: m.passport_no || '',
      driving_license_no: m.driving_license_no || '',
      gst_no: m.gst_no || '',
      tin_no: m.tin_no || '',
      // Emergency contact
      emergency_contact_name: m.emergency_contact_name || '',
      emergency_contact_phone: m.emergency_contact_phone || '',
      emergency_contact_relation: m.emergency_contact_relation || '',
      // Nominee
      nominee_name: m.nominee_name || '',
      nominee_relation: m.nominee_relation || '',
      nominee_phone: m.nominee_phone || '',
      // Employee
      employee_id: m.employee_id || '',
      designation: m.designation || '',
      department: m.department || '',
      date_of_joining: m.date_of_joining ? m.date_of_joining.split('T')[0] : '',
      salary: m.salary || '',
      employment_type: m.employment_type || '',
      team: m.team || '',
    });
    setEditingId(m.id);
    setPhotoPreview(m.photo || null);
    setPhotoFile(null);
    setRemovePhoto(false);
    // Populate existing document previews
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

      // Append KYC & Employee document files
      Object.entries(docFiles).forEach(([fieldKey, file]) => {
        if (file) formData.append(fieldKey, file);
      });
      // Append remove flags for documents
      Object.entries(removeDocs).forEach(([fieldKey, val]) => {
        if (val) formData.append(`remove_${fieldKey}`, 'true');
      });

      const config = { headers: { 'Content-Type': 'multipart/form-data' } };

      let savedMember = null;
      if (editingId) {
        const { data } = await api.put(`/members/${editingId}`, formData, config);
        savedMember = data?.member || null;
      } else {
        const { data } = await api.post('/members', formData, config);
        savedMember = data?.member || null;
      }

      // Optimistic in-place update so the table reflects the change immediately
      // without waiting for a full re-fetch round-trip.
      if (savedMember) {
        setMembers(prev => {
          const idx = prev.findIndex(p => p.id === savedMember.id);
          if (idx === -1) return [savedMember, ...prev];
          const next = prev.slice();
          next[idx] = { ...next[idx], ...savedMember };
          return next;
        });
      }

      // Close dialog right away — no artificial delay.
      setDialogOpen(false);
      // Reconcile with the server in the background (covers summary counts + any
      // server-side defaults). The table stays responsive while this runs.
      refreshMembers();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to save' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (m) => {
    if (!window.confirm(`Delete ${m.full_name}? This cannot be undone.`)) return;
    // Optimistic removal — instant UI feedback.
    const snapshot = members;
    setMembers(prev => prev.filter(x => x.id !== m.id));
    try {
      await api.delete(`/members/${m.id}`);
      refreshMembers();
    } catch (err) {
      console.error('Delete failed:', err);
      setMembers(snapshot); // rollback on failure
    }
  };

  // ── Filters ──
  const filteredMembers = useMemo(() => {
    let list = [...members];
    if (filterType !== 'ALL') list = list.filter(m => m.member_type === filterType);
    if (filterStatus !== 'ALL') list = list.filter(m => m.status === filterStatus);
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      list = list.filter(m =>
        m.full_name?.toLowerCase().includes(q) ||
        m.father_name?.toLowerCase().includes(q) ||
        m.phone?.includes(q) ||
        m.email?.toLowerCase().includes(q) ||
        m.city?.toLowerCase().includes(q) ||
        m.aadhar_no?.includes(q) ||
        m.team?.toLowerCase().includes(q)
      );
    }
    if (sortOrder === 'asc') list.reverse();
    return list;
  }, [members, filterType, filterStatus, searchQuery, sortOrder]);

  // ── Excel Export ──
  const downloadExcel = () => {
    const headers = ['#', 'Type', 'Full Name', 'Father Name', 'Phone', 'Email', 'City', 'State', 'Aadhar', 'PAN', 'Occupation', 'Status'];
    const rows = filteredMembers.map((m, i) => [
      i + 1, m.member_type, m.full_name, m.father_name || '', m.phone || '', m.email || '',
      m.city || '', m.state || '', m.aadhar_no || '', m.pan_no || '', m.occupation || '', m.status,
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = headers.map(() => ({ wch: 18 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Members');
    XLSX.writeFile(wb, `Members_${currentSite?.name || 'site'}.xlsx`);
  };

  // ── Document upload helpers ──
  const handleDocSelect = (fieldKey, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDocFiles(prev => ({ ...prev, [fieldKey]: file }));
    setRemoveDocs(prev => ({ ...prev, [fieldKey]: false }));
    // Generate preview for images
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

  // ── Reusable document upload card component ──
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

  // ═══════════════════════════════════════════════════
  //  MEMBER FORM DIALOG (inline JSX to prevent remount/flicker)
  // ═══════════════════════════════════════════════════
  const memberDialogJsx = (
    <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">{editingId ? 'Edit Member' : 'Add New Member'}</DialogTitle>
          <DialogDescription className="text-sm">
            {editingId ? 'Update member details, documents and KYC.' : 'Register a new client, farmer, employee or member with complete details.'}
          </DialogDescription>
        </DialogHeader>

        {message.text && (
          <div className={`flex gap-2 p-3 rounded-lg text-sm ${
            message.type === 'success'
              ? 'bg-emerald-50 border border-emerald-100 text-emerald-700'
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
                <button type="button" onClick={handleClearPhoto} className="text-[10px] text-red-500 hover:text-red-700 font-medium">
                  Remove Photo
                </button>
              )}
              <p className="text-[10px] text-slate-400">JPG/PNG, max 5MB</p>
            </div>
            <div className="flex-1 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Member Type</Label>
                  <Select value={form.member_type} onValueChange={(v) => setForm({ ...form, member_type: v })}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MEMBER_TYPES.map(t => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
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
                <Input type="date" value={form.date_of_birth}
                  onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} />
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
                <Input placeholder="MOTHER NAME" value={form.mother_name}
                  onChange={(e) => setForm({ ...form, mother_name: e.target.value.toUpperCase() })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Spouse Name</Label>
                <Input placeholder="SPOUSE NAME" value={form.spouse_name}
                  onChange={(e) => setForm({ ...form, spouse_name: e.target.value.toUpperCase() })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Anniversary Date</Label>
                <Input type="date" value={form.anniversary_date}
                  onChange={(e) => setForm({ ...form, anniversary_date: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Qualification</Label>
                <Input placeholder="B.TECH, MBA..." value={form.qualification}
                  onChange={(e) => setForm({ ...form, qualification: e.target.value.toUpperCase() })} />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Occupation</Label>
                <Input placeholder="BUSINESSMAN, FARMER..." value={form.occupation}
                  onChange={(e) => setForm({ ...form, occupation: e.target.value.toUpperCase() })}
                  list="occ-list" />
                <datalist id="occ-list">
                  {autocomplete.occupations?.map(v => <option key={v} value={v} />)}
                </datalist>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Nationality</Label>
                <Input placeholder="INDIAN" value={form.nationality}
                  onChange={(e) => setForm({ ...form, nationality: e.target.value.toUpperCase() })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Religion</Label>
                <Input placeholder="HINDU, MUSLIM..." value={form.religion}
                  onChange={(e) => setForm({ ...form, religion: e.target.value.toUpperCase() })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Caste</Label>
                <Input placeholder="CASTE" value={form.caste}
                  onChange={(e) => setForm({ ...form, caste: e.target.value.toUpperCase() })} />
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
                <Input placeholder="9876543210" value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Alt Phone</Label>
                <Input placeholder="Alternate number" value={form.alt_phone}
                  onChange={(e) => setForm({ ...form, alt_phone: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">WhatsApp</Label>
                <Input placeholder="WhatsApp number" value={form.whatsapp}
                  onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Email</Label>
                <Input type="email" placeholder="email@example.com" value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value.toLowerCase() })} />
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
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Full Address</Label>
                <Textarea placeholder="House No, Street, Locality..." value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">City</Label>
                  <Input placeholder="JAIPUR" value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value.toUpperCase() })}
                    list="city-list" />
                  <datalist id="city-list">
                    {autocomplete.cities?.map(v => <option key={v} value={v} />)}
                  </datalist>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">State</Label>
                  <Input placeholder="RAJASTHAN" value={form.state}
                    onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Pincode</Label>
                  <Input placeholder="302001" value={form.pincode}
                    onChange={(e) => setForm({ ...form, pincode: e.target.value })} />
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Identity Documents (Numbers) */}
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" /> Identity Documents
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Aadhar Number</Label>
                <Input placeholder="1234 5678 9012" value={form.aadhar_no}
                  onChange={(e) => setForm({ ...form, aadhar_no: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">PAN Number</Label>
                <Input placeholder="ABCDE1234F" value={form.pan_no}
                  onChange={(e) => setForm({ ...form, pan_no: e.target.value.toUpperCase() })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Voter ID</Label>
                <Input placeholder="ABC1234567" value={form.voter_id}
                  onChange={(e) => setForm({ ...form, voter_id: e.target.value.toUpperCase() })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Passport Number</Label>
                <Input placeholder="A1234567" value={form.passport_no}
                  onChange={(e) => setForm({ ...form, passport_no: e.target.value.toUpperCase() })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Driving License No</Label>
                <Input placeholder="DL-1234567890" value={form.driving_license_no}
                  onChange={(e) => setForm({ ...form, driving_license_no: e.target.value.toUpperCase() })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">GST Number</Label>
                <Input placeholder="22AAAAA0000A1Z5" value={form.gst_no}
                  onChange={(e) => setForm({ ...form, gst_no: e.target.value.toUpperCase() })} />
              </div>
            </div>
          </div>

          <Separator />

          {/* KYC Document Uploads */}
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <FileCheck className="w-3.5 h-3.5" /> KYC Document Photos
            </p>
            <p className="text-[10px] text-slate-400 mb-3">Upload scanned copies of identity documents (JPG, PNG, PDF — max 5MB each)</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {KYC_DOC_FIELDS.map(doc => (
                <DocUploadCard key={doc.key} fieldDef={doc} />
              ))}
            </div>
          </div>

          <Separator />

          {/* Bank */}
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5" /> Bank Details
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Bank Name</Label>
                <Input placeholder="SBI, HDFC..." value={form.bank_name}
                  onChange={(e) => setForm({ ...form, bank_name: e.target.value.toUpperCase() })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Account Number</Label>
                <Input placeholder="Account No" value={form.account_no}
                  onChange={(e) => setForm({ ...form, account_no: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">IFSC Code</Label>
                <Input placeholder="SBIN0001234" value={form.ifsc_code}
                  onChange={(e) => setForm({ ...form, ifsc_code: e.target.value.toUpperCase() })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Branch</Label>
                <Input placeholder="Branch name" value={form.branch}
                  onChange={(e) => setForm({ ...form, branch: e.target.value.toUpperCase() })} />
              </div>
            </div>
          </div>

          <Separator />

          {/* Emergency Contact */}
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5" /> Emergency Contact
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Contact Name</Label>
                <Input placeholder="EMERGENCY CONTACT NAME" value={form.emergency_contact_name}
                  onChange={(e) => setForm({ ...form, emergency_contact_name: e.target.value.toUpperCase() })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Contact Phone</Label>
                <Input placeholder="9876543210" value={form.emergency_contact_phone}
                  onChange={(e) => setForm({ ...form, emergency_contact_phone: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Relation</Label>
                <Input placeholder="FATHER, SPOUSE, BROTHER..." value={form.emergency_contact_relation}
                  onChange={(e) => setForm({ ...form, emergency_contact_relation: e.target.value.toUpperCase() })} />
              </div>
            </div>
          </div>

          <Separator />

          {/* Nominee */}
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Contact className="w-3.5 h-3.5" /> Nominee Details
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Nominee Name</Label>
                <Input placeholder="NOMINEE NAME" value={form.nominee_name}
                  onChange={(e) => setForm({ ...form, nominee_name: e.target.value.toUpperCase() })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Nominee Relation</Label>
                <Input placeholder="WIFE, SON, DAUGHTER..." value={form.nominee_relation}
                  onChange={(e) => setForm({ ...form, nominee_relation: e.target.value.toUpperCase() })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Nominee Phone</Label>
                <Input placeholder="9876543210" value={form.nominee_phone}
                  onChange={(e) => setForm({ ...form, nominee_phone: e.target.value })} />
              </div>
            </div>
          </div>

          {/* Employee-Specific Section (conditional) */}
          {form.member_type === 'EMPLOYEE' && (
            <>
              <Separator />
              <div>
                <p className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <UserCog className="w-3.5 h-3.5" /> Employee Details
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Employee ID</Label>
                    <Input placeholder="EMP-001" value={form.employee_id}
                      onChange={(e) => setForm({ ...form, employee_id: e.target.value.toUpperCase() })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Designation</Label>
                    <Input placeholder="MANAGER, ACCOUNTANT..." value={form.designation}
                      onChange={(e) => setForm({ ...form, designation: e.target.value.toUpperCase() })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Department</Label>
                    <Input placeholder="ACCOUNTS, HR, SALES..." value={form.department}
                      onChange={(e) => setForm({ ...form, department: e.target.value.toUpperCase() })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Date of Joining</Label>
                    <Input type="date" value={form.date_of_joining}
                      onChange={(e) => setForm({ ...form, date_of_joining: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Salary (₹)</Label>
                    <Input type="number" placeholder="25000" value={form.salary}
                      onChange={(e) => setForm({ ...form, salary: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Employment Type</Label>
                    <Select value={form.employment_type || 'none'} onValueChange={(v) => setForm({ ...form, employment_type: v === 'none' ? '' : v })}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Not Specified</SelectItem>
                        {EMPLOYMENT_TYPE_OPTIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <Separator />
              {/* Employee Documents */}
              <div>
                <p className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5" /> Employee Documents
                </p>
                <p className="text-[10px] text-slate-400 mb-3">Upload resume, marksheets, certificates (JPG, PNG, PDF — max 5MB each)</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {EMPLOYEE_DOC_FIELDS.map(doc => (
                    <DocUploadCard key={doc.key} fieldDef={doc} />
                  ))}
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Other / Additional */}
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5" /> Additional Info
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Company Name</Label>
                <Input placeholder="Company / Firm" value={form.company_name}
                  onChange={(e) => setForm({ ...form, company_name: e.target.value.toUpperCase() })}
                  list="comp-list" />
                <datalist id="comp-list">
                  {autocomplete.companies?.map(v => <option key={v} value={v} />)}
                </datalist>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Reference / Referred By</Label>
                <Input placeholder="Who referred this member" value={form.reference}
                  onChange={(e) => setForm({ ...form, reference: e.target.value.toUpperCase() })}
                  list="ref-list" />
                <datalist id="ref-list">
                  {autocomplete.references?.map(v => <option key={v} value={v} />)}
                </datalist>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">TIN Number</Label>
                <Input placeholder="TIN Number" value={form.tin_no}
                  onChange={(e) => setForm({ ...form, tin_no: e.target.value.toUpperCase() })} />
              </div>
            </div>
            <div className="mt-3 space-y-1.5">
              <Label className="text-xs font-medium">Notes / Remarks</Label>
              <Textarea placeholder="Any additional notes or remarks about this member..." value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => setDialogOpen(false)} disabled={submitting}>Cancel</Button>
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? (
                <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />{editingId ? 'Updating...' : 'Creating...'}</>
              ) : (editingId ? 'Update Member' : 'Create Member')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );

  // ═══════════════════════════════════════════════════
  //   NO SITE
  // ═══════════════════════════════════════════════════
  if (!currentSite) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Building2 className="w-10 h-10 text-slate-200 mb-3" />
        <p className="text-sm text-slate-500">Select a site to view members</p>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════
  //  LIST VIEW
  // ═══════════════════════════════════════════════════
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Members</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Client, farmer & member records for <span className="font-medium text-slate-700">{currentSite.name}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={downloadExcel} className="text-xs" disabled={filteredMembers.length === 0}>
            <Download className="w-3.5 h-3.5 mr-1" /> Excel
          </Button>
          {canWrite && (
            <Button size="sm" onClick={handleOpenCreate}>
              <Plus className="w-4 h-4 mr-1.5" /> Add Member
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      {summary.total > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-7 gap-3">
          {[
            { label: 'Total', value: summary.total, color: 'text-slate-900' },
            { label: 'Clients', value: summary.clients, color: 'text-blue-700' },
            { label: 'Farmers', value: summary.farmers, color: 'text-emerald-700' },
            { label: 'Employees', value: summary.employees, color: 'text-indigo-700' },
            { label: 'Members', value: summary.members, color: 'text-purple-700' },
            { label: 'Active', value: summary.active, color: 'text-emerald-700' },
            { label: 'Inactive', value: summary.inactive, color: 'text-slate-500' },
          ].map((s) => (
            <Card key={s.label} className="shadow-none border-slate-200">
              <CardContent className="p-3 text-center">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">{s.label}</p>
                <p className={`text-lg font-bold ${s.color} mt-0.5`}>{s.value || 0}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filters */}
      <Card className="shadow-none border-slate-200">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-52">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <Input placeholder="Search name, phone, email, city, aadhar..."
                value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs" />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="All Types" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Types</SelectItem>
                {MEMBER_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="All Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            {(searchQuery || filterType !== 'ALL' || filterStatus !== 'ALL') && (
              <Button variant="ghost" size="sm" onClick={() => { setSearchQuery(''); setFilterType('ALL'); setFilterStatus('ALL'); }} className="text-xs text-slate-500 h-8">
                <X className="w-3 h-3 mr-1" /> Clear
              </Button>
            )}
            <span className="text-xs text-slate-400 ml-auto">{filteredMembers.length} members</span>
          </div>
        </CardContent>
      </Card>

      {/* Members Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
        </div>
      ) : filteredMembers.length === 0 ? (
        <div className="text-center py-16">
          <Users className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-sm text-slate-500">{members.length === 0 ? 'No members registered yet' : 'No members match your filters'}</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {members.length === 0 ? 'Add your first client, farmer or member' : 'Try different search criteria'}
          </p>
        </div>
      ) : (
        <Card className="shadow-none border-slate-200">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50">
                    <TableHead className="w-12">
                      <Button variant="ghost" size="sm" onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')} className="h-6 px-1.5 text-xs" title="Sort Older/Latest">
                        # <ArrowUpDown className="w-3 h-3 ml-1" />
                      </Button>
                    </TableHead>
                    <TableHead className="w-16">Photo</TableHead>
                    <TableHead className="min-w-[200px]">Name</TableHead>
                    <TableHead className="min-w-[180px]">Father Name</TableHead>
                    <TableHead className="w-32">Type</TableHead>
                    <TableHead className="min-w-[130px]">Phone</TableHead>
                    <TableHead className="min-w-[120px]">City</TableHead>
                    <TableHead className="w-24">Team</TableHead>
                    <TableHead className="w-24">Status</TableHead>
                    <TableHead className="w-32 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMembers.map((m, idx) => {
                    const kycMissing = isKycIncomplete(m);
                    return (
                    <TableRow
                      key={m.id}
                      className="cursor-pointer hover:bg-slate-50/50 transition-colors"
                      onClick={() => navigate(`/clients/${m.id}`)}
                    >
                      <TableCell className="text-xs text-slate-400 font-mono">{idx + 1}</TableCell>
                      <TableCell>
                        <Avatar src={m.photo} name={m.full_name} size="sm" />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-sm text-slate-900">{m.full_name}</div>
                        {m.email && <div className="text-xs text-slate-500 mt-0.5">{m.email}</div>}
                        {kycMissing && (
                          <Badge  className="text-[9px] px-1.5 bg-red-500 py-0 h-4 font-semibold gap-1">
                            <AlertCircle className="w-2.5 h-2.5 " /> KYC Incomplete
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">{m.father_name || '—'}</TableCell>
                      <TableCell>
                        <TypeBadge type={m.member_type} />
                      </TableCell>
                      <TableCell>
                        {m.phone ? (
                          <a href={`tel:${m.phone}`} onClick={(e) => e.stopPropagation()} className="text-sm text-slate-600 hover:text-blue-600 inline-flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5" /> {m.phone}
                          </a>
                        ) : (
                          <span className="text-sm text-slate-400">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {m.city ? (
                          <div className="text-sm text-slate-600 inline-flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5" /> {m.city}
                          </div>
                        ) : (
                          <span className="text-sm text-slate-400">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {m.team ? (
                          <Badge variant="outline" className="text-[10px] font-semibold bg-indigo-50 text-indigo-700 border-indigo-200">{m.team}</Badge>
                        ) : (
                          <span className="text-sm text-slate-400">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 text-[10px] font-semibold rounded-full ${STATUS_COLORS[m.status] || 'bg-slate-100 text-slate-600'}`}>
                          {m.status}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-500 hover:text-blue-600" title="View"
                            onClick={(e) => { e.stopPropagation(); navigate(`/clients/${m.id}`); }}>
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          {(canUpdate || canDelete) && (
                            <>
                              {canUpdate && <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-500 hover:text-slate-700" title="Edit"
                                onClick={(e) => { e.stopPropagation(); handleOpenEdit(m); }}>
                                <Edit2 className="w-3.5 h-3.5" />
                              </Button>}
                              {canDelete && <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-500 hover:text-red-600" title="Delete"
                                onClick={(e) => { e.stopPropagation(); handleDelete(m); }}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>}
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {memberDialogJsx}
    </div>
  );
};

export default Clients;
