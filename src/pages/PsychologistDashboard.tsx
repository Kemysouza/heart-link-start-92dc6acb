import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Brain, Calendar, Users, LogOut, FileText, MessageSquare, Settings } from "lucide-react";
import { EmailConfirmToast } from "@/components/EmailConfirmToast";
import { supabase } from "@/integrations/supabase/client";

const PsychologistDashboard = () => {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [activePatients, setActivePatients] = useState<number>(0);
  const [conversationsCount, setConversationsCount] = useState<number>(0);

  useEffect(() => {
    const stored = sessionStorage.getItem("pending_email_confirm");
    if (stored) {
      setPendingEmail(stored);
      sessionStorage.removeItem("pending_email_confirm");
    }
  }, []);

  useEffect(() => {
    const fetchCounts = async () => {
      if (!user) return;
      const { count: patientsCount } = await supabase
        .from("psychologist_patients")
        .select("id", { count: "exact", head: true })
        .eq("psychologist_id", user.id);
      setActivePatients(patientsCount || 0);

      const { data: msgs } = await supabase
        .from("messages")
        .select("sender_id, receiver_id")
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);
      const others = new Set<string>();
      msgs?.forEach((m: { sender_id: string; receiver_id: string }) => {
        const other = m.sender_id === user.id ? m.receiver_id : m.sender_id;
        others.add(other);
      });
      setConversationsCount(others.size);
    };
    fetchCounts();
  }, [user]);

  return (
    <div className="min-h-screen bg-background">
      {pendingEmail && (
        <EmailConfirmToast email={pendingEmail} onClose={() => setPendingEmail(null)} />
      )}
      <header className="border-b bg-card">
        <div className="container mx-auto flex items-center justify-between py-4 px-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
              <Brain className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">MindCare</h2>
              <p className="text-xs text-muted-foreground">Painel do Psicólogo</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:block">
              Olá, {profile?.nome_completo || "Profissional"}
            </span>
            <Button variant="ghost" size="icon" onClick={signOut}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-4 md:p-8">
        <div className="mb-8 animate-fade-in">
          <h1 className="text-3xl font-bold text-foreground">
            Bem-vindo(a), {profile?.nome_completo?.split(" ")[0] || "Profissional"}!
          </h1>
          <p className="text-muted-foreground mt-1">Aqui está o resumo do seu consultório</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 animate-slide-up">
          <Card
            className="shadow-card border-0 cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all duration-200"
            onClick={() => navigate("/dashboard/psicologo/pacientes")}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
                  <Users className="w-5 h-5 text-accent-foreground" />
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground">—</p>
              <p className="text-sm text-muted-foreground">Pacientes · Ativos</p>
              <p className="text-xs text-primary mt-1">Clique para ver →</p>
            </CardContent>
          </Card>

          <Card className="shadow-card border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-accent-foreground" />
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground">0</p>
              <p className="text-sm text-muted-foreground">Consultas · Esta semana</p>
            </CardContent>
          </Card>

          <Card
            className="shadow-card border-0 cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all duration-200"
            onClick={() => navigate("/dashboard/psicologo/mensagens")}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-accent-foreground" />
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground">—</p>
              <p className="text-sm text-muted-foreground">Mensagens · Conversas</p>
              <p className="text-xs text-primary mt-1">Clique para ver →</p>
            </CardContent>
          </Card>

          <Card className="shadow-card border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
                  <Settings className="w-5 h-5 text-accent-foreground" />
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground">100%</p>
              <p className="text-sm text-muted-foreground">Perfil · Completo</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="shadow-card border-0">
            <CardContent className="p-6">
              <h3 className="font-semibold text-foreground mb-1">Próximas Consultas</h3>
              <p className="text-sm text-muted-foreground mb-4">Agenda do dia</p>
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p>Nenhuma consulta agendada</p>
                <p className="text-sm">As consultas aparecerão aqui</p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card border-0">
            <CardContent className="p-6">
              <h3 className="font-semibold text-foreground mb-1">Pacientes Recentes</h3>
              <p className="text-sm text-muted-foreground mb-4">Últimos atendimentos</p>
              <div className="text-center py-8 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p>Nenhum paciente ainda</p>
                <p className="text-sm">Seus pacientes aparecerão aqui</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default PsychologistDashboard;
