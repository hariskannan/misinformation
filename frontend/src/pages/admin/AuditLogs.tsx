import { Search, ScrollText } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '../../api/users';
import ErrorMessage from '../../components/ErrorMessage';
import LoadingSpinner from '../../components/LoadingSpinner';
import PageWrapper from '../../components/PageWrapper';
import type { AuditLogItem } from '../../types';
import { formatDateTime } from '../../utils/format';

const ACTION_OPTIONS = [
  { value: '', label: 'All actions' },
  { value: 'login', label: 'Logins' },
  { value: 'register', label: 'Registrations' },
  { value: 'logout', label: 'Logouts' },
  { value: 'dataset_', label: 'Dataset events' },
  { value: 'model_', label: 'Model events' },
  { value: 'user_', label: 'User admin events' },
  { value: 'moderation_', label: 'Moderation events' },
];

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [action, setAction] = useState('');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.listAuditLogs({
        page,
        action: action || undefined,
        search: search.trim() || undefined,
      });
      setLogs(data.results);
      setCount(data.count);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [page, action, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(count / 20));

  return (
    <PageWrapper>
      <div className="space-y-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-navy-950 dark:text-white">
            <ScrollText className="h-6 w-6 text-accent-500" />
            Audit logs
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Every authentication, dataset, training, moderation and user
            administration event, recorded server-side. Click a row for the
            full recorded details.
          </p>
        </div>

        <div className="card flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-52 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="input pl-9"
              placeholder="Search actor or target..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <select
            className="input w-auto"
            value={action}
            onChange={(event) => setAction(event.target.value)}
            aria-label="Filter by action type"
          >
            {ACTION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          {loading && <LoadingSpinner label="Loading audit logs..." />}
          {error ? <ErrorMessage error={error} onRetry={load} /> : null}
          {!loading && !error && logs.length === 0 && (
            <div className="card p-10 text-center text-sm text-slate-400">
              No audit entries match this filter.
            </div>
          )}
          {logs.map((log) => (
            <button
              key={log.id}
              type="button"
              onClick={() => setExpanded(expanded === log.id ? null : log.id)}
              className="card block w-full p-4 text-left transition-colors hover:border-accent-500/40"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-navy-900 px-2.5 py-0.5 font-mono text-[11px] font-bold text-accent-300">
                    {log.action}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    by @{log.actor_username ?? 'system'}
                  </span>
                  <span className="text-xs text-slate-400">
                    on {log.target_type} #{log.target_id}
                  </span>
                </div>
                <span className="text-xs text-slate-400">
                  {formatDateTime(log.created_at)}
                  {log.ip_address ? ` - ${log.ip_address}` : ''}
                </span>
              </div>
              {expanded === log.id && (
                <pre className="mt-3 max-h-56 overflow-auto rounded-lg bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-600 dark:bg-navy-900 dark:text-slate-300">
                  {JSON.stringify(log.details, null, 2)}
                </pre>
              )}
            </button>
          ))}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button type="button" className="btn-secondary px-3 py-1.5 text-sm"
              disabled={page <= 1} onClick={() => setPage((v) => Math.max(1, v - 1))}>
              Previous
            </button>
            <span className="text-sm text-slate-500">
              Page {page} of {totalPages} ({count} entries)
            </span>
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
