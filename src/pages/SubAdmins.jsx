import { useState, useEffect } from 'react';
import api from '../api/api';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '../components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  UserPlus, Edit2, Trash2, Mail, Phone, Shield,
  Eye, EyeOff, AlertCircle, Check, Search
} from 'lucide-react';

export const SubAdmins = () => {
  const [subAdmins, setSubAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showPass, setShowPass] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });

  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', password: '', role: 'sub_admin',
  });

  const fetchSubAdmins = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/sub-admins');
      setSubAdmins(response.data.subAdmins || []);
    } catch (err) {
      console.error('Failed to fetch sub-admins:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSubAdmins(); }, []);

  const resetForm = () => {
    setFormData({ name: '', email: '', phone: '', password: '', role: 'sub_admin' });
    setEditingId(null);
    setShowPass(false);
    setMessage({ type: '', text: '' });
  };

  const handleOpenCreate = () => { resetForm(); setDialogOpen(true); };

  const handleOpenEdit = (admin) => {
    setFormData({
      name: admin.name,
      email: admin.email,
      phone: admin.phone || '',
      password: '',
      role: (admin.role || 'sub_admin').toLowerCase(),
    });
    setEditingId(admin.id);
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    try {
      if (editingId) {
        const payload = { ...formData };
        if (!payload.password) delete payload.password;
        await api.put(`/admin/sub-admins/${editingId}`, payload);
        setMessage({ type: 'success', text: 'Sub-admin updated' });
      } else {
        if (!formData.password) { setMessage({ type: 'error', text: 'Password is required' }); return; }
        await api.post('/admin/sub-admins', formData);
        setMessage({ type: 'success', text: 'Sub-admin created' });
      }
      await fetchSubAdmins();
      setTimeout(() => setDialogOpen(false), 500);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Operation failed' });
    }
  };

  const handleDeactivate = async (id) => {
    if (!window.confirm('Deactivate this sub-admin?')) return;
    try { await api.delete(`/admin/sub-admins/${id}`); await fetchSubAdmins(); } catch (err) { console.error('Failed:', err); }
  };

  const handleToggleActive = async (admin) => {
    try { await api.put(`/admin/sub-admins/${admin.id}`, { is_active: !admin.is_active }); await fetchSubAdmins(); } catch (err) { console.error('Failed:', err); }
  };

  const filteredAdmins = subAdmins.filter(
    (a) => a.name?.toLowerCase().includes(searchQuery.toLowerCase()) || a.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Admin Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage admins and sub-admins for the system</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={handleOpenCreate}>
              <UserPlus className="w-4 h-4 mr-1.5" /> Add Admin / Sub-Admin
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-base">{editingId ? 'Edit User' : 'New Admin / Sub-Admin'}</DialogTitle>
              <DialogDescription className="text-sm">
                {editingId ? 'Update user details and role.' : 'Create a new admin or sub-admin account.'}
              </DialogDescription>
            </DialogHeader>

            {message.text && (
              <div className={`flex gap-2 p-3 rounded-lg text-sm ${
                message.type === 'success' ? 'bg-emerald-50 border border-emerald-100 text-emerald-700' : 'bg-red-50 border border-red-100 text-red-700'
              }`}>
                {message.type === 'success' ? <Check className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
                {message.text}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Full Name *</Label>
                  <Input placeholder="John Doe" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input placeholder="+91 9876543210" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Email *</Label>
                <Input type="email" placeholder="john@company.com" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label>Role *</Label>
                <Select value={formData.role} onValueChange={(v) => setFormData({ ...formData, role: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="sub_admin">Sub-Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{editingId ? 'New Password (optional)' : 'Password *'}</Label>
                <div className="relative">
                  <Input type={showPass ? 'text' : 'password'} placeholder={editingId ? 'Leave blank to keep' : 'Min. 6 characters'} value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} required={!editingId} className="pr-10" />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" tabIndex={-1}>
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" size="sm">{editingId ? 'Update' : 'Create'}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="Search by name or email..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 h-9" />
        </div>
        <span className="text-xs text-slate-400 ml-auto">{filteredAdmins.length} member{filteredAdmins.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      <Card className="shadow-none border-slate-200">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
            </div>
          ) : filteredAdmins.length === 0 ? (
            <div className="text-center py-16">
              <Shield className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No admins or sub-admins found</p>
              <p className="text-xs text-slate-400 mt-0.5">Add your first admin or sub-admin</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs">Name</TableHead>
                  <TableHead className="text-xs">Contact</TableHead>
                  <TableHead className="text-xs">Role</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Joined</TableHead>
                  <TableHead className="text-xs text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAdmins.map((admin) => (
                  <TableRow key={admin.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 text-sm font-medium shrink-0">
                          {admin.name?.charAt(0)?.toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-slate-800">{admin.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 text-sm text-slate-600">
                          <Mail className="w-3 h-3 text-slate-400" />
                          {admin.email}
                        </div>
                        {admin.phone && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-400">
                            <Phone className="w-3 h-3" />
                            {admin.phone}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] ${admin.role === 'admin' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-50 text-slate-700 border-slate-200'}`}>
                        {admin.role === 'admin' ? 'ADMIN' : 'SUB-ADMIN'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <button onClick={() => handleToggleActive(admin)} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium cursor-pointer transition-colors ${
                        admin.is_active ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-red-50 text-red-600 hover:bg-red-100'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${admin.is_active ? 'bg-emerald-500' : 'bg-red-400'}`} />
                        {admin.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {admin.created_at ? new Date(admin.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(admin)} className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700">
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeactivate(admin.id)} className="h-7 w-7 p-0 text-slate-400 hover:text-red-600">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SubAdmins;
