import { ArrowRight, Eye, Gauge, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { extractErrorMessage, mediaUrl } from '../api/client';
import { moderationApi } from '../api/moderation';
import type { ModerationQueueItem, RiskLevel } from '../types';
import { CATEGORY_LABELS, formatDateTime, POST_STATUS_LABELS } from '../utils/format';
import RiskBadge from './RiskBadge';

const RISK_LABELS: Record<RiskLevel, string> = {
  low: 'Low risk',
  medium: 'Medium risk',
  high: 'High risk',
};

const RISK_HINTS: Record<RiskLevel, string> = {
  low: 'Publishes normally and can be shared to social media.',
  medium: 'Publishes with a warning and can be shared to social media.',
  high: 'Can stay public, but social sharing is blocked until the risk is lowered.',
};

const STATUS_STYLES: Record<string, string> = {
  published: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  approved: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
};

/**
 * Posts that already left the review queue. Moderators can correct the risk
 * level here (for example lower a high-risk post after verification). The
 * change is recorded as a separate moderation review; the model prediction is
 * never edited.
 */
export default function ModeratedPostsTable({
  items,
  onChanged,
}: {
  items: ModerationQueueItem[];
  onChanged?: () => void;
}) {
  const [changing, setChanging] = useState<ModerationQueueItem | null>(null);
  const [risk, setRisk] = useState<RiskLevel>('low');
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openChange(item: ModerationQueueItem) {
    setChanging(item);
    setRisk(item.risk_level === 'low' ? 'medium' : 'low');
    setRemarks('');
    setError(null);
  }

  async function submitChange() {
    if (!changing) return;
    const trimmed = remarks.trim();
    if (trimmed.length < 10) {
      setError('Please write at least 10 characters explaining the risk change.');
      return;
    }
    if (risk === changing.risk_level) {
      setError('Choose a different risk level.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await moderationApi.setRisk(changing.id, risk, trimmed);
      setChanging(null);
      onChanged?.();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {items.length === 0 && (
        <div className="card flex flex-col items-center gap-2 p-10 text-center text-slate-400">
          <ShieldCheck className="h-8 w-8" />
          <p className="text-sm">No posts match this filter.</p>
        </div>
      )}

      {items.map((item) => {
        const imageUrl = mediaUrl(item.image);
        const review = item.latest_review;
        return (
          <article key={item.id} className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-navy-950 dark:text-white">
                    {item.title || `Post #${item.id}`}
                  </h3>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                      STATUS_STYLES[item.status] ?? 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {POST_STATUS_LABELS[item.status] ?? item.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  by @{item.author_username}
                  {item.author_full_name ? ` (${item.author_full_name})` : ''} -{' '}
                  {formatDateTime(item.created_at)} -{' '}
                  {CATEGORY_LABELS[item.category] ?? item.category}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <RiskBadge level={item.risk_level} />
                <span className="text-[11px] text-slate-400">
                  {item.risk_level === 'high'
                    ? 'Sharing blocked'
                    : 'Shareable'}
                </span>
              </div>
            </div>

            <div className="mt-3 flex gap-3">
              {imageUrl && (
                <img
                  src={imageUrl}
                  alt="Post attachment"
                  className="h-20 w-28 shrink-0 rounded-lg border border-slate-200 object-cover dark:border-navy-700"
                  loading="lazy"
                />
              )}
              <p className="line-clamp-3 rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-slate-600 dark:bg-navy-900 dark:text-slate-300">
                {item.content}
              </p>
            </div>

            {review && (
              <div className="mt-3 rounded-lg border border-slate-200 p-3 text-xs dark:border-navy-700">
                <p className="font-semibold text-navy-950 dark:text-slate-100">
                  {review.action === 'risk_overridden'
                    ? 'Risk level overridden'
                    : `Last decision: ${review.action}`}{' '}
                  <span className="font-normal text-slate-400">
                    by @{review.moderator_username}
                  </span>
                </p>
                {review.action === 'risk_overridden' && (
                  <p className="mt-1 flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                    <RiskBadge level={review.previous_risk_level || 'low'} size="sm" />
                    <ArrowRight className="h-3 w-3" />
                    <RiskBadge level={review.new_risk_level || 'low'} size="sm" />
                  </p>
                )}
                {review.remarks && (
                  <p className="mt-1 leading-relaxed text-slate-500 dark:text-slate-400">
                    {review.remarks}
                  </p>
                )}
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="btn-secondary px-3 py-1.5 text-sm"
                onClick={() => openChange(item)}
              >
                <Gauge className="h-4 w-4" />
                Change risk
              </button>
              <Link
                to={`/post/${item.id}`}
                className="btn-ghost px-3 py-1.5 text-sm"
              >
                <Eye className="h-4 w-4" />
                Open post
              </Link>
              <span className="ml-auto text-[11px] text-slate-400">post #{item.id}</span>
            </div>
          </article>
        );
      })}

      {changing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-navy-950/60 backdrop-blur-sm"
            onClick={() => !busy && setChanging(null)}
          />
          <div className="relative w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-navy-700 dark:bg-navy-900">
            <h3 className="text-lg font-semibold text-navy-950 dark:text-white">
              Change risk level - post #{changing.id}
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              Current risk: {RISK_LABELS[changing.risk_level]}. This is a human
              decision recorded on top of the model prediction; the original
              prediction is never edited.
            </p>

            <label htmlFor="new-risk" className="label mt-4">
              New risk level
            </label>
            <select
              id="new-risk"
              className="input"
              value={risk}
              onChange={(event) => setRisk(event.target.value as RiskLevel)}
            >
              {(['low', 'medium', 'high'] as RiskLevel[])
                .filter((level) => level !== changing.risk_level)
                .map((level) => (
                  <option key={level} value={level}>
                    {RISK_LABELS[level]} - {RISK_HINTS[level]}
                  </option>
                ))}
            </select>
            <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
              {RISK_HINTS[risk]}
            </p>

            <label htmlFor="risk-remarks" className="label mt-4">
              Reason for the change (required, visible to the author and auditors)
            </label>
            <textarea
              id="risk-remarks"
              className="input resize-none"
              rows={4}
              maxLength={1000}
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
              placeholder="e.g. Verified the claims against the cited report; the content is accurate, so the risk is lowered to low."
            />
            {error && (
              <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                {error}
              </p>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setChanging(null)}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={submitChange}
                disabled={busy}
              >
                {busy ? 'Saving...' : 'Save risk level'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
