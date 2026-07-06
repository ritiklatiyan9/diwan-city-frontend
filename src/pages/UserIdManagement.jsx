import { useEffect, useMemo, useState } from 'react';
import api from '../api/api';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { AlertCircle, Check, Eye, EyeOff, Home, KeyRound, Lock, Search, ShieldCheck, Unlock } from 'lucide-react';
import { Checkbox } from '../components/ui/checkbox';

const UserIdManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  // Site access
  const [allSites, setAllSites] = useState([]);
  const [siteDialogOpen, setSiteDialogOpen] = useState(false);
  const [siteUser, setSiteUser] = useState(null);
  const [selectedSiteIds, setSelectedSiteIds] = useState([]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/sub-admins');
      setUsers(res.data.subAdmins || []);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to load users' });
    } finally {
      setLoading(false);
    }
  };

  const loadSites = async () => {
    try {
      const res = await api.get('/sites');
      setAllSites(res.data.sites || res.data || []);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    loadUsers();
    loadSites();
  }, []);

  useEffect(() => {
    if (!message.text) return;
    const timer = setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    return () => clearTimeout(timer);
  }, [message]);

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      String(u.id).includes(q) ||
      (u.name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q)
    );
  }, [users, query]);

  const handleToggleAccess = async (user) => {
    const nextState = !user.is_active;
    const action = nextState ? 'unblock' : 'block';
    if (!window.confirm(`Are you sure you want to ${action} user ${user.name}?`)) return;

    setSubmitting(true);
    try {
      await api.patch(`/admin/sub-admins/${user.id}/access`, { is_active: nextState });
      setMessage({ type: 'success', text: `User ${nextState ? 'unblocked' : 'blocked'} successfully` });
      await loadUsers();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to update access' });
    } finally {
      setSubmitting(false);
    }
  };

  const openResetDialog = (user) => {
    setSelectedUser(user);
    setNewPassword('');
    setShowPassword(false);
    setResetDialogOpen(true);
  };

  const openSiteDialog = (user) => {
    setSiteUser(user);
    setSelectedSiteIds(user.site_ids || []);
    setSiteDialogOpen(true);
  };

  const toggleSite = (siteId) => {
    setSelectedSiteIds((prev) =>
      prev.includes(siteId) ? prev.filter((id) => id !== siteId) : [...prev, siteId]
    );
  };

  const handleSaveSites = async () => {
    if (!siteUser) return;
    setSubmitting(true);
    try {
      await api.put(`/admin/sub-admins/${siteUser.id}`, { site_ids: selectedSiteIds });
      setSiteDialogOpen(false);
      setMessage({ type: 'success', text: `Site access updated for ${siteUser.name}` });
      await loadUsers();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to update site access' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    if (!selectedUser) return;
    if (!newPassword || newPassword.length < 6) {
      setMessage({ type: 'error', text: 'New password must be at least 6 characters' });
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/admin/sub-admins/${selectedUser.id}/reset-password`, { new_password: newPassword });
      setResetDialogOpen(false);
      setMessage({ type: 'success', text: `Password reset for ${selectedUser.name}` });
      await loadUsers();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to reset password' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">User ID Management</h1>
        <p className="text-sm text-slate-500 mt-0.5">Admin controls for user access block/unblock and password reset/change</p>
      </div>

      {message.text && (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm border ${
          message.type === 'success'
            ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
            : 'bg-red-50 border-red-100 text-red-700'
        }`}>
          {message.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{message.text}</span>
        </div>
      )}

      <Card className="shadow-none border-slate-200">
        <CardContent className="p-4 flex items-center justify-between gap-3">
          <div className="relative w-full max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by user id, name, email"
              className="pl-9"
            />
          </div>
          <Badge variant="outline" className="text-xs bg-slate-50 border-slate-200 text-slate-600">
            {filteredUsers.length} users
          </Badge>
        </CardContent>
      </Card>

      <Card className="shadow-none border-slate-200">
        <CardContent className="p-0">
          {loading ? (
            <div className="py-14 text-center text-sm text-slate-500">Loading users...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-14 text-center text-sm text-slate-500">No users found.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent bg-slate-50/80">
                  <TableHead className="text-[11px] uppercase tracking-wider">User ID</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider">Name</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider">Email</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider">Role</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider">Status</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider">Joined</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="text-sm font-semibold text-slate-700">#{u.id}</TableCell>
                    <TableCell className="text-sm text-slate-800">{u.name}</TableCell>
                    <TableCell className="text-sm text-slate-600">{u.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] ${u.role === 'admin' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-50 text-slate-700 border-slate-200'}`}>
                        {u.role === 'admin' ? 'ADMIN' : 'SUB-ADMIN'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] ${u.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                        {u.is_active ? 'ACTIVE' : 'BLOCKED'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                          disabled={submitting}
                          onClick={() => openSiteDialog(u)}
                          title="Manage site access"
                        >
                          <Home className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className={`h-8 ${u.is_active ? 'text-red-600 border-red-200 hover:bg-red-50' : 'text-emerald-700 border-emerald-200 hover:bg-emerald-50'}`}
                          disabled={submitting}
                          onClick={() => handleToggleAccess(u)}
                        >
                          {u.is_active ? <Lock className="w-3.5 h-3.5 mr-1.5" /> : <Unlock className="w-3.5 h-3.5 mr-1.5" />}
                          {u.is_active ? 'Block' : 'Unblock'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8"
                          disabled={submitting || !u.is_active}
                          onClick={() => openResetDialog(u)}
                        >
                          <KeyRound className="w-3.5 h-3.5 mr-1.5" /> Reset Password
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

      {/* ── Site Access Dialog ── */}
      <Dialog open={siteDialogOpen} onOpenChange={setSiteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Site Access — {siteUser?.name}</DialogTitle>
            <DialogDescription className="text-sm">
              Select which sites this user can access.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {allSites.length === 0 ? (
              <p className="text-sm text-slate-500 py-4 text-center">No sites found.</p>
            ) : (
              allSites.map((site) => (
                <label
                  key={site.id}
                  className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                    selectedSiteIds.includes(site.id)
                      ? 'bg-indigo-50 border-indigo-200'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Checkbox
                    checked={selectedSiteIds.includes(site.id)}
                    onCheckedChange={() => toggleSite(site.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{site.name}</p>
                    {site.location && <p className="text-[11px] text-slate-500 truncate">{site.location}</p>}
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0">ID: {site.id}</Badge>
                </label>
              ))
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => setSiteDialogOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={handleSaveSites} disabled={submitting}>
              {submitting ? 'Saving...' : `Save (${selectedSiteIds.length} sites)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Reset / Change Password</DialogTitle>
            <DialogDescription className="text-sm">
              Set a new password for {selectedUser?.name || 'user'}. Existing sessions will be logged out.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label className="text-xs font-medium">New Password *</Label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                className="pr-10"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-500 inline-flex items-center gap-1.5">
              <ShieldCheck className="w-3 h-3" /> User will need to login again with the new password.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => setResetDialogOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={handleResetPassword} disabled={submitting}>
              {submitting ? 'Updating...' : 'Update Password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserIdManagement;
