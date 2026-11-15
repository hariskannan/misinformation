import { CheckCircle2, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { datasetsApi, type DatasetValidationStats } from '../api/datasets';
import { extractErrorMessage } from '../api/client';
import type { DatasetPreview } from '../types';
import { formatNumber } from '../utils/format';

/**
 * Validation panel: shows the server-side preview (columns, label values,
 * duplicates, missing data) and lets the admin map columns/labels and run
 * the real validate-and-clean pipeline.
 */
export default function DatasetPreviewPanel({
  datasetId,
  preview,
  onValidated,
}: {
  datasetId: number;
  preview: DatasetPreview;
  onValidated?: (stats: DatasetValidationStats) => void;
}) {
  const [textColumn, setTextColumn] = useState(preview.text_column || '');
  const [labelColumn, setLabelColumn] = useState(preview.label_column || '');
  const [labelMapping, setLabelMapping] = useState<Record<string, string>>(
    Object.keys(preview.label_mapping ?? {}).length
      ? preview.label_mapping
      : Object.fromEntries(
          (preview.label_values ?? []).map((entry) => [entry.value, entry.value]),
        ),
  );
  const [dropMissing, setDropMissing] = useState(true);
  const [dropDuplicates, setDropDuplicates] = useState(true);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<DatasetValidationStats | null>(null);

  const columnNames = preview.columns.map((column) => column.name);

  async function validate() {
    if (validating) return;
    if (!textColumn || !labelColumn) {
      setError('Select both the text column and the label column.');
      return;
    }
    setValidating(true);
    setError(null);
    try {
      const result = await datasetsApi.validate(datasetId, {
        text_column: textColumn,
        label_column: labelColumn,
        label_mapping: labelMapping,
        drop_missing: dropMissing,
        drop_duplicates: dropDuplicates,
      });
      setStats(result.stats);
      onValidated?.(result.stats);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setValidating(false);
    }
  }

  return (
    <div className="card space-y-5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-navy-950 dark:text-white">
            Dataset preview - version {preview.version_number}
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">
            {preview.original_filename} - {formatNumber(preview.row_count)} rows -{' '}
            {formatNumber(preview.duplicate_rows)} duplicate rows detected
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
            preview.status === 'validated'
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
              : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
          }`}
        >
          {preview.status === 'validated' ? 'Validated' : 'Raw - needs validation'}
        </span>
      </div>

      {/* Columns */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Columns
        </h3>
        <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200 dark:border-navy-800">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 dark:bg-navy-900">
              <tr>
                <th className="px-3 py-2 font-semibold">Column</th>
                <th className="px-3 py-2 font-semibold">Type</th>
                <th className="px-3 py-2 font-semibold">Non-null</th>
                <th className="px-3 py-2 font-semibold">Missing</th>
                <th className="px-3 py-2 font-semibold">Unique</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
              {preview.columns.map((column) => (
                <tr key={column.name} className="bg-white dark:bg-navy-900/40">
                  <td className="px-3 py-2 font-medium text-navy-950 dark:text-white">
                    {column.name}
                  </td>
                  <td className="px-3 py-2 text-slate-500">{column.dtype}</td>
                  <td className="px-3 py-2 text-slate-500">{formatNumber(column.non_null)}</td>
                  <td className={`px-3 py-2 ${column.missing > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500'}`}>
                    {formatNumber(column.missing)}
                  </td>
                  <td className="px-3 py-2 text-slate-500">{formatNumber(column.unique_values)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sample rows */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Sample rows (first 5)
        </h3>
        <div className="mt-2 space-y-1.5">
          {preview.sample_rows.slice(0, 5).map((row, index) => (
            <div
              key={index}
              className="rounded-lg bg-slate-50 p-2.5 text-xs dark:bg-navy-900"
            >
              {Object.entries(row)
                .slice(0, 4)
                .map(([key, value]) => (
                  <p key={key} className="truncate">
                    <span className="font-semibold text-slate-500 dark:text-slate-400">
                      {key}:
                    </span>{' '}
                    <span className="text-slate-600 dark:text-slate-300">
                      {String(value ?? '').slice(0, 140) || '(empty)'}
                    </span>
                  </p>
                ))}
            </div>
          ))}
        </div>
      </div>

      {/* Mapping configuration */}
      <div className="rounded-xl border border-slate-200 p-4 dark:border-navy-700">
        <h3 className="text-sm font-semibold text-navy-950 dark:text-white">
          Column and label mapping
        </h3>
        <p className="mt-1 text-xs text-slate-400">
          Choose which column holds the text and which holds the label, then
          map each original label value to the platform's classes.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="text-column" className="label">Text column</label>
            <select
              id="text-column"
              className="input"
              value={textColumn}
              onChange={(event) => setTextColumn(event.target.value)}
            >
              <option value="">Select...</option>
              {columnNames.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="label-column" className="label">Label column</label>
            <select
              id="label-column"
              className="input"
              value={labelColumn}
              onChange={(event) => setLabelColumn(event.target.value)}
            >
              <option value="">Select...</option>
              {columnNames.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
        </div>

        {(preview.label_values ?? []).length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Label values found in this column
            </p>
            <div className="mt-2 space-y-2">
              {preview.label_values!.map((entry) => (
                <div key={entry.value} className="flex items-center gap-3 text-sm">
                  <span className="w-40 truncate font-mono text-xs text-slate-500 dark:text-slate-400">
                    {entry.value || '(empty)'} ({entry.count})
                  </span>
                  <span className="text-slate-300">-&gt;</span>
                  <select
                    className="input w-auto flex-1 py-1.5 text-sm"
                    value={labelMapping[entry.value] ?? ''}
                    onChange={(event) =>
                      setLabelMapping((current) => ({
                        ...current,
                        [entry.value]: event.target.value,
                      }))
                    }
                    aria-label={`Map label ${entry.value}`}
                  >
                    <option value="">(drop these rows)</option>
                    <option value="real">real</option>
                    <option value="fake">fake</option>
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-accent-500"
              checked={dropMissing}
              onChange={(event) => setDropMissing(event.target.checked)}
            />
            Drop rows with missing text or label
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-accent-500"
              checked={dropDuplicates}
              onChange={(event) => setDropDuplicates(event.target.checked)}
            />
            Drop duplicate rows
          </label>
        </div>

        {error && (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </p>
        )}

        <button
          type="button"
          className="btn-primary mt-4"
          onClick={validate}
          disabled={validating}
        >
          {validating ? 'Validating & cleaning...' : 'Validate & clean dataset'}
        </button>
      </div>

      {/* Validation result */}
      {stats && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/30 dark:bg-emerald-500/10">
          <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4" />
            Validation complete - {formatNumber(stats.rows_after)} of{' '}
            {formatNumber(stats.rows_before)} rows are usable for training
          </p>
          <ul className="mt-2 grid gap-1 text-xs text-emerald-600/90 dark:text-emerald-300/90 sm:grid-cols-2">
            <li>Dropped for missing values: {formatNumber(stats.missing_dropped)}</li>
            <li>Dropped for empty text: {formatNumber(stats.empty_text_dropped)}</li>
            <li>Duplicates removed: {formatNumber(stats.duplicates_removed)}</li>
            <li>Unmapped labels dropped: {formatNumber(stats.unmapped_labels_dropped)}</li>
            <li>Average text length: {stats.avg_text_length.toFixed(0)} chars</li>
            <li>
              Class distribution:{' '}
              {Object.entries(stats.class_distribution)
                .map(([label, count]) => `${label}: ${count}`)
                .join(', ')}
            </li>
          </ul>
          {stats.unmapped_label_values.length > 0 && (
            <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-300">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Unmapped label values dropped: {stats.unmapped_label_values.join(', ')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
