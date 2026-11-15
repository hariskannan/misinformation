import { motion } from 'framer-motion';
import { CheckCircle2, AlertTriangle, ShieldAlert } from 'lucide-react';
import type { Prediction, PostStatus } from '../types';
import { POST_STATUS_LABELS, RISK_META } from '../utils/format';
import PredictionDetails from './PredictionDetails';
import RiskBadge from './RiskBadge';

/**
 * The card shown to a user right after a risk analysis or after publishing:
 * risk level, workflow outcome, prediction details and limitations.
 */
export default function RiskResultCard({
  prediction,
  postStatus,
  preview = false,
}: {
  prediction: Prediction;
  postStatus?: PostStatus;
  preview?: boolean;
}) {
  const meta = RISK_META[prediction.risk_level];
  const isHigh = prediction.risk_level === 'high';
  const isMedium = prediction.risk_level === 'medium';

  const Icon = isHigh ? ShieldAlert : isMedium ? AlertTriangle : CheckCircle2;

  const outcome = preview
    ? 'This is a pre-publish analysis. The prediction will be re-run by the server when you publish.'
    : isHigh
      ? 'This post was held from public visibility and forwarded to the moderation team. You will be notified once a moderator reviews it.'
      : isMedium
        ? postStatus === 'pending_review'
          ? 'This post was held for moderation according to the platform policy.'
          : 'The post was published, but please double-check the content and your sources.'
        : 'The post was published successfully.';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="card overflow-hidden"
    >
      <div
        className="flex flex-col gap-3 border-b border-slate-200 p-5 dark:border-navy-800"
        style={{ backgroundColor: `${meta.color}14` }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="rounded-full p-2.5"
              style={{ backgroundColor: `${meta.color}26`, color: meta.color }}
            >
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-50">
                {meta.label} detected
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {prediction.predicted_label_display}
              </p>
            </div>
          </div>
          <RiskBadge level={prediction.risk_level} />
        </div>
        <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          {meta.description}
        </p>
      </div>

      <div className="space-y-4 p-5">
        <div
          className={`rounded-lg border p-3 text-sm ${
            isHigh
              ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300'
              : isMedium
                ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300'
                : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
          }`}
        >
          {outcome}
          {postStatus && !preview && (
            <span className="ml-1 font-semibold">
              (status: {POST_STATUS_LABELS[postStatus]})
            </span>
          )}
        </div>
        <PredictionDetails prediction={prediction} />
      </div>
    </motion.div>
  );
}
