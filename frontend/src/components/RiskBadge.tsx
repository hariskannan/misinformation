import type { RiskLevel } from '../types';
import { RISK_META } from '../utils/format';

export default function RiskBadge({
  level,
  size = 'md',
}: {
  level: RiskLevel | '' | null | undefined;
  size?: 'sm' | 'md';
}) {
  if (!level) return null;
  const meta = RISK_META[level];
  const sizeClasses =
    size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${meta.badge} ${sizeClasses}`}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: meta.color }}
      />
      {meta.label}
    </span>
  );
}
