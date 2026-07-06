import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Separator } from '../components/ui/separator';
import { Badge } from '../components/ui/badge';
import {
    Dialog, DialogContent, DialogDescription, DialogFooter,
    DialogHeader, DialogTitle,
} from '../components/ui/dialog';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import {
    Search, Tag, HardHat, Hammer, Truck, Building2, Banknote,
    Handshake, Scale, Wrench, Zap, Paintbrush, Grid3x3, TreePine,
    Package, Landmark, Receipt, FileText, Phone, Fuel,
    UtensilsCrossed, Printer, Send, CreditCard, BarChart3, Megaphone,
    Users, Gift, Cog, Car, Armchair, Trash2, SprayCan, Shield,
    HelpCircle, Wallet, GraduationCap, Droplets, Fence,
    Plus, Edit2, Loader2, Lock,
} from 'lucide-react';
import { toast } from 'sonner';

// Icon / Color helpers
const ICON_MAP = {
    Tag, HardHat, Hammer, Truck, Building2, Banknote, Handshake, Scale, Wrench,
    Zap, Paintbrush, Grid3x3, TreePine, Package, Landmark, Receipt, FileText,
    Phone, Fuel, UtensilsCrossed, Printer, Send, CreditCard, BarChart3, Megaphone,
    Users, Gift, Cog, Car, Armchair, Trash2, SprayCan, Shield, HelpCircle,
    Wallet, GraduationCap, Droplets, Fence,
};
const ICON_OPTIONS = Object.keys(ICON_MAP);

const COLOR_OPTIONS = [
    { value: 'blue', label: 'Blue', cls: 'bg-blue-100 text-blue-700' },
    { value: 'emerald', label: 'Green', cls: 'bg-emerald-100 text-emerald-700' },
    { value: 'purple', label: 'Purple', cls: 'bg-purple-100 text-purple-700' },
    { value: 'amber', label: 'Amber', cls: 'bg-amber-100 text-amber-700' },
    { value: 'cyan', label: 'Cyan', cls: 'bg-cyan-100 text-cyan-700' },
    { value: 'orange', label: 'Orange', cls: 'bg-orange-100 text-orange-700' },
    { value: 'indigo', label: 'Indigo', cls: 'bg-indigo-100 text-indigo-700' },
    { value: 'rose', label: 'Rose', cls: 'bg-rose-100 text-rose-700' },
    { value: 'teal', label: 'Teal', cls: 'bg-teal-100 text-teal-700' },
    { value: 'slate', label: 'Gray', cls: 'bg-slate-100 text-slate-700' },
    { value: 'red', label: 'Red', cls: 'bg-red-100 text-red-700' },
    { value: 'green', label: 'Green', cls: 'bg-green-100 text-green-700' },
    { value: 'stone', label: 'Stone', cls: 'bg-stone-100 text-stone-700' },
    { value: 'yellow', label: 'Yellow', cls: 'bg-yellow-100 text-yellow-700' },
    { value: 'pink', label: 'Pink', cls: 'bg-pink-100 text-pink-700' },
    { value: 'sky', label: 'Sky', cls: 'bg-sky-100 text-sky-700' },
];

const getColorCls = (c) => {
    const found = COLOR_OPTIONS.find(o => o.value === c);
    return found ? found.cls : 'bg-slate-100 text-slate-700';
};

const GROUP_OPTIONS = [
    'Construction & Civil', 'MEP & Finishing', 'Infrastructure',
    'Professional Services', 'Government & Tax', 'Office & Admin',
    'Transport & Fuel', 'Financial', 'Marketing & Misc', 'Assets', 'Custom', 'Other',
];

// Predefined categories (built-in, cannot be deleted)
const PREDEFINED = [
    { name: 'CONSTRUCTION', group: 'Construction & Civil', icon: 'HardHat', color: 'orange' },
    { name: 'MATERIAL', group: 'Construction & Civil', icon: 'Package', color: 'amber' },
    { name: 'LABOUR', group: 'Construction & Civil', icon: 'Hammer', color: 'yellow' },
    { name: 'CEMENT', group: 'Construction & Civil', icon: 'Package', color: 'stone' },
    { name: 'SAND', group: 'Construction & Civil', icon: 'Package', color: 'amber' },
    { name: 'STEEL', group: 'Construction & Civil', icon: 'Package', color: 'slate' },
    { name: 'BRICKS', group: 'Construction & Civil', icon: 'Grid3x3', color: 'red' },
    { name: 'WOOD', group: 'Construction & Civil', icon: 'TreePine', color: 'amber' },
    { name: 'EXCAVATION', group: 'Construction & Civil', icon: 'HardHat', color: 'orange' },
    { name: 'EARTH WORK', group: 'Construction & Civil', icon: 'HardHat', color: 'amber' },
    { name: 'BORING', group: 'Construction & Civil', icon: 'Cog', color: 'stone' },
    { name: 'DEMOLITION', group: 'Construction & Civil', icon: 'Trash2', color: 'red' },
    { name: 'PLUMBING', group: 'MEP & Finishing', icon: 'Wrench', color: 'blue' },
    { name: 'ELECTRICAL', group: 'MEP & Finishing', icon: 'Zap', color: 'yellow' },
    { name: 'PAINTING', group: 'MEP & Finishing', icon: 'Paintbrush', color: 'purple' },
    { name: 'FLOORING', group: 'MEP & Finishing', icon: 'Grid3x3', color: 'stone' },
    { name: 'TILES', group: 'MEP & Finishing', icon: 'Grid3x3', color: 'cyan' },
    { name: 'CARPENTRY', group: 'MEP & Finishing', icon: 'Hammer', color: 'amber' },
    { name: 'WELDING', group: 'MEP & Finishing', icon: 'Cog', color: 'orange' },
    { name: 'FABRICATION', group: 'MEP & Finishing', icon: 'Cog', color: 'slate' },
    { name: 'GLASS', group: 'MEP & Finishing', icon: 'Grid3x3', color: 'sky' },
    { name: 'ALUMINIUM', group: 'MEP & Finishing', icon: 'Package', color: 'slate' },
    { name: 'ROOFING', group: 'MEP & Finishing', icon: 'Building2', color: 'stone' },
    { name: 'HARDWARE', group: 'MEP & Finishing', icon: 'Wrench', color: 'slate' },
    { name: 'WATER SUPPLY', group: 'Infrastructure', icon: 'Droplets', color: 'blue' },
    { name: 'DRAINAGE', group: 'Infrastructure', icon: 'Droplets', color: 'teal' },
    { name: 'COMPOUND WALL', group: 'Infrastructure', icon: 'Fence', color: 'stone' },
    { name: 'FENCING', group: 'Infrastructure', icon: 'Fence', color: 'emerald' },
    { name: 'GATE', group: 'Infrastructure', icon: 'Building2', color: 'slate' },
    { name: 'ROAD WORK', group: 'Infrastructure', icon: 'Truck', color: 'slate' },
    { name: 'LANDSCAPING', group: 'Infrastructure', icon: 'TreePine', color: 'green' },
    { name: 'ARCHITECT', group: 'Professional Services', icon: 'GraduationCap', color: 'indigo' },
    { name: 'ENGINEER', group: 'Professional Services', icon: 'HardHat', color: 'blue' },
    { name: 'SURVEYOR', group: 'Professional Services', icon: 'Scale', color: 'purple' },
    { name: 'CONSULTANT', group: 'Professional Services', icon: 'Users', color: 'purple' },
    { name: 'CONTRACTOR', group: 'Professional Services', icon: 'Handshake', color: 'amber' },
    { name: 'LEGAL', group: 'Professional Services', icon: 'Scale', color: 'slate' },
    { name: 'GOVERNMENT', group: 'Government & Tax', icon: 'Landmark', color: 'blue' },
    { name: 'REGISTRATION', group: 'Government & Tax', icon: 'FileText', color: 'indigo' },
    { name: 'STAMP DUTY', group: 'Government & Tax', icon: 'Receipt', color: 'purple' },
    { name: 'TAX', group: 'Government & Tax', icon: 'Receipt', color: 'red' },
    { name: 'GST', group: 'Government & Tax', icon: 'Receipt', color: 'orange' },
    { name: 'TDS', group: 'Government & Tax', icon: 'Receipt', color: 'amber' },
    { name: 'OFFICE', group: 'Office & Admin', icon: 'Building2', color: 'slate' },
    { name: 'SALARY', group: 'Office & Admin', icon: 'Banknote', color: 'green' },
    { name: 'RENT', group: 'Office & Admin', icon: 'Building2', color: 'purple' },
    { name: 'INSURANCE', group: 'Office & Admin', icon: 'Shield', color: 'blue' },
    { name: 'TELEPHONE', group: 'Office & Admin', icon: 'Phone', color: 'cyan' },
    { name: 'INTERNET', group: 'Office & Admin', icon: 'Cog', color: 'indigo' },
    { name: 'STATIONERY', group: 'Office & Admin', icon: 'Printer', color: 'slate' },
    { name: 'PRINTING', group: 'Office & Admin', icon: 'Printer', color: 'slate' },
    { name: 'COURIER', group: 'Office & Admin', icon: 'Send', color: 'orange' },
    { name: 'CLEANING', group: 'Office & Admin', icon: 'SprayCan', color: 'teal' },
    { name: 'SECURITY', group: 'Office & Admin', icon: 'Shield', color: 'slate' },
    { name: 'TRANSPORT', group: 'Transport & Fuel', icon: 'Truck', color: 'blue' },
    { name: 'PETROL', group: 'Transport & Fuel', icon: 'Fuel', color: 'red' },
    { name: 'DIESEL', group: 'Transport & Fuel', icon: 'Fuel', color: 'amber' },
    { name: 'VEHICLE', group: 'Transport & Fuel', icon: 'Car', color: 'slate' },
    { name: 'BROKERAGE', group: 'Financial', icon: 'Handshake', color: 'amber' },
    { name: 'COMMISSION', group: 'Financial', icon: 'CreditCard', color: 'purple' },
    { name: 'ADVANCE', group: 'Financial', icon: 'Wallet', color: 'blue' },
    { name: 'DEPOSIT', group: 'Financial', icon: 'Banknote', color: 'green' },
    { name: 'REFUND', group: 'Financial', icon: 'Banknote', color: 'red' },
    { name: 'LOAN', group: 'Financial', icon: 'Banknote', color: 'indigo' },
    { name: 'EMI', group: 'Financial', icon: 'CreditCard', color: 'orange' },
    { name: 'INTEREST', group: 'Financial', icon: 'CreditCard', color: 'rose' },
    { name: 'MARKETING', group: 'Marketing & Misc', icon: 'BarChart3', color: 'pink' },
    { name: 'ADVERTISEMENT', group: 'Marketing & Misc', icon: 'Megaphone', color: 'purple' },
    { name: 'SOCIETY', group: 'Marketing & Misc', icon: 'Users', color: 'emerald' },
    { name: 'DONATION', group: 'Marketing & Misc', icon: 'Gift', color: 'rose' },
    { name: 'FOOD', group: 'Marketing & Misc', icon: 'UtensilsCrossed', color: 'amber' },
    { name: 'REFRESHMENT', group: 'Marketing & Misc', icon: 'UtensilsCrossed', color: 'orange' },
    { name: 'MAINTENANCE', group: 'Marketing & Misc', icon: 'Wrench', color: 'cyan' },
    { name: 'UTILITIES', group: 'Marketing & Misc', icon: 'Zap', color: 'yellow' },
    { name: 'MACHINERY', group: 'Assets', icon: 'Cog', color: 'slate' },
    { name: 'EQUIPMENT', group: 'Assets', icon: 'Wrench', color: 'slate' },
    { name: 'FURNITURE', group: 'Assets', icon: 'Armchair', color: 'amber' },
    { name: 'FIXTURE', group: 'Assets', icon: 'Cog', color: 'stone' },
    { name: 'MISC', group: 'Other', icon: 'HelpCircle', color: 'slate' },
    { name: 'MISCELLANEOUS', group: 'Other', icon: 'HelpCircle', color: 'slate' },
];

const GROUP_ORDER = [
    'Construction & Civil', 'MEP & Finishing', 'Infrastructure',
    'Professional Services', 'Government & Tax', 'Office & Admin',
    'Transport & Fuel', 'Financial', 'Marketing & Misc', 'Assets', 'Custom', 'Other',
];

const EMPTY_FORM = { name: '', icon: 'Tag', color: 'slate', grp: 'Custom' };

export const ExpenseCategories = () => {
    const { isAdmin } = useAuth();
    const [searchQuery, setSearchQuery] = useState('');
    const [customCategories, setCustomCategories] = useState([]);
    const [hiddenPredefined, setHiddenPredefined] = useState(() => {
        try { return JSON.parse(localStorage.getItem('hidden_expense_cats') || '[]'); } catch { return []; }
    });
    const [loading, setLoading] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState({ ...EMPTY_FORM });
    const [submitting, setSubmitting] = useState(false);

    // Fetch custom categories from backend
    const fetchCustom = useCallback(async () => {
        try {
            setLoading(true);
            // Watchdog so the spinner can never hang on a stalled request.
            const watchdog = setTimeout(() => setLoading(false), 15000);
            const { data } = await api.get('/expense-categories');
            clearTimeout(watchdog);
            setCustomCategories(data.categories || []);
        } catch (err) {
            console.error('Failed to fetch custom categories:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchCustom(); }, [fetchCustom]);

    // Merge predefined (minus hidden) + custom
    const allCategories = useMemo(() => {
        const predefined = PREDEFINED
            .filter(c => !hiddenPredefined.includes(c.name))
            .map(c => ({ ...c, is_predefined: true }));
        const custom = customCategories.map(c => ({
            id: c.id,
            name: c.name,
            group: c.grp || 'Custom',
            icon: c.icon || 'Tag',
            color: c.color || 'slate',
            is_predefined: false,
        }));
        return [...predefined, ...custom];
    }, [customCategories, hiddenPredefined]);

    // Filter
    const filtered = useMemo(() => {
        if (!searchQuery) return allCategories;
        const q = searchQuery.toUpperCase();
        return allCategories.filter(c =>
            c.name.includes(q) || c.group.toUpperCase().includes(q)
        );
    }, [allCategories, searchQuery]);

    // Group
    const grouped = useMemo(() => {
        const map = {};
        filtered.forEach(cat => {
            if (!map[cat.group]) map[cat.group] = [];
            map[cat.group].push(cat);
        });
        return GROUP_ORDER
            .filter(g => map[g])
            .map(g => ({ group: g, items: map[g] }));
    }, [filtered]);

    // CRUD handlers
    const handleOpenCreate = () => {
        setForm({ ...EMPTY_FORM });
        setEditingId(null);
        setDialogOpen(true);
    };

    const handleOpenEdit = (cat) => {
        if (cat.is_predefined) return; // predefined can't be edited
        setForm({ name: cat.name, icon: cat.icon || 'Tag', color: cat.color || 'slate', grp: cat.group || 'Custom' });
        setEditingId(cat.id);
        setDialogOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) { toast.error('Name is required'); return; }
        setSubmitting(true);
        try {
            let savedCat = null;
            if (editingId) {
                const { data } = await api.put(`/expense-categories/${editingId}`, form);
                savedCat = data?.category || null;
                toast.success('Category updated');
            } else {
                const { data } = await api.post('/expense-categories', form);
                savedCat = data?.category || null;
                toast.success('Category created');
            }
            // Optimistic in-place update — close dialog instantly.
            if (savedCat) {
                setCustomCategories((prev) => {
                    const idx = prev.findIndex((c) => c.id === savedCat.id);
                    if (idx === -1) return [...prev, savedCat];
                    const next = prev.slice();
                    next[idx] = { ...next[idx], ...savedCat };
                    return next;
                });
            }
            setDialogOpen(false);
            // Reconcile in background.
            fetchCustom();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to save');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (cat) => {
        if (!window.confirm(`Delete category "${cat.name}"?`)) return;
        if (cat.is_predefined) {
            // Hide predefined category locally
            const updated = [...hiddenPredefined, cat.name];
            setHiddenPredefined(updated);
            localStorage.setItem('hidden_expense_cats', JSON.stringify(updated));
            toast.success('Category removed');
            return;
        }
        // Optimistic removal — instant UI feedback.
        const snapshot = customCategories;
        setCustomCategories((prev) => prev.filter((c) => c.id !== cat.id));
        try {
            await api.delete(`/expense-categories/${cat.id}`);
            toast.success('Category deleted');
            fetchCustom();
        } catch (err) {
            setCustomCategories(snapshot); // rollback
            toast.error(err.response?.data?.message || 'Failed to delete');
        }
    };

    return (
        <div className="max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Expense Categories</h1>
                    <p className="text-sm text-slate-500 mt-0.5">
                        All available categories for expense classification
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs font-mono">
                        {allCategories.length} categories
                    </Badge>
                    {isAdmin && (
                        <Button onClick={handleOpenCreate} size="sm" className="gap-1.5">
                            <Plus className="w-4 h-4" />
                            Add Category
                        </Button>
                    )}
                </div>
            </div>

            {/* Search */}
            <div className="mb-5">
                <div className="relative max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                        placeholder="Search categories..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 h-9 text-sm"
                    />
                </div>
            </div>

            {/* Categories by group */}
            <div className="space-y-6">
                {grouped.map(({ group, items }) => {
                    return (
                        <div key={group}>
                            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                <Tag className="w-3.5 h-3.5" />
                                {group} ({items.length})
                            </h2>
                            <div className="flex flex-wrap gap-1.5 mb-5">
                                {items.map(cat => {
                                    const Icon = ICON_MAP[cat.icon] || Tag;
                                    return (
                                        <div key={cat.name}
                                            className="group inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 bg-white hover:shadow-sm transition-all">
                                            <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${getColorCls(cat.color)}`}>
                                                <Icon className="w-3 h-3" />
                                            </div>
                                            <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">{cat.name}</span>
                                            {isAdmin && (
                                                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-0.5">
                                                    {!cat.is_predefined && (
                                                        <button onClick={() => handleOpenEdit(cat)}
                                                            className="p-0.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700">
                                                            <Edit2 className="w-2.5 h-2.5" />
                                                        </button>
                                                    )}
                                                    <button onClick={() => handleDelete(cat)}
                                                        className="p-0.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600">
                                                        <Trash2 className="w-2.5 h-2.5" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            <Separator />
                        </div>
                    );
                })}

                {grouped.length === 0 && (
                    <div className="text-center py-12">
                        <Search className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                        <p className="text-sm text-slate-500">No categories match "{searchQuery}"</p>
                    </div>
                )}
            </div>

            {/* Create / Edit Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-base">{editingId ? 'Edit Category' : 'New Expense Category'}</DialogTitle>
                        <DialogDescription className="text-sm">
                            {editingId ? 'Update this custom category.' : 'Create a new expense category visible to all users.'}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-medium">Category Name <span className="text-red-500">*</span></Label>
                            <Input
                                placeholder="e.g. PLOTTER, SIGNAGE, AUDIT..."
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value.toUpperCase() })}
                                required
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-medium">Group</Label>
                            <Select value={form.grp} onValueChange={(v) => setForm({ ...form, grp: v })}>
                                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent position="popper" className="max-h-60">
                                    {GROUP_OPTIONS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-medium">Icon</Label>
                                <Select value={form.icon} onValueChange={(v) => setForm({ ...form, icon: v })}>
                                    <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent position="popper" className="max-h-60">
                                        {ICON_OPTIONS.map(ico => {
                                            const I = ICON_MAP[ico];
                                            return (
                                                <SelectItem key={ico} value={ico}>
                                                    <span className="flex items-center gap-2"><I className="w-3.5 h-3.5" /> {ico}</span>
                                                </SelectItem>
                                            );
                                        })}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-medium">Color</Label>
                                <Select value={form.color} onValueChange={(v) => setForm({ ...form, color: v })}>
                                    <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent position="popper" className="max-h-60">
                                        {COLOR_OPTIONS.map(c => (
                                            <SelectItem key={c.value} value={c.value}>
                                                <span className="flex items-center gap-2">
                                                    <span className={`w-3 h-3 rounded-full ${c.cls.split(' ')[0]}`} />
                                                    {c.label}
                                                </span>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" size="sm" onClick={() => setDialogOpen(false)} disabled={submitting}>
                                Cancel
                            </Button>
                            <Button type="submit" size="sm" disabled={submitting}>
                                {submitting ? (
                                    <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />{editingId ? 'Updating...' : 'Creating...'}</>
                                ) : (editingId ? 'Update' : 'Create')}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default ExpenseCategories;
