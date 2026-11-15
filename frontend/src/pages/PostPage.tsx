import { AlertTriangle, ArrowLeft, Brain, Clock, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { extractErrorMessage, mediaUrl } from '../api/client';
import { postsApi } from '../api/posts';
import ErrorMessage from '../components/ErrorMessage';
import Footer from '../components/Footer';
import LoadingSpinner from '../components/LoadingSpinner';
import Navbar from '../components/Navbar';
import PageWrapper from '../components/PageWrapper';
import RiskBadge from '../components/RiskBadge';
import ShareMenu from '../components/ShareMenu';
import type { Post } from '../types';
import {
  avatarColor,
  CATEGORY_LABELS,
  formatDateTime,
  formatPercent,
  initials,
} from '../utils/format';

export default function PostPage() {
  const { id } = useParams<{ id: string }>();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    postsApi
      .getPost(Number(id))
      .then((data) => !cancelled && setPost(data))
      .catch((err) => !cancelled && setError(err))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const imageUrl = mediaUrl(post?.image);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-navy-950">
      <Navbar />
      <PageWrapper>
        <main className="mx-auto max-w-3xl px-4 pb-20 pt-28 sm:px-6 lg:px-8">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent-600 hover:text-accent-500 dark:text-accent-400"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to TruthGuard
          </Link>

          {loading && (
            <div className="mt-8">
              <LoadingSpinner label="Loading post..." />
            </div>
          )}

          {error ? (
            <div className="mt-8">
              <ErrorMessage error={error} />
              <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                The post may have been removed, or it is not public.{' '}
                <Link to="/login" className="font-semibold text-accent-500 hover:underline">
                  Sign in
                </Link>{' '}
                to view your own posts.
              </p>
            </div>
          ) : null}

          {post && !loading && (
            <article className="card mt-6 p-6">
              <div className="flex items-start gap-3">
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${avatarColor(
                    post.author.username,
                  )}`}
                >
                  {initials(post.author.full_name || post.author.username)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {post.author.full_name || post.author.username}
                    </span>
                    <span className="text-sm text-slate-400">@{post.author.username}</span>
                    <span className="text-slate-300 dark:text-navy-600">•</span>
                    <span className="text-sm text-slate-400">
                      {formatDateTime(post.created_at)}
                    </span>
                    {post.category && post.category !== 'other' && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-navy-800 dark:text-slate-300">
                        {CATEGORY_LABELS[post.category] ?? post.category}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {post.status === 'approved'
                      ? 'Approved by a moderator'
                      : post.status === 'published'
                        ? 'Published on TruthGuard'
                        : 'Not publicly available'}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <RiskBadge level={post.risk_level} />
                  <ShareMenu post={post} />
                </div>
              </div>

              {post.title && (
                <h1 className="mt-5 text-2xl font-bold leading-tight text-navy-950 dark:text-white">
                  {post.title}
                </h1>
              )}
              <p className="mt-3 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-slate-700 dark:text-slate-300">
                {post.content}
              </p>

              {imageUrl && (
                <img
                  src={imageUrl}
                  alt="Post attachment"
                  className="mt-5 max-h-[28rem] w-full rounded-lg border border-slate-200 object-cover dark:border-navy-700"
                />
              )}

              {post.risk_level === 'high' && (
                <p className="mt-5 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm leading-relaxed text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  This post is flagged as high risk. Social sharing is disabled until a
                  moderator reviews it and lowers the risk level.
                </p>
              )}

              {post.prediction && (
                <section className="mt-6 rounded-xl border border-slate-200 p-4 dark:border-navy-700">
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-navy-950 dark:text-white">
                    <Brain className="h-4 w-4 text-accent-500" />
                    How the model assessed this post
                  </h2>
                  <div className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
                    <div>
                      <p className="text-slate-400">Predicted label</p>
                      <p className="font-semibold text-navy-950 dark:text-slate-100">
                        {post.prediction.predicted_label_display ||
                          (post.prediction.predicted_label === 'fake'
                            ? 'Likely misinformation'
                            : 'Likely reliable')}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400">Confidence</p>
                      <p className="font-semibold text-navy-950 dark:text-slate-100">
                        {formatPercent(post.prediction.confidence)}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400">Model</p>
                      <p className="font-semibold text-navy-950 dark:text-slate-100">
                        {post.prediction.model.name} ({post.prediction.model.version_tag})
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400">Predicted at</p>
                      <p className="flex items-center gap-1 font-semibold text-navy-950 dark:text-slate-100">
                        <Clock className="h-3 w-3 text-slate-400" />
                        {formatDateTime(post.prediction.created_at)}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                    <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {post.prediction.limitations ||
                      'This is a statistical risk signal from a machine learning model, not a fact-check. Verify claims with primary sources.'}
                  </p>
                </section>
              )}
            </article>
          )}
        </main>
      </PageWrapper>
      <Footer />
    </div>
  );
}
