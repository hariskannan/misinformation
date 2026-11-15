import { Loader2 } from 'lucide-react';

export default function LoadingSpinner({
  label = 'Loading...',
  fullScreen = false,
}: {
  label?: string;
  fullScreen?: boolean;
}) {
  return (
    <div
      className={
        fullScreen
          ? 'flex min-h-[60vh] flex-col items-center justify-center gap-3 text-slate-500 dark:text-slate-400'
          : 'flex items-center justify-center gap-2 py-8 text-slate-500 dark:text-slate-400'
      }
    >
      <Loader2 className="h-6 w-6 animate-spin text-accent-500" />
      <span className="text-sm">{label}</span>
    </div>
  );
}
