import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppVersion } from "@/components/AppVersion";

import Auth from "./pages/Auth";
import RoleSelect from "./pages/RoleSelect";
import PsychologistOnboarding from "./pages/PsychologistOnboarding";
import PatientOnboarding from "./pages/PatientOnboarding";
import PsychologistDashboard from "./pages/PsychologistDashboard";
import PsychologistPatients from "./pages/PsychologistPatients";
import PsychologistAvailability from "./pages/PsychologistAvailability";
import PatientDashboard from "./pages/PatientDashboard";
import FindPsychologists from "./pages/FindPsychologists";
import ChatWithPsychologist from "./pages/ChatWithPsychologist";
import PsychologistChats from "./pages/PsychologistChats";
import PsychologistChatConversation from "./pages/PsychologistChatConversation";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

const FullScreenLoader = () => (
  <div className="min-h-screen flex items-center justify-center gradient-soft">
    <div className="animate-pulse text-muted-foreground">Carregando...</div>
  </div>
);

const ProtectedRoute = ({
  children,
  requireRole,
}: {
  children: React.ReactNode;
  requireRole?: "paciente" | "psicologo";
}) => {
  const { user, profile, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/auth" replace />;
  if (requireRole && profile?.role && profile.role !== requireRole) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

const AppRoutes = () => {
  const { user, profile, loading } = useAuth();

  if (loading) return <FullScreenLoader />;

  const getHomeRedirect = () => {
    if (!user) return <Auth />;
    if (!profile?.role) return <Navigate to="/selecionar-perfil" replace />;
    if (!profile.onboarding_completed) {
      return (
        <Navigate
          to={profile.role === "psicologo" ? "/onboarding/psicologo" : "/onboarding/paciente"}
          replace
        />
      );
    }
    return (
      <Navigate
        to={profile.role === "psicologo" ? "/dashboard/psicologo" : "/dashboard/paciente"}
        replace
      />
    );
  };

  return (
    <Routes>
      <Route path="/" element={getHomeRedirect()} />
      <Route path="/auth" element={user ? <Navigate to="/" replace /> : <Auth />} />
      <Route
        path="/selecionar-perfil"
        element={<ProtectedRoute><RoleSelect /></ProtectedRoute>}
      />
      <Route
        path="/onboarding/psicologo"
        element={<ProtectedRoute><PsychologistOnboarding /></ProtectedRoute>}
      />
      <Route
        path="/onboarding/paciente"
        element={<ProtectedRoute><PatientOnboarding /></ProtectedRoute>}
      />

      {/* Psicólogo */}
      <Route
        path="/dashboard/psicologo"
        element={<ProtectedRoute requireRole="psicologo"><PsychologistDashboard /></ProtectedRoute>}
      />
      <Route
        path="/dashboard/psicologo/pacientes"
        element={<ProtectedRoute requireRole="psicologo"><PsychologistPatients /></ProtectedRoute>}
      />
      <Route
        path="/dashboard/psicologo/disponibilidade"
        element={<ProtectedRoute requireRole="psicologo"><PsychologistAvailability /></ProtectedRoute>}
      />
      <Route
        path="/dashboard/psicologo/mensagens"
        element={<ProtectedRoute requireRole="psicologo"><PsychologistChats /></ProtectedRoute>}
      />
      <Route
        path="/dashboard/psicologo/chat/:patientId"
        element={<ProtectedRoute requireRole="psicologo"><PsychologistChatConversation /></ProtectedRoute>}
      />

      {/* Paciente */}
      <Route
        path="/dashboard/paciente"
        element={<ProtectedRoute requireRole="paciente"><PatientDashboard /></ProtectedRoute>}
      />
      <Route
        path="/dashboard/paciente/psicologos"
        element={<ProtectedRoute requireRole="paciente"><FindPsychologists /></ProtectedRoute>}
      />
      <Route
        path="/chat/:psychologistId"
        element={<ProtectedRoute><ChatWithPsychologist /></ProtectedRoute>}
      />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Sonner position="top-right" richColors closeButton />
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
            <AppVersion />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
