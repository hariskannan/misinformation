import { Check, Eye, EyeOff, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { extractErrorMessage } from '../api/client';
import { Logo } from '../components/Logo';
import PageWrapper from '../components/PageWrapper';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    full_name: '',
    username: '',
    email: '',
    department: '',
    password: '',
    password2: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(field: keyof typeof form) {
    return (event: React.ChangeEvent<HTMLInputElement>) =>
      setForm((current) => ({ ...current, [field]: event.target.value }));
  }

  const passwordChecks = [
    { label: 'At least 8 characters', valid: form.password.length >= 8 },
    { label: 'Contains an uppercase letter', valid: /[A-Z]/.test(form.password) },
    { label: 'Contains a digit', valid: /\d/.test(form.password) },
    { label: 'Passwords match', valid: form.password.length > 0 && form.password === form.password2 },
  ];

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await register(form);
      navigate('/app', { replace: true });
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 dark:bg-navy-950">
      <PageWrapper>
        <div className="w-full max-w-md">
          <div className="mb-8 flex justify-center">
            <Link to="/" aria-label="TruthGuard home">
              <Logo size="lg" />
            </Link>
          </div>

          <div className="card p-8">
            <h1 className="text-2xl font-bold text-navy-950 dark:text-white">
              Create your account
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Join TruthGuard and publish with risk awareness.
            </p>

            <form onSubmit={submit} className="mt-6 space-y-4">
              <div>
                <label htmlFor="full_name" className="label">Full name</label>
                <input id="full_name" className="input" required maxLength={120}
                  value={form.full_name} onChange={update('full_name')} placeholder="Alice Johnson" />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="username" className="label">Username</label>
                  <input id="username" className="input" required minLength={3} maxLength={30}
                    pattern="[a-zA-Z0-9_.]+" title="Letters, numbers, dots and underscores only"
                    autoComplete="username" value={form.username} onChange={update('username')}
                    placeholder="alice" />
                </div>
                <div>
                  <label htmlFor="email" className="label">Email</label>
                  <input id="email" className="input" type="email" required autoComplete="email"
                    value={form.email} onChange={update('email')} placeholder="alice@example.com" />
                </div>
              </div>

              <div>
                <label htmlFor="department" className="label">
                  Department <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <input id="department" className="input" maxLength={120}
                  value={form.department} onChange={update('department')} placeholder="Computer Science" />
              </div>

              <div>
                <label htmlFor="password" className="label">Password</label>
                <div className="relative">
                  <input id="password" className="input pr-10"
                    type={showPassword ? 'text' : 'password'} required autoComplete="new-password"
                    value={form.password} onChange={update('password')} placeholder="Choose a strong password" />
                  <button type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    onClick={() => setShowPassword((value) => !value)} aria-label="Toggle password visibility">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="password2" className="label">Confirm password</label>
                <input id="password2" className="input"
                  type={showPassword ? 'text' : 'password'} required autoComplete="new-password"
                  value={form.password2} onChange={update('password2')} placeholder="Repeat the password" />
              </div>

              <ul className="grid grid-cols-1 gap-1 rounded-lg bg-slate-50 p-3 text-xs dark:bg-navy-900 sm:grid-cols-2">
                {passwordChecks.map((check) => (
                  <li key={check.label}
                    className={`flex items-center gap-1.5 ${check.valid ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
                    <Check className={`h-3.5 w-3.5 ${check.valid ? 'opacity-100' : 'opacity-30'}`} />
                    {check.label}
                  </li>
                ))}
              </ul>

              {error && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                  {error}
                </p>
              )}

              <button type="submit" className="btn-primary w-full py-2.5" disabled={submitting}>
                <UserPlus className="h-4 w-4" />
                {submitting ? 'Creating account...' : 'Create account'}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
              Already registered?{' '}
              <Link to="/login" className="font-semibold text-accent-600 hover:text-accent-500 dark:text-accent-400">
                Log in
              </Link>
            </p>
          </div>

          <p className="mt-6 text-center text-xs leading-relaxed text-slate-400">
            By registering you agree to use TruthGuard responsibly. Model risk
            predictions are automated signals, not fact-checks.
          </p>
        </div>
      </PageWrapper>
    </div>
  );
}
