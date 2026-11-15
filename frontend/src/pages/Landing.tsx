import { motion } from 'framer-motion';
import {
  ArrowRight,
  BarChart3,
  Bell,
  Brain,
  CheckCircle2,
  Database,
  FileSearch,
  GitBranch,
  Info,
  LineChart,
  Lock,
  Scale,
  ScanSearch,
  ShieldCheck,
  TriangleAlert,
  Users,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { analyticsApi } from '../api/analytics';
import Footer from '../components/Footer';
import Navbar from '../components/Navbar';
import PageWrapper from '../components/PageWrapper';
import { predictionsApi } from '../api/predictions';
import type { MLModelVersion, PublicStats } from '../types';
import { formatNumber } from '../utils/format';

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.5 },
};

export default function Landing() {
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [activeModel, setActiveModel] = useState<MLModelVersion | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const publicStats = await analyticsApi.publicStats();
        if (!cancelled) setStats(publicStats);
      } catch {
        // Landing page stays usable without the backend.
      }
      const model = await predictionsApi.getActiveModel();
      if (!cancelled) setActiveModel(model);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const steps = [
    {
      icon: FileSearch,
      title: '1. Analyze before publishing',
      text: 'When you write a post, TruthGuard runs the active machine learning model over the text and shows the predicted misinformation risk before anything goes live.',
    },
    {
      icon: Scale,
      title: '2. Three risk levels',
      text: 'Low risk publishes normally. Medium risk publishes with a visible warning. High risk is held back automatically until a moderator reviews it.',
    },
    {
      icon: ShieldCheck,
      title: '3. Human moderation',
      text: 'Moderators see the full prediction evidence - label, confidence, model version and probabilities - and make the final decision. The model never deletes anything by itself.',
    },
  ];

  const algorithms = [
    { icon: GitBranch, name: 'Decision Tree', text: 'Transparent rule-based classification with interpretable splits.' },
    { icon: LineChart, name: 'Random Forest', text: 'Ensemble voting that reduces overfitting and stabilises recall.' },
    { icon: Brain, name: 'Naive Bayes', text: 'Fast probabilistic baseline that performs strongly on short text.' },
    { icon: ScanSearch, name: 'Support Vector Machine', text: 'Maximum-margin classification with calibrated probability output.' },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-navy-950">
      <Navbar />

      {/* Hero */}
      <PageWrapper>
        <section className="relative overflow-hidden pt-16">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(6,182,212,0.12),transparent)] dark:bg-[radial-gradient(60%_50%_at_50%_0%,rgba(6,182,212,0.09),transparent)]" />
          <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-20 sm:px-6 lg:px-8 lg:pt-28">
            <div className="grid items-center gap-12 lg:grid-cols-2">
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <span className="inline-flex items-center gap-2 rounded-full border border-accent-500/30 bg-accent-500/10 px-3 py-1 text-xs font-semibold text-accent-700 dark:text-accent-300">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Think Before You Share
                </span>
                <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight text-navy-950 dark:text-white sm:text-5xl">
                  Stop misinformation{' '}
                  <span className="text-accent-500">before it spreads</span>
                </h1>
                <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600 dark:text-slate-300">
                  TruthGuard analyzes every post with machine learning before it
                  is published, turning model predictions into a transparent
                  low / medium / high misinformation risk signal that users and
                  moderators can actually act on.
                </p>
                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Link to="/register" className="btn-primary px-6 py-3 text-base">
                    Get started free
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link to="/about" className="btn-secondary px-6 py-3 text-base">
                    <Info className="h-4 w-4" />
                    How it works
                  </Link>
                </div>

                {/* Live platform stats - real numbers from the API */}
                <div className="mt-10 grid max-w-lg grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { label: 'Registered users', value: stats?.users_total },
                    { label: 'Posts analyzed', value: stats?.predictions_total },
                    { label: 'Models trained', value: stats?.models_trained },
                    { label: 'Algorithms', value: stats?.algorithms_available },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="rounded-xl border border-slate-200 bg-white/70 p-3 dark:border-navy-800 dark:bg-navy-900/60"
                    >
                      <p className="text-xl font-bold text-navy-950 dark:text-white">
                        {stat.value === undefined ? '...' : formatNumber(stat.value)}
                      </p>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                        {stat.label}
                      </p>
                    </div>
                  ))}
                </div>
                {activeModel && (
                  <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-400">
                    <Brain className="h-3.5 w-3.5 text-accent-500" />
                    Active model:{' '}
                    <span className="font-medium text-slate-500 dark:text-slate-300">
                      {activeModel.name} ({activeModel.algorithm_display})
                    </span>
                  </p>
                )}
              </motion.div>

              {/* Risk preview card */}
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.15 }}
                className="relative mx-auto w-full max-w-md"
              >
                <div className="card space-y-4 p-6 shadow-2xl">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">Pre-publish analysis</p>
                    <span className="rounded-full bg-navy-900 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-accent-400">
                      Live demo
                    </span>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-600 dark:bg-navy-900 dark:text-slate-300">
                    "BREAKING: A researcher discovered a miracle cure that
                    doctors don't want you to know about. Read before it's
                    deleted!"
                  </div>
                  <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-500/30 dark:bg-red-500/10">
                    <div className="flex items-center gap-2">
                      <TriangleAlert className="h-5 w-5 text-red-500" />
                      <p className="font-semibold text-red-700 dark:text-red-300">
                        High misinformation risk
                      </p>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-red-600/80 dark:text-red-300/70">
                      Predicted "fake" with 0.94 confidence. The post is held
                      for moderator review instead of being published.
                    </p>
                  </div>
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/30 dark:bg-emerald-500/10">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      <p className="font-semibold text-emerald-700 dark:text-emerald-300">
                        Low misinformation risk
                      </p>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-emerald-600/80 dark:text-emerald-300/70">
                      Predicted "real" with 0.87 confidence. The post publishes
                      normally.
                    </p>
                  </div>
                </div>
                <div className="pointer-events-none absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-accent-500/10 via-transparent to-navy-500/10 blur-2xl" />
              </motion.div>
            </div>
          </div>
        </section>
      </PageWrapper>

      {/* How it works */}
      <section className="border-t border-slate-100 bg-slate-50/70 py-20 dark:border-navy-800 dark:bg-navy-900/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold text-navy-950 dark:text-white">
              A prediction-first publishing workflow
            </h2>
            <p className="mt-3 text-slate-600 dark:text-slate-300">
              No post skips analysis. The model runs first, the outcome decides
              visibility, and every decision is logged.
            </p>
          </motion.div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {steps.map((step, index) => (
              <motion.div
                key={step.title}
                {...fadeUp}
                transition={{ ...fadeUp.transition, delay: index * 0.1 }}
                className="card p-6"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy-900 text-accent-400">
                  <step.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-navy-950 dark:text-white">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {step.text}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Algorithms */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold text-navy-950 dark:text-white">
              Four classical algorithms, compared openly
            </h2>
            <p className="mt-3 text-slate-600 dark:text-slate-300">
              Text is transformed with TF-IDF (unigrams + bigrams) and
              classified with four scikit-learn models. Accuracy, precision,
              recall and F1 are reported from real held-out test sets - never
              invented.
            </p>
          </motion.div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {algorithms.map((algorithm, index) => (
              <motion.div
                key={algorithm.name}
                {...fadeUp}
                transition={{ ...fadeUp.transition, delay: index * 0.08 }}
                className="card p-5"
              >
                <algorithm.icon className="h-6 w-6 text-accent-500" />
                <h3 className="mt-3 font-semibold text-navy-950 dark:text-white">
                  {algorithm.name}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                  {algorithm.text}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature grid */}
      <section className="border-t border-slate-100 bg-slate-50/70 py-20 dark:border-navy-800 dark:bg-navy-900/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold text-navy-950 dark:text-white">
              Everything a research platform needs
            </h2>
          </motion.div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Database, title: 'Real dataset management', text: 'Upload CSV/JSON datasets, map labels, validate and clean rows, and version every change - all stored server-side.' },
              { icon: Brain, title: 'Transparent training', text: 'Train any algorithm on any dataset version, watch live progress, and compare metrics side by side before activating a model.' },
              { icon: Bell, title: 'Moderation queue', text: 'High-risk posts land in a moderator queue with the full prediction evidence attached. Approve or reject with written remarks.' },
              { icon: Users, title: 'Roles and audit logs', text: 'Users, moderators and administrators each see the right tools, and every administrative action is recorded in audit logs.' },
              { icon: BarChart3, title: 'Live analytics', text: 'Risk distribution, posting activity, moderation throughput and model performance charts computed live from the database.' },
              { icon: Lock, title: 'JWT authentication', text: 'Secure token-based auth with refresh rotation, blacklisted logouts and password policies.' },
            ].map((feature, index) => (
              <motion.div
                key={feature.title}
                {...fadeUp}
                transition={{ ...fadeUp.transition, delay: (index % 3) * 0.08 }}
                className="card p-6"
              >
                <feature.icon className="h-6 w-6 text-accent-500" />
                <h3 className="mt-3 font-semibold text-navy-950 dark:text-white">
                  {feature.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                  {feature.text}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <motion.div
          {...fadeUp}
          className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8"
        >
          <div className="relative overflow-hidden rounded-3xl bg-navy-900 px-8 py-14 text-center shadow-2xl">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_60%_at_50%_110%,rgba(6,182,212,0.25),transparent)]" />
            <h2 className="relative text-3xl font-bold text-white">
              Join the platform that reads before it publishes
            </h2>
            <p className="relative mx-auto mt-3 max-w-xl text-slate-300">
              Create an account, write a post, and watch the risk analysis
              happen in real time.
            </p>
            <div className="relative mt-8 flex flex-wrap justify-center gap-3">
              <Link to="/register" className="btn-primary px-6 py-3 text-base">
                Create your account
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/about"
                className="rounded-lg border border-white/20 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                Read the methodology
              </Link>
            </div>
          </div>
        </motion.div>
      </section>

      <Footer />
    </div>
  );
}
