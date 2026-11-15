import { Database, FileSearch, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { datasetsApi } from '../../api/datasets';
import { extractErrorMessage } from '../../api/client';
import ConfirmationModal from '../../components/ConfirmationModal';
import DatasetPreviewPanel from '../../components/DatasetPreview';
import DatasetUpload from '../../components/DatasetUpload';
import ErrorMessage from '../../components/ErrorMessage';
import LoadingSpinner from '../../components/LoadingSpinner';
import PageWrapper from '../../components/PageWrapper';
import type { Dataset, DatasetPreview } from '../../types';
import { formatDateTime, formatNumber } from '../../utils/format';

export default function AdminDatasets() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [selected, setSelected] = useState<Dataset | null>(null);
  const [preview, setPreview] = useState<DatasetPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Dataset | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await datasetsApi.list();
      setDatasets(data.results);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function openPreview(dataset: Dataset) {
    setSelected(dataset);
    setPreview(null);
    setPreviewError(null);
    setPreviewLoading(true);
    try {
      const data = await datasetsApi.preview(dataset.id);
      setPreview(data);
    } catch (err) {
      setPreviewError(extractErrorMessage(err));
    } finally {
      setPreviewLoading(false);
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await datasetsApi.remove(toDelete.id);
      setDatasets((current) => current.filter((item) => item.id !== toDelete.id));
      if (selected?.id === toDelete.id) {
        setSelected(null);
        setPreview(null);
      }
      setToDelete(null);
    } catch (err) {
      setPreviewError(extractErrorMessage(err));
      setToDelete(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <PageWrapper>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-navy-950 dark:text-white">
            Dataset management
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Upload raw datasets, review the server-side validation preview,
            map columns and labels, and produce clean versions ready for
            training.
          </p>
        </div>

        <DatasetUpload
          onUploaded={(dataset, uploadedPreview) => {
            void load();
            setSelected(dataset);
            setPreview(uploadedPreview);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />

        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-navy-950 dark:text-white">
            <Database className="h-4 w-4 text-accent-500" />
            Datasets ({datasets.length})
          </h2>

          <div className="mt-4 space-y-3">
            {loading && <LoadingSpinner label="Loading datasets..." />}
            {error ? <ErrorMessage error={error} onRetry={load} /> : null}
            {!loading && !error && datasets.length === 0 && (
              <div className="card p-10 text-center text-sm text-slate-400">
                No datasets yet - upload your first file above.
              </div>
            )}
            {datasets.map((dataset) => (
              <div key={dataset.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-navy-950 dark:text-white">
                      {dataset.name}
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-400">
                      Uploaded by @{dataset.uploaded_by_username} -{' '}
                      {formatDateTime(dataset.created_at)}
                      {dataset.latest_version &&
                        ` - latest v${dataset.latest_version.version_number} (${dataset.latest_version.status_display}, ${formatNumber(dataset.latest_version.row_count)} rows)`}
                    </p>
                    {dataset.description && (
                      <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                        {dataset.description}
                      </p>
                    )}
                    {dataset.latest_version?.label_mapping &&
                      Object.keys(dataset.latest_version.label_mapping).length > 0 && (
                        <p className="mt-1 text-[11px] text-slate-400">
                          Label mapping:{' '}
                          {Object.entries(dataset.latest_version.label_mapping)
                            .map(([from, to]) => `${from} -> ${to}`)
                            .join(', ')}
                        </p>
                      )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="btn-secondary px-3 py-1.5 text-xs"
                      onClick={() => void openPreview(dataset)}
                    >
                      <FileSearch className="h-3.5 w-3.5" />
                      {selected?.id === dataset.id ? 'Refresh preview' : 'Preview & validate'}
                    </button>
                    <button
                      type="button"
                      className="btn-danger px-3 py-1.5 text-xs"
                      onClick={() => setToDelete(dataset)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </div>
                </div>

                {dataset.versions.length > 1 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {dataset.versions.map((version) => (
                      <span
                        key={version.id}
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          version.status === 'validated'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                            : 'bg-slate-100 text-slate-600 dark:bg-navy-800 dark:text-slate-300'
                        }`}
                      >
                        v{version.version_number}: {version.status_display} -{' '}
                        {formatNumber(version.row_count)} rows
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Preview & validation for the selected dataset */}
        {selected && (
          <div>
            <h2 className="text-sm font-semibold text-navy-950 dark:text-white">
              Preview - {selected.name}
            </h2>
            <div className="mt-4">
              {previewLoading && <LoadingSpinner label="Loading preview..." />}
              {previewError ? (
                <ErrorMessage
                  error={previewError}
                  onRetry={() => void openPreview(selected)}
                />
              ) : null}
              {preview && (
                <DatasetPreviewPanel
                  datasetId={selected.id}
                  preview={preview}
                  onValidated={() => void load()}
                />
              )}
            </div>
          </div>
        )}

        <p className="text-xs leading-relaxed text-slate-400">
          For real-world evaluation, use legally obtained research datasets such
          as ISOT Fake News, LIAR or FakeNewsNet and record their citation and
          license above. The bundled synthetic sample dataset is clearly
          labelled as synthetic and demonstrates the pipeline only.
        </p>
      </div>

      <ConfirmationModal
        open={toDelete !== null}
        title="Delete dataset?"
        message={
          toDelete
            ? `This permanently deletes "${toDelete.name}" with all its versions and stored files. Trained models keep their recorded metrics but cannot be retrained from this dataset afterwards.`
            : ''
        }
        confirmLabel={deleting ? 'Deleting...' : 'Delete dataset'}
        danger
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </PageWrapper>
  );
}
