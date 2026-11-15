import { Cpu, Play, Timer, XCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { extractErrorMessage } from '../api/client';
import { modelsApi } from '../api/models';
import type {
  AlgorithmInfo,
  Dataset,
  MLModelVersion,
  TrainingJob,
} from '../types';
import { formatDuration, formatNumber, formatPercent } from '../utils/format';

/**
 * Real training panel: pick a validated dataset version and an algorithm,
 * start a background TrainingJob on the server, poll its status/log live,
 * and report the real evaluation metrics when it completes.
 */
export default function ModelTrainingPanel({
  datasets,
  onTrained,
}: {
  datasets: Dataset[];
  onTrained?: () => void;
}) {
  const [algorithms, setAlgorithms] = useState<AlgorithmInfo[]>([]);
  const [algorithm, setAlgorithm] = useState('');
  const [datasetVersionId, setDatasetVersionId] = useState<number | ''>('');
  const [params, setParams] = useState<Record<string, number>>({});
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [job, setJob] = useState<TrainingJob | null>(null);
  const [resultModel, setResultModel] = useState<MLModelVersion | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const validatedVersions = datasets.flatMap((dataset) =>
    dataset.versions
      .filter((version) => version.status === 'validated')
      .map((version) => ({
        id: version.id,
        label: `${dataset.name} - v${version.version_number} (${formatNumber(version.row_count)} rows)`,
      })),
  );

  useEffect(() => {
    modelsApi
      .algorithms()
      .then((data) => {
        setAlgorithms(data.results);
        if (data.results.length > 0 && !algorithm) {
          setAlgorithm(data.results[0].key);
          setParams(
            Object.fromEntries(
              Object.entries(data.results[0].params).map(
                ([key, schema]) => [key, schema.default],
              ),
            ),
          );
        }
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(
    () => () => {
      if (pollRef.current) clearInterval(pollRef.current);
    },
    [],
  );

  function selectAlgorithm(key: string) {
    setAlgorithm(key);
    const info = algorithms.find((item) => item.key === key);
    if (info) {
      setParams(
        Object.fromEntries(
          Object.entries(info.params).map(([pKey, schema]) => [pKey, schema.default]),
        ),
      );
    }
  }

  function poll(jobId: number) {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const status = await modelsApi.trainingStatus(jobId);
        setJob(status);
        if (status.status === 'completed') {
          if (pollRef.current) clearInterval(pollRef.current);
          setResultModel(status.model_version);
          onTrained?.();
        } else if (status.status === 'failed') {
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch {
        if (pollRef.current) clearInterval(pollRef.current);
      }
    }, 1500);
  }

  async function startTraining() {
    if (starting) return;
    if (!datasetVersionId) {
      setError('Select a validated dataset version to train on.');
      return;
    }
    setStarting(true);
    setError(null);
    setJob(null);
    setResultModel(null);
    try {
      const created = await modelsApi.train({
        dataset_version: Number(datasetVersionId),
        algorithm,
        params,
      });
      setJob(created);
      poll(created.id);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setStarting(false);
    }
  }

  const selectedInfo = algorithms.find((item) => item.key === algorithm);
  const running = job?.status === 'queued' || job?.status === 'running';

  return (
    <div className="card space-y-5 p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-navy-950 dark:text-white">
        <Play className="h-4 w-4 text-accent-500" />
        Train a new model version
      </h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="train-dataset" className="label">Dataset (validated versions only)</label>
          <select
            id="train-dataset"
            className="input"
            value={datasetVersionId}
            onChange={(event) =>
              setDatasetVersionId(event.target.value ? Number(event.target.value) : '')
            }
          >
            <option value="">Select a dataset version...</option>
            {validatedVersions.map((version) => (
              <option key={version.id} value={version.id}>{version.label}</option>
            ))}
          </select>
          {validatedVersions.length === 0 && (
            <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
              No validated dataset versions available - upload and validate one first.
            </p>
          )}
        </div>

        <div>
          <label htmlFor="train-algorithm" className="label">Algorithm</label>
          <select
            id="train-algorithm"
            className="input"
            value={algorithm}
            onChange={(event) => selectAlgorithm(event.target.value)}
          >
            {algorithms.map((item) => (
              <option key={item.key} value={item.key}>{item.label}</option>
            ))}
          </select>
          {selectedInfo && (
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              {selectedInfo.description}
            </p>
          )}
        </div>
      </div>

      {/* Hyperparameters */}
      {selectedInfo && Object.keys(selectedInfo.params).length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Hyperparameters
          </p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {Object.entries(selectedInfo.params).map(([key, schema]) => (
              <div key={key} className="text-sm">
                <label htmlFor={`param-${key}`} className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
                  <span className="font-mono">{key}</span>
                  <span className="text-accent-600 dark:text-accent-300">{params[key] ?? schema.default}</span>
                </label>
                <input
                  id={`param-${key}`}
                  type="range"
                  min={schema.min}
                  max={schema.max}
                  step={1}
                  value={params[key] ?? schema.default}
                  onChange={(event) =>
                    setParams((current) => ({
                      ...current,
                      [key]: Number(event.target.value),
                    }))
                  }
                  className="mt-1 w-full accent-cyan-500"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs leading-relaxed text-slate-400">
          Training runs server-side in a background job (80/20 train/test
          split, TF-IDF features). Metrics below come from the real held-out
          test set.
        </p>
        <button
          type="button"
          className="btn-primary shrink-0"
          onClick={startTraining}
          disabled={starting || running || !algorithm}
        >
          <Cpu className="h-4 w-4" />
          {starting || running ? 'Training in progress...' : 'Start training'}
        </button>
      </div>

      {/* Job status */}
      {job && (
        <div
          className={`rounded-xl border p-4 text-sm ${
            job.status === 'completed'
              ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10'
              : job.status === 'failed'
                ? 'border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10'
                : 'border-accent-500/30 bg-accent-500/5'
          }`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-navy-950 dark:text-white">
              {job.algorithm_display} training job #{job.id}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
                job.status === 'completed'
                  ? 'bg-emerald-500 text-white'
                  : job.status === 'failed'
                    ? 'bg-red-500 text-white'
                    : 'bg-accent-500 text-navy-950'
              }`}
            >
              {job.status}
            </span>
            {job.finished_at && (
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <Timer className="h-3.5 w-3.5" />
                {formatDuration(
                  (new Date(job.finished_at).getTime() -
                    new Date(job.created_at).getTime()) / 1000,
                )}
              </span>
            )}
          </div>
          {running && (
            <p className="mt-2 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="h-2 w-2 animate-pulse rounded-full bg-accent-500" />
              {job.log?.split('\n').filter(Boolean).slice(-1)[0] ?? 'Preparing...'}
            </p>
          )}
          {job.status === 'failed' && (
            <p className="mt-2 flex items-start gap-1.5 text-xs text-red-600 dark:text-red-300">
              <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {job.error_message || 'Training failed.'}
            </p>
          )}
        </div>
      )}

      {/* Result metrics */}
      {resultModel && resultModel.metrics && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/30 dark:bg-emerald-500/10">
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
            {resultModel.name} ({resultModel.version_tag}) trained successfully
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(
              [
                ['Accuracy', resultModel.metrics.accuracy],
                ['Precision', resultModel.metrics.precision],
                ['Recall', resultModel.metrics.recall],
                ['F1', resultModel.metrics.f1],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="rounded-lg bg-white/70 p-2.5 text-center dark:bg-navy-900/60">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  {label}
                </p>
                <p className="text-lg font-bold text-navy-950 dark:text-white">
                  {formatPercent(value)}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-emerald-600/80 dark:text-emerald-300/80">
            Computed on {formatNumber(resultModel.test_rows)} held-out test rows
            ({formatNumber(resultModel.train_rows)} training rows,{' '}
            {formatNumber(resultModel.feature_count)} TF-IDF features). The
            model is NOT active yet - activate it from the models table when
            you are satisfied with the comparison.
          </p>
        </div>
      )}
    </div>
  );
}
