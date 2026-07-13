import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Auth from "./pages/Auth";
import RoleSelect from "./pages/RoleSelect";
import PsychologistOnboarding from "./pages/PsychologistOnboarding";
import PatientOnboarding from "./pages/PatientOnboarding";
import PsychologistDashboard from "./pages/PsychologistDashboard";
import PsychologistPatients from "./pages/PsychologistPatients";
import PatientDashboard from "./pages/PatientDashboard";
import FindPsychologists from "./pages/FindPsychologists";
import ChatWithPsychologist from "./pages/ChatWithPsychologist";
import PatientChats from "./pages/PatientChats";
import PsychologistChats from "./pages/PsychologistChats";
import PsychologistChatConversation from "./pages/PsychologistChatConversation";
import PsychologistAgenda from "./pages/PsychologistAgenda";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center gradient-soft"><div className="animate-pulse text-muted-foreground">Carregando...</div></div>;
  if (!user) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const RoleRoute = ({ role, children }: { role: "psicologo" | "paciente"; children: React.ReactNode }) => {
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
    // Not logged in → show role selection (entry point)
    if (!user) return <RoleSelect />;
    // Logged in but profile not loaded — fallback to role selection
    if (!profile) return <RoleSelect />;
    // Logged in with no role yet → role selection
    if (!profile.role) return <RoleSelect />;
    // Logged in with a role → go straight to the dashboard
    return <Navigate to={profile.role === "psicologo" ? "/dashboard/psicologo" : "/dashboard/paciente"} replace />;
  };

  return (
    <Routes>
      <Route path="/" element={getHomeRedirect()} />
      <Route path="/auth/:role" element={user ? <Navigate to="/" replace /> : <Auth />} />
      <Route path="/cadastro/psicologo" element={user ? <Navigate to="/" replace /> : <PsychologistOnboarding />} />
      <Route path="/cadastro/paciente" element={<PatientOnboarding />} />
      <Route path="/selecionar-perfil" element={<ProtectedRoute><RoleSelect /></ProtectedRoute>} />
      <Route path="/onboarding/psicologo" element={<ProtectedRoute><PsychologistOnboarding /></ProtectedRoute>} />
      <Route path="/onboarding/paciente" element={<ProtectedRoute><PatientOnboarding /></ProtectedRoute>} />
      <Route path="/dashboard/psicologo" element={<RoleRoute role="psicologo"><PsychologistDashboard /></RoleRoute>} />
      <Route path="/dashboard/psicologo/pacientes" element={<RoleRoute role="psicologo"><PsychologistPatients /></RoleRoute>} />
      <Route path="/dashboard/psicologo/mensagens" element={<RoleRoute role="psicologo"><PsychologistChats /></RoleRoute>} />
      <Route path="/dashboard/psicologo/agenda" element={<RoleRoute role="psicologo"><PsychologistAgenda /></RoleRoute>} />
      <Route path="/dashboard/psicologo/chat/:patientId" element={<RoleRoute role="psicologo"><PsychologistChatConversation /></RoleRoute>} />
      <Route path="/dashboard/paciente" element={<RoleRoute role="paciente"><PatientDashboard /></RoleRoute>} />
      <Route path="/dashboard/paciente/psicologos" element={<RoleRoute role="paciente"><FindPsychologists /></RoleRoute>} />
      <Route path="/dashboard/paciente/mensagens" element={<RoleRoute role="paciente"><PatientChats /></RoleRoute>} />
      <Route path="/chat/:psychologistId" element={<RoleRoute role="paciente"><ChatWithPsychologist /></RoleRoute>} />
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
