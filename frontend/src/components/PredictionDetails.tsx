import { Info } from 'lucide-react';
import type { Prediction } from '../types';
import { formatDateTime, formatPercent } from '../utils/format';

/**
 * Detailed technical view of a single prediction: model, version,
 * timestamp, probabilities and the mandatory limitations notice.
 */
export default function PredictionDetails({ prediction }: { prediction: Prediction }) {
  const entries = Object.entries(prediction.probabilities || {}).sort((a, b) =>
    a[0] === prediction.predicted_label ? -1 : b[0] === prediction.predicted_label ? 1 : 0,
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <div>
          <span className="text-slate-500 dark:text-slate-400">Model</span>
          <p className="font-medium text-slate-900 dark:text-slate-100">
            {prediction.model.name}
          </p>
        </div>
        <div>
          <span className="text-slate-500 dark:text-slate-400">Algorithm</span>
          <p className="font-medium text-slate-900 dark:text-slate-100">
            {prediction.model.algorithm_display ?? prediction.model.algorithm}
          </p>
        </div>
        <div>
          <span className="text-slate-500 dark:text-slate-400">Model version</span>
          <p className="font-medium text-slate-900 dark:text-slate-100">
            {prediction.model.version_tag}
          </p>
        </div>
        <div>
          <span className="text-slate-500 dark:text-slate-400">Prediction timestamp</span>
          <p className="font-medium text-slate-900 dark:text-slate-100">
            {formatDateTime(prediction.created_at)}
          </p>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-slate-500 dark:text-slate-400">
            Confidence of prediction
          </span>
          <span className="font-semibold text-slate-900 dark:text-slate-100">
            {formatPercent(prediction.confidence)}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-navy-800">
          <div
            className="h-full rounded-full bg-accent-500 transition-all"
            style={{ width: `${Math.round(prediction.confidence * 100)}%` }}
          />
        </div>
      </div>

      {entries.length > 0 && (
        <div>
          <p className="mb-2 text-sm text-slate-500 dark:text-slate-400">
            Class probabilities
          </p>
          <div className="space-y-2">
            {entries.map(([label, probability]) => (
              <div key={label} className="flex items-center gap-3 text-sm">
                <span className="w-40 shrink-0 text-slate-600 dark:text-slate-300">
                  {label === 'fake' ? 'Potential misinformation' : 'Likely reliable'}
                </span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-navy-800">
                  <div
                    className={`h-full rounded-full ${
                      label === 'fake' ? 'bg-red-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.round(probability * 100)}%` }}
                  />
                </div>
                <span className="w-12 text-right font-mono text-xs text-slate-500 dark:text-slate-400">
                  {(probability * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-600 dark:border-navy-700 dark:bg-navy-950/50 dark:text-slate-400">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent-600" />
        <p>{prediction.limitations}</p>
      </div>
    </div>
  );
}
