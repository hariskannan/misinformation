import { Compass } from 'lucide-react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import PageWrapper from '../components/PageWrapper';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-navy-950">
      <Navbar />
      <PageWrapper>
        <main className="flex flex-1 flex-col items-center justify-center px-4 pt-16 text-center">
          <Compass className="h-14 w-14 text-accent-500" />
          <h1 className="mt-6 text-5xl font-extrabold text-navy-950 dark:text-white">404</h1>
          <p className="mt-3 max-w-md text-slate-600 dark:text-slate-300">
            The page you are looking for does not exist or may have been moved.
          </p>
          <Link to="/" className="btn-primary mt-8 px-6 py-3">
            Back to home
          </Link>
        </main>
      </PageWrapper>
    </div>
  );
}
