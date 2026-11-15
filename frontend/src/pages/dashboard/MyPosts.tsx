import { FileText, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { extractErrorMessage } from '../../api/client';
import { postsApi } from '../../api/posts';import ConfirmationModal from '../../components/ConfirmationModal';
import ErrorMessage from '../../components/ErrorMessage';
import LoadingSpinner from '../../components/LoadingSpinner';
import PageWrapper from '../../components/PageWrapper';
import PostCard from '../../components/PostCard';
import { useAuth } from '../../context/AuthContext';
import type { Post } from '../../types';
import { POST_STATUS_LABELS } from '../../utils/format';

const STATUS_TABS = [
  { key: '', label: 'All' },
  { key: 'published', label: 'Published' },
  { key: 'approved', label: 'Approved' },
  { key: 'pending_review', label: 'In review' },
  { key: 'rejected', label: 'Rejected' },
];

export default function MyPosts() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [toDelete, setToDelete] = useState<Post | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await postsApi.getMyPosts({
        page,
        status: status || undefined,
      });
      setPosts(data.results);
      setCount(data.count);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  useEffect(() => {
    void load();
  }, [load]);

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await postsApi.deletePost(toDelete.id);
      setPosts((current) => current.filter((item) => item.id !== toDelete.id));
      setCount((value) => Math.max(0, value - 1));
      setToDelete(null);
    } catch (err) {
      setError(err);
    } finally {
      setDeleting(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(count / 5));

  return (
    <PageWrapper>
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-bold text-navy-950 dark:text-white">My posts</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Everything you published, with its analysis outcome and moderation state.
        </p>

        <div className="mt-5 flex flex-wrap gap-1.5">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setPage(1);
                setStatus(tab.key);
              }}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                status === tab.key
                  ? 'bg-navy-900 text-white dark:bg-accent-500 dark:text-navy-950'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-navy-800 dark:text-slate-300 dark:hover:bg-navy-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mt-5 space-y-5">
          {loading && <LoadingSpinner label="Loading your posts..." />}
          {error ? <ErrorMessage error={error} onRetry={load} /> : null}
          {!loading && !error && posts.length === 0 && (
            <div className="card flex flex-col items-center gap-2 p-10 text-center text-slate-400">
              <FileText className="h-8 w-8" />
              <p className="text-sm">You have not posted anything here yet.</p>
            </div>
          )}
          {posts.map((post) => (
            <div key={post.id} className="space-y-1">
              <PostCard post={post} currentUser={user} showStatus onDelete={() => setToDelete(post)} />
              {post.status === 'pending_review' && (
                <p className="pl-2 text-xs text-amber-600 dark:text-amber-400">
                  Status: {POST_STATUS_LABELS[post.status]} - a moderator has not
                  decided yet.
                </p>
              )}
            </div>
          ))}
        </div>

        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-2">
            <button type="button" className="btn-secondary px-3 py-1.5 text-sm"
              disabled={page <= 1} onClick={() => setPage((v) => Math.max(1, v - 1))}>
              Previous
            </button>
            <span className="text-sm text-slate-500">Page {page} of {totalPages}</span>
            <button type="button" className="btn-secondary px-3 py-1.5 text-sm"
              disabled={page >= totalPages} onClick={() => setPage((v) => Math.min(totalPages, v + 1))}>
              Next
            </button>
          </div>
        )}
      </div>

      <ConfirmationModal
        open={toDelete !== null}
        title="Delete this post?"
        message={
          toDelete
            ? `This permanently removes "${toDelete.title || toDelete.content.slice(0, 60) + '...'}" along with its prediction record, likes and comments.`
            : ''
        }
        confirmLabel={deleting ? 'Deleting...' : 'Delete post'}
        danger
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </PageWrapper>
  );
}
