import { FileWarning } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { postsApi } from '../../api/posts';
import ErrorMessage from '../../components/ErrorMessage';
import LoadingSpinner from '../../components/LoadingSpinner';
import PageWrapper from '../../components/PageWrapper';
import RiskBadge from '../../components/RiskBadge';
import type { UserReport } from '../../types';
import { REPORT_REASON_LABELS, formatDateTime, POST_STATUS_LABELS } from '../../utils/format';

const STATUS_BADGES: Record<string, string> = {
  open: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  in_review: 'bg-accent-100 text-accent-700 dark:bg-accent-500/15 dark:text-accent-300',
  resolved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  dismissed: 'bg-slate-100 text-slate-600 dark:bg-navy-800 dark:text-slate-300',
};

export default function Reports() {
  const [reports, setReports] = useState<UserReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await postsApi.getMyReports({ page });
      setReports(data.results);
      setCount(data.count);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(count / 10));

  return (
    <PageWrapper>
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-bold text-navy-950 dark:text-white">
          My reports
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Reports you submitted and how the moderation team handled them.
        </p>

        <div className="mt-5 space-y-3">
          {loading && <LoadingSpinner label="Loading your reports..." />}
          {error ? <ErrorMessage error={error} onRetry={load} /> : null}
          {!loading && !error && reports.length === 0 && (
            <div className="card flex flex-col items-center gap-2 p-10 text-center text-slate-400">
              <FileWarning className="h-8 w-8" />
              <p className="text-sm">
                You have not reported any content. Use the report button on a
                post when you see something suspicious.
              </p>
            </div>
          )}
          {reports.map((report) => (
            <div key={report.id} className="card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-navy-950 dark:text-white">
                    {REPORT_REASON_LABELS[report.reason] ?? report.reason} - post
                    #{report.post_id}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-slate-400">
                    Reported {formatDateTime(report.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
                      STATUS_BADGES[report.status] ?? STATUS_BADGES.dismissed
                    }`}
                  >
                    {report.status.replace('_', ' ')}
                  </span>
                </div>
              </div>

              <p className="mt-3 line-clamp-3 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-500 dark:bg-navy-900 dark:text-slate-400">
                "{report.post_content}"
              </p>

              {report.details && (
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-semibold">Your note:</span> {report.details}
                </p>
              )}

              {report.resolution_remarks && (
                <p className="mt-2 rounded-lg border border-accent-500/20 bg-accent-500/5 p-2.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  <span className="font-semibold">Moderator response</span> (by{' '}
                  {report.resolved_by_username}): {report.resolution_remarks}
                </p>
              )}

              {report.resolved_at && (
                <p className="mt-2 text-[11px] text-slate-400">
                  Closed {formatDateTime(report.resolved_at)} - post is now "
                  {POST_STATUS_LABELS[report.post_status] ?? report.post_status}"
                </p>
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
