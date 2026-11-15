import { LogIn, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { extractErrorMessage } from '../api/client';
import { Logo } from '../components/Logo';
import PageWrapper from '../components/PageWrapper';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!identifier.trim() || !password || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const user = await login(identifier.trim(), password);
      const destination =
        (location.state as { from?: string } | null)?.from ??
        (user.role === 'admin' ? '/admin' : user.role === 'moderator' ? '/moderation' : '/app');
      navigate(destination, { replace: true });
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
              Welcome back
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Log in with your username or email address.
            </p>

            <form onSubmit={submit} className="mt-6 space-y-4">
              <div>
                <label htmlFor="identifier" className="label">
                  Username or email
                </label>
                <input
                  id="identifier"
                  className="input"
                  type="text"
                  autoComplete="username"
                  required
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  placeholder="e.g. alice"
                />
              </div>

              <div>
                <label htmlFor="password" className="label">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    className="input pr-16"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Your password"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                    onClick={() => setShowPassword((value) => !value)}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              {error && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                  {error}
                </p>
              )}

              <button
                type="submit"
                className="btn-primary w-full py-2.5"
                disabled={submitting}
              >
                <LogIn className="h-4 w-4" />
                {submitting ? 'Logging in...' : 'Log in'}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
              No account yet?{' '}
              <Link to="/register" className="font-semibold text-accent-600 hover:text-accent-500 dark:text-accent-400">
                Create one
              </Link>
            </p>
          </div>

          <p className="mt-6 text-center text-xs leading-relaxed text-slate-400">
            <ShieldCheck className="mr-1 inline h-3.5 w-3.5 -translate-y-0.5 text-accent-500" />
            Sessions use short-lived JWT access tokens with refresh rotation and
            logout blacklisting.
          </p>
        </div>
      </PageWrapper>
    </div>
  );
}
