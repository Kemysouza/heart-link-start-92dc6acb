import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Brain, Calendar, Users, LogOut, MessageSquare, Settings } from "lucide-react";
import { EmailConfirmToast } from "@/components/EmailConfirmToast";
import { supabase } from "@/integrations/supabase/client";

interface ActivePatientSummary {
  user_id: string;
  nome_completo: string | null;
  data_nascimento: string | null;
}

const formatBirthDate = (date: string | null) => {
  if (!date) return "Data não informada";
  const [year, month, day] = date.split("-");
  if (!year || !month || !day) return date;
  return `${day}/${month}/${year}`;
};

const PsychologistDashboard = () => {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [activePatients, setActivePatients] = useState<number>(0);
  const [activePatientList, setActivePatientList] = useState<ActivePatientSummary[]>([]);
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

      const { data: patientLinks } = await supabase
        .from("psychologist_patients")
        .select("patient_id")
        .eq("psychologist_id", user.id);

      const patientIds = (patientLinks || []).map((link) => link.patient_id);
      setActivePatients(patientIds.length);

      if (patientIds.length > 0) {
        const [{ data: profiles }, { data: patientProfiles }] = await Promise.all([
          supabase
            .from("profiles")
            .select("user_id, nome_completo")
            .in("user_id", patientIds),
          supabase
            .from("patient_profiles")
            .select("user_id, data_nascimento")
            .in("user_id", patientIds),
        ]);

        const profileMap = new Map((profiles || []).map((item) => [item.user_id, item.nome_completo]));
        const birthDateMap = new Map((patientProfiles || []).map((item) => [item.user_id, item.data_nascimento]));

        setActivePatientList(
          patientIds.map((patientId) => ({
            user_id: patientId,
            nome_completo: profileMap.get(patientId) || null,
            data_nascimento: birthDateMap.get(patientId) || null,
          }))
        );
      } else {
        setActivePatientList([]);
      }

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
              <p className="text-2xl font-bold text-foreground">{activePatients}</p>
              <p className="text-sm text-muted-foreground">Pacientes · Ativos</p>
              {activePatientList.length > 0 && (
                <div className="mt-4 space-y-2 border-t border-border pt-3">
                  {activePatientList.slice(0, 3).map((patient) => (
                    <div key={patient.user_id} className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {patient.nome_completo || "Nome não informado"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Nascimento: {formatBirthDate(patient.data_nascimento)}
                      </p>
                    </div>
                  ))}
                  {activePatientList.length > 3 && (
                    <p className="text-xs text-muted-foreground">+{activePatientList.length - 3} pacientes</p>
                  )}
                </div>
              )}
              <p className="text-xs text-primary mt-3">Clique para ver →</p>
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
              <p className="text-2xl font-bold text-foreground">{conversationsCount}</p>
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
              {activePatientList.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
                  <p>Nenhum paciente ainda</p>
                  <p className="text-sm">Seus pacientes aparecerão aqui</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activePatientList.slice(0, 5).map((patient) => (
                    <button
                      key={patient.user_id}
                      type="button"
                      onClick={() => navigate("/dashboard/psicologo/pacientes")}
                      className="w-full rounded-md border border-border px-3 py-2 text-left transition-colors hover:bg-accent"
                    >
                      <p className="truncate text-sm font-medium text-foreground">
                        {patient.nome_completo || "Nome não informado"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Nascimento: {formatBirthDate(patient.data_nascimento)}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default PsychologistDashboard;
