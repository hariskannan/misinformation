import { Eye, MessageSquareText, ShieldCheck, ThumbsDown, ThumbsUp } from 'lucide-react';
import { useState } from 'react';
import { moderationApi } from '../api/moderation';
import { extractErrorMessage } from '../api/client';
import ErrorMessage from './ErrorMessage';
import RiskBadge from './RiskBadge';
import type { ModerationQueueItem, RiskLevel } from '../types';
import { CATEGORY_LABELS, formatDateTime, formatPercent } from '../utils/format';

/**
 * The moderator queue table: every row shows the post, the model's evidence
 * (label, confidence, model version) and approve/reject actions with written
 * remarks. The final decision is always human.
 */
export default function ModerationTable({
  items,
  onDecided,
}: {
  items: ModerationQueueItem[];
  onDecided?: () => void;
}) {
  const [deciding, setDeciding] = useState<{
    item: ModerationQueueItem;
    action: 'approve' | 'reject';
  } | null>(null);
  const [remarks, setRemarks] = useState('');
  const [newRisk, setNewRisk] = useState<'' | RiskLevel>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<ModerationQueueItem | null>(null);

  function openDecision(item: ModerationQueueItem, action: 'approve' | 'reject') {
    setError(null);
    setRemarks('');
    setNewRisk('');
    setDeciding({ item, action });
  }

  async function submitDecision() {
    if (!deciding) return;
    const trimmed = remarks.trim();
    if (trimmed.length < 10) {
      setError('Please write at least 10 characters of review remarks - other moderators should understand your reasoning.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (deciding.action === 'approve') {
        await moderationApi.approve(
          deciding.item.id,
          trimmed,
          newRisk || undefined,
        );
      } else {
        await moderationApi.reject(deciding.item.id, trimmed);
      }
      setDeciding(null);
      onDecided?.();
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
          <p className="text-sm">The queue is empty. Nothing is waiting for review.</p>
        </div>
      )}

      {items.map((item) => (
        <article key={item.id} className="card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-navy-950 dark:text-white">
                  {item.title || `Post #${item.id}`}
                </h3>
                {item.reports_count > 0 && (
                  <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-bold text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
                    {item.reports_count} user report{item.reports_count > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-400">
                by @{item.author_username}
                {item.author_full_name ? ` (${item.author_full_name})` : ''} -{' '}
                {formatDateTime(item.created_at)} -{' '}
                {CATEGORY_LABELS[item.category] ?? item.category}
              </p>
            </div>
            <RiskBadge level={item.risk_level} />
          </div>

          <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-slate-600 dark:bg-navy-900 dark:text-slate-300">
            {item.content}
          </p>

          {/* Model evidence */}
          {item.prediction ? (
            <div className="mt-3 grid gap-2 rounded-lg border border-slate-200 p-3 text-xs dark:border-navy-700 sm:grid-cols-4">
              <div>
                <p className="text-slate-400">Predicted label</p>
                <p className="font-semibold text-navy-950 dark:text-slate-100">
                  {item.prediction.predicted_label === 'fake' ? 'Likely fake' : 'Likely real'}
                </p>
              </div>
              <div>
                <p className="text-slate-400">Confidence</p>
                <p className="font-semibold text-navy-950 dark:text-slate-100">
                  {formatPercent(item.prediction.confidence)}
                </p>
              </div>
              <div>
                <p className="text-slate-400">Model</p>
                <p className="font-semibold text-navy-950 dark:text-slate-100">
                  {item.prediction.model.name}
                </p>
              </div>
              <div>
                <p className="text-slate-400">Version</p>
                <p className="font-semibold text-navy-950 dark:text-slate-100">
                  {item.prediction.model.version_tag}
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-xs italic text-slate-400">
              No model prediction recorded for this post.
            </p>
          )}

          {item.latest_report_reasons.length > 0 && (
            <p className="mt-2 text-xs text-slate-400">
              Latest user reports:{' '}
              {item.latest_report_reasons.join(', ')}
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn-primary px-3 py-1.5 text-sm"
              onClick={() => openDecision(item, 'approve')}
            >
              <ThumbsUp className="h-4 w-4" />
              Approve
            </button>
            <button
              type="button"
              className="btn-danger px-3 py-1.5 text-sm"
              onClick={() => openDecision(item, 'reject')}
            >
              <ThumbsDown className="h-4 w-4" />
              Reject
            </button>
            <button
              type="button"
              className="btn-secondary px-3 py-1.5 text-sm"
              onClick={() => setViewing(item)}
            >
              <Eye className="h-4 w-4" />
              View prediction details
            </button>
            <span className="ml-auto text-[11px] text-slate-400">post #{item.id}</span>
          </div>
        </article>
      ))}

      {/* Decision modal */}
      {deciding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-navy-950/60 backdrop-blur-sm"
            onClick={() => !busy && setDeciding(null)}
          />
          <div className="relative w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-navy-700 dark:bg-navy-900">
            <h3 className="text-lg font-semibold text-navy-950 dark:text-white">
              {deciding.action === 'approve' ? 'Approve' : 'Reject'} post #
              {deciding.item.id}
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              {deciding.action === 'approve'
                ? 'Approving makes this post publicly visible again.'
                : 'Rejecting keeps this post out of the public feed. The author is notified with your remarks.'}
            </p>
            {deciding.action === 'approve' && (
              <div className="mt-4">
                <label htmlFor="approve-risk" className="label">
                  Risk level after approval
                </label>
                <select
                  id="approve-risk"
                  className="input"
                  value={newRisk}
                  onChange={(event) => setNewRisk(event.target.value as '' | RiskLevel)}
                >
                  <option value="">
                    Keep the model's risk level ({deciding.item.risk_level})
                  </option>
                  <option value="low">Low risk - publish and allow sharing</option>
                  <option value="medium">
                    Medium risk - publish with warning and allow sharing
                  </option>
                  <option value="high">High risk - publish but block social sharing</option>
                </select>
                <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
                  Lowering the risk overrides the model's assessment. The original
                  prediction and confidence stay on record, and the change is written
                  to the audit log.
                </p>
              </div>
            )}
            <label htmlFor="remarks" className="label mt-4">
              Review remarks (required, visible to the author and other moderators)
            </label>
            <textarea
              id="remarks"
              className="input resize-none"
              rows={4}
              maxLength={1000}
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
              placeholder={
                deciding.action === 'approve'
                  ? 'e.g. Checked the sources referenced in the post; the claims are presented responsibly.'
                  : 'e.g. Unverified sensational claims about public health; rejected pending reliable sources.'
              }
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
                onClick={() => setDeciding(null)}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                className={deciding.action === 'approve' ? 'btn-primary' : 'btn-danger'}
                onClick={submitDecision}
                disabled={busy}
              >
                <MessageSquareText className="h-4 w-4" />
                {busy ? 'Submitting...' : `Confirm ${deciding.action}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Prediction details modal */}
      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-navy-950/60 backdrop-blur-sm"
            onClick={() => setViewing(null)}
          />
          <div className="relative max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-navy-700 dark:bg-navy-900">
            <div className="flex items-start justify-between gap-4">
              <h3 className="text-lg font-semibold text-navy-950 dark:text-white">
                Model evidence - post #{viewing.id}
              </h3>
              <button
                type="button"
                className="btn-secondary px-3 py-1.5 text-sm"
                onClick={() => setViewing(null)}
              >
                Close
              </button>
            </div>
            {viewing.prediction ? (
              <div className="mt-4 space-y-4">
                <p className="rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-slate-600 dark:bg-navy-900 dark:text-slate-300">
                  {viewing.content}
                </p>
                <div className="grid gap-2 rounded-lg border border-slate-200 p-3 text-sm dark:border-navy-700 sm:grid-cols-2">
                  <p className="text-slate-500 dark:text-slate-400">
                    Predicted label:{' '}
                    <span className="font-semibold text-navy-950 dark:text-white">
                      {viewing.prediction.predicted_label}
                    </span>
                  </p>
                  <p className="text-slate-500 dark:text-slate-400">
                    Risk level:{' '}
                    <span className="font-semibold text-navy-950 dark:text-white">
                      {viewing.prediction.risk_level}
                    </span>
                  </p>
                  <p className="text-slate-500 dark:text-slate-400">
                    Confidence:{' '}
                    <span className="font-semibold text-navy-950 dark:text-white">
                      {formatPercent(viewing.prediction.confidence)}
                    </span>
                  </p>
                  <p className="text-slate-500 dark:text-slate-400">
                    Model:{' '}
                    <span className="font-semibold text-navy-950 dark:text-white">
                      {viewing.prediction.model.name} ({viewing.prediction.model.version_tag})
                    </span>
                  </p>
                  <p className="text-slate-500 dark:text-slate-400">
                    Predicted at:{' '}
                    <span className="font-semibold text-navy-950 dark:text-white">
                      {formatDateTime(viewing.prediction.created_at)}
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                    Class probabilities
                  </p>
                  <div className="mt-2 space-y-2">
                    {Object.entries(viewing.prediction.probabilities).map(([label, prob]) => (
                      <div key={label} className="flex items-center gap-3 text-xs">
                        <span className="w-12 font-medium text-slate-500 dark:text-slate-400">
                          {label}
                        </span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-navy-800">
                          <div
                            className="h-full rounded-full bg-accent-500"
                            style={{ width: `${(prob * 100).toFixed(1)}%` }}
                          />
                        </div>
                        <span className="w-14 text-right font-semibold text-navy-950 dark:text-white">
                          {formatPercent(prob)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                  This prediction is a statistical signal produced by a machine
                  learning model, not a fact-check. Moderators make the final
                  decision and remain responsible for it.
                </p>
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-400">
                No prediction was recorded for this post.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
