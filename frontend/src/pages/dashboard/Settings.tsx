import { KeyRound, Save, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { extractErrorMessage } from '../../api/client';
import { authApi } from '../../api/auth';
import PageWrapper from '../../components/PageWrapper';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

export default function Settings() {
  const { user, updateProfile } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [profileForm, setProfileForm] = useState({
    full_name: user?.profile.full_name ?? '',
    department: user?.profile.department ?? '',
    bio: user?.profile.bio ?? '',
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [passwordForm, setPasswordForm] = useState({
    old_password: '',
    new_password: '',
    new_password2: '',
  });
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    if (savingProfile) return;
    setSavingProfile(true);
    setProfileError(null);
    setProfileMessage(null);
    try {
      await updateProfile(profileForm);
      setProfileMessage('Profile updated.');
    } catch (err) {
      setProfileError(extractErrorMessage(err));
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword(event: React.FormEvent) {
    event.preventDefault();
    if (savingPassword) return;
    setSavingPassword(true);
    setPasswordError(null);
    setPasswordMessage(null);
    try {
      await authApi.changePassword(passwordForm.old_password, passwordForm.new_password);
      setPasswordMessage('Password changed successfully.');
      setPasswordForm({ old_password: '', new_password: '', new_password2: '' });
    } catch (err) {
      setPasswordError(extractErrorMessage(err));
    } finally {
      setSavingPassword(false);
    }
  }

  const passwordsMatch =
    passwordForm.new_password.length > 0 &&
    passwordForm.new_password === passwordForm.new_password2;

  return (
    <PageWrapper>
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-bold text-navy-950 dark:text-white">Settings</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Manage your profile, appearance and account security.
        </p>

        {/* Appearance */}
        <section className="card mt-6 p-5">
          <h2 className="text-sm font-semibold text-navy-950 dark:text-white">Appearance</h2>
          <div className="mt-3 flex items-center justify-between gap-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Current theme: <span className="font-semibold capitalize">{theme}</span>
            </p>
            <button type="button" className="btn-secondary px-3 py-1.5 text-sm" onClick={toggleTheme}>
              Switch to {theme === 'dark' ? 'light' : 'dark'} mode
            </button>
          </div>
        </section>

        {/* Profile info */}
        <form onSubmit={saveProfile} className="card mt-6 space-y-4 p-5">
          <h2 className="text-sm font-semibold text-navy-950 dark:text-white">Profile information</h2>
          <div>
            <label htmlFor="full_name" className="label">Full name</label>
            <input id="full_name" className="input" maxLength={120}
              value={profileForm.full_name}
              onChange={(e) => setProfileForm((f) => ({ ...f, full_name: e.target.value }))} />
          </div>
          <div>
            <label htmlFor="department" className="label">Department</label>
            <input id="department" className="input" maxLength={120}
              value={profileForm.department}
              onChange={(e) => setProfileForm((f) => ({ ...f, department: e.target.value }))} />
          </div>
          <div>
            <label htmlFor="bio" className="label">Bio</label>
            <textarea id="bio" className="input resize-none" rows={3} maxLength={500}
              value={profileForm.bio}
              onChange={(e) => setProfileForm((f) => ({ ...f, bio: e.target.value }))}
              placeholder="A short introduction (max 500 characters)" />
          </div>
          {profileError && (
            <p className="text-sm text-red-600 dark:text-red-400">{profileError}</p>
          )}
          {profileMessage && (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">{profileMessage}</p>
          )}
          <button type="submit" className="btn-primary" disabled={savingProfile}>
            <Save className="h-4 w-4" />
            {savingProfile ? 'Saving...' : 'Save profile'}
          </button>
        </form>

        {/* Change password */}
        <form onSubmit={changePassword} className="card mt-6 space-y-4 p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-navy-950 dark:text-white">
            <KeyRound className="h-4 w-4 text-accent-500" />
            Change password
          </h2>
          <div>
            <label htmlFor="old_password" className="label">Current password</label>
            <input id="old_password" className="input" type="password" required autoComplete="current-password"
              value={passwordForm.old_password}
              onChange={(e) => setPasswordForm((f) => ({ ...f, old_password: e.target.value }))} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="new_password" className="label">New password</label>
              <input id="new_password" className="input" type="password" required autoComplete="new-password"
                value={passwordForm.new_password}
                onChange={(e) => setPasswordForm((f) => ({ ...f, new_password: e.target.value }))} />
            </div>
            <div>
              <label htmlFor="new_password2" className="label">Repeat new password</label>
              <input id="new_password2" className="input" type="password" required autoComplete="new-password"
                value={passwordForm.new_password2}
                onChange={(e) => setPasswordForm((f) => ({ ...f, new_password2: e.target.value }))} />
              {passwordForm.new_password2.length > 0 && !passwordsMatch && (
                <p className="mt-1 text-xs text-red-500">Passwords do not match.</p>
              )}
            </div>
          </div>
          {passwordError && (
            <p className="text-sm text-red-600 dark:text-red-400">{passwordError}</p>
          )}
          {passwordMessage && (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">{passwordMessage}</p>
          )}
          <button type="submit" className="btn-primary" disabled={savingPassword || !passwordsMatch}>
            <KeyRound className="h-4 w-4" />
            {savingPassword ? 'Changing...' : 'Change password'}
          </button>
        </form>

        <p className="mt-6 flex items-start gap-2 text-xs leading-relaxed text-slate-400">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent-500" />
          Forgot your password? This demonstration platform does not use email
          delivery - an administrator can reset it from the admin panel
          (Admin - Users - Reset password).
        </p>
      </div>
    </PageWrapper>
  );
}
