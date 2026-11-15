import { Brain, Download, ShieldAlert, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { analyticsApi } from '../../api/analytics';
import DashboardStatCard from '../../components/DashboardStatCard';
import ErrorMessage from '../../components/ErrorMessage';
import LoadingSpinner from '../../components/LoadingSpinner';
import PageWrapper from '../../components/PageWrapper';
import {
  ActivityChart,
  ModerationBarChart,
  ModelPerformanceChart,
  RiskDistributionChart,
} from '../../components/AnalyticsChart';
import type {
  ActivityPoint,
  ModelPerformanceRow,
  ModerationStatsAnalytics,
  OverviewStats,
} from '../../types';

type RiskRow = { risk_level: string; count: number; label: string };

export default function AdminAnalytics() {
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [overviewError, setOverviewError] = useState<unknown>(null);
  const [risk, setRisk] = useState<RiskRow[] | null>(null);
  const [activity, setActivity] = useState<ActivityPoint[] | null>(null);
  const [modelPerf, setModelPerf] = useState<ModelPerformanceRow[] | null>(null);
  const [modStats, setModStats] = useState<ModerationStatsAnalytics | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    analyticsApi
      .overview()
      .then((data) => !cancelled && setOverview(data))
      .catch((err) => !cancelled && setOverviewError(err));
    analyticsApi.riskDistribution().then((data) => !cancelled && setRisk(data.results)).catch(() => undefined);
    analyticsApi.activity({ days: 30 }).then((data) => !cancelled && setActivity(data.results)).catch(() => undefined);
    analyticsApi.modelPerformance().then((data) => !cancelled && setModelPerf(data.results)).catch(() => undefined);
    analyticsApi.moderationStats().then((data) => !cancelled && setModStats(data)).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  async function exportCsv(type: 'overview' | 'posts') {
    setExporting(true);
    try {
      const blob = await analyticsApi.exportUrl(type);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `truthguard_${type}_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  if (overviewError) {
    return (
      <PageWrapper>
        <ErrorMessage error={overviewError} onRetry={() => window.location.reload()} />
      </PageWrapper>
    );
  }

  if (!overview) {
    return <LoadingSpinner fullScreen label="Loading analytics..." />;
  }

  return (
    <PageWrapper>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-navy-950 dark:text-white">
              Platform analytics
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Every number is computed live from the database.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-secondary px-3 py-1.5 text-sm"
              onClick={() => void exportCsv('overview')}
              disabled={exporting}
            >
              <Download className="h-4 w-4" />
              Overview CSV
            </button>
            <button
              type="button"
              className="btn-secondary px-3 py-1.5 text-sm"
              onClick={() => void exportCsv('posts')}
              disabled={exporting}
            >
              <Download className="h-4 w-4" />
              Posts CSV
            </button>
          </div>
        </div>

        {/* Top stats */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <DashboardStatCard icon={Users} label="Registered users" value={overview.users_total}
            hint={`${overview.users_by_role.admin ?? 0} admin / ${overview.users_by_role.moderator ?? 0} moderator`} />
          <DashboardStatCard icon={Brain} label="Posts analyzed" value={overview.predictions_total}
            hint={`${overview.posts_total} posts total`} tone="info" />
          <DashboardStatCard icon={ShieldAlert} label="High-risk posts" value={overview.posts_high_risk}
            hint={`${overview.posts_pending} awaiting review`} tone="danger" />
          <DashboardStatCard icon={Users} label="Open reports" value={overview.reports_open}
            hint={`${overview.reports_total} reports total`} tone="warning" />
        </div>

        {/* Active model banner */}
        {overview.active_model && (
          <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Active model
              </p>
              <p className="mt-1 text-lg font-bold text-navy-950 dark:text-white">
                {overview.active_model.name}{' '}
                <span className="text-sm font-medium text-slate-400">
                  ({overview.active_model.version_tag})
                </span>
              </p>
              {overview.active_model.metrics && (
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Real held-out test metrics - accuracy{' '}
                  {(overview.active_model.metrics.accuracy * 100).toFixed(1)}%, F1{' '}
                  {overview.active_model.metrics.f1.toFixed(3)} on{' '}
                  {overview.active_model.metrics.test_size} test rows
                </p>
              )}
            </div>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
              ACTIVE
            </span>
          </div>
        )}

        {/* Charts */}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-navy-950 dark:text-white">
              Risk distribution of predictions
            </h2>
            {risk ? (
              <RiskDistributionChart data={risk} />
            ) : (
              <LoadingSpinner label="Loading chart..." />
            )}
          </div>
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-navy-950 dark:text-white">
              Moderation throughput
            </h2>
            <ModerationBarChart
              approved={overview.posts_approved}
              rejected={overview.posts_rejected}
              pending={overview.posts_pending}
              reports={overview.reports_total}
            />
          </div>
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-navy-950 dark:text-white">
              Posting activity (last 30 days)
            </h2>
            {activity ? (
              <ActivityChart data={activity} />
            ) : (
              <LoadingSpinner label="Loading chart..." />
            )}
          </div>
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-navy-950 dark:text-white">
              Model performance comparison
            </h2>
            {modelPerf && modelPerf.length > 0 ? (
              <>
                <ModelPerformanceChart models={modelPerf} />
                <p className="mt-2 text-xs text-slate-400">
                  Metrics come from each model's held-out test split during its
                  training run. No simulated values.
                </p>
              </>
            ) : (
              <LoadingSpinner label="Loading chart..." />
            )}
          </div>
        </div>

        {/* Moderation per moderator */}
        {modStats && modStats.per_moderator.length > 0 && (
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-navy-950 dark:text-white">
              Reviews per moderator
            </h2>
            <ul className="mt-3 divide-y divide-slate-100 dark:divide-navy-800">
              {modStats.per_moderator.map((row) => (
                <li key={row.moderator} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-slate-600 dark:text-slate-300">@{row.moderator}</span>
                  <span className="font-semibold text-navy-950 dark:text-white">
                    {row.count} review{row.count === 1 ? '' : 's'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-xs leading-relaxed text-slate-400">
          Analytics aggregate data generated by real platform usage and real
          training runs. The demo database ships with a synthetic sample dataset
          (clearly labelled as such) - upload a real research dataset to obtain
          meaningful real-world metrics.
        </p>
      </div>
    </PageWrapper>
  );
}
