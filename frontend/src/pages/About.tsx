import {
  AlertTriangle,
  Brain,
  Database,
  FileSearch,
  GitBranch,
  LineChart,
  ScanSearch,
  Scale,
  ShieldCheck,
  Table2,
  TriangleAlert,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import Footer from '../components/Footer';
import Navbar from '../components/Navbar';
import PageWrapper from '../components/PageWrapper';

export default function About() {
  return (
    <div className="min-h-screen bg-white dark:bg-navy-950">
      <Navbar />

      <PageWrapper>
        <main className="mx-auto max-w-4xl px-4 pb-20 pt-28 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-extrabold tracking-tight text-navy-950 dark:text-white">
            About <span className="text-accent-500">TruthGuard</span>
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-slate-600 dark:text-slate-300">
            TruthGuard is an early misinformation risk prediction platform built
            with data mining and machine learning. It integrates a trained text
            classification model directly into a social media publishing
            workflow: every post is analyzed <em>before</em> it becomes visible,
            and the model's output decides whether it publishes, publishes with
            a warning, or is held for human moderation.
          </p>

          <section className="mt-12">
            <h2 className="flex items-center gap-2 text-2xl font-bold text-navy-950 dark:text-white">
              <FileSearch className="h-6 w-6 text-accent-500" />
              The prediction workflow
            </h2>
            <ol className="mt-5 space-y-4 border-l-2 border-accent-500/40 pl-6">
              {[
                'You write a post. Optionally you press "Analyze before publishing" to see the risk result before committing.',
                'The backend runs the active model on the post text (title is not used for classification) and stores a Prediction record: predicted label, confidence, class probabilities, model name and version.',
                'The predicted label is mapped to a risk level: "real" -> low risk; "fake" with confidence above the platform threshold -> high risk; anything else -> medium risk.',
                'Low-risk posts publish immediately. Medium-risk posts publish with a visible warning (or are held, per platform policy). High-risk posts are never made public until a moderator approves them.',
                'Moderators review flagged content with the full prediction evidence in front of them and make the final human decision.',
              ].map((step, index) => (
                <li key={index} className="relative">
                  <span className="absolute -left-[31px] flex h-5 w-5 items-center justify-center rounded-full bg-accent-500 text-[10px] font-bold text-white">
                    {index + 1}
                  </span>
                  <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    {step}
                  </p>
                </li>
              ))}
            </ol>
          </section>

          <section className="mt-12">
            <h2 className="flex items-center gap-2 text-2xl font-bold text-navy-950 dark:text-white">
              <Brain className="h-6 w-6 text-accent-500" />
              Models and features
            </h2>
            <p className="mt-4 leading-relaxed text-slate-600 dark:text-slate-300">
              Text is preprocessed (lowercased, punctuation stripped, English
              stopwords removed) and vectorized with TF-IDF over unigrams and
              bigrams. Four classical scikit-learn classifiers are supported:
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {[
                { icon: GitBranch, name: 'Decision Tree', text: 'Interpretable tree of if-then rules on TF-IDF features.' },
                { icon: LineChart, name: 'Random Forest', text: 'Bagged ensemble of decision trees voting on each post.' },
                { icon: Table2, name: 'Naive Bayes', text: 'Multinomial Naive Bayes over word likelihoods.' },
                { icon: ScanSearch, name: 'Support Vector Machine', text: 'Linear SVM wrapped in probability calibration (Platt scaling).' },
              ].map((model) => (
                <div key={model.name} className="card flex gap-3 p-5">
                  <model.icon className="mt-0.5 h-6 w-6 shrink-0 text-accent-500" />
                  <div>
                    <h3 className="font-semibold text-navy-950 dark:text-white">{model.name}</h3>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{model.text}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-6 leading-relaxed text-slate-600 dark:text-slate-300">
              Every training run reports accuracy, precision, recall, F1 and a
              confusion matrix computed on a held-out 20% test split of the
              selected dataset version. Only one model version can be active
              at a time; activating a new one automatically deactivates the
              previous. Model metrics shown anywhere in the app always come
              from these real training runs - the platform never displays
              invented accuracy numbers.
            </p>
          </section>

          <section className="mt-12">
            <h2 className="flex items-center gap-2 text-2xl font-bold text-navy-950 dark:text-white">
              <Database className="h-6 w-6 text-accent-500" />
              Dataset policy
            </h2>
            <p className="mt-4 leading-relaxed text-slate-600 dark:text-slate-300">
              Administrators upload datasets as CSV or JSON files, map text and
              label columns, and validate each version through a cleaning
              pipeline that reports dropped rows, duplicates, missing values
              and class distribution. For real-world evaluation the project
              targets well-known research datasets such as{' '}
              <strong>ISOT Fake News</strong>, <strong>LIAR</strong> and{' '}
              <strong>FakeNewsNet</strong>; because those datasets have
              redistribution restrictions, they are not bundled with the
              repository - upload your legally obtained copy and follow the
              label mapping documented in the README.
            </p>
            <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
              <TriangleAlert className="mr-1.5 inline h-4 w-4 -translate-y-0.5" />
              The demo database ships with a clearly-labelled{' '}
              <strong>synthetic sample dataset</strong> generated locally from
              patterned templates. It exists so the full pipeline can be
              demonstrated end-to-end and must not be interpreted as real-world
              news data or real-world performance.
            </p>
          </section>

          <section className="mt-12">
            <h2 className="flex items-center gap-2 text-2xl font-bold text-navy-950 dark:text-white">
              <Scale className="h-6 w-6 text-accent-500" />
              Risk levels and what they mean
            </h2>
            <div className="mt-5 space-y-3">
              {[
                { level: 'Low risk (green)', text: 'The model predicted the content is likely reliable. The post publishes normally.' },
                { level: 'Medium risk (yellow)', text: 'The model is uncertain or leaning towards unreliable. The post publishes with a visible warning, or is held for review depending on platform policy.' },
                { level: 'High risk (red)', text: 'The model predicted likely misinformation with high confidence. The post is held for moderator review and is not publicly visible until a decision is made.' },
              ].map((row) => (
                <div key={row.level} className="card p-5">
                  <h3 className="font-semibold text-navy-950 dark:text-white">{row.level}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{row.text}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-12">
            <h2 className="flex items-center gap-2 text-2xl font-bold text-navy-950 dark:text-white">
              <AlertTriangle className="h-6 w-6 text-accent-500" />
              Limitations - please read
            </h2>
            <p className="mt-4 leading-relaxed text-slate-600 dark:text-slate-300">
              TruthGuard is an academic demonstration of ML-assisted content
              moderation. Its predictions are statistical signals, not verdicts:
            </p>
            <ul className="mt-4 space-y-2.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {[
                'The model reflects the biases of its training dataset; a low-risk result is not a fact-check.',
                'Text classification cannot verify images, videos, or claims that require primary sources.',
                'Automated predictions must never be the sole basis for removing content - human moderators always make the final decision.',
                'Confidence scores are model self-assessments (calibrated probabilities), not guarantees of correctness.',
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent-500" />
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <div className="mt-12 flex flex-wrap gap-3">
            <Link to="/register" className="btn-primary px-6 py-3">
              Try the platform
            </Link>
            <Link to="/" className="btn-secondary px-6 py-3">
              Back to home
            </Link>
          </div>
        </main>
      </PageWrapper>

      <Footer />
    </div>
  );
}
