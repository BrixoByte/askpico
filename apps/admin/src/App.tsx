import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { supabase } from './lib/supabase';
import Login from './pages/Login';
import DashboardLayout from './components/DashboardLayout';
import Overview from './pages/Overview';
import Users from './pages/Users';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import { ReactNode } from 'react';

// Every dashboard route passes through here: unauthenticated → /login,
// authenticated non-admin → denied screen. The API re-verifies the role on
// each call, so this wrapper is UX, not the security boundary.
const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { loading, isAdmin } = useAuth();
  if (loading) {
    return (
      <div className='flex min-h-screen items-center justify-center text-ink-muted'>
        Verifying admin access…
      </div>
    );
  }
  if (!supabase) {
    return (
      <div className='flex min-h-screen items-center justify-center text-ink-muted'>
        Supabase env vars missing — set VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.
      </div>
    );
  }
  if (!isAdmin) return <Navigate to='/login' replace />;
  return <>{children}</>;
};

const App = () => (
  <Routes>
    <Route path='/login' element={<Login />} />
    <Route
      path='/'
      element={
        <ProtectedRoute>
          <DashboardLayout />
        </ProtectedRoute>
      }
    >
      <Route index element={<Overview />} />
      <Route path='users' element={<Users />} />
      <Route path='analytics' element={<Analytics />} />
      <Route path='settings' element={<Settings />} />
    </Route>
    <Route path='*' element={<Navigate to='/' replace />} />
  </Routes>
);

export default App;
