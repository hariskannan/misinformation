import {
  Clock,
  FileWarning,
  Gauge,
  Inbox,
  ListChecks,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { moderationApi } from '../api/moderation';
import DashboardStatCard from '../components/DashboardStatCard';
import ErrorMessage from '../components/ErrorMessage';
import LoadingSpinner from '../components/LoadingSpinner';
import ModeratedPostsTable from '../components/ModeratedPostsTable';
import ModerationTable from '../components/ModerationTable';
import PageWrapper from '../components/PageWrapper';
import RiskBadge from '../components/RiskBadge';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import type {
  ModerationQueueItem,
  ModerationReviewItem,
  ModerationStats,
  UserReport,
} from '../types';
import {
  formatDateTime,
  POST_STATUS_LABELS,
  REPORT_REASON_LABELS,
} from '../utils/format';

type Tab = 'queue' | 'moderated' | 'reports' | 'history';

export default function ModeratorPage() {
  const [tab, setTab] = useState<Tab>('queue');
  const [stats, setStats] = useState<ModerationStats | null>(null);
  const [statsError, setStatsError] = useState<unknown>(null);

  const [queue, setQueue] = useState<ModerationQueueItem[]>([]);
  const [queueLoading, setQueueLoading] = useState(true);
  const [queueError, setQueueError] = useState<unknown>(null);
  const [queueRisk, setQueueRisk] = useState('');

  const [moderated, setModerated] = useState<ModerationQueueItem[]>([]);
  const [moderatedLoading, setModeratedLoading] = useState(true);
  const [moderatedError, setModeratedError] = useState<unknown>(null);
  const [moderatedRisk, setModeratedRisk] = useState('');

  const [reports, setReports] = useState<UserReport[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [reportsError, setReportsError] = useState<unknown>(null);
  const [reportsStatus, setReportsStatus] = useState('open');
  const [resolving, setResolving] = useState<UserReport | null>(null);
  const [resolveAction, setResolveAction] = useState<'resolve' | 'dismiss'>('resolve');
  const [resolveRemarks, setResolveRemarks] = useState('');
  const [resolveBusy, setResolveBusy] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  const [history, setHistory] = useState<ModerationReviewItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<unknown>(null);

  const loadStats = useCallback(() => {
    moderationApi
      .stats()
      .then(setStats)
      .catch(setStatsError);
  }, []);

  const loadQueue = useCallback(async () => {
    setQueueLoading(true);
    setQueueError(null);
    try {
      const data = await moderationApi.queue({ risk: queueRisk || undefined });
      setQueue(data.results);
    } catch (err) {
      setQueueError(err);
    } finally {
      setQueueLoading(false);
    }
  }, [queueRisk]);

  const loadModerated = useCallback(async () => {
    setModeratedLoading(true);
    setModeratedError(null);
    try {
      const data = await moderationApi.moderatedPosts({
        risk: moderatedRisk || undefined,
      });
      setModerated(data.results);
    } catch (err) {
      setModeratedError(err);
    } finally {
      setModeratedLoading(false);
    }
  }, [moderatedRisk]);

  const loadReports = useCallback(async () => {    setReportsLoading(true);
    setReportsError(null);
    try {
      const data = await moderationApi.reports({ status: reportsStatus });
      setReports(data.results);
    } catch (err) {
      setReportsError(err);
    } finally {
      setReportsLoading(false);
    }
  }, [reportsStatus]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const data = await moderationApi.history();
      setHistory(data.results);
    } catch (err) {
      setHistoryError(err);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    if (tab === 'queue') void loadQueue();
    if (tab === 'moderated') void loadModerated();
    if (tab === 'reports') void loadReports();
    if (tab === 'history') void loadHistory();
  }, [tab, loadQueue, loadModerated, loadReports, loadHistory]);

  function refreshAll() {
    loadStats();
    if (tab === 'queue') void loadQueue();
    if (tab === 'moderated') void loadModerated();
    if (tab === 'reports') void loadReports();
  }

  function openResolve(report: UserReport, action: 'resolve' | 'dismiss') {
    setResolving(report);
    setResolveAction(action);
    setResolveRemarks('');
    setResolveError(null);
  }

  async function submitResolve() {
    if (!resolving) return;
    if (resolveRemarks.trim().length < 10) {
      setResolveError('Please write at least 10 characters explaining the outcome.');
      return;
    }
    setResolveBusy(true);
    setResolveError(null);
    try {
      await moderationApi.resolveReport(resolving.id, resolveAction, resolveRemarks.trim());
      setResolving(null);
      refreshAll();
    } catch (err) {
      setResolveError(
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
          'Could not submit the resolution.',
      );
    } finally {
      setResolveBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-navy-950">
      <Sidebar open={false} onClose={() => undefined} />
      <div className="lg:pl-64">
        <Topbar onMenuClick={() => undefined} />
        <PageWrapper>
          <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className="flex items-center gap-2 text-2xl font-bold text-navy-950 dark:text-white">
                  <ShieldCheck className="h-6 w-6 text-accent-500" />
                  Moderator dashboard
                </h1>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Review flagged content with the full model evidence, then make
                  the final human decision.
                </p>
              </div>
            </div>

            {/* Stats */}
            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <DashboardStatCard
                icon={Clock}
                label="Pending review"
                value={stats?.pending_reviews ?? '...'}
                tone="warning"
                hint="High-risk posts held by the model"
              />
              <DashboardStatCard
                icon={FileWarning}
                label="Open user reports"
                value={stats?.open_reports ?? '...'}
                tone="info"
                hint="Reports waiting for a moderator"
              />
              <DashboardStatCard
                icon={UserCheck}
                label="Approved"
                value={stats?.approved_posts ?? '...'}
                tone="success"
              />
              <DashboardStatCard
                icon={XCircle}
                label="Rejected"
                value={stats?.rejected_posts ?? '...'}
                tone="danger"
              />
            </div>
            {statsError ? (
              <div className="mt-4">
                <ErrorMessage error={statsError} onRetry={loadStats} />
              </div>
            ) : null}

            {/* Tabs */}
            <div className="mt-8 flex flex-wrap gap-1.5">
              {([
                { key: 'queue', label: 'Review queue', icon: Inbox },
                { key: 'moderated', label: 'Moderated posts', icon: Gauge },
                { key: 'reports', label: 'User reports', icon: FileWarning },
                { key: 'history', label: 'My review history', icon: ListChecks },
              ] as const).map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setTab(item.key)}
                  className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                    tab === item.key
                      ? 'bg-navy-900 text-white dark:bg-accent-500 dark:text-navy-950'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-navy-800 dark:text-slate-300 dark:hover:bg-navy-700'
                  }`}
                >
                  <item.icon className="h-3.5 w-3.5" />
                  {item.label}
                </button>
              ))}
              {tab === 'queue' && (
                <select
                  className="input ml-auto w-auto py-1.5 text-sm"
                  value={queueRisk}
                  onChange={(event) => setQueueRisk(event.target.value)}
                  aria-label="Filter queue by risk level"
                >
                  <option value="">All risk levels</option>
                  <option value="high">High risk</option>
                  <option value="medium">Medium risk</option>
                  <option value="low">Low risk</option>
                </select>
              )}
              {tab === 'moderated' && (
                <select
                  className="input ml-auto w-auto py-1.5 text-sm"
                  value={moderatedRisk}
                  onChange={(event) => setModeratedRisk(event.target.value)}
                  aria-label="Filter posts by risk level"
                >
                  <option value="">All risk levels</option>
                  <option value="high">High risk</option>
                  <option value="medium">Medium risk</option>
                  <option value="low">Low risk</option>
                </select>
              )}
              {tab === 'reports' && (
                <select
                  className="input ml-auto w-auto py-1.5 text-sm"
                  value={reportsStatus}
                  onChange={(event) => setReportsStatus(event.target.value)}
                  aria-label="Filter reports by status"
                >
                  <option value="open">Open</option>
                  <option value="in_review">In review</option>
                  <option value="resolved">Resolved</option>
                  <option value="dismissed">Dismissed</option>
                  <option value="">All</option>
                </select>
              )}
            </div>

            <div className="mt-5">
              {/* QUEUE */}
              {tab === 'queue' && (
                <div className="space-y-4">
                  {queueLoading && <LoadingSpinner label="Loading the queue..." />}
                  {queueError ? <ErrorMessage error={queueError} onRetry={loadQueue} /> : null}
                  {!queueLoading && !queueError && (
                    <ModerationTable items={queue} onDecided={refreshAll} />
                  )}
                </div>
              )}

              {/* MODERATED POSTS */}
              {tab === 'moderated' && (
                <div className="space-y-4">
                  {moderatedLoading && (
                    <LoadingSpinner label="Loading posts..." />
                  )}
                  {moderatedError ? (
                    <ErrorMessage error={moderatedError} onRetry={loadModerated} />
                  ) : null}
                  {!moderatedLoading && !moderatedError && (
                    <ModeratedPostsTable
                      items={moderated}
                      onChanged={refreshAll}
                    />
                  )}
                </div>
              )}

              {/* REPORTS */}
              {tab === 'reports' && (
                <div className="space-y-4">
                  {reportsLoading && <LoadingSpinner label="Loading reports..." />}
                  {reportsError ? <ErrorMessage error={reportsError} onRetry={loadReports} /> : null}
                  {!reportsLoading && !reportsError && reports.length === 0 && (
                    <div className="card flex flex-col items-center gap-2 p-10 text-center text-slate-400">
                      <FileWarning className="h-8 w-8" />
                      <p className="text-sm">No reports with this filter.</p>
                    </div>
                  )}
                  {reports.map((report) => (
                    <div key={report.id} className="card p-5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-navy-950 dark:text-white">
                            {REPORT_REASON_LABELS[report.reason] ?? report.reason} - post #{report.post_id}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-400">
                            Reported by @{report.reporter_username} - {formatDateTime(report.created_at)}
                          </p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:bg-navy-800 dark:text-slate-300">
                          {report.status.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="mt-3 line-clamp-3 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-500 dark:bg-navy-900 dark:text-slate-400">
                        "{report.post_content}"
                      </p>
                      {report.details && (
                        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                          <span className="font-semibold">Reporter note:</span> {report.details}
                        </p>
                      )}
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {report.post_risk_level && <RiskBadge level={report.post_risk_level} size="sm" />}
                        <span className="text-xs text-slate-400">
                          Post status: {POST_STATUS_LABELS[report.post_status] ?? report.post_status}
                        </span>
                        <div className="ml-auto flex gap-2">
                          <button
                            type="button"
                            className="btn-primary px-3 py-1.5 text-xs"
                            onClick={() => openResolve(report, 'resolve')}
                          >
                            Resolve (moderate post)
                          </button>
                          <button
                            type="button"
                            className="btn-secondary px-3 py-1.5 text-xs"
                            onClick={() => openResolve(report, 'dismiss')}
                          >
                            Dismiss report
                          </button>
                        </div>
                      </div>
                      {report.resolution_remarks && (
                        <p className="mt-3 rounded-lg border border-accent-500/20 bg-accent-500/5 p-2.5 text-xs text-slate-600 dark:text-slate-300">
                          <span className="font-semibold">Resolution</span> (by @{report.resolved_by_username}):{' '}
                          {report.resolution_remarks}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* HISTORY */}
              {tab === 'history' && (
                <div className="space-y-4">
                  {historyLoading && <LoadingSpinner label="Loading review history..." />}
                  {historyError ? <ErrorMessage error={historyError} onRetry={loadHistory} /> : null}
                  {!historyLoading && !historyError && history.length === 0 && (
                    <div className="card flex flex-col items-center gap-2 p-10 text-center text-slate-400">
                      <ListChecks className="h-8 w-8" />
                      <p className="text-sm">No moderation reviews recorded yet.</p>
                    </div>
                  )}
                  {history.map((review) => (
                    <div key={review.id} className="card p-5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-navy-950 dark:text-white">
                            Post #{review.post_id}: {review.post_title || review.post_content.slice(0, 50)}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-400">
                            Author @{review.post_author} - reviewed {formatDateTime(review.created_at)}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
                            review.action === 'risk_overridden'
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
                              : review.action === 'approved'
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                                : 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300'
                          }`}
                        >
                          {review.action.replace('_', ' ')}
                        </span>
                      </div>
                      {review.action === 'risk_overridden' && (
                        <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                          <RiskBadge level={review.previous_risk_level || 'low'} size="sm" />
                          <span>→</span>
                          <RiskBadge level={review.new_risk_level || 'low'} size="sm" />
                        </p>
                      )}
                      {review.remarks && (
                        <p className="mt-2 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-500 dark:bg-navy-900 dark:text-slate-400">
                          {review.remarks}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <p className="mt-8 flex items-start gap-2 text-xs leading-relaxed text-slate-400">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-accent-500" />
              Model output is advisory. As a moderator you always make the final
              decision, and your written remarks are recorded with the review.
              Administrators can audit every action in the{' '}
              <Link to="/admin/audit-logs" className="font-semibold text-accent-500 hover:underline">
                audit logs
              </Link>
              .
            </p>
          </main>
        </PageWrapper>
      </div>

      {/* Report resolution modal */}
      {resolving && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-navy-950/60 backdrop-blur-sm"
            onClick={() => !resolveBusy && setResolving(null)}
          />
          <div className="relative w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-navy-700 dark:bg-navy-900">
            <h3 className="text-lg font-semibold text-navy-950 dark:text-white">
              {resolveAction === 'resolve' ? 'Resolve' : 'Dismiss'} report #
              {resolving.id}
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              {resolveAction === 'resolve'
                ? 'Resolving means you moderate the reported post - review it in the queue or state the outcome in your remarks.'
                : 'Dismissing closes the report without changing the post.'}
            </p>
            <label htmlFor="resolve-remarks" className="label mt-4">
              Outcome remarks (required)
            </label>
            <textarea
              id="resolve-remarks"
              className="input resize-none"
              rows={4}
              maxLength={1000}
              value={resolveRemarks}
              onChange={(event) => setResolveRemarks(event.target.value)}
              placeholder="Explain what you verified and why you are closing the report this way."
            />
            {resolveError && (
              <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                {resolveError}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setResolving(null)}
                disabled={resolveBusy}
              >
                Cancel
              </button>
              <button
                type="button"
                className={resolveAction === 'resolve' ? 'btn-primary' : 'btn-secondary'}
                onClick={submitResolve}
                disabled={resolveBusy}
              >
                {resolveBusy ? 'Submitting...' : `Confirm ${resolveAction}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
