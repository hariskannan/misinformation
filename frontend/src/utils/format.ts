import type { RiskLevel } from '../types';

export function timeAgo(isoDate: string): string {
  const date = new Date(isoDate);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export function formatDateTime(isoDate: string): string {
  return new Date(isoDate).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat().format(value);
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined) return '-';
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatDuration(seconds: number): string {
  if (seconds < 1) return `${(seconds * 1000).toFixed(0)} ms`;
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}m ${rest.toFixed(0)}s`;
}

export const CATEGORY_LABELS: Record<string, string> = {
  news: 'News',
  politics: 'Politics',
  health: 'Health',
  technology: 'Technology',
  science: 'Science',
  business: 'Business',
  entertainment: 'Entertainment',
  sports: 'Sports',
  other: 'Other',
};

export const POST_STATUS_LABELS: Record<string, string> = {
  published: 'Published',
  pending_review: 'In review',
  approved: 'Approved',
  rejected: 'Rejected',
};

export const REPORT_REASON_LABELS: Record<string, string> = {
  misinformation: 'Suspected misinformation',
  spam: 'Spam or misleading',
  harassment: 'Harassment or hate',
  inappropriate: 'Inappropriate content',
  other: 'Other',
};

export const RISK_META: Record<
  RiskLevel,
  { label: string; color: string; badge: string; description: string }
> = {
  low: {
    label: 'Low risk',
    color: '#10b981',
    badge:
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    description:
      'The model detected a low misinformation risk. Content can be published.',
  },
  medium: {
    label: 'Medium risk',
    color: '#f59e0b',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    description:
      'The model detected a medium misinformation risk. Please review the content before it is published.',
  },
  high: {
    label: 'High risk',
    color: '#ef4444',
    badge: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
    description:
      'The model detected a high misinformation risk. The post is held for moderator review.',
  },
};

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('') || '?';
}

const AVATAR_COLORS = [
  'bg-accent-500',
  'bg-navy-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-violet-500',
];

export function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}
