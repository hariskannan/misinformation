import { Send } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { postsApi } from '../api/posts';
import { extractErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { CommentItem } from '../types';
import { avatarColor, initials, timeAgo } from '../utils/format';

export default function CommentSection({
  postId,
  onCountChange,
}: {
  postId: number;
  onCountChange?: (count: number) => void;
}) {
  const { user } = useAuth();
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadComments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await postsApi.getComments(postId);
      setComments(data.results);
      onCountChange?.(data.count);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  useEffect(() => {
    void loadComments();
  }, [loadComments]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const comment = await postsApi.addComment(postId, content);
      setComments((current) => {
        const next = [...current, comment];
        onCountChange?.(next.length);
        return next;
      });
      setDraft('');
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <p className="py-3 text-sm text-slate-500">Loading comments...</p>;
  }

  return (
    <div className="mt-3 border-t border-slate-200 pt-3 dark:border-navy-800">
      <div className="space-y-3">
        {comments.length === 0 && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No comments yet. Be the first to reply.
          </p>
        )}
        {comments.map((comment) => (
          <div key={comment.id} className="flex gap-3">
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${avatarColor(
                comment.author.username,
              )}`}
            >
              {initials(comment.author.full_name || comment.author.username)}
            </div>
            <div className="min-w-0 flex-1 rounded-lg bg-slate-100 px-3 py-2 dark:bg-navy-800/70">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                {comment.author.full_name || comment.author.username}
                <span className="ml-2 font-normal text-slate-400">
                  {timeAgo(comment.created_at)}
                </span>
              </p>
              <p className="mt-0.5 break-words text-sm text-slate-700 dark:text-slate-300">
                {comment.content}
              </p>
            </div>
          </div>
        ))}
      </div>

      {user && (
        <form onSubmit={submit} className="mt-3 flex items-start gap-2">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Write a comment..."
            rows={1}
            maxLength={2000}
            className="input flex-1 resize-none"
          />
          <button
            type="submit"
            className="btn-primary h-9 px-3"
            disabled={submitting || !draft.trim()}
            aria-label="Send comment"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      )}
      {error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
