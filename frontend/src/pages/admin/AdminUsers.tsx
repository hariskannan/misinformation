import { KeyRound, Search, ShieldCheck, UserRound } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '../../api/users';
import { extractErrorMessage } from '../../api/client';
import ConfirmationModal from '../../components/ConfirmationModal';
import ErrorMessage from '../../components/ErrorMessage';
import LoadingSpinner from '../../components/LoadingSpinner';
import PageWrapper from '../../components/PageWrapper';
import type { User } from '../../types';
import { avatarColor, formatDateTime, initials } from '../../utils/format';

const ROLE_OPTIONS = [
  { value: 'user', label: 'User' },
  { value: 'moderator', label: 'Moderator' },
  { value: 'admin', label: 'Administrator' },
];

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [updating, setUpdating] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [toReset, setToReset] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.listUsers({
        search: search.trim() || undefined,
        role: roleFilter || undefined,
      });
      setUsers(data.results);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function update(target: User, payload: { role?: string; is_active?: boolean }) {
    setUpdating(target.id);
    setActionError(null);
    try {
      const updated = await adminApi.updateUser(target.id, payload);
      setUsers((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
    } catch (err) {
      setActionError(extractErrorMessage(err));
    } finally {
      setUpdating(null);
    }
  }

  async function submitReset() {
    if (!toReset) return;
    if (newPassword.length < 8) {
      setActionError('The new password must have at least 8 characters.');
      return;
    }
    setResetting(true);
    setActionError(null);
    try {
      await adminApi.resetUserPassword(toReset.id, newPassword);
      setResetMessage(`Password reset for @${toReset.username}. They can log in with the new password immediately.`);
      setToReset(null);
      setNewPassword('');
    } catch (err) {
      setActionError(extractErrorMessage(err));
    } finally {
      setResetting(false);
    }
  }

  return (
    <PageWrapper>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-navy-950 dark:text-white">
            User management
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Assign roles, activate or deactivate accounts, and reset passwords.
            Every change is recorded in the audit logs.
          </p>
        </div>

        {/* Filters */}
        <div className="card flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-52 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="input pl-9"
              placeholder="Search by username, email or name..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <select
            className="input w-auto"
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value)}
            aria-label="Filter by role"
          >
            <option value="">All roles</option>
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {resetMessage && (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
            {resetMessage}
          </p>
        )}
        {actionError ? (
          <ErrorMessage error={actionError} onRetry={() => setActionError(null)} />
        ) : null}

        <div className="space-y-3">
          {loading && <LoadingSpinner label="Loading users..." />}
          {error ? <ErrorMessage error={error} onRetry={load} /> : null}
          {!loading && !error && users.length === 0 && (
            <div className="card p-10 text-center text-sm text-slate-400">
              No users match this filter.
            </div>
          )}
          {users.map((user) => (
            <div key={user.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white ${avatarColor(user.username)}`}
                  >
                    {initials(user.profile?.full_name || user.username)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-navy-950 dark:text-white">
                      {user.profile?.full_name || user.username}{' '}
                      <span className="font-normal text-slate-400">@{user.username}</span>
                    </p>
                    <p className="truncate text-xs text-slate-400">
                      {user.email} - joined {formatDateTime(user.date_joined)}
                      {user.last_login ? ` - last login ${formatDateTime(user.last_login)}` : ' - never logged in'}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
                      <UserRound className="h-3 w-3" />
                      {user.profile?.department || 'No department'}
                      {typeof user.posts_count === 'number' && ` - ${user.posts_count} posts`}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {!user.is_active && (
                    <span className="rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-bold uppercase text-red-700 dark:bg-red-500/15 dark:text-red-300">
                      deactivated
                    </span>
                  )}
                  <select
                    className="input w-auto py-1.5 text-sm"
                    value={user.role}
                    onChange={(event) => void update(user, { role: event.target.value })}
                    disabled={updating === user.id}
                    aria-label={`Role for ${user.username}`}
                  >
                    {ROLE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn-secondary px-3 py-1.5 text-xs"
                    onClick={() => void update(user, { is_active: !user.is_active })}
                    disabled={updating === user.id}
                  >
                    {user.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary px-3 py-1.5 text-xs"
                    onClick={() => {
                      setToReset(user);
                      setNewPassword('');
                    }}
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    Reset password
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-400">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent-500" />
          Role changes take effect on the user's next request. Deactivating an
          account blocks logins immediately; their existing content is kept.
        </p>
      </div>

      <ConfirmationModal
        open={toReset !== null}
        title={`Reset password for @${toReset?.username ?? ''}`}
        message={
          toReset
            ? 'Set a new password for this user and share it with them through a secure channel. They will be notified in-app that an administrator reset their password.'
            : ''
        }
        confirmLabel={resetting ? 'Resetting...' : 'Reset password'}
        danger={false}
        busy={resetting}
        onConfirm={submitReset}
        onCancel={() => setToReset(null)}
      >
        <div className="mt-3">
          <label htmlFor="new-password" className="label">
            New password (min 8 characters)
          </label>
          <input
            id="new-password"
            className="input"
            type="text"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            placeholder="New password"
          />
        </div>
      </ConfirmationModal>
    </PageWrapper>
  );
}
