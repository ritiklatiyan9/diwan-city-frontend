import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Separator } from '../components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import {
    Building2, ArrowLeft, Camera, X, Check, AlertCircle, Loader2,
    User, Phone, MapPin, Shield, CreditCard, Briefcase, Heart,
    UserCog, FileText, Upload, GraduationCap, Contact, FileCheck,
    Tractor, Handshake, Store, HelpCircle, UserCheck, Users, Tag,
} from 'lucide-react';
import { toast } from 'sonner';

// ── Constants ──
const GENDER_OPTIONS = ['MALE', 'FEMALE', 'OTHER'];
const BLOOD_OPTIONS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const STATUS_OPTIONS = ['ACTIVE', 'INACTIVE', 'BLOCKED'];
const MARITAL_OPTIONS = ['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED'];
const EMPLOYMENT_TYPE_OPTIONS = ['FULL-TIME', 'PART-TIME', 'CONTRACT', 'INTERN', 'PROBATION', 'FREELANCE'];
const IRRIGATION_OPTIONS = ['CANAL', 'TUBEWELL', 'RAINFED', 'DRIP', 'SPRINKLER', 'OTHER'];

const ICON_MAP = { UserCheck, Tractor, Users, Handshake, Store, UserCog, HelpCircle, Tag };

const EMPTY_FORM = {
    member_type: '', full_name: '', father_name: '', gender: '', date_of_birth: '',
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
    // Employee
    employee_id: '', designation: '', department: '', date_of_joining: '', salary: '', employment_type: '',
    // Farmer
    land_area: '', crop_type: '', farm_location: '', irrigation_type: '', farming_experience: '',
    // Broker
    license_number: '', commission_rate: '', operating_areas: '',
    // Vendor
    business_name: '', service_type: '', payment_terms: '',
    // Team (for broker/member/employee/partner)
    team: '',
};

// KYC document definitions
const KYC_DOC_FIELDS = [
    { key: 'aadhar_front_url', label: 'Aadhar Front', accept: 'image/jpeg,image/png,image/jpg,application/pdf' },
    { key: 'aadhar_back_url', label: 'Aadhar Back', accept: 'image/jpeg,image/png,image/jpg,application/pdf' },
    { key: 'pan_card_url', label: 'PAN Card', accept: 'image/jpeg,image/png,image/jpg,application/pdf' },
    { key: 'voter_id_url', label: 'Voter ID', accept: 'image/jpeg,image/png,image/jpg,application/pdf' },
    { key: 'passport_url', label: 'Passport', accept: 'image/jpeg,image/png,image/jpg,application/pdf' },
    { key: 'driving_license_url', label: 'Driving License', accept: 'image/jpeg,image/png,image/jpg,application/pdf' },
    { key: 'cheque_url', label: 'Cancelled Cheque', accept: 'image/jpeg,image/png,image/jpg,application/pdf' },
    { key: 'other_kyc_url', label: 'Other KYC', accept: 'image/jpeg,image/png,image/jpg,application/pdf' },
];

const EMPLOYEE_DOC_FIELDS = [
    { key: 'resume_url', label: 'Resume / CV', accept: 'image/jpeg,image/png,image/jpg,application/pdf' },
    { key: 'marksheet_10th_url', label: '10th Marksheet', accept: 'image/jpeg,image/png,image/jpg,application/pdf' },
    { key: 'marksheet_12th_url', label: '12th Marksheet', accept: 'image/jpeg,image/png,image/jpg,application/pdf' },
    { key: 'degree_certificate_url', label: 'Degree Certificate', accept: 'image/jpeg,image/png,image/jpg,application/pdf' },
    { key: 'experience_certificate_url', label: 'Experience Certificate', accept: 'image/jpeg,image/png,image/jpg,application/pdf' },
    { key: 'offer_letter_url', label: 'Offer Letter', accept: 'image/jpeg,image/png,image/jpg,application/pdf' },
    { key: 'other_certificate_url', label: 'Other Certificate', accept: 'image/jpeg,image/png,image/jpg,application/pdf' },
];

export const RegisterUser = () => {
    const { currentSite } = useAuth();
    const navigate = useNavigate();
    const siteId = currentSite?.id;

    const [categories, setCategories] = useState([]);
    const [form, setForm] = useState({ ...EMPTY_FORM });
    const [autocomplete, setAutocomplete] = useState({ cities: [], occupations: [], companies: [], references: [] });
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    // Photo
    const [photoFile, setPhotoFile] = useState(null);
    const [photoPreview, setPhotoPreview] = useState(null);
    const fileInputRef = useRef(null);

    // Documents
    const [docFiles, setDocFiles] = useState({});
    const [docPreviews, setDocPreviews] = useState({});

    // Fetch categories + autocomplete
    useEffect(() => {
        const load = async () => {
            try {
                const [catRes, acRes] = await Promise.all([
                    api.get('/member-categories'),
                    siteId ? api.get('/members/autocomplete', { params: { site_id: siteId } }) : Promise.resolve({ data: {} }),
                ]);
                setCategories(catRes.data.categories || []);
                setAutocomplete(acRes.data || { cities: [], occupations: [], companies: [], references: [] });
            } catch (err) {
                console.error('Failed to load data:', err);
            }
        };
        load();
    }, [siteId]);

    const handlePhotoSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setPhotoFile(file);
        const reader = new FileReader();
        reader.onloadend = () => setPhotoPreview(reader.result);
        reader.readAsDataURL(file);
    };

    const handleClearPhoto = () => {
        setPhotoFile(null);
        setPhotoPreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleDocSelect = (fieldKey, e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setDocFiles(prev => ({ ...prev, [fieldKey]: file }));
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
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!siteId) { toast.error('Please select a site first'); return; }
        if (!form.member_type) { toast.error('Please select a user category'); return; }
        if (!form.full_name) { toast.error('Full name is required'); return; }

        setSubmitting(true);
        setMessage({ type: '', text: '' });
        try {
            const formData = new FormData();
            formData.append('site_id', siteId);
            Object.entries(form).forEach(([key, val]) => {
                if (val !== null && val !== undefined && val !== '') formData.append(key, val);
            });
            if (photoFile) formData.append('photo', photoFile);
            Object.entries(docFiles).forEach(([fieldKey, file]) => {
                if (file) formData.append(fieldKey, file);
            });

            await api.post('/members', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            toast.success('User registered successfully!');
            // Reset form immediately — no artificial delay.
            setForm({ ...EMPTY_FORM });
            setPhotoFile(null);
            setPhotoPreview(null);
            setDocFiles({});
            setDocPreviews({});
            setMessage({ type: '', text: '' });
        } catch (err) {
            const msg = err.response?.data?.message || 'Failed to register user';
            toast.error(msg);
            setMessage({ type: 'error', text: msg });
        } finally {
            setSubmitting(false);
        }
    };

    const DocUploadCard = ({ fieldDef }) => {
        const { key, label, accept } = fieldDef;
        const preview = docPreviews[key];
        const inputRef = useRef(null);
        return (
            <div className="border border-slate-200 rounded-lg p-3 space-y-2 bg-white">
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

    const selectedType = form.member_type;
    const isEmployee = selectedType === 'EMPLOYEE';
    const isFarmer = selectedType === 'FARMER';
    const isBroker = selectedType === 'BROKER';
    const isVendor = selectedType === 'VENDOR';
    const showTeam = ['BROKER', 'MEMBER', 'EMPLOYEE', 'PARTNER'].includes(selectedType);

    if (!currentSite) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <Building2 className="w-10 h-10 text-slate-200 mb-3" />
                <p className="text-sm text-slate-500">Select a site to register a user</p>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto pb-10">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/clients')}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                        <ArrowLeft className="w-4 h-4 text-slate-500" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Register New User</h1>
                        <p className="text-sm text-slate-500 mt-0.5">
                            Register a new member for <span className="font-medium text-slate-700">{currentSite.name}</span>
                        </p>
                    </div>
                </div>
            </div>

            {message.text && (
                <div className={`flex gap-2 p-3 rounded-lg text-sm mb-5 ${message.type === 'success'
                    ? 'bg-emerald-50 border border-emerald-100 text-emerald-700'
                    : 'bg-red-50 border border-red-100 text-red-700'
                    }`}>
                    {message.type === 'success' ? <Check className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
                    {message.text}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
                {/* ─── Category Selection + Photo ─── */}
                <Card className="border-slate-200/80">
                    <CardContent className="p-5">
                        <div className="flex items-start gap-5">
                            {/* Photo Upload */}
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

                            {/* Category + Name */}
                            <div className="flex-1 space-y-3">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-medium">User Category <span className="text-red-500">*</span></Label>
                                        <Select value={form.member_type || 'none'} onValueChange={(v) => setForm({ ...form, member_type: v === 'none' ? '' : v })}>
                                            <SelectTrigger className="h-9 text-xs">
                                                <SelectValue placeholder="Select category" />
                                            </SelectTrigger>
                                            <SelectContent position="popper" className="max-h-60">
                                                <SelectItem value="none">Select category...</SelectItem>
                                                {categories.map(cat => (
                                                    <SelectItem key={cat.id} value={cat.slug}>
                                                        <span className="flex items-center gap-2">
                                                            {(() => { const I = ICON_MAP[cat.icon] || Tag; return <I className="w-3.5 h-3.5" />; })()}
                                                            {cat.name}
                                                        </span>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-medium">Status</Label>
                                        <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                                            <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                                            <SelectContent position="popper" className="max-h-60">
                                                {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-medium">Full Name <span className="text-red-500">*</span></Label>
                                        <Input placeholder="RAJESH KUMAR" value={form.full_name}
                                            onChange={(e) => setForm({ ...form, full_name: e.target.value.toUpperCase() })} required />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-medium">Father / Husband Name</Label>
                                        <Input placeholder="S/O RAMESH KUMAR" value={form.father_name}
                                            onChange={(e) => setForm({ ...form, father_name: e.target.value.toUpperCase() })} />
                                    </div>
                                </div>
                                {showTeam && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                    </CardContent>
                </Card>

                {/* Show form only after category is selected */}
                {selectedType && (
                    <>
                        {/* ─── Personal Details ─── */}
                        <Card className="border-slate-200/80">
                            <CardHeader className="pb-3 pt-4 px-5">
                                <CardTitle className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                    <User className="w-3.5 h-3.5" /> Personal Details
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="px-5 pb-5 space-y-3">
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-medium">Gender</Label>
                                        <Select value={form.gender || 'none'} onValueChange={(v) => setForm({ ...form, gender: v === 'none' ? '' : v })}>
                                            <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                                            <SelectContent position="popper" className="max-h-60">
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
                                            <SelectContent position="popper" className="max-h-60">
                                                <SelectItem value="none">Not Specified</SelectItem>
                                                {BLOOD_OPTIONS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-medium">Marital Status</Label>
                                        <Select value={form.marital_status || 'none'} onValueChange={(v) => setForm({ ...form, marital_status: v === 'none' ? '' : v })}>
                                            <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                                            <SelectContent position="popper" className="max-h-60">
                                                <SelectItem value="none">Not Specified</SelectItem>
                                                {MARITAL_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-medium">Occupation</Label>
                                        <Input placeholder="BUSINESSMAN..." value={form.occupation}
                                            onChange={(e) => setForm({ ...form, occupation: e.target.value.toUpperCase() })}
                                            list="occ-list-reg" />
                                        <datalist id="occ-list-reg">
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
                            </CardContent>
                        </Card>

                        {/* ─── Contact Details ─── */}
                        <Card className="border-slate-200/80">
                            <CardHeader className="pb-3 pt-4 px-5">
                                <CardTitle className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                    <Phone className="w-3.5 h-3.5" /> Contact Details
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="px-5 pb-5">
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
                            </CardContent>
                        </Card>

                        {/* ─── Address ─── */}
                        <Card className="border-slate-200/80">
                            <CardHeader className="pb-3 pt-4 px-5">
                                <CardTitle className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                    <MapPin className="w-3.5 h-3.5" /> Address
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="px-5 pb-5 space-y-3">
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
                                            list="city-list-reg" />
                                        <datalist id="city-list-reg">
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
                            </CardContent>
                        </Card>

                        {/* ─── Identity Documents ─── */}
                        <Card className="border-slate-200/80">
                            <CardHeader className="pb-3 pt-4 px-5">
                                <CardTitle className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                    <Shield className="w-3.5 h-3.5" /> Identity Documents
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="px-5 pb-5">
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
                                        <Label className="text-xs font-medium">Driving License</Label>
                                        <Input placeholder="DL-1234567890" value={form.driving_license_no}
                                            onChange={(e) => setForm({ ...form, driving_license_no: e.target.value.toUpperCase() })} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-medium">GST Number</Label>
                                        <Input placeholder="22AAAAA0000A1Z5" value={form.gst_no}
                                            onChange={(e) => setForm({ ...form, gst_no: e.target.value.toUpperCase() })} />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* ─── KYC Uploads ─── */}
                        <Card className="border-slate-200/80">
                            <CardHeader className="pb-3 pt-4 px-5">
                                <CardTitle className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                    <FileCheck className="w-3.5 h-3.5" /> KYC Document Photos
                                </CardTitle>
                                <p className="text-[10px] text-slate-400 mt-1">Upload scanned copies (JPG, PNG, PDF — max 5MB each)</p>
                            </CardHeader>
                            <CardContent className="px-5 pb-5">
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {KYC_DOC_FIELDS.map(doc => <DocUploadCard key={doc.key} fieldDef={doc} />)}
                                </div>
                            </CardContent>
                        </Card>

                        {/* ─── Bank Details ─── */}
                        <Card className="border-slate-200/80">
                            <CardHeader className="pb-3 pt-4 px-5">
                                <CardTitle className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                    <CreditCard className="w-3.5 h-3.5" /> Bank Details
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="px-5 pb-5">
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
                            </CardContent>
                        </Card>

                        {/* ─── Emergency Contact ─── */}
                        <Card className="border-slate-200/80">
                            <CardHeader className="pb-3 pt-4 px-5">
                                <CardTitle className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                    <Phone className="w-3.5 h-3.5" /> Emergency Contact
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="px-5 pb-5">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-medium">Contact Name</Label>
                                        <Input placeholder="EMERGENCY CONTACT" value={form.emergency_contact_name}
                                            onChange={(e) => setForm({ ...form, emergency_contact_name: e.target.value.toUpperCase() })} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-medium">Contact Phone</Label>
                                        <Input placeholder="9876543210" value={form.emergency_contact_phone}
                                            onChange={(e) => setForm({ ...form, emergency_contact_phone: e.target.value })} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-medium">Relation</Label>
                                        <Input placeholder="FATHER, SPOUSE..." value={form.emergency_contact_relation}
                                            onChange={(e) => setForm({ ...form, emergency_contact_relation: e.target.value.toUpperCase() })} />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* ─── Nominee ─── */}
                        <Card className="border-slate-200/80">
                            <CardHeader className="pb-3 pt-4 px-5">
                                <CardTitle className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                    <Contact className="w-3.5 h-3.5" /> Nominee Details
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="px-5 pb-5">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-medium">Nominee Name</Label>
                                        <Input placeholder="NOMINEE NAME" value={form.nominee_name}
                                            onChange={(e) => setForm({ ...form, nominee_name: e.target.value.toUpperCase() })} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-medium">Nominee Relation</Label>
                                        <Input placeholder="WIFE, SON..." value={form.nominee_relation}
                                            onChange={(e) => setForm({ ...form, nominee_relation: e.target.value.toUpperCase() })} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-medium">Nominee Phone</Label>
                                        <Input placeholder="9876543210" value={form.nominee_phone}
                                            onChange={(e) => setForm({ ...form, nominee_phone: e.target.value })} />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* ─── EMPLOYEE-SPECIFIC ─── */}
                        {isEmployee && (
                            <>
                                <Card className="border-indigo-200/80 bg-indigo-50/30">
                                    <CardHeader className="pb-3 pt-4 px-5">
                                        <CardTitle className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wider flex items-center gap-1.5">
                                            <UserCog className="w-3.5 h-3.5" /> Employee Details
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="px-5 pb-5">
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
                                                    <SelectContent position="popper" className="max-h-60">
                                                        <SelectItem value="none">Not Specified</SelectItem>
                                                        {EMPLOYMENT_TYPE_OPTIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Employee Documents */}
                                <Card className="border-indigo-200/80 bg-indigo-50/30">
                                    <CardHeader className="pb-3 pt-4 px-5">
                                        <CardTitle className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wider flex items-center gap-1.5">
                                            <GraduationCap className="w-3.5 h-3.5" /> Employee Documents
                                        </CardTitle>
                                        <p className="text-[10px] text-slate-400 mt-1">Upload resume, marksheets, certificates (JPG, PNG, PDF — max 5MB each)</p>
                                    </CardHeader>
                                    <CardContent className="px-5 pb-5">
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                            {EMPLOYEE_DOC_FIELDS.map(doc => <DocUploadCard key={doc.key} fieldDef={doc} />)}
                                        </div>
                                    </CardContent>
                                </Card>
                            </>
                        )}

                        {/* ─── FARMER-SPECIFIC ─── */}
                        {isFarmer && (
                            <Card className="border-emerald-200/80 bg-emerald-50/30">
                                <CardHeader className="pb-3 pt-4 px-5">
                                    <CardTitle className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider flex items-center gap-1.5">
                                        <Tractor className="w-3.5 h-3.5" /> Farmer Details
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="px-5 pb-5">
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-medium">Land Area</Label>
                                            <Input placeholder="50 Bigha, 10 Acres..." value={form.land_area}
                                                onChange={(e) => setForm({ ...form, land_area: e.target.value })} />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-medium">Crop Type</Label>
                                            <Input placeholder="WHEAT, RICE, SUGARCANE..." value={form.crop_type}
                                                onChange={(e) => setForm({ ...form, crop_type: e.target.value.toUpperCase() })} />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-medium">Farm Location</Label>
                                            <Input placeholder="Village / Block / Tehsil" value={form.farm_location}
                                                onChange={(e) => setForm({ ...form, farm_location: e.target.value.toUpperCase() })} />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-medium">Irrigation Type</Label>
                                            <Select value={form.irrigation_type || 'none'} onValueChange={(v) => setForm({ ...form, irrigation_type: v === 'none' ? '' : v })}>
                                                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                                                <SelectContent position="popper" className="max-h-60">
                                                    <SelectItem value="none">Not Specified</SelectItem>
                                                    {IRRIGATION_OPTIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-medium">Farming Experience</Label>
                                            <Input placeholder="10 years, 5 years..." value={form.farming_experience}
                                                onChange={(e) => setForm({ ...form, farming_experience: e.target.value })} />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* ─── BROKER-SPECIFIC ─── */}
                        {isBroker && (
                            <Card className="border-amber-200/80 bg-amber-50/30">
                                <CardHeader className="pb-3 pt-4 px-5">
                                    <CardTitle className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
                                        <Handshake className="w-3.5 h-3.5" /> Broker Details
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="px-5 pb-5">
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-medium">License Number</Label>
                                            <Input placeholder="RERA/12345" value={form.license_number}
                                                onChange={(e) => setForm({ ...form, license_number: e.target.value.toUpperCase() })} />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-medium">Commission Rate (%)</Label>
                                            <Input placeholder="2.5%" value={form.commission_rate}
                                                onChange={(e) => setForm({ ...form, commission_rate: e.target.value })} />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-medium">Operating Areas</Label>
                                            <Input placeholder="JAIPUR, DELHI..." value={form.operating_areas}
                                                onChange={(e) => setForm({ ...form, operating_areas: e.target.value.toUpperCase() })} />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* ─── VENDOR-SPECIFIC ─── */}
                        {isVendor && (
                            <Card className="border-orange-200/80 bg-orange-50/30">
                                <CardHeader className="pb-3 pt-4 px-5">
                                    <CardTitle className="text-[11px] font-semibold text-orange-700 uppercase tracking-wider flex items-center gap-1.5">
                                        <Store className="w-3.5 h-3.5" /> Vendor Details
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="px-5 pb-5">
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-medium">Business Name</Label>
                                            <Input placeholder="Business / Firm Name" value={form.business_name}
                                                onChange={(e) => setForm({ ...form, business_name: e.target.value.toUpperCase() })} />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-medium">Service Type</Label>
                                            <Input placeholder="CONSTRUCTION, PLUMBING..." value={form.service_type}
                                                onChange={(e) => setForm({ ...form, service_type: e.target.value.toUpperCase() })} />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-medium">Payment Terms</Label>
                                            <Input placeholder="30 DAYS, ADVANCE..." value={form.payment_terms}
                                                onChange={(e) => setForm({ ...form, payment_terms: e.target.value.toUpperCase() })} />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* ─── Additional Info ─── */}
                        <Card className="border-slate-200/80">
                            <CardHeader className="pb-3 pt-4 px-5">
                                <CardTitle className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                    <Briefcase className="w-3.5 h-3.5" /> Additional Info
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="px-5 pb-5 space-y-3">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-medium">Company Name</Label>
                                        <Input placeholder="Company / Firm" value={form.company_name}
                                            onChange={(e) => setForm({ ...form, company_name: e.target.value.toUpperCase() })}
                                            list="comp-list-reg" />
                                        <datalist id="comp-list-reg">
                                            {autocomplete.companies?.map(v => <option key={v} value={v} />)}
                                        </datalist>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-medium">Reference / Referred By</Label>
                                        <Input placeholder="Who referred this member" value={form.reference}
                                            onChange={(e) => setForm({ ...form, reference: e.target.value.toUpperCase() })}
                                            list="ref-list-reg" />
                                        <datalist id="ref-list-reg">
                                            {autocomplete.references?.map(v => <option key={v} value={v} />)}
                                        </datalist>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-medium">TIN Number</Label>
                                        <Input placeholder="TIN Number" value={form.tin_no}
                                            onChange={(e) => setForm({ ...form, tin_no: e.target.value.toUpperCase() })} />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-medium">Notes / Remarks</Label>
                                    <Textarea placeholder="Any additional notes..." value={form.notes}
                                        onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
                                </div>
                            </CardContent>
                        </Card>

                        {/* ─── Submit ─── */}
                        <div className="flex items-center justify-end gap-3 pt-2">
                            <Button type="button" variant="outline" size="sm" onClick={() => navigate('/clients')} disabled={submitting}>
                                Cancel
                            </Button>
                            <Button type="submit" size="sm" disabled={submitting} className="min-w-[140px]">
                                {submitting ? (
                                    <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Registering...</>
                                ) : 'Register User'}
                            </Button>
                        </div>
                    </>
                )}
            </form>
        </div>
    );
};

export default RegisterUser;
