import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import {
    Shield, Users, Tractor, Landmark, BookOpen, Wallet, Banknote,
    LayoutGrid, ClipboardList, CreditCard, Home, FileText, Settings,
    Save, Loader2, CheckCircle2, AlertCircle, Store, MessageSquare, Sheet,
} from 'lucide-react';

const MODULE_CONFIG = [
    { key: 'dashboard', label: 'Dashboard', icon: Home, readOnly: true },
    { key: 'clients', label: 'User Management', icon: Users },
    { key: 'vendors', label: 'Vendor Management', icon: Store },
    { key: 'farmers', label: 'Farmer Payments', icon: Tractor },
    { key: 'commissions', label: 'Plot Commission', icon: Landmark },
    { key: 'daybook', label: 'Day Book', icon: BookOpen },
    { key: 'cashflow', label: 'Cash Flow', icon: Wallet },
    { key: 'firm_transactions', label: 'Firm Transactions', icon: Banknote },
    { key: 'plot_payments', label: 'Plot Payments', icon: LayoutGrid },
    { key: 'plot_registry', label: 'Plot Registry', icon: ClipboardList },
    { key: 'expenses', label: 'Expenses', icon: CreditCard },
    { key: 'imprest', label: 'Imprest', icon: Wallet },
    { key: 'chat', label: 'Internal Chat', icon: MessageSquare },
    { key: 'excel', label: 'Native Excel', icon: Sheet },
    { key: 'reports', label: 'Reports', icon: FileText, readOnly: true },
    { key: 'settings', label: 'Settings', icon: Settings, readOnly: true },
];

const ACTIONS = [
    { key: 'read', label: 'Read' },
    { key: 'write', label: 'Write' },
    { key: 'update', label: 'Update' },
    { key: 'delete', label: 'Delete' },
];

const PermissionManagement = () => {
    const { user } = useAuth();
    const [subAdmins, setSubAdmins] = useState([]);
    const [subAdminsLoading, setSubAdminsLoading] = useState(true);
    const [selectedUserId, setSelectedUserId] = useState('');
    const [permissions, setPermissions] = useState({});
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState(null);

    // Fetch sub-admins
    useEffect(() => {
        const fetchSubAdmins = async () => {
            setSubAdminsLoading(true);
            try {
                const res = await api.get('/admin/sub-admins');
                const allUsers = res.data.subAdmins || [];
                setSubAdmins(allUsers.filter((u) => (u.role || '').toLowerCase() === 'sub_admin'));
            } catch (err) {
                console.error('Failed to fetch sub-admins:', err);
            } finally {
                setSubAdminsLoading(false);
            }
        };
        fetchSubAdmins();
    }, []);

    // Fetch permissions for selected sub-admin
    useEffect(() => {
        if (!selectedUserId) {
            setPermissions({});
            return;
        }
        const fetchPermissions = async () => {
            setLoading(true);
            try {
                const res = await api.get(`/permissions/${selectedUserId}`);
                const permsArray = res.data.permissions || [];
                const permsMap = {};
                permsArray.forEach(p => {
                    permsMap[p.module] = {
                        can_read: p.can_read,
                        can_write: p.can_write,
                        can_update: p.can_update,
                        can_delete: p.can_delete,
                    };
                });
                // Fill in any missing modules with defaults
                MODULE_CONFIG.forEach(m => {
                    if (!permsMap[m.key]) {
                        permsMap[m.key] = {
                            can_read: true,
                            can_write: true,
                            can_update: true,
                            can_delete: false,
                        };
                    }
                });
                setPermissions(permsMap);
            } catch (err) {
                console.error('Failed to fetch permissions:', err);
                showToast('Failed to load permissions', 'error');
            } finally {
                setLoading(false);
            }
        };
        fetchPermissions();
    }, [selectedUserId]);

    const showToast = (message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const togglePermission = (module, action) => {
        setPermissions(prev => ({
            ...prev,
            [module]: {
                ...prev[module],
                [`can_${action}`]: !prev[module]?.[`can_${action}`],
            },
        }));
    };

    const handleSave = async () => {
        if (!selectedUserId) return;
        setSaving(true);
        try {
            const permissionsArray = Object.entries(permissions).map(([module, perms]) => ({
                module,
                can_read: perms.can_read,
                can_write: perms.can_write,
                can_update: perms.can_update,
                can_delete: perms.can_delete,
            }));
            await api.put(`/permissions/${selectedUserId}`, { permissions: permissionsArray });
            showToast('Permissions saved successfully!', 'success');
        } catch (err) {
            console.error('Failed to save permissions:', err);
            showToast('Failed to save permissions', 'error');
        } finally {
            setSaving(false);
        }
    };

    const selectedUser = subAdmins.find(sa => String(sa.id) === selectedUserId);

    return (
        <div className="space-y-6 max-w-5xl">
            {/* Toast */}
            {toast && (
                <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium animate-in slide-in-from-top-2 duration-300 ${toast.type === 'success'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                    }`}>
                    {toast.type === 'success' ? (
                        <CheckCircle2 className="w-4 h-4" />
                    ) : (
                        <AlertCircle className="w-4 h-4" />
                    )}
                    {toast.message}
                </div>
            )}

            {/* Header */}
            <div>
                <div className="flex items-center gap-3 mb-1">
                    <div className="p-2 rounded-xl bg-linear-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-200">
                        <Shield className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Permission Management</h1>
                        <p className="text-sm text-slate-500">Control sub-admin access to modules</p>
                    </div>
                </div>
            </div>

            {/* Sub-admin Selector */}
            <Card className="border-slate-200/80 shadow-sm">
                <CardHeader className="pb-4">
                    <CardTitle className="text-sm font-semibold text-slate-700">Select Sub-Admin</CardTitle>
                    <CardDescription className="text-xs">
                        Choose a sub-admin to manage their permissions across all modules
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-4">
                        <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                            <SelectTrigger className="w-80 h-10 bg-white border-slate-200 text-sm">
                                <SelectValue placeholder="Select a sub-admin..." />
                            </SelectTrigger>
                            <SelectContent>
                                {subAdminsLoading ? (
                                    <div className="flex items-center justify-center p-3">
                                        <Loader2 className="w-4 h-4 text-violet-500 animate-spin mr-2" />
                                        <span className="text-xs text-slate-500">Loading sub-admins...</span>
                                    </div>
                                ) : subAdmins.length === 0 ? (
                                    <div className="px-3 py-2 text-xs text-slate-400">No sub-admins found</div>
                                ) : (
                                    subAdmins.map(sa => (
                                        <SelectItem key={sa.id} value={String(sa.id)} className="text-sm">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600">
                                                    {sa.name?.charAt(0)?.toUpperCase()}
                                                </div>
                                                <span>{sa.name}</span>
                                                <span className="text-slate-400 text-xs">({sa.email})</span>
                                            </div>
                                        </SelectItem>
                                    ))
                                )}
                            </SelectContent>
                        </Select>
                        {selectedUser && (
                            <Badge variant="outline" className={`text-xs ${selectedUser.is_active ? 'border-emerald-200 text-emerald-700 bg-emerald-50' : 'border-red-200 text-red-700 bg-red-50'}`}>
                                {selectedUser.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Permissions Grid */}
            {selectedUserId && (
                <Card className="border-slate-200/80 shadow-sm">
                    <CardHeader className="pb-3 flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="text-sm font-semibold text-slate-700">Module Permissions</CardTitle>
                            <CardDescription className="text-xs">
                                Toggle access for each module. Delete is OFF by default.
                            </CardDescription>
                        </div>
                        <Button
                            onClick={handleSave}
                            disabled={saving}
                            className="bg-linear-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white shadow-md shadow-violet-200 gap-2"
                            size="sm"
                        >
                            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                            {saving ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <div className="flex flex-col items-center gap-3">
                                    <Loader2 className="w-6 h-6 text-violet-500 animate-spin" />
                                    <p className="text-sm text-slate-400">Loading permissions...</p>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-0">
                                {/* Table Header */}
                                <div className="flex items-center px-6 py-3 bg-slate-50 rounded-t-xl border border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    <div className="flex-1">Module</div>
                                    <div className="flex items-center gap-4 w-90 justify-end">
                                        {ACTIONS.map(action => (
                                            <div key={action.key} className="w-16 text-center">{action.label}</div>
                                        ))}
                                    </div>
                                </div>

                                {/* Table Body */}
                                <div className="border border-t-0 border-slate-200 rounded-b-xl divide-y divide-slate-100">
                                    {MODULE_CONFIG.map((mod) => {
                                        const Icon = mod.icon;
                                        const perms = permissions[mod.key] || {};
                                        return (
                                            <div
                                                key={mod.key}
                                                className="flex items-center px-6 py-3 hover:bg-slate-50/50 transition-colors"
                                            >
                                                <div className="flex items-center gap-3 flex-1">
                                                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shadow-sm border border-slate-200/60">
                                                        <Icon className="w-4 h-4 text-slate-600" />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-medium text-slate-800">{mod.label}</p>
                                                        <p className="text-[10px] font-medium text-slate-400">{mod.key}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4 w-90 justify-end">
                                                    {ACTIONS.map(action => (
                                                        <div key={action.key} className="w-16 flex justify-center">
                                                            {mod.readOnly && action.key !== 'read' ? (
                                                                <span className="text-[10px] text-slate-300 font-medium">—</span>
                                                            ) : (
                                                                <Switch
                                                                    checked={perms[`can_${action.key}`] ?? (action.key === 'delete' ? false : true)}
                                                                    onCheckedChange={() => {
                                                                        if (mod.readOnly && action.key === 'read') return;
                                                                        togglePermission(mod.key, action.key);
                                                                    }}
                                                                    disabled={mod.readOnly && action.key === 'read'}
                                                                    className="border-2 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-600 data-[state=unchecked]:bg-red-500 data-[state=unchecked]:border-red-600 shadow-sm"
                                                                />
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Empty State */}
            {!selectedUserId && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                        <Shield className="w-7 h-7 text-slate-400" />
                    </div>
                    <h3 className="text-sm font-semibold text-slate-700 mb-1">Select a Sub-Admin</h3>
                    <p className="text-xs text-slate-400 max-w-xs">
                        Choose a sub-admin from the dropdown above to view and manage their module permissions
                    </p>
                </div>
            )}
        </div>
    );
};

export default PermissionManagement;
