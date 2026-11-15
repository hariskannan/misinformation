import { ShieldCheck } from 'lucide-react';

export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: { icon: 'h-7 w-7 rounded-lg', text: 'text-lg' },
    md: { icon: 'h-9 w-9 rounded-xl', text: 'text-xl' },
    lg: { icon: 'h-12 w-12 rounded-2xl', text: 'text-3xl' },
  }[size];

  return (
    <div className="flex items-center gap-2.5">
      <div
        className={`flex items-center justify-center bg-navy-900 text-accent-400 ${sizes.icon}`}
      >
        <ShieldCheck className="h-[70%] w-[70%]" />
      </div>
      <div className="leading-tight">
        <span className={`font-extrabold tracking-tight text-slate-900 dark:text-white ${sizes.text}`}>
          Truth<span className="text-accent-500">Guard</span>
        </span>
      </div>
    </div>
  );
}
