import {
  Check,
  Copy,
  Facebook,
  Linkedin,
  Lock,
  MessageCircle,
  Send,
  Share2,
  Twitter,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Post } from '../types';

type ShareTarget = {
  key: string;
  label: string;
  icon: typeof Twitter;
  buildUrl: (url: string, text: string) => string;
};

const TARGETS: ShareTarget[] = [
  {
    key: 'x',
    label: 'X (Twitter)',
    icon: Twitter,
    buildUrl: (url, text) =>
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
  },
  {
    key: 'facebook',
    label: 'Facebook',
    icon: Facebook,
    buildUrl: (url) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    key: 'linkedin',
    label: 'LinkedIn',
    icon: Linkedin,
    buildUrl: (url) =>
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
  },
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    icon: MessageCircle,
    buildUrl: (url, text) =>
      `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`,
  },
  {
    key: 'telegram',
    label: 'Telegram',
    icon: Send,
    buildUrl: (url, text) =>
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
  },
];

export default function ShareMenu({ post }: { post: Post }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isPublic = post.status === 'published' || post.status === 'approved';
  const riskAllowsSharing = post.risk_level === 'low' || post.risk_level === 'medium';
  const canShare = isPublic && riskAllowsSharing;

  const reason = !isPublic
    ? 'This post is not public yet, so it cannot be shared.'
    : 'High-risk posts cannot be shared until a moderator reviews the content and lowers the risk.';

  useEffect(() => {
    if (!open) return;
    function handleClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const url = `${window.location.origin}/post/${post.id}`;
  const text = `${post.title || post.content.slice(0, 120)} — on TruthGuard`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard API can be unavailable on insecure origins; fall back to a
      // temporary textarea so copy still works.
      const area = document.createElement('textarea');
      area.value = url;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      document.body.removeChild(area);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => canShare && setOpen((value) => !value)}
        disabled={!canShare}
        title={canShare ? 'Share this post' : reason}
        className={`btn-ghost px-2.5 py-1.5 ${
          canShare ? '' : 'cursor-not-allowed opacity-50'
        }`}
        aria-label={canShare ? 'Share post' : reason}
        aria-expanded={open}
      >
        {canShare ? (
          <Share2 className="h-[18px] w-[18px]" />
        ) : (
          <Lock className="h-[18px] w-[18px]" />
        )}
        <span className="hidden text-sm sm:inline">Share</span>
      </button>

      {!canShare && post.status !== 'pending_review' && post.risk_level === 'high' && (
        <span className="absolute -bottom-4 right-0 whitespace-nowrap text-[10px] font-medium text-amber-600 dark:text-amber-400">
          High risk: sharing disabled
        </span>
      )}

      {open && canShare && (
        <div className="absolute bottom-full right-0 z-30 mb-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-navy-700 dark:bg-navy-900">
          <p className="border-b border-slate-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:border-navy-800">
            Share this post
          </p>
          {TARGETS.map((target) => {
            const Icon = target.icon;
            return (
              <button
                key={target.key}
                type="button"
                onClick={() => {
                  window.open(
                    target.buildUrl(url, text),
                    '_blank',
                    'noopener,noreferrer',
                  );
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-slate-600 transition-colors hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-navy-800"
              >
                <Icon className="h-4 w-4 text-slate-400" />
                {target.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={copyLink}
            className="flex w-full items-center gap-2.5 border-t border-slate-100 px-3 py-2 text-left text-sm text-slate-600 transition-colors hover:bg-slate-50 dark:border-navy-800 dark:text-slate-300 dark:hover:bg-navy-800"
          >
            {copied ? (
              <Check className="h-4 w-4 text-emerald-500" />
            ) : (
              <Copy className="h-4 w-4 text-slate-400" />
            )}
            {copied ? 'Link copied' : 'Copy link'}
          </button>
          <p className="border-t border-slate-100 px-3 py-2 text-[10px] leading-relaxed text-slate-400 dark:border-navy-800">
            Only low and medium risk posts can be shared.
          </p>
        </div>
      )}
    </div>
  );
}
