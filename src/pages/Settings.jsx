import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import api from '../api/api';
import {
  User,
  Shield,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Phone,
  UserCircle,
  CheckCircle2,
  Loader2,
  Settings as SettingsIcon,
  KeyRound,
} from 'lucide-react';

export const Settings = () => {
  const { user, updateProfile } = useAuth();

  // Profile form
  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
  });
  const [profileLoading, setProfileLoading] = useState(false);

  // Password form
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  // Password strength
  const getPasswordStrength = (password) => {
    if (!password) return { level: 0, label: '', color: '' };
    let score = 0;
    if (password.length >= 6) score++;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    if (score <= 1) return { level: 1, label: 'Weak', color: 'bg-red-500' };
    if (score <= 2) return { level: 2, label: 'Fair', color: 'bg-orange-500' };
    if (score <= 3) return { level: 3, label: 'Good', color: 'bg-yellow-500' };
    if (score <= 4) return { level: 4, label: 'Strong', color: 'bg-emerald-500' };
    return { level: 5, label: 'Excellent', color: 'bg-green-500' };
  };

  const passwordStrength = getPasswordStrength(passwordData.newPassword);

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfileData(prev => ({ ...prev, [name]: value }));
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({ ...prev, [name]: value }));
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileLoading(true);

    try {
      const data = new FormData();
      let hasChanges = false;

      if (profileData.name !== user?.name) {
        data.append('name', profileData.name);
        hasChanges = true;
      }
      if (profileData.email !== user?.email) {
        data.append('email', profileData.email);
        hasChanges = true;
      }
      if (profileData.phone !== (user?.phone || '')) {
        data.append('phone', profileData.phone);
        hasChanges = true;
      }

      if (!hasChanges) {
        toast.info('No changes to update');
        return;
      }

      await updateProfile(data);
      toast.success('Profile updated successfully');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();

    // Client-side validation
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      toast.error('All password fields are required');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('New password and confirm password do not match');
      return;
    }

    setPasswordLoading(true);

    try {
      await api.put('/auth/change-password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
        confirmPassword: passwordData.confirmPassword,
      });

      toast.success('Password changed successfully');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setShowCurrentPass(false);
      setShowNewPass(false);
      setShowConfirmPass(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    } finally {
      setPasswordLoading(false);
    }
  };

  const passwordsMatch = passwordData.newPassword && passwordData.confirmPassword &&
    passwordData.newPassword === passwordData.confirmPassword;

  const userInitials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '??';

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-10">
      {/* Page Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 sm:p-8">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[80px] translate-x-1/3 -translate-y-1/3" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/10 rounded-full blur-[60px] -translate-x-1/4 translate-y-1/4" />

        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-5">
          {/* Avatar */}
          <div className="relative group">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-primary/80 to-blue-600/80 flex items-center justify-center text-white font-bold text-xl sm:text-2xl shadow-xl ring-2 ring-white/10 transition-transform duration-300 group-hover:scale-105">
              {userInitials}
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border-2 border-slate-900 shadow-lg" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <SettingsIcon className="w-5 h-5 text-primary/70" />
              <span className="text-xs font-medium text-primary/70 uppercase tracking-wider">Settings</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight truncate">
              {user?.name || 'User'}
            </h1>
            <p className="text-slate-400 text-sm mt-0.5 flex items-center gap-1.5 truncate">
              <Mail className="w-3.5 h-3.5 shrink-0" />
              {user?.email || 'email@example.com'}
            </p>
          </div>

          {/* Role badge */}
          <div className="sm:self-start">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-primary/15 text-primary border border-primary/20 backdrop-blur-sm">
              <Shield className="w-3.5 h-3.5" />
              {user?.role?.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'User'}
            </span>
          </div>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profile Information Card */}
        <Card className="border-border/50 shadow-lg shadow-black/5 rounded-2xl overflow-hidden">
          <CardHeader className="pb-4 border-b border-border/50 bg-gradient-to-r from-slate-50/80 to-transparent dark:from-slate-800/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md">
                <User className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold">Profile Information</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Update your personal details</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleUpdateProfile} className="space-y-5">
              {/* Full Name */}
              <div className="space-y-2">
                <Label htmlFor="settings-name" className="text-sm font-medium flex items-center gap-1.5">
                  <UserCircle className="w-3.5 h-3.5 text-muted-foreground" />
                  Full Name
                </Label>
                <Input
                  id="settings-name"
                  name="name"
                  value={profileData.name}
                  onChange={handleProfileChange}
                  disabled={profileLoading}
                  placeholder="Enter your full name"
                  className="h-11 rounded-xl bg-background transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="settings-email" className="text-sm font-medium flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                  Email Address
                </Label>
                <Input
                  id="settings-email"
                  name="email"
                  type="email"
                  value={profileData.email}
                  onChange={handleProfileChange}
                  disabled={profileLoading}
                  placeholder="Enter your email"
                  className="h-11 rounded-xl bg-background transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <Label htmlFor="settings-phone" className="text-sm font-medium flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                  Phone Number
                </Label>
                <Input
                  id="settings-phone"
                  name="phone"
                  value={profileData.phone}
                  onChange={handleProfileChange}
                  disabled={profileLoading}
                  placeholder="Enter your phone number"
                  className="h-11 rounded-xl bg-background transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={profileLoading}
                  className="w-full h-11 rounded-xl font-medium text-sm shadow-md hover:shadow-lg transition-all duration-200"
                >
                  {profileLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving Changes...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Save Profile
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Change Password Card */}
        <Card className="border-border/50 shadow-lg shadow-black/5 rounded-2xl overflow-hidden">
          <CardHeader className="pb-4 border-b border-border/50 bg-gradient-to-r from-amber-50/80 to-transparent dark:from-amber-900/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-md">
                <KeyRound className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold">Change Password</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Keep your account secure</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleChangePassword} className="space-y-5">
              {/* Current Password */}
              <div className="space-y-2">
                <Label htmlFor="settings-currentPassword" className="text-sm font-medium flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                  Current Password
                </Label>
                <div className="relative">
                  <Input
                    id="settings-currentPassword"
                    name="currentPassword"
                    type={showCurrentPass ? 'text' : 'password'}
                    value={passwordData.currentPassword}
                    onChange={handlePasswordChange}
                    disabled={passwordLoading}
                    placeholder="Enter current password"
                    className="h-11 rounded-xl bg-background pr-10 transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-transparent"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    tabIndex={-1}
                  >
                    {showCurrentPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {/* New Password */}
              <div className="space-y-2">
                <Label htmlFor="settings-newPassword" className="text-sm font-medium flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                  New Password
                </Label>
                <div className="relative">
                  <Input
                    id="settings-newPassword"
                    name="newPassword"
                    type={showNewPass ? 'text' : 'password'}
                    value={passwordData.newPassword}
                    onChange={handlePasswordChange}
                    disabled={passwordLoading}
                    placeholder="Enter new password"
                    className="h-11 rounded-xl bg-background pr-10 transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-transparent"
                    onClick={() => setShowNewPass(!showNewPass)}
                    tabIndex={-1}
                  >
                    {showNewPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>

                {/* Password Strength Indicator */}
                {passwordData.newPassword && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div
                          key={i}
                          className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                            i <= passwordStrength.level ? passwordStrength.color : 'bg-muted'
                          }`}
                        />
                      ))}
                    </div>
                    <p className={`text-xs font-medium ${
                      passwordStrength.level <= 1 ? 'text-red-500' :
                      passwordStrength.level <= 2 ? 'text-orange-500' :
                      passwordStrength.level <= 3 ? 'text-yellow-600' :
                      'text-emerald-600'
                    }`}>
                      {passwordStrength.label}
                    </p>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <Label htmlFor="settings-confirmPassword" className="text-sm font-medium flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                  Confirm New Password
                </Label>
                <div className="relative">
                  <Input
                    id="settings-confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPass ? 'text' : 'password'}
                    value={passwordData.confirmPassword}
                    onChange={handlePasswordChange}
                    disabled={passwordLoading}
                    placeholder="Confirm new password"
                    className={`h-11 rounded-xl bg-background pr-10 transition-all duration-200 focus:ring-2 focus:ring-primary/20 ${
                      passwordData.confirmPassword
                        ? passwordsMatch
                          ? 'border-emerald-500 focus:ring-emerald-500/20'
                          : 'border-red-500 focus:ring-red-500/20'
                        : ''
                    }`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-transparent"
                    onClick={() => setShowConfirmPass(!showConfirmPass)}
                    tabIndex={-1}
                  >
                    {showConfirmPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {passwordData.confirmPassword && (
                  <p className={`text-xs font-medium flex items-center gap-1 ${
                    passwordsMatch ? 'text-emerald-600' : 'text-red-500'
                  }`}>
                    {passwordsMatch ? (
                      <><CheckCircle2 className="w-3 h-3" /> Passwords match</>
                    ) : (
                      'Passwords do not match'
                    )}
                  </p>
                )}
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={passwordLoading || !passwordData.currentPassword || !passwordsMatch}
                  className="w-full h-11 rounded-xl font-medium text-sm shadow-md hover:shadow-lg transition-all duration-200 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white border-0"
                >
                  {passwordLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Updating Password...
                    </>
                  ) : (
                    <>
                      <Shield className="w-4 h-4 mr-2" />
                      Update Password
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Security Tips */}
      <Card className="border-border/50 shadow-sm rounded-2xl overflow-hidden">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
              <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="space-y-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">Security Tips</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Use a strong, unique password with a mix of uppercase, lowercase, numbers, and special characters.
                Never share your password with anyone. Change your password regularly to keep your account secure.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;
