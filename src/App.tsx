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
import PsychologistChats from "./pages/PsychologistChats";
import PsychologistChatConversation from "./pages/PsychologistChatConversation";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center gradient-soft"><div className="animate-pulse text-muted-foreground">Carregando...</div></div>;
  if (!user) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const AppRoutes = () => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center gradient-soft"><div className="animate-pulse text-muted-foreground">Carregando...</div></div>;
  }

  // Home redirect logic
  const getHomeRedirect = () => {
    // Not logged in → show role selection (entry point)
    if (!user) return <RoleSelect />;
    // Logged in, no role yet → role selection
    if (!profile?.role) return <RoleSelect />;
    // Logged in with role but onboarding incomplete → onboarding
    if (!profile.onboarding_completed) {
      return <Navigate to={profile.role === "psicologo" ? "/onboarding/psicologo" : "/onboarding/paciente"} replace />;
    }
    return <Navigate to={profile.role === "psicologo" ? "/dashboard/psicologo" : "/dashboard/paciente"} replace />;
  };

  return (
    <Routes>
      <Route path="/" element={getHomeRedirect()} />
      <Route path="/auth/:role" element={user ? <Navigate to="/" replace /> : <Auth />} />
      <Route path="/cadastro/psicologo" element={user ? <Navigate to="/" replace /> : <PsychologistOnboarding />} />
      <Route path="/cadastro/paciente" element={user ? <Navigate to="/" replace /> : <PatientOnboarding />} />
      <Route path="/selecionar-perfil" element={<ProtectedRoute><RoleSelect /></ProtectedRoute>} />
      <Route path="/onboarding/psicologo" element={<ProtectedRoute><PsychologistOnboarding /></ProtectedRoute>} />
      <Route path="/onboarding/paciente" element={<ProtectedRoute><PatientOnboarding /></ProtectedRoute>} />
      <Route path="/dashboard/psicologo" element={<ProtectedRoute><PsychologistDashboard /></ProtectedRoute>} />
      <Route path="/dashboard/psicologo/pacientes" element={<ProtectedRoute><PsychologistPatients /></ProtectedRoute>} />
      <Route path="/dashboard/psicologo/mensagens" element={<ProtectedRoute><PsychologistChats /></ProtectedRoute>} />
      <Route path="/dashboard/psicologo/chat/:patientId" element={<ProtectedRoute><PsychologistChatConversation /></ProtectedRoute>} />
      <Route path="/dashboard/paciente" element={<ProtectedRoute><PatientDashboard /></ProtectedRoute>} />
      <Route path="/dashboard/paciente/psicologos" element={<ProtectedRoute><FindPsychologists /></ProtectedRoute>} />
      <Route path="/chat/:psychologistId" element={<ProtectedRoute><ChatWithPsychologist /></ProtectedRoute>} />
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
