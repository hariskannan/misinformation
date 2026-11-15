import { Bell, FileWarning, MessageSquare, PenSquare, TrendingUp } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { postsApi } from '../../api/posts';
import CreatePost from '../../components/CreatePost';
import DashboardStatCard from '../../components/DashboardStatCard';
import ErrorMessage from '../../components/ErrorMessage';
import LoadingSpinner from '../../components/LoadingSpinner';
import PageWrapper from '../../components/PageWrapper';
import PostCard from '../../components/PostCard';
import RiskBadge from '../../components/RiskBadge';
import { useAuth } from '../../context/AuthContext';
import type { Prediction, Post } from '../../types';
import { formatNumber, timeAgo } from '../../utils/format';

const PAGE_SIZE = 5;

export default function Home() {
  const { user } = useAuth();
  const [myPostsCount, setMyPostsCount] = useState<number | null>(null);
  const [myPending, setMyPending] = useState(0);
  const [myReports, setMyReports] = useState<number | null>(null);
  const [unread, setUnread] = useState<number | null>(null);
  const [recentPredictions, setRecentPredictions] = useState<Prediction[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [postsError, setPostsError] = useState<unknown>(null);
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [filter, setFilter] = useState<string>('all');
  const [category, setCategory] = useState<string>('');

  // User-scoped summary - regular users must not call admin analytics.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mine = await postsApi.getMyPosts({ page: 1 });
        if (!cancelled) {
          setMyPostsCount(mine.count);
          setMyPending(
            mine.results.filter((post) => post.status === 'pending_review').length,
          );
        }
      } catch {
        /* non-critical summary */
      }
      try {
        const reports = await postsApi.getMyReports({ page: 1 });
        if (!cancelled) setMyReports(reports.count);
      } catch {
        /* non-critical summary */
      }
      try {
        const unreadData = await postsApi.getUnreadCount();
        if (!cancelled) setUnread(unreadData.count);
      } catch {
        /* non-critical summary */
      }
      try {
        const predictions = await postsApi.getRecentPredictions();
        if (!cancelled) setRecentPredictions(predictions.results);
      } catch {
        /* non-critical summary */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadFeed = useCallback(async () => {
    setLoadingPosts(true);
    setPostsError(null);
    try {
      const data = await postsApi.getFeed({
        page,
        risk: filter === 'all' ? undefined : filter,
        category: category || undefined,
      });
      setPosts(data.results);
      setCount(data.count);
    } catch (err) {
      setPostsError(err);
    } finally {
      setLoadingPosts(false);
    }
  }, [page, filter, category]);

  useEffect(() => {
    void loadFeed();
  }, [loadFeed]);

  function prependPost(post: Post) {
    setPosts((current) => [post, ...current.filter((item) => item.id !== post.id)]);
    setCount((value) => value + 1);
    setMyPostsCount((value) => (value === null ? value : value + 1));
    if (post.status === 'pending_review') {
      setMyPending((value) => value + 1);
    }
  }

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const firstName = user?.profile.full_name?.split(' ')[0] ?? user?.username ?? 'there';

  // Risk distribution over the user's own recent predictions.
  const myRiskCounts = recentPredictions.reduce(
    (acc, prediction) => {
      acc[prediction.risk_level] = (acc[prediction.risk_level] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  const myRiskTotal = recentPredictions.length;

  return (
    <PageWrapper>
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-navy-950 dark:text-white">
              Hello {firstName}
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Here is what is happening on TruthGuard today.
            </p>
          </div>
        </div>

        {/* Personal stats */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <DashboardStatCard
            icon={PenSquare}
            label="My posts"
            value={myPostsCount === null ? '...' : formatNumber(myPostsCount)}
            hint="Every post gets a model prediction"
            tone="info"
            delay={0}
          />
          <DashboardStatCard
            icon={FileWarning}
            label="Awaiting moderation"
            value={formatNumber(myPending)}
            hint="Your posts held for review"
            tone="warning"
            delay={0.05}
          />
          <DashboardStatCard
            icon={MessageSquare}
            label="My reports"
            value={myReports === null ? '...' : formatNumber(myReports)}
            hint="Reports you submitted"
            tone="default"
            delay={0.1}
          />
          <DashboardStatCard
            icon={Bell}
            label="Unread notifications"
            value={unread === null ? '...' : formatNumber(unread)}
            hint="Likes, comments, moderation news"
            tone="success"
            delay={0.15}
          />
        </div>

        {/* Composer + feed */}
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            <CreatePost onPublished={prependPost} />

            {/* Feed filters */}
            <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex flex-wrap gap-1.5">
                {[
                  { key: 'all', label: 'All posts' },
                  { key: 'low', label: 'Low risk' },
                  { key: 'medium', label: 'Medium risk' },
                  { key: 'high', label: 'High risk' },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setPage(1);
                      setFilter(item.key);
                    }}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                      filter === item.key
                        ? 'bg-navy-900 text-white dark:bg-accent-500 dark:text-navy-950'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-navy-800 dark:text-slate-300 dark:hover:bg-navy-700'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <select
                className="input w-auto py-1.5 text-sm"
                value={category}
                onChange={(event) => {
                  setPage(1);
                  setCategory(event.target.value);
                }}
                aria-label="Filter by category"
              >
                <option value="">All categories</option>
                <option value="news">News</option>
                <option value="politics">Politics</option>
                <option value="health">Health</option>
                <option value="technology">Technology</option>
                <option value="science">Science</option>
                <option value="business">Business</option>
                <option value="entertainment">Entertainment</option>
                <option value="sports">Sports</option>
                <option value="other">Other</option>
              </select>
            </div>

            {loadingPosts && <LoadingSpinner label="Loading feed..." />}
            {postsError ? <ErrorMessage error={postsError} onRetry={loadFeed} /> : null}
            {!loadingPosts && !postsError && posts.length === 0 && (
              <div className="card flex flex-col items-center gap-2 p-10 text-center text-slate-400">
                <Bell className="h-8 w-8" />
                <p className="text-sm">
                  No posts match this filter yet. Be the first to publish something reliable!
                </p>
              </div>
            )}
            {posts.map((post) => (
              <PostCard key={post.id} post={post} currentUser={user} />
            ))}

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  className="btn-secondary px-3 py-1.5 text-sm"
                  disabled={page <= 1}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                >
                  Previous
                </button>
                <span className="text-sm text-slate-500">
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  className="btn-secondary px-3 py-1.5 text-sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                >
                  Next
                </button>
              </div>
            )}
          </div>

          {/* Sidebar widgets */}
          <aside className="space-y-6">
            <div className="card p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-navy-950 dark:text-white">
                <TrendingUp className="h-4 w-4 text-accent-500" />
                My recent risk results
              </h2>
              {myRiskTotal > 0 ? (
                <ul className="mt-4 space-y-2.5 text-sm">
                  {(['low', 'medium', 'high'] as const).map((level) => {
                    const value = myRiskCounts[level] ?? 0;
                    const pct = Math.round((value / myRiskTotal) * 100);
                    const colors = {
                      low: 'bg-emerald-500',
                      medium: 'bg-amber-500',
                      high: 'bg-red-500',
                    } as const;
                    return (
                      <li key={level}>
                        <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
                          <span className="capitalize">{level} risk</span>
                          <span>{formatNumber(value)}</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-navy-800">
                          <div className={`h-full rounded-full ${colors[level]}`} style={{ width: `${pct}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-3 text-xs text-slate-400">
                  No predictions yet - write your first post to see its risk analysis.
                </p>
              )}
              {recentPredictions.length > 0 && recentPredictions[0].model && (
                <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-400 dark:border-navy-800">
                  Analyzed by{' '}
                  <span className="font-semibold text-slate-500 dark:text-slate-300">
                    {recentPredictions[0].model.name}
                  </span>
                </p>
              )}
            </div>

            {recentPredictions.length > 0 && (
              <div className="card p-5">
                <h2 className="text-sm font-semibold text-navy-950 dark:text-white">
                  Latest prediction
                </h2>
                <div className="mt-3 space-y-2">
                  <RiskBadge level={recentPredictions[0].risk_level} />
                  <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                    {recentPredictions[0].predicted_label_display} with{' '}
                    {Math.round(recentPredictions[0].confidence * 100)}% confidence,
                    predicted {timeAgo(recentPredictions[0].created_at)}.
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Statistical signal, not a fact-check.
                  </p>
                </div>
              </div>
            )}

            <div className="card p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-navy-950 dark:text-white">
                <FileWarning className="h-4 w-4 text-accent-500" />
                Platform policy
              </h2>
              <ul className="mt-3 space-y-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                <li><span className="font-semibold text-emerald-600 dark:text-emerald-400">Low risk</span> - publishes immediately.</li>
                <li><span className="font-semibold text-amber-600 dark:text-amber-400">Medium risk</span> - publishes with a warning.</li>
                <li><span className="font-semibold text-red-600 dark:text-red-400">High risk</span> - held for moderator review.</li>
              </ul>
              <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
                Predictions are automated risk signals from a machine learning
                model, not fact-checks. Moderators make the final decision.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </PageWrapper>
  );
}
