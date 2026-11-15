import { Image as ImageIcon, ScanSearch, Sparkles, Upload, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { postsApi } from '../api/posts';
import { predictionsApi } from '../api/predictions';
import { extractErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { Post, Prediction } from '../types';
import { CATEGORY_LABELS } from '../utils/format';
import RiskResultCard from './RiskResultCard';

/**
 * The post creation module. Publishing never happens before the backend
 * risk-prediction workflow has completed (the POST /api/posts/ endpoint
 * runs the model and applies the moderation policy server-side).
 */
export default function CreatePost({ onPublished }: { onPublished?: (post: Post) => void }) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('news');
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewResult, setPreviewResult] = useState<Prediction | null>(null);
  const [publishedPost, setPublishedPost] = useState<Post | null>(null);

  const contentLength = content.trim().length;
  const canSubmit = contentLength >= 15 && !publishing;

  function pickImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be smaller than 5 MB.');
      return;
    }
    setError(null);
    setImage(file);
    setImagePreview(URL.createObjectURL(file));
  }

  function clearImage() {
    setImage(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function analyze() {
    if (contentLength < 15) {
      setError('Write at least 15 characters of content before analyzing.');
      return;
    }
    setAnalyzing(true);
    setError(null);
    setPreviewResult(null);
    try {
      const prediction = await predictionsApi.analyze(content.trim());
      setPreviewResult(prediction);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setAnalyzing(false);
    }
  }

  async function publish() {
    if (!canSubmit) return;
    setPublishing(true);
    setError(null);
    setPreviewResult(null);
    setPublishedPost(null);
    try {
      const form = new FormData();
      form.append('content', content.trim());
      form.append('category', category);
      if (title.trim()) form.append('title', title.trim());
      if (image) form.append('image', image);
      const post = await postsApi.createPost(form);
      setPublishedPost(post);
      setTitle('');
      setContent('');
      setCategory('news');
      clearImage();
      onPublished?.(post);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setPublishing(false);
    }
  }

  if (!user) return null;

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Sparkles className="h-4 w-4 text-accent-500" />
          Create a post
        </h2>
        <span className="text-xs text-slate-400">
          Every post is analyzed by the active ML model before publishing
        </span>
      </div>

      <div className="mt-4 space-y-3">
        <input
          className="input"
          placeholder="Title (optional)"
          maxLength={200}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <textarea
          className="input resize-none"
          placeholder={`What's on your mind, ${user.profile.full_name?.split(' ')[0] || user.username}?`}
          rows={4}
          maxLength={10000}
          value={content}
          onChange={(event) => setContent(event.target.value)}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <select
              className="input w-auto py-1.5 text-sm"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              aria-label="Category"
            >
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={pickImage}
            />
            <button
              type="button"
              className="btn-ghost px-2.5 py-1.5 text-sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <ImageIcon className="h-4 w-4" />
              Image
            </button>
            {image && (
              <button
                type="button"
                className="btn-ghost px-2 py-1.5 text-xs text-slate-500"
                onClick={clearImage}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <span
            className={`text-xs ${
              contentLength > 0 && contentLength < 15
                ? 'text-amber-500'
                : 'text-slate-400'
            }`}
          >
            {contentLength} / 10000 characters
            {contentLength > 0 && contentLength < 15 && ' (minimum 15)'}
          </span>
        </div>

        {imagePreview && (
          <div className="relative">
            <img
              src={imagePreview}
              alt="Selected upload preview"
              className="max-h-64 w-full rounded-lg border border-slate-200 object-cover dark:border-navy-700"
            />
            <button
              type="button"
              onClick={clearImage}
              className="absolute right-2 top-2 rounded-full bg-navy-950/70 p-1.5 text-white hover:bg-navy-950"
              aria-label="Remove image"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            className="btn-secondary"
            onClick={analyze}
            disabled={analyzing || publishing || contentLength < 15}
          >
            <ScanSearch className={`h-4 w-4 ${analyzing ? 'animate-pulse' : ''}`} />
            {analyzing ? 'Analyzing...' : 'Analyze before publishing'}
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={publish}
            disabled={!canSubmit || analyzing}
          >
            <Upload className="h-4 w-4" />
            {publishing ? 'Analyzing & publishing...' : 'Publish'}
          </button>
        </div>
      </div>

      {previewResult && !publishedPost && (
        <div className="mt-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Pre-publish analysis result
          </p>
          <RiskResultCard prediction={previewResult} preview />
        </div>
      )}

      {publishedPost && publishedPost.prediction && (
        <div className="mt-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Prediction result
          </p>
          <RiskResultCard
            prediction={publishedPost.prediction}
            postStatus={publishedPost.status}
          />
        </div>
      )}
    </div>
  );
}
