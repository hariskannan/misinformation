import { FileUp, Info, UploadCloud } from 'lucide-react';
import { useRef, useState } from 'react';
import { extractErrorMessage } from '../api/client';
import { datasetsApi } from '../api/datasets';
import type { Dataset, DatasetPreview } from '../types';

/**
 * Real dataset upload: POST multipart to /api/datasets/upload/ with the
 * file plus metadata, then show the server's validation preview so the
 * admin can map columns/labels before validating.
 */
export default function DatasetUpload({
  onUploaded,
}: {
  onUploaded?: (dataset: Dataset, preview: DatasetPreview) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [licenseNotes, setLicenseNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function pick(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setError(null);
    if (!name.trim()) {
      setName(selected.name.replace(/\.(csv|json)$/i, ''));
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!file || uploading) return;
    if (!name.trim()) {
      setError('Give the dataset a name.');
      return;
    }
    setUploading(true);
    setError(null);
    setSuccess(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('name', name.trim());
      form.append('description', description.trim());
      form.append('source_url', sourceUrl.trim());
      form.append('license_notes', licenseNotes.trim());
      const result = await datasetsApi.upload(form);
      setSuccess(
        `Uploaded "${file.name}" as version 1 - ${result.preview.row_count} rows and ` +
          `${result.preview.column_count} columns detected. Review the mapping below and validate.`,
      );
      onUploaded?.(result.dataset, result.preview);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-navy-950 dark:text-white">
        <UploadCloud className="h-4 w-4 text-accent-500" />
        Upload a new dataset (CSV or JSON)
      </h2>

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 p-8 text-slate-400 transition-colors hover:border-accent-500 hover:text-accent-500 dark:border-navy-700"
      >
        <FileUp className="h-8 w-8" />
        {file ? (
          <>
            <span className="text-sm font-semibold text-navy-950 dark:text-white">
              {file.name}
            </span>
            <span className="text-xs">
              {(file.size / 1024).toFixed(1)} KB - click to change
            </span>
          </>
        ) : (
          <>
            <span className="text-sm font-semibold">Click to select a file</span>
            <span className="text-xs">CSV or JSON, must contain text and label columns</span>
          </>
        )}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.json"
        className="hidden"
        onChange={pick}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="ds-name" className="label">Dataset name</label>
          <input id="ds-name" className="input" required maxLength={120}
            value={name} onChange={(e) => setName(e.target.value)}
            placeholder="e.g. ISOT Fake News Dataset" />
        </div>
        <div>
          <label htmlFor="ds-source" className="label">
            Source URL <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <input id="ds-source" className="input" type="url"
            value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://..." />
        </div>
      </div>

      <div>
        <label htmlFor="ds-desc" className="label">Description</label>
        <textarea id="ds-desc" className="input resize-none" rows={2} maxLength={2000}
          value={description} onChange={(e) => setDescription(e.target.value)}
          placeholder="What does this dataset contain? Where does it come from?" />
      </div>

      <div>
        <label htmlFor="ds-license" className="label">
          License / usage notes <span className="font-normal text-slate-400">(recommended)</span>
        </label>
        <textarea id="ds-license" className="input resize-none" rows={2} maxLength={2000}
          value={licenseNotes} onChange={(e) => setLicenseNotes(e.target.value)}
          placeholder="e.g. ISOT dataset - for research use; cite Ahmed et al. 2017. Do not redistribute." />
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
          {success}
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-400">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Uploaded files are stored server-side; each upload creates a new
          dataset with version 1 in "raw" state until validated.
        </p>
        <button type="submit" className="btn-primary shrink-0" disabled={!file || uploading}>
          <UploadCloud className="h-4 w-4" />
          {uploading ? 'Uploading...' : 'Upload'}
        </button>
      </div>
    </form>
  );
}
