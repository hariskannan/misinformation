import { Github, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Logo } from './Logo';

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white dark:border-navy-800 dark:bg-navy-950">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-4">
          <div className="md:col-span-2">
            <Logo />
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              TruthGuard is an early misinformation risk prediction platform built
              with data mining and machine learning. It analyzes social media
              content before it is published and turns model output into a
              transparent, risk-based moderation signal.
            </p>
            <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-300">
              Think Before You Share.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Project
            </h4>
            <ul className="mt-3 space-y-2 text-sm text-slate-500 dark:text-slate-400">
              <li>
                <Link to="/about" className="hover:text-accent-600">
                  About TruthGuard
                </Link>
              </li>
              <li>
                <Link to="/" className="hover:text-accent-600">
                  How it works
                </Link>
              </li>
              <li>
                <Link to="/register" className="hover:text-accent-600">
                  Create an account
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Technology
            </h4>
            <ul className="mt-3 space-y-2 text-sm text-slate-500 dark:text-slate-400">
              <li>React + TypeScript + Tailwind CSS</li>
              <li>Django REST Framework + JWT</li>
              <li>Scikit-learn: TF-IDF, DT, RF, NB, SVM</li>
              <li>PostgreSQL</li>
            </ul>
          </div>
        </div>
        <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-slate-100 pt-6 text-xs text-slate-400 dark:border-navy-800 sm:flex-row">
          <p className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-accent-500" />
            TruthGuard - Early Misinformation Risk Prediction Using Data Mining
          </p>
          <p className="flex items-center gap-1">
            <Github className="h-3.5 w-3.5" />
            Academic demonstration project - predictions are risk signals, not verdicts.
          </p>
        </div>
      </div>
    </footer>
  );
}
