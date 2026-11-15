import { Bell, BellOff, CheckCheck } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { postsApi } from '../../api/posts';
import ErrorMessage from '../../components/ErrorMessage';
import LoadingSpinner from '../../components/LoadingSpinner';
import PageWrapper from '../../components/PageWrapper';
import type { AppNotification } from '../../types';
import { timeAgo } from '../../utils/format';

const TYPE_STYLES: Record<string, string> = {
  like: 'bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300',
  comment: 'bg-accent-100 text-accent-600 dark:bg-accent-500/15 dark:text-accent-300',
  moderation: 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300',
  report: 'bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300',
  system: 'bg-slate-100 text-slate-600 dark:bg-navy-800 dark:text-slate-300',
};

export default function Notifications() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await postsApi.getNotifications({
        page,
        unread: onlyUnread ? 'true' : undefined,
      });
      setItems(data.results);
      setCount(data.count);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [page, onlyUnread]);

  useEffect(() => {
    void load();
  }, [load]);

  async function markRead(id: number) {
    await postsApi.markNotificationRead(id);
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, is_read: true } : item)),
    );
  }

  async function markAll() {
    await postsApi.markAllNotificationsRead();
    setItems((current) => current.map((item) => ({ ...item, is_read: true })));
  }

  const totalPages = Math.max(1, Math.ceil(count / 15));

  return (
    <PageWrapper>
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-navy-950 dark:text-white">Notifications</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Likes, comments, moderation decisions and platform messages.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className={`btn-secondary px-3 py-1.5 text-xs ${onlyUnread ? 'bg-navy-900 text-white dark:bg-accent-500 dark:text-navy-950' : ''}`}
              onClick={() => {
                setPage(1);
                setOnlyUnread((value) => !value);
              }}
            >
              {onlyUnread ? 'Showing unread' : 'All notifications'}
            </button>
            <button
              type="button"
              className="btn-secondary px-3 py-1.5 text-xs"
              onClick={markAll}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </button>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {loading && <LoadingSpinner label="Loading notifications..." />}
          {error ? <ErrorMessage error={error} onRetry={load} /> : null}
          {!loading && !error && items.length === 0 && (
            <div className="card flex flex-col items-center gap-2 p-10 text-center text-slate-400">
              <BellOff className="h-8 w-8" />
              <p className="text-sm">Nothing here yet - notifications will appear as you use the platform.</p>
            </div>
          )}
          {items.map((notification) => (
            <div
              key={notification.id}
              className={`card flex gap-3 p-4 ${notification.is_read ? '' : 'ring-1 ring-accent-500/40'}`}
            >
              <span
                className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                  TYPE_STYLES[notification.notification_type] ?? TYPE_STYLES.system
                }`}
              >
                <Bell className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-navy-950 dark:text-white">
                  {notification.verb}
                </p>
                {notification.message && (
                  <p className="mt-0.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                    {notification.message}
                  </p>
                )}
                <p className="mt-1 text-xs text-slate-400">
                  {timeAgo(notification.created_at)}
                </p>
              </div>
              {!notification.is_read && (
                <button
                  type="button"
                  className="self-start rounded-lg px-2.5 py-1 text-xs font-semibold text-accent-600 hover:bg-accent-500/10 dark:text-accent-300"
                  onClick={() => void markRead(notification.id)}
                >
                  Mark read
                </button>
              )}
            </div>
          ))}
        </div>

        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-2">
            <button type="button" className="btn-secondary px-3 py-1.5 text-sm"
              disabled={page <= 1} onClick={() => setPage((v) => Math.max(1, v - 1))}>
              Previous
            </button>
            <span className="text-sm text-slate-500">Page {page} of {totalPages}</span>
            <button type="button" className="btn-secondary px-3 py-1.5 text-sm"
              disabled={page >= totalPages} onClick={() => setPage((v) => Math.min(totalPages, v + 1))}>
              Next
            </button>
          </div>
        )}
      </div>
    </PageWrapper>
  );
}
