// ============================================================================
// AdminManagement — Admin Management module UI
//
// Three responsibilities, all admin-only (caller gates on isAdmin):
//   1. Change your own password (re-auth + updatePassword).
//   2. Add another admin by email — stored in the admin_allowlist so the account
//      is promoted to admin on its next login (existing users) or at signup
//      (future users).
//   3. Review current admins and the pending allowlist; remove allowlist entries.
// ============================================================================

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Shield,
  ShieldCheck,
  UserPlus,
  KeyRound,
  Trash2,
  RefreshCw,
  Mail,
  Headset,
} from 'lucide-react';
import {
  listAdmins,
  listAdminAllowlist,
  addAdminEmail,
  addHelpDeskEmail,
  updateHelpDeskPermissions,
  removeAdminEmail,
  changeOwnPassword,
  normalizeEmail,
  type AdminUser,
  type AdminAllowlistEntry,
} from '@/services/adminManagementService';
import { ADMIN_PERMISSIONS, type AdminPermission } from '@/constants/adminPermissions';

const AdminManagement: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [allowlist, setAllowlist] = useState<AdminAllowlistEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [newEmail, setNewEmail] = useState('');
  const [adding, setAdding] = useState(false);

  // Help-desk management state.
  const [hdEmail, setHdEmail] = useState('');
  const [hdPerms, setHdPerms] = useState<Set<AdminPermission>>(new Set());
  const [addingHd, setAddingHd] = useState(false);
  const [savingHd, setSavingHd] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPw, setChangingPw] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [a, w] = await Promise.all([listAdmins(), listAdminAllowlist()]);
      setAdmins(a);
      setAllowlist(w);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const adminEmails = new Set(admins.map((a) => normalizeEmail(a.email)));
  const adminAllowlist = allowlist.filter((e) => e.role !== 'help_desk');
  const helpDeskAllowlist = allowlist.filter((e) => e.role === 'help_desk');

  const handleAddEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adding || !newEmail.trim()) return;
    setAdding(true);
    try {
      await addAdminEmail(newEmail, user?.uid ?? null);
      toast({
        title: 'Admin email added',
        description: `${normalizeEmail(newEmail)} will gain admin access on their next login.`,
      });
      setNewEmail('');
      await load();
    } catch (err: any) {
      toast({
        title: 'Could not add admin',
        description: err?.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveEmail = async (email: string) => {
    if (!confirm(`Remove ${email} from the admin allowlist?\n\nNote: this does not demote an account that is already an admin.`))
      return;
    try {
      await removeAdminEmail(email);
      toast({ title: 'Removed', description: `${email} removed from the allowlist.` });
      await load();
    } catch (err: any) {
      toast({
        title: 'Remove failed',
        description: err?.message || 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const toggleNewHdPerm = (perm: AdminPermission) => {
    setHdPerms((prev) => {
      const next = new Set(prev);
      next.has(perm) ? next.delete(perm) : next.add(perm);
      return next;
    });
  };

  const handleAddHelpDesk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (addingHd || !hdEmail.trim()) return;
    if (hdPerms.size === 0) {
      toast({
        title: 'Select at least one permission',
        description: 'A help-desk user needs at least one granted permission.',
        variant: 'destructive',
      });
      return;
    }
    setAddingHd(true);
    try {
      await addHelpDeskEmail(hdEmail, Array.from(hdPerms), user?.uid ?? null);
      toast({
        title: 'Help-desk user added',
        description: `${normalizeEmail(hdEmail)} will gain help-desk access on their next login.`,
      });
      setHdEmail('');
      setHdPerms(new Set());
      await load();
    } catch (err: any) {
      toast({
        title: 'Could not add help-desk user',
        description: err?.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setAddingHd(false);
    }
  };

  const handleToggleEntryPerm = async (
    entry: AdminAllowlistEntry,
    perm: AdminPermission,
  ) => {
    const current = new Set(entry.permissions);
    current.has(perm) ? current.delete(perm) : current.add(perm);
    setSavingHd(entry.email);
    try {
      await updateHelpDeskPermissions(entry.email, Array.from(current));
      toast({
        title: 'Permissions updated',
        description: `${entry.email} — changes apply on their next login.`,
      });
      await load();
    } catch (err: any) {
      toast({
        title: 'Could not update permissions',
        description: err?.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSavingHd(null);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (changingPw) return;
    if (newPassword !== confirmPassword) {
      toast({
        title: 'Passwords do not match',
        description: 'The new password and confirmation must match.',
        variant: 'destructive',
      });
      return;
    }
    setChangingPw(true);
    try {
      await changeOwnPassword(currentPassword, newPassword);
      toast({ title: 'Password updated', description: 'Your password has been changed.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      const code = err?.code || '';
      const message =
        code === 'auth/wrong-password' || code === 'auth/invalid-credential'
          ? 'The current password is incorrect.'
          : code === 'auth/weak-password'
          ? 'The new password is too weak (use at least 6 characters).'
          : err?.message || 'Could not change password. Please try again.';
      toast({ title: 'Password change failed', description: message, variant: 'destructive' });
    } finally {
      setChangingPw(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Change password */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <KeyRound className="h-5 w-5 text-blue-600" />
            Change my password
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <Label htmlFor="cur-pw">Current password</Label>
              <Input
                id="cur-pw"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="mt-1.5"
                required
              />
            </div>
            <div>
              <Label htmlFor="new-pw">New password</Label>
              <Input
                id="new-pw"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1.5"
                required
                minLength={6}
              />
            </div>
            <div>
              <Label htmlFor="confirm-pw">Confirm new password</Label>
              <Input
                id="confirm-pw"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1.5"
                required
                minLength={6}
              />
            </div>
            <Button
              type="submit"
              disabled={changingPw || !currentPassword || !newPassword || !confirmPassword}
            >
              {changingPw ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Updating…
                </>
              ) : (
                'Update password'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Add admin by email */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <UserPlus className="h-5 w-5 text-blue-600" />
            Add an admin
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddEmail} className="space-y-4">
            <div>
              <Label htmlFor="admin-email">Email address</Label>
              <Input
                id="admin-email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="person@example.com"
                className="mt-1.5"
                required
              />
              <p className="mt-1.5 text-xs text-slate-500">
                If this email already has an account, they become an admin on their next login. If not,
                they become an admin automatically when they sign up with it.
              </p>
            </div>
            <Button type="submit" disabled={adding || !newEmail.trim()}>
              {adding ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Adding…
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Grant admin access
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Current admins */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldCheck className="h-5 w-5 text-green-600" />
              Current admins{' '}
              <span className="text-sm font-normal text-slate-400">({admins.length})</span>
            </CardTitle>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-slate-500">Loading…</div>
          ) : admins.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">No admins found.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {admins.map((a) => (
                <li key={a.uid} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{a.name}</p>
                    <p className="truncate text-xs text-slate-500">{a.email}</p>
                  </div>
                  {user?.uid === a.uid && (
                    <Badge variant="secondary" className="flex-shrink-0">
                      You
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Allowlist */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5 text-blue-600" />
            Admin allowlist{' '}
            <span className="text-sm font-normal text-slate-400">({allowlist.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-slate-500">Loading…</div>
          ) : adminAllowlist.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">
              No allowlisted admin emails yet. Add one with the form above.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {adminAllowlist.map((entry) => {
                const active = adminEmails.has(normalizeEmail(entry.email));
                return (
                  <li key={entry.email} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-sm text-slate-800">{entry.email}</span>
                      {active ? (
                        <Badge variant="secondary" className="flex-shrink-0 bg-green-100 text-green-800">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="flex-shrink-0 text-slate-500">
                          Pending next login
                        </Badge>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveEmail(entry.email)}
                      title="Remove from allowlist"
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Help Desk — granular admin-area access */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Headset className="h-5 w-5 text-blue-600" />
            Help Desk
            <span className="text-sm font-normal text-slate-400">({helpDeskAllowlist.length})</span>
          </CardTitle>
          <p className="text-sm text-slate-500">
            Help-desk users get admin-area access limited to the permissions you grant. A full
            admin always has every permission. Changes apply on the user’s next login.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Add help-desk user */}
          <form onSubmit={handleAddHelpDesk} className="space-y-3 rounded-lg border border-slate-200 p-4">
            <div>
              <Label htmlFor="hd-email">Email address</Label>
              <Input
                id="hd-email"
                type="email"
                value={hdEmail}
                onChange={(e) => setHdEmail(e.target.value)}
                placeholder="helper@example.com"
                className="mt-1.5"
                required
              />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wide text-slate-500">Permissions</Label>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {ADMIN_PERMISSIONS.map((p) => (
                  <label
                    key={p.key}
                    className="flex cursor-pointer items-start gap-2 rounded-md border p-2 text-sm hover:bg-slate-50"
                    title={p.description}
                  >
                    <Checkbox
                      checked={hdPerms.has(p.key)}
                      onCheckedChange={() => toggleNewHdPerm(p.key)}
                      className="mt-0.5"
                    />
                    <span>
                      <span className="font-medium text-slate-800">{p.label}</span>
                      <span className="block text-xs text-slate-500">{p.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <Button type="submit" disabled={addingHd || !hdEmail.trim()}>
              {addingHd ? (
                <><RefreshCw className="mr-2 h-4 w-4 animate-spin" />Adding…</>
              ) : (
                <><Headset className="mr-2 h-4 w-4" />Add help-desk user</>
              )}
            </Button>
          </form>

          {/* Existing help-desk users */}
          {loading ? (
            <div className="py-6 text-center text-slate-500">Loading…</div>
          ) : helpDeskAllowlist.length === 0 ? (
            <div className="py-6 text-center text-sm text-slate-500">
              No help-desk users yet. Add one above.
            </div>
          ) : (
            <ul className="space-y-4">
              {helpDeskAllowlist.map((entry) => {
                const active = adminEmails.has(normalizeEmail(entry.email));
                const granted = new Set(entry.permissions);
                return (
                  <li key={entry.email} className="rounded-lg border border-slate-200 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-sm font-medium text-slate-800">{entry.email}</span>
                        <Badge variant="outline" className="flex-shrink-0 text-slate-500">
                          {active ? 'Active' : 'Pending next login'}
                        </Badge>
                        {savingHd === entry.email && (
                          <RefreshCw className="h-3.5 w-3.5 animate-spin text-slate-400" />
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveEmail(entry.email)}
                        title="Remove from help desk"
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {ADMIN_PERMISSIONS.map((p) => (
                        <label
                          key={p.key}
                          className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm hover:bg-slate-50"
                          title={p.description}
                        >
                          <Checkbox
                            checked={granted.has(p.key)}
                            disabled={savingHd === entry.email}
                            onCheckedChange={() => handleToggleEntryPerm(entry, p.key)}
                          />
                          <span className="text-slate-800">{p.label}</span>
                        </label>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminManagement;
