import { Route, Routes } from 'react-router-dom';
import DashboardLayout from './pages/DashboardLayout';
import Landing from './pages/Landing';
import About from './pages/About';
import Login from './pages/Login';
import Register from './pages/Register';
import NotFound from './pages/NotFound';
import Home from './pages/dashboard/Home';
import CreatePostPage from './pages/dashboard/CreatePostPage';
import MyPosts from './pages/dashboard/MyPosts';
import Notifications from './pages/dashboard/Notifications';
import Reports from './pages/dashboard/Reports';
import Profile from './pages/dashboard/Profile';
import Settings from './pages/dashboard/Settings';
import ModeratorPage from './pages/ModeratorPage';
import AdminLayout from './pages/admin/AdminLayout';
import AdminAnalytics from './pages/admin/AdminAnalytics';
import AdminUsers from './pages/admin/AdminUsers';
import AdminDatasets from './pages/admin/AdminDatasets';
import AdminModels from './pages/admin/AdminModels';
import AuditLogs from './pages/admin/AuditLogs';
import ProtectedRoute from './components/ProtectedRoute';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/about" element={<About />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Authenticated user dashboard */}
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Home />} />
        <Route path="create" element={<CreatePostPage />} />
        <Route path="my-posts" element={<MyPosts />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="reports" element={<Reports />} />
        <Route path="profile" element={<Profile />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      {/* Moderator dashboard */}
      <Route
        path="/moderation"
        element={
          <ProtectedRoute roles={['moderator', 'admin']}>
            <ModeratorPage />
          </ProtectedRoute>
        }
      />

      {/* Administration */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute roles={['admin']}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminAnalytics />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="datasets" element={<AdminDatasets />} />
        <Route path="models" element={<AdminModels />} />
        <Route path="audit-logs" element={<AuditLogs />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
