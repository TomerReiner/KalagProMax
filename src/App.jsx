import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import { PreviewRoleProvider } from '@/lib/previewRoleContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Navigate } from 'react-router-dom';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import Home from '@/pages/Home';
import AppLayout from '@/components/AppLayout';
import Shotaf from '@/pages/Shotaf';
import Constraints from '@/pages/Constraints';
import DailySummaryPage from '@/pages/DailySummary';
import Tasks from '@/pages/Tasks';
import Klaf from '@/pages/Klaf';
import Statistics from '@/pages/Statistics';
import Equipment from '@/pages/Equipment';
import Playbox from '@/pages/Playbox';
// Add page imports here
// Note: the Base44 MCP OAuth-consent page (src/pages/OAuthConsent.jsx) was
// dropped here — it authorized AI clients against Base44's own hosted MCP
// server, which no longer exists once the app runs on Supabase/Vercel. The
// file is left on disk but is no longer imported or routed.
// Note: src/pages/Delegations.jsx (a standalone "האצלות" page/tab for the
// delegated-permissions feature) is likewise left on disk but unrouted — a
// combined grab-bag tab wasn't wanted, so each capability now lives where it
// naturally fits instead: frisa_pina and meal_regulators fold into Klaf.jsx,
// and playbox_orders gets its own focused page/route (see Playbox.jsx /
// /playbox above). Equipment withdrawal delegation (equipment_manager) lives
// in Equipment.jsx's own canEdit check — it started as a separate flag on
// profiles that predated this feature, and is now one of these permission
// keys too (see src/lib/permissions.js).

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/shotaf" element={<Shotaf />} />
          <Route path="/constraints" element={<Constraints />} />
          <Route path="/daily-summary" element={<DailySummaryPage />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/klaf" element={<Klaf />} />
          <Route path="/statistics" element={<Statistics />} />
          <Route path="/equipment" element={<Equipment />} />
          <Route path="/playbox" element={<Playbox />} />
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <PreviewRoleProvider>
            <AuthenticatedApp />
          </PreviewRoleProvider>
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
