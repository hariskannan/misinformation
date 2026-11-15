import { motion } from 'framer-motion';
import { Flag, Heart, MessageCircle, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { extractErrorMessage, mediaUrl } from '../api/client';
import { postsApi } from '../api/posts';
import { useAuth } from '../context/AuthContext';
import type { Post, User } from '../types';
import {
  avatarColor,
  CATEGORY_LABELS,
  initials,
  POST_STATUS_LABELS,
  REPORT_REASON_LABELS,
  timeAgo,
} from '../utils/format';
import CommentSection from './CommentSection';
import ConfirmationModal from './ConfirmationModal';
import RiskBadge from './RiskBadge';
import ShareMenu from './ShareMenu';

function ReportModal({
  post,
  onClose,
  onSubmitted,
}: {
  post: Post;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [reason, setReason] = useState('misinformation');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await postsApi.reportPost(post.id, reason, details);
      onSubmitted();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy-950/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-navy-700 dark:bg-navy-900"
        role="dialog"
        aria-modal="true"
      >
        <h3 className="text-base font-semibold">Report this post</h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Reports are reviewed by the moderation team.
        </p>
        <div className="mt-4 space-y-3">
          <div>
            <label className="label" htmlFor="report-reason">Reason</label>
            <select
              id="report-reason"
              className="input"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            >
              {Object.entries(REPORT_REASON_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="report-details">
              Additional details (optional)
            </label>
            <textarea
              id="report-details"
              className="input resize-none"
              rows={3}
              maxLength={2000}
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              placeholder="Why does this post look suspicious?"
            />
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="btn-primary" onClick={submit} disabled={busy}>
              {busy ? 'Submitting...' : 'Submit report'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default function PostCard({
  post,
  currentUser,
  showStatus = false,
  onDelete,
}: {
  post: Post;
  currentUser: User | null;
  showStatus?: boolean;
  onDelete?: (postId: number) => void;
}) {
  const [liked, setLiked] = useState(post.liked_by_me);
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [commentCount, setCommentCount] = useState(post.comment_count);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reported, setReported] = useState(Boolean(post.reported_by_me));
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const imageUrl = mediaUrl(post.image);
  const isAuthor = currentUser?.id === post.author.id;

  async function toggleLike() {
    try {
      const result = await postsApi.toggleLike(post.id);
      setLiked(result.liked);
      setLikeCount(result.like_count);
    } catch {
      // Silent failure for quick actions; full errors surface elsewhere.
    }
  }

  async function handleDelete() {
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await postsApi.deletePost(post.id);
      onDelete?.(post.id);
      setDeleteOpen(false);
    } catch (err) {
      setDeleteError(extractErrorMessage(err));
    } finally {
      setDeleteBusy(false);
    }
  }

  const statusStyles: Record<string, string> = {
    pending_review: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    rejected: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
    approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  };

  return (
    <motion.article
      whileHover={{ y: -2 }}
      transition={{ duration: 0.15 }}
      className="card p-5 transition-shadow hover:shadow-card-hover"
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${avatarColor(
            post.author.username,
          )}`}
        >
          {initials(post.author.full_name || post.author.username)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {post.author.full_name || post.author.username}
            </span>
            <span className="text-sm text-slate-400">@{post.author.username}</span>
            <span className="text-slate-300 dark:text-navy-600">•</span>
            <span className="text-sm text-slate-400">{timeAgo(post.created_at)}</span>
            {post.category && post.category !== 'other' && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-navy-800 dark:text-slate-300">
                {CATEGORY_LABELS[post.category] ?? post.category}
              </span>
            )}
          </div>
          {post.author.department && (
            <p className="text-xs text-slate-400">{post.author.department}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <RiskBadge level={post.risk_level} size="sm" />
          {showStatus && post.status !== 'published' && (
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                statusStyles[post.status] ?? 'bg-slate-100 text-slate-600'
              }`}
            >
              {POST_STATUS_LABELS[post.status]}
            </span>
          )}
        </div>
      </div>

      {post.title && (
        <h3 className="mt-3 text-base font-semibold text-slate-900 dark:text-slate-100">
          {post.title}
        </h3>
      )}
      <p
        className={`mt-1.5 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-slate-700 dark:text-slate-300 ${
          expanded ? '' : 'line-clamp-5'
        }`}
      >
        {post.content}
      </p>
      {post.content.length > 400 && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-1 text-sm font-medium text-accent-600 hover:text-accent-500 dark:text-accent-400"
        >
          {expanded ? 'Show less' : 'Read more'}
        </button>
      )}

      {imageUrl && (
        <img
          src={imageUrl}
          alt="Post attachment"
          className="mt-3 max-h-96 w-full rounded-lg border border-slate-200 object-cover dark:border-navy-700"
          loading="lazy"
        />
      )}

      {showStatus && post.moderation_remarks && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-navy-700 dark:bg-navy-950/50">
          <span className="font-semibold">
            Moderator {post.moderation_remarks.action} this post:
          </span>{' '}
          {post.moderation_remarks.remarks || '(no remarks)'}
          <span className="ml-1 text-xs text-slate-400">
            by @{post.moderation_remarks.moderator}
          </span>
        </div>
      )}

      <div className="mt-4 flex items-center gap-1 border-t border-slate-100 pt-3 dark:border-navy-800">
        <button
          type="button"
          onClick={toggleLike}
          className={`btn-ghost px-2.5 py-1.5 ${
            liked ? 'text-rose-500 hover:text-rose-400' : ''
          }`}
          aria-label={liked ? 'Unlike' : 'Like'}
        >
          <Heart className={`h-[18px] w-[18px] ${liked ? 'fill-current' : ''}`} />
          <span className="text-sm">{likeCount}</span>
        </button>
        <button
          type="button"
          onClick={() => setCommentsOpen((value) => !value)}
          className="btn-ghost px-2.5 py-1.5"
          aria-label="Comments"
        >
          <MessageCircle className="h-[18px] w-[18px]" />
          <span className="text-sm">{commentCount}</span>
        </button>
        <ShareMenu post={post} />
        {!isAuthor && !reported && (
          <button
            type="button"
            onClick={() => setReportOpen(true)}
            className="btn-ghost ml-auto px-2.5 py-1.5"
            aria-label="Report post"
          >
            <Flag className="h-[18px] w-[18px]" />
            <span className="hidden text-sm sm:inline">Report</span>
          </button>
        )}
        {reported && (
          <span className="ml-auto text-xs font-medium text-slate-400">
            Reported
          </span>
        )}
        {isAuthor && onDelete && (
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="btn-ghost ml-auto px-2.5 py-1.5 text-slate-400 hover:text-red-500"
            aria-label="Delete post"
          >
            <Trash2 className="h-[18px] w-[18px]" />
          </button>
        )}
      </div>

      {commentsOpen && (
        <div className="mt-1">
          <CommentSection postId={post.id} onCountChange={setCommentCount} />
        </div>
      )}

      {reportOpen && (
        <ReportModal
          post={post}
          onClose={() => setReportOpen(false)}
          onSubmitted={() => {
            setReportOpen(false);
            setReported(true);
          }}
        />
      )}

      <ConfirmationModal
        open={deleteOpen}
        title="Delete this post?"
        message="This permanently removes the post, its comments and likes."
        confirmLabel="Delete post"
        busy={deleteBusy}
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
      />
      {deleteError && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{deleteError}</p>
      )}
    </motion.article>
  );
}
