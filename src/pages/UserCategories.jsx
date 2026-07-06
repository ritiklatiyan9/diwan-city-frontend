import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Separator } from '../components/ui/separator';
import { Card, CardContent } from '../components/ui/card';
import {
    Dialog, DialogContent, DialogDescription, DialogFooter,
    DialogHeader, DialogTitle,
} from '../components/ui/dialog';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import {
    Tags, Plus, Edit2, Trash2, Loader2, Shield, Search,
    UserCheck, Tractor, Users, Handshake, Store, UserCog,
    HelpCircle, Tag, Lock,
} from 'lucide-react';
import { toast } from 'sonner';

const ICON_MAP = {
    UserCheck, Tractor, Users, Handshake, Store, UserCog, HelpCircle, Tag, Tags, Shield,
};

const COLOR_OPTIONS = [
    { value: 'blue', label: 'Blue', class: 'bg-blue-100 text-blue-700' },
    { value: 'emerald', label: 'Green', class: 'bg-emerald-100 text-emerald-700' },
    { value: 'purple', label: 'Purple', class: 'bg-purple-100 text-purple-700' },
    { value: 'amber', label: 'Amber', class: 'bg-amber-100 text-amber-700' },
    { value: 'cyan', label: 'Cyan', class: 'bg-cyan-100 text-cyan-700' },
    { value: 'orange', label: 'Orange', class: 'bg-orange-100 text-orange-700' },
    { value: 'indigo', label: 'Indigo', class: 'bg-indigo-100 text-indigo-700' },
    { value: 'rose', label: 'Rose', class: 'bg-rose-100 text-rose-700' },
    { value: 'teal', label: 'Teal', class: 'bg-teal-100 text-teal-700' },
    { value: 'slate', label: 'Gray', class: 'bg-slate-100 text-slate-700' },
];

const ICON_OPTIONS = ['UserCheck', 'Tractor', 'Users', 'Handshake', 'Store', 'UserCog', 'HelpCircle', 'Tag', 'Tags', 'Shield'];

const getColorClass = (color) => {
    const c = COLOR_OPTIONS.find(o => o.value === color);
    return c ? c.class : 'bg-slate-100 text-slate-700';
};

const EMPTY_FORM = { name: '', description: '', icon: 'Tag', color: 'slate' };

export const UserCategories = () => {
    const { isAdmin } = useAuth();
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState({ ...EMPTY_FORM });
    const [submitting, setSubmitting] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchCategories = useCallback(async () => {
        setLoading(true);
        // Safety watchdog so the spinner can never hang on a stalled request.
        const watchdog = setTimeout(() => setLoading(false), 15000);
        try {
            const { data } = await api.get('/member-categories');
            setCategories(data.categories || []);
        } catch (err) {
            console.error('Failed to fetch categories:', err);
            toast.error('Failed to load categories');
        } finally {
            clearTimeout(watchdog);
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchCategories(); }, [fetchCategories]);

    const handleOpenCreate = () => {
        setForm({ ...EMPTY_FORM });
        setEditingId(null);
        setDialogOpen(true);
    };

    const handleOpenEdit = (cat) => {
        setForm({ name: cat.name, description: cat.description || '', icon: cat.icon || 'Tag', color: cat.color || 'slate' });
        setEditingId(cat.id);
        setDialogOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            let savedCat = null;
            if (editingId) {
                const { data } = await api.put(`/member-categories/${editingId}`, form);
                savedCat = data?.category || null;
                toast.success('Category updated');
            } else {
                const { data } = await api.post('/member-categories', form);
                savedCat = data?.category || null;
                toast.success('Category created');
            }
            // Optimistic in-place update so the dialog closes instantly.
            if (savedCat) {
                setCategories(prev => {
                    const idx = prev.findIndex(c => c.id === savedCat.id);
                    if (idx === -1) return [...prev, savedCat];
                    const next = prev.slice();
                    next[idx] = { ...next[idx], ...savedCat };
                    return next;
                });
            }
            setDialogOpen(false);
            // Reconcile in background.
            fetchCategories();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to save');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (cat) => {
        if (!window.confirm(`Delete category "${cat.name}"? This cannot be undone.`)) return;
        const snapshot = categories;
        setCategories(prev => prev.filter(c => c.id !== cat.id));
        try {
            await api.delete(`/member-categories/${cat.id}`);
            toast.success('Category deleted');
            fetchCategories();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to delete');
            setCategories(snapshot); // rollback
        }
    };

    const filtered = categories.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const predefined = filtered.filter(c => c.is_predefined);
    const custom = filtered.filter(c => !c.is_predefined);

    return (
        <div className="max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">User Categories</h1>
                    <p className="text-sm text-slate-500 mt-0.5">Manage member types and categories</p>
                </div>
                {isAdmin && (
                    <Button onClick={handleOpenCreate} size="sm" className="gap-1.5">
                        <Plus className="w-4 h-4" />
                        Add Category
                    </Button>
                )}
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

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Predefined Categories */}
                    <div>
                        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                            <Lock className="w-3.5 h-3.5" />
                            Predefined Categories ({predefined.length})
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                            {predefined.map(cat => {
                                const IconComp = ICON_MAP[cat.icon] || Tag;
                                return (
                                    <Card key={cat.id} className="border-slate-200/80 hover:shadow-sm transition-shadow">
                                        <CardContent className="p-4">
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-center gap-2.5">
                                                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${getColorClass(cat.color)}`}>
                                                        <IconComp className="w-4 h-4" />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-semibold text-slate-800">{cat.name}</p>
                                                        <p className="text-[10px] text-slate-400 font-mono">{cat.slug}</p>
                                                    </div>
                                                </div>
                                                <span className="px-1.5 py-0.5 text-[9px] font-medium bg-slate-100 text-slate-500 rounded">
                                                    Built-in
                                                </span>
                                            </div>
                                            {cat.description && (
                                                <p className="text-xs text-slate-500 mt-2 line-clamp-2">{cat.description}</p>
                                            )}
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    </div>

                    <Separator />

                    {/* Custom Categories */}
                    <div>
                        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                            <Tags className="w-3.5 h-3.5" />
                            Custom Categories ({custom.length})
                        </h2>
                        {custom.length === 0 ? (
                            <div className="text-center py-12 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                                <Tags className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                <p className="text-sm text-slate-500">No custom categories yet</p>
                                <p className="text-xs text-slate-400 mt-0.5">Click "Add Category" to create one</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                {custom.map(cat => {
                                    const IconComp = ICON_MAP[cat.icon] || Tag;
                                    return (
                                        <Card key={cat.id} className="border-slate-200/80 hover:shadow-sm transition-shadow group">
                                            <CardContent className="p-4">
                                                <div className="flex items-start justify-between">
                                                    <div className="flex items-center gap-2.5">
                                                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${getColorClass(cat.color)}`}>
                                                            <IconComp className="w-4 h-4" />
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-semibold text-slate-800">{cat.name}</p>
                                                            <p className="text-[10px] text-slate-400 font-mono">{cat.slug}</p>
                                                        </div>
                                                    </div>
                                                    {isAdmin && (
                                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button onClick={() => handleOpenEdit(cat)}
                                                                className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700">
                                                                <Edit2 className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button onClick={() => handleDelete(cat)}
                                                                className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600">
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                                {cat.description && (
                                                    <p className="text-xs text-slate-500 mt-2 line-clamp-2">{cat.description}</p>
                                                )}
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Create/Edit Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-base">{editingId ? 'Edit Category' : 'Create Category'}</DialogTitle>
                        <DialogDescription className="text-sm">
                            {editingId ? 'Update category details.' : 'Add a new custom member category.'}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-medium">Category Name</Label>
                            <Input
                                placeholder="e.g. Investor, Consultant..."
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                required
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-medium">Description</Label>
                            <Textarea
                                placeholder="Brief description of this category..."
                                value={form.description}
                                onChange={(e) => setForm({ ...form, description: e.target.value })}
                                rows={2}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-medium">Icon</Label>
                                <Select value={form.icon} onValueChange={(v) => setForm({ ...form, icon: v })}>
                                    <SelectTrigger className="h-9 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {ICON_OPTIONS.map(ico => {
                                            const I = ICON_MAP[ico] || Tag;
                                            return (
                                                <SelectItem key={ico} value={ico}>
                                                    <span className="flex items-center gap-2">
                                                        <I className="w-3.5 h-3.5" /> {ico}
                                                    </span>
                                                </SelectItem>
                                            );
                                        })}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-medium">Color</Label>
                                <Select value={form.color} onValueChange={(v) => setForm({ ...form, color: v })}>
                                    <SelectTrigger className="h-9 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {COLOR_OPTIONS.map(c => (
                                            <SelectItem key={c.value} value={c.value}>
                                                <span className="flex items-center gap-2">
                                                    <span className={`w-3 h-3 rounded-full ${c.class.split(' ')[0]}`} />
                                                    {c.label}
                                                </span>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" size="sm" onClick={() => setDialogOpen(false)} disabled={submitting}>Cancel</Button>
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

export default UserCategories;
