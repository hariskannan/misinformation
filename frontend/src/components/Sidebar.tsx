import {
  Bell,
  FileWarning,
  Home,
  LayoutDashboard,
  PenSquare,
  Settings,
  ShieldCheck,
  User as UserIcon,
  FileText,
  LogOut,
  X,
} from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Logo } from './Logo';

export const NAV_ITEMS = [
  { to: '/app', label: 'Home', icon: Home, end: true },
  { to: '/app/create', label: 'Create Post', icon: PenSquare },
  { to: '/app/my-posts', label: 'My Posts', icon: FileText },
  { to: '/app/notifications', label: 'Notifications', icon: Bell },
  { to: '/app/reports', label: 'Reports', icon: FileWarning },
  { to: '/app/profile', label: 'Profile', icon: UserIcon },
  { to: '/app/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/');
  }

  const extraItems = [];
  if (user?.role === 'moderator' || user?.role === 'admin') {
    extraItems.push({
      to: '/moderation',
      label: 'Moderator Dashboard',
      icon: ShieldCheck,
    });
  }
  if (user?.role === 'admin') {
    extraItems.push({
      to: '/admin',
      label: 'Administration',
      icon: LayoutDashboard,
    });
  }

  const content = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 py-5">
        <NavLink to="/app">
          <Logo size="sm" />
        </NavLink>
        <button
          type="button"
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 lg:hidden dark:hover:bg-navy-800"
          onClick={onClose}
          aria-label="Close sidebar"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={'end' in item ? item.end : false}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-accent-500/10 text-accent-600 dark:text-accent-300'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-navy-800 dark:hover:text-white'
              }`
            }
          >
            <item.icon className="h-4.5 w-4.5 h-[18px] w-[18px]" />
            {item.label}
          </NavLink>
        ))}

        {extraItems.length > 0 && (
          <div className="my-3 border-t border-slate-200 pt-3 dark:border-navy-800" />
        )}
        {extraItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-navy-900 text-white dark:bg-accent-500/15 dark:text-accent-300'
                  : 'text-navy-700 hover:bg-navy-900 hover:text-white dark:text-accent-300 dark:hover:bg-accent-500/10'
              }`
            }
          >
            <item.icon className="h-[18px] w-[18px]" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-slate-200 p-3 dark:border-navy-800">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-navy-800 dark:hover:text-white"
        >
          <LogOut className="h-[18px] w-[18px]" />
          Log out
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200 bg-white dark:border-navy-800 dark:bg-navy-900 lg:block">
        {content}
      </aside>
      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-navy-950/60" onClick={onClose} />
          <aside className="absolute inset-y-0 left-0 w-72 border-r border-slate-200 bg-white shadow-xl dark:border-navy-800 dark:bg-navy-900">
            {content}
          </aside>
        </div>
      )}
    </>
  );
}
