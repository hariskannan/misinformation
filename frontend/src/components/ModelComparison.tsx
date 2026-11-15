import { Radar, Table2 } from 'lucide-react';
import type { MLModelVersion } from '../types';
import { formatNumber, formatPercent } from '../utils/format';

/**
 * Side-by-side comparison of trained model versions using their real
 * held-out test metrics, plus the confusion matrix of each model.
 */
export default function ModelComparison({ models }: { models: MLModelVersion[] }) {
  if (models.length === 0) {
    return (
      <div className="card p-10 text-center text-sm text-slate-400">
        No trained models to compare yet.
      </div>
    );
  }

  const sorted = [...models].sort((a, b) => (b.metrics?.f1 ?? 0) - (a.metrics?.f1 ?? 0));

  return (
    <div className="card space-y-6 p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-navy-950 dark:text-white">
        <Radar className="h-4 w-4 text-accent-500" />
        Model comparison (real held-out test metrics)
      </h2>

      {/* Metrics table */}
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-navy-800">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-navy-900">
            <tr>
              <th className="px-3 py-2.5 font-semibold">Model</th>
              <th className="px-3 py-2.5 font-semibold">Status</th>
              <th className="px-3 py-2.5 font-semibold">Dataset</th>
              <th className="px-3 py-2.5 font-semibold">Accuracy</th>
              <th className="px-3 py-2.5 font-semibold">Precision</th>
              <th className="px-3 py-2.5 font-semibold">Recall</th>
              <th className="px-3 py-2.5 font-semibold">F1</th>
              <th className="px-3 py-2.5 font-semibold">Test rows</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
            {sorted.map((model) => (
              <tr key={model.id} className="bg-white dark:bg-navy-900/40">
                <td className="px-3 py-2.5">
                  <p className="font-semibold text-navy-950 dark:text-white">
                    {model.algorithm_display}
                  </p>
                  <p className="text-xs text-slate-400">{model.version_tag}</p>
                </td>
                <td className="px-3 py-2.5">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${
                      model.status === 'active'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                        : model.status === 'trained'
                          ? 'bg-accent-100 text-accent-700 dark:bg-accent-500/15 dark:text-accent-300'
                          : 'bg-slate-100 text-slate-500 dark:bg-navy-800 dark:text-slate-400'
                    }`}
                  >
                    {model.status}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-xs text-slate-500 dark:text-slate-400">
                  v{model.dataset?.version_number ?? '-'} ({formatNumber(model.dataset?.row_count ?? 0)} rows)
                </td>
                <td className="px-3 py-2.5 font-mono text-xs">{formatPercent(model.metrics?.accuracy)}</td>
                <td className="px-3 py-2.5 font-mono text-xs">{formatPercent(model.metrics?.precision)}</td>
                <td className="px-3 py-2.5 font-mono text-xs">{formatPercent(model.metrics?.recall)}</td>
                <td className="px-3 py-2.5 font-mono text-xs font-semibold">{formatPercent(model.metrics?.f1)}</td>
                <td className="px-3 py-2.5 font-mono text-xs">{formatNumber(model.test_rows)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Confusion matrices */}
      <div>
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          <Table2 className="h-3.5 w-3.5" />
          Confusion matrices (rows = true label, columns = predicted)
        </h3>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          {sorted.map((model) => {
            const matrix = model.metrics?.confusion_matrix;
            return (
              <div
                key={model.id}
                className="rounded-xl border border-slate-200 p-4 dark:border-navy-700"
              >
                <p className="text-sm font-semibold text-navy-950 dark:text-white">
                  {model.algorithm_display} {model.version_tag}
                </p>
                {matrix ? (
                  <table className="mt-2 w-full text-center text-xs">
                    <thead>
                      <tr className="text-slate-400">
                        <th />
                        {matrix.labels.map((label) => (
                          <th key={label} className="px-2 py-1 font-semibold">
                            pred. {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {matrix.matrix.map((row, rowIndex) => (
                        <tr key={rowIndex} className="border-t border-slate-100 dark:border-navy-800">
                          <td className="px-2 py-1 font-semibold text-slate-400">
                            true {matrix.labels[rowIndex]}
                          </td>
                          {row.map((cell, cellIndex) => (
                            <td
                              key={cellIndex}
                              className={`px-2 py-1 font-mono ${
                                rowIndex === cellIndex
                                  ? 'font-bold text-emerald-600 dark:text-emerald-400'
                                  : 'text-red-600 dark:text-red-400'
                              }`}
                            >
                              {formatNumber(cell)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="mt-2 text-xs text-slate-400">
                    Metrics not available.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
