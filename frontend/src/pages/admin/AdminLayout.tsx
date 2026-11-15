import {
  BarChart3,
  Database,
  GitBranch,
  ScrollText,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';

const ADMIN_NAV = [
  { to: '/admin', label: 'Analytics', icon: BarChart3, end: true },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/datasets', label: 'Datasets', icon: Database },
  { to: '/admin/models', label: 'Models & Training', icon: GitBranch },
  { to: '/admin/audit-logs', label: 'Audit Logs', icon: ScrollText },
];

export default function AdminLayout() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-navy-950">
      <Sidebar open={false} onClose={() => undefined} />
      <div className="lg:pl-64">
        <Topbar onMenuClick={() => undefined} />
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <ShieldCheck className="h-4 w-4 text-accent-500" />
            <span className="font-semibold uppercase tracking-wide">
              Administration
            </span>
          </div>
          <nav className="mt-4 flex flex-wrap gap-1.5">
            {ADMIN_NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={'end' in item ? item.end : false}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                    isActive
                      ? 'bg-navy-900 text-white dark:bg-accent-500 dark:text-navy-950'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-navy-800 dark:text-slate-300 dark:hover:bg-navy-700'
                  }`
                }
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
              </NavLink>
            ))}
          </nav>
          <main className="mt-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
