import { Bell, BellOff, Check } from 'lucide-react';
import { useEffect, useState } from 'react';
import { postsApi } from '../api/posts';
import type { AppNotification } from '../types';
import { timeAgo } from '../utils/format';

const TYPE_STYLES: Record<string, string> = {
  like: 'bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300',
  comment: 'bg-accent-100 text-accent-600 dark:bg-accent-500/15 dark:text-accent-300',
  moderation: 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300',
  report: 'bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300',
  system: 'bg-slate-100 text-slate-600 dark:bg-navy-800 dark:text-slate-300',
};

export default function NotificationPanel({
  open,
  onClose,
  onCountChange,
}: {
  open: boolean;
  onClose: () => void;
  onCountChange?: (count: number) => void;
}) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await postsApi.getNotifications();
        if (!cancelled) setNotifications(data.results);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('[data-notification-panel]')) onClose();
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open, onClose]);

  async function markAllRead() {
    await postsApi.markAllNotificationsRead();
    setNotifications((current) =>
      current.map((item) => ({ ...item, is_read: true })),
    );
    onCountChange?.(0);
  }

  async function markRead(id: number) {
    await postsApi.markNotificationRead(id);
    setNotifications((current) =>
      current.map((item) => (item.id === id ? { ...item, is_read: true } : item)),
    );
    onCountChange?.(
      notifications.filter((item) => !item.is_read && item.id !== id).length,
    );
  }

  if (!open) return null;

  return (
    <div
      data-notification-panel
      className="absolute right-0 top-full z-40 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-navy-700 dark:bg-navy-900 sm:w-96"
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-navy-800">
        <span className="text-sm font-semibold">Notifications</span>
        <button
          type="button"
          className="flex items-center gap-1 text-xs font-medium text-accent-600 hover:text-accent-500"
          onClick={markAllRead}
        >
          <Check className="h-3.5 w-3.5" />
          Mark all read
        </button>
      </div>
      <div className="max-h-96 overflow-y-auto">
        {loading && (
          <p className="px-4 py-6 text-center text-sm text-slate-400">Loading...</p>
        )}
        {!loading && notifications.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-slate-400">
            <BellOff className="h-6 w-6" />
            <p className="text-sm">No notifications yet</p>
          </div>
        )}
        {notifications.map((notification) => (
          <button
            key={notification.id}
            type="button"
            onClick={() => !notification.is_read && void markRead(notification.id)}
            className={`flex w-full gap-3 border-b border-slate-50 px-4 py-3 text-left transition-colors last:border-0 hover:bg-slate-50 dark:border-navy-800/50 dark:hover:bg-navy-800/50 ${
              notification.is_read ? 'opacity-60' : ''
            }`}
          >
            <span
              className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                TYPE_STYLES[notification.notification_type] ?? TYPE_STYLES.system
              }`}
            >
              <Bell className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">
                {notification.verb}
              </span>
              {notification.message && (
                <span className="mt-0.5 line-clamp-2 block text-xs text-slate-500 dark:text-slate-400">
                  {notification.message}
                </span>
              )}
              <span className="mt-1 block text-[11px] text-slate-400">
                {timeAgo(notification.created_at)}
              </span>
            </span>
            {!notification.is_read && (
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent-500" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
