import { Brain, Power, PowerOff, Zap } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { datasetsApi } from '../../api/datasets';
import { extractErrorMessage } from '../../api/client';
import { modelsApi } from '../../api/models';
import ConfirmationModal from '../../components/ConfirmationModal';
import ErrorMessage from '../../components/ErrorMessage';
import LoadingSpinner from '../../components/LoadingSpinner';
import ModelComparison from '../../components/ModelComparison';
import ModelTrainingPanel from '../../components/ModelTrainingPanel';
import PageWrapper from '../../components/PageWrapper';
import type { Dataset, MLModelVersion } from '../../types';
import { formatDateTime, formatDuration, formatNumber } from '../../utils/format';

export default function AdminModels() {
  const [models, setModels] = useState<MLModelVersion[]>([]);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [toActivate, setToActivate] = useState<MLModelVersion | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [algorithmFilter, setAlgorithmFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [modelsData, datasetsData] = await Promise.all([
        modelsApi.list({ algorithm: algorithmFilter || undefined }),
        datasetsApi.list({ page: 1 }),
      ]);
      setModels(modelsData.results);
      setDatasets(datasetsData.results);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [algorithmFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function confirmActivate() {
    if (!toActivate) return;
    setBusy(true);
    setActionError(null);
    try {
      await modelsApi.activate(toActivate.id);
      setToActivate(null);
      void load();
    } catch (err) {
      setActionError(extractErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function deactivate(model: MLModelVersion) {
    setBusy(true);
    setActionError(null);
    try {
      await modelsApi.deactivate(model.id);
      void load();
    } catch (err) {
      setActionError(extractErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const activeModel = models.find((model) => model.status === 'active');
  const algorithms = [...new Set(models.map((model) => model.algorithm))];

  return (
    <PageWrapper>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-navy-950 dark:text-white">
            Models & training
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Train scikit-learn models on validated dataset versions, compare
            their real test metrics, and control which version makes live
            predictions.
          </p>
        </div>

        {activeModel && (
          <div className="card flex flex-wrap items-center justify-between gap-3 border-emerald-300/60 p-5 dark:border-emerald-500/30">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-300">
                Active model - used for every live prediction
              </p>
              <p className="mt-1 text-lg font-bold text-navy-950 dark:text-white">
                {activeModel.name}{' '}
                <span className="text-sm font-medium text-slate-400">
                  ({activeModel.version_tag}, trained{' '}
                  {formatDateTime(activeModel.trained_at)})
                </span>
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {activeModel.metrics
                  ? `Real test metrics - accuracy ${(activeModel.metrics.accuracy * 100).toFixed(1)}%, F1 ${activeModel.metrics.f1.toFixed(3)} on ${formatNumber(activeModel.test_rows)} held-out rows.`
                  : 'No metrics recorded.'}
              </p>
            </div>
            <button
              type="button"
              className="btn-secondary px-3 py-1.5 text-sm"
              onClick={() => void deactivate(activeModel)}
              disabled={busy}
            >
              <PowerOff className="h-4 w-4" />
              Deactivate
            </button>
          </div>
        )}

        {!activeModel && (
          <div className="card border-amber-300/60 p-4 text-sm text-amber-700 dark:border-amber-500/30 dark:text-amber-300">
            No active model - users cannot publish posts until you train and
            activate one.
          </div>
        )}

        <ModelTrainingPanel datasets={datasets} onTrained={load} />

        {/* Models table */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-navy-950 dark:text-white">
              <Brain className="h-4 w-4 text-accent-500" />
              Trained model versions ({models.length})
            </h2>
            <select
              className="input w-auto py-1.5 text-sm"
              value={algorithmFilter}
              onChange={(event) => setAlgorithmFilter(event.target.value)}
              aria-label="Filter models by algorithm"
            >
              <option value="">All algorithms</option>
              {algorithms.map((algorithm) => (
                <option key={algorithm} value={algorithm}>
                  {algorithm.replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4 space-y-3">
            {loading && <LoadingSpinner label="Loading models..." />}
            {error ? <ErrorMessage error={error} onRetry={load} /> : null}
            {!loading && !error && models.length === 0 && (
              <div className="card p-10 text-center text-sm text-slate-400">
                No model versions yet - train your first model above.
              </div>
            )}
            {models.map((model) => (
              <div key={model.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-navy-950 dark:text-white">
                        {model.name}
                      </h3>
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
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      {model.algorithm_display} - dataset v{model.dataset?.version_number ?? '-'} -{' '}
                      trained by @{model.trained_by_username} on{' '}
                      {formatDateTime(model.trained_at)} -{' '}
                      {formatDuration(model.training_duration_seconds)}
                    </p>
                    {model.metrics && (
                      <div className="mt-2 flex flex-wrap gap-3 text-xs font-mono text-slate-500 dark:text-slate-400">
                        <span>accuracy {(model.metrics.accuracy * 100).toFixed(1)}%</span>
                        <span>precision {(model.metrics.precision * 100).toFixed(1)}%</span>
                        <span>recall {(model.metrics.recall * 100).toFixed(1)}%</span>
                        <span className="font-semibold text-navy-950 dark:text-white">
                          f1 {model.metrics.f1.toFixed(3)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {model.status !== 'active' && (
                      <button
                        type="button"
                        className="btn-primary px-3 py-1.5 text-xs"
                        onClick={() => setToActivate(model)}
                        disabled={busy}
                      >
                        <Zap className="h-3.5 w-3.5" />
                        Activate
                      </button>
                    )}
                    {model.status === 'active' && (
                      <button
                        type="button"
                        className="btn-secondary px-3 py-1.5 text-xs"
                        onClick={() => void deactivate(model)}
                        disabled={busy}
                      >
                        <Power className="h-3.5 w-3.5" />
                        Deactivate
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Comparison */}
        <ModelComparison models={models} />

        {actionError && (
          <ErrorMessage error={actionError} onRetry={() => setActionError(null)} />
        )}

        <p className="text-xs leading-relaxed text-slate-400">
          All metrics shown are computed from real training runs on held-out
          test splits. Models trained on the synthetic sample dataset are
          demonstration artifacts - their scores do not represent real-world
          detection performance.
        </p>
      </div>

      <ConfirmationModal
        open={toActivate !== null}
        title="Activate this model?"
        message={
          toActivate
            ? `"${toActivate.name}" (${toActivate.version_tag}) will immediately become the model behind every new post analysis. The currently active model, if any, will be deactivated.`
            : ''
        }
        confirmLabel={busy ? 'Activating...' : 'Activate model'}
        danger={false}
        busy={busy}
        onConfirm={confirmActivate}
        onCancel={() => setToActivate(null)}
      />
    </PageWrapper>
  );
}
