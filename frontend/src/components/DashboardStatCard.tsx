import type { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatNumber } from '../utils/format';

export default function DashboardStatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = 'default',
  delay = 0,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  hint?: string;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  delay?: number;
}) {
  const tones: Record<string, string> = {
    default: 'bg-navy-100 text-navy-600 dark:bg-navy-800 dark:text-accent-300',
    success: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
    warning: 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300',
    danger: 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-300',
    info: 'bg-accent-100 text-accent-600 dark:bg-accent-500/15 dark:text-accent-300',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.25 }}
      whileHover={{ y: -2 }}
      className="card flex items-center gap-4 p-5"
    >
      <div className={`rounded-xl p-3 ${tones[tone]}`}>
        <Icon className="h-6 w-6" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm text-slate-500 dark:text-slate-400">{label}</p>
        <p className="text-2xl font-bold text-slate-900 dark:text-slate-50">
          {typeof value === 'number' ? formatNumber(value) : value}
        </p>
        {hint && (
          <p className="truncate text-xs text-slate-400 dark:text-slate-500">{hint}</p>
        )}
      </div>
    </motion.div>
  );
}
