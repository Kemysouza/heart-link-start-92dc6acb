import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Auth from "./pages/Auth";
import RoleSelect from "./pages/RoleSelect";
import PsychologistOnboarding from "./pages/PsychologistOnboarding";
import PsychologistDashboard from "./pages/PsychologistDashboard";
import PsychologistPatients from "./pages/PsychologistPatients";
import PsychologistAgenda from "./pages/PsychologistAgenda";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center gradient-soft"><div className="animate-pulse text-muted-foreground">Carregando...</div></div>;
  if (!user) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const RoleRoute = ({ role, children }: { role: "psicologo"; children: React.ReactNode }) => {
  const { user, profile, loading, profileLoading } = useAuth();
  if (loading || (user && profileLoading)) {
    return <div className="min-h-screen flex items-center justify-center gradient-soft"><div className="animate-pulse text-muted-foreground">Carregando...</div></div>;
  }
  if (!user) return <Navigate to="/" replace />;
  if (!profile?.role) return <Navigate to="/selecionar-perfil" replace />;
  if (profile.role !== role) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const AppRoutes = () => {
  const { user, profile, loading, profileLoading } = useAuth();

  // Wait for both auth session AND profile (when logged in) before deciding routes
  if (loading || (user && profileLoading)) {
    return <div className="min-h-screen flex items-center justify-center gradient-soft"><div className="animate-pulse text-muted-foreground">Carregando...</div></div>;
  }

  // Home redirect logic
  const getHomeRedirect = () => {
    if (!user) return <RoleSelect />;
    if (profile?.role === "psicologo") return <Navigate to="/dashboard/psicologo" replace />;
    return <RoleSelect />;
  };

  return (
    <Routes>
      <Route path="/" element={getHomeRedirect()} />
      <Route path="/auth/:role" element={user ? <Navigate to="/" replace /> : <Auth />} />
      <Route path="/cadastro/psicologo" element={user ? <Navigate to="/" replace /> : <PsychologistOnboarding />} />
      <Route path="/selecionar-perfil" element={<ProtectedRoute><RoleSelect /></ProtectedRoute>} />
      <Route path="/onboarding/psicologo" element={<ProtectedRoute><PsychologistOnboarding /></ProtectedRoute>} />
      <Route path="/dashboard/psicologo" element={<RoleRoute role="psicologo"><PsychologistDashboard /></RoleRoute>} />
      <Route path="/dashboard/psicologo/pacientes" element={<RoleRoute role="psicologo"><PsychologistPatients /></RoleRoute>} />
      <Route path="/dashboard/psicologo/agenda" element={<RoleRoute role="psicologo"><PsychologistAgenda /></RoleRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
