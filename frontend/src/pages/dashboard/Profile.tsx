import { FileText, ShieldCheck, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { postsApi } from '../../api/posts';
import { extractErrorMessage } from '../../api/client';
import ErrorMessage from '../../components/ErrorMessage';
import LoadingSpinner from '../../components/LoadingSpinner';
import PageWrapper from '../../components/PageWrapper';
import RiskBadge from '../../components/RiskBadge';
import { useAuth } from '../../context/AuthContext';
import type { Post, User } from '../../types';
import { avatarColor, formatDateTime, initials, POST_STATUS_LABELS } from '../../utils/format';

export default function Profile() {
  const { user } = useAuth();

  return (
    <PageWrapper>
      <div className="mx-auto max-w-4xl">
        {user ? <ProfileContent user={user} /> : <LoadingSpinner />}
      </div>
    </PageWrapper>
  );
}

function ProfileContent({ user }: { user: User }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await postsApi.getMyPosts({ page: 1 });
        if (!cancelled) setPosts(data.results);
      } catch (err) {
        if (!cancelled) setError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const riskCounts = posts.reduce(
    (acc, post) => {
      if (post.risk_level) acc[post.risk_level] = (acc[post.risk_level] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <>
      <h1 className="text-2xl font-bold text-navy-950 dark:text-white">Profile</h1>

      <div className="card mt-5 flex flex-col items-center gap-6 p-6 sm:flex-row sm:items-start">
        <span
          className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl text-2xl font-bold text-white ${avatarColor(user.username)}`}
        >
          {initials(user.profile.full_name || user.username)}
        </span>
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <h2 className="text-xl font-bold text-navy-950 dark:text-white">
            {user.profile.full_name || user.username}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            @{user.username}
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <span className="rounded-full bg-navy-900 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-accent-400">
              {user.role}
            </span>
            <span className="text-xs text-slate-400">
              Joined {formatDateTime(user.date_joined)}
            </span>
          </div>
          {user.profile.bio && (
            <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {user.profile.bio}
            </p>
          )}
          {user.profile.department && (
            <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-slate-400 sm:justify-start">
              <UserRound className="h-3.5 w-3.5" />
              {user.profile.department}
            </p>
          )}
        </div>
      </div>

      {/* Risk summary of recent posts */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {(['low', 'medium', 'high'] as const).map((level) => (
          <div key={level} className="card flex items-center justify-between p-4">
            <RiskBadge level={level} />
            <p className="text-2xl font-bold text-navy-950 dark:text-white">
              {riskCounts[level] ?? 0}
            </p>
          </div>
        ))}
      </div>

      <h2 className="mt-8 flex items-center gap-2 text-lg font-semibold text-navy-950 dark:text-white">
        <FileText className="h-5 w-5 text-accent-500" />
        Recent posts
      </h2>
      <div className="mt-4 space-y-3">
        {loading && <LoadingSpinner label="Loading your posts..." />}
        {error ? <ErrorMessage error={error} /> : null}
        {!loading && !error && posts.length === 0 && (
          <div className="card p-8 text-center text-sm text-slate-400">
            No posts yet - your published content will appear here.
          </div>
        )}
        {posts.map((post) => (
          <div key={post.id} className="card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="min-w-0 truncate text-sm font-semibold text-navy-950 dark:text-white">
                {post.title || post.content.slice(0, 60)}
              </p>
              <div className="flex items-center gap-2">
                {post.risk_level && <RiskBadge level={post.risk_level} />}
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:bg-navy-800 dark:text-slate-300">
                  {POST_STATUS_LABELS[post.status] ?? post.status}
                </span>
              </div>
            </div>
            <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              {post.content}
            </p>
            <p className="mt-2 text-[11px] text-slate-400">
              {formatDateTime(post.created_at)}
            </p>
          </div>
        ))}
      </div>

      <p className="mt-8 flex items-start gap-2 text-xs leading-relaxed text-slate-400">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent-500" />
        Risk badges reflect the machine learning model's prediction at the time
        each post was analyzed. They are automated signals, not fact-checks.
      </p>
    </>
  );
}
