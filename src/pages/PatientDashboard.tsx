import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, Calendar, Heart, BookOpen, LogOut, Search, Clock, User, MessageSquare } from "lucide-react";
import { EmailConfirmToast } from "@/components/EmailConfirmToast";
import { supabase } from "@/integrations/supabase/client";

interface Appointment {
  id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: string;
  psychologist_id: string;
  psychologist_name?: string;
}

const PatientDashboard = () => {
  const { profile, signOut, user } = useAuth();
  const navigate = useNavigate();
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(true);

  useEffect(() => {
    const stored = sessionStorage.getItem("pending_email_confirm");
    if (stored) {
      setPendingEmail(stored);
      sessionStorage.removeItem("pending_email_confirm");
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchAppointments();
  }, [user]);

  const fetchAppointments = async () => {
    if (!user) return;
    setLoadingAppointments(true);
    try {
      const { data: appts, error } = await supabase
        .from("appointments")
        .select("id, appointment_date, start_time, end_time, status, psychologist_id")
        .eq("patient_id", user.id)
        .order("appointment_date", { ascending: true })
        .order("start_time", { ascending: true });

      if (error) throw error;

      const list = appts || [];
      const psychIds = [...new Set(list.map((a: any) => a.psychologist_id))];
      let nameMap = new Map<string, string>();
      if (psychIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("user_id, nome_completo")
          .in("user_id", psychIds);
        (profilesData || []).forEach((p: any) => nameMap.set(p.user_id, p.nome_completo));
      }

      setAppointments(
        list.map((a: any) => ({
          ...a,
          psychologist_name: nameMap.get(a.psychologist_id) || "Profissional",
        }))
      );
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAppointments(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split("-").map(Number);
    return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
  };

  const formatTime = (timeStr: string) => timeStr.slice(0, 5);

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
              <p className="text-xs text-muted-foreground">Painel do Paciente</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:block">
              Olá, {profile?.nome_completo || "Paciente"}
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
            Olá, {profile?.nome_completo?.split(" ")[0] || "Paciente"}! 💚
          </h1>
          <p className="text-muted-foreground mt-1">Como você está se sentindo hoje?</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 animate-slide-up">
          {[
            {
              icon: Calendar,
              label: "Consultas",
              value: String(appointments.filter(a => a.status !== 'cancelado' && a.status !== 'recusado').length),
              desc: "Agendadas",
              onClick: () => {
                const next = appointments.find(a => a.status !== 'cancelado' && a.status !== 'recusado');
                if (next) {
                  navigate(`/dashboard/paciente/psicologos?open=${next.psychologist_id}&date=${next.appointment_date}&reschedule=${next.id}`);
                } else {
                  navigate("/dashboard/paciente/psicologos");
                }
              },
            },
            { icon: Search, label: "Psicólogos", value: "—", desc: "Encontrar", onClick: () => navigate("/dashboard/paciente/psicologos") },
            { icon: MessageSquare, label: "Mensagens", value: "—", desc: "Conversas", onClick: () => navigate("/dashboard/paciente/mensagens") },
            { icon: BookOpen, label: "Diário", value: "0", desc: "Entradas", onClick: undefined },
          ].map(({ icon: Icon, label, value, desc, onClick }) => (
            <Card key={label} className={`shadow-card border-0 cursor-pointer hover:shadow-elevated hover:scale-[1.02] transition-all duration-200`} onClick={onClick}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
                    <Icon className="w-5 h-5 text-accent-foreground" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-foreground">{value}</p>
                <p className="text-sm text-muted-foreground">{label} · {desc}</p>
                {onClick && <p className="text-xs text-primary mt-1">Clique para ver →</p>}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="shadow-card border-0">
            <CardHeader>
              <CardTitle>Próximas Consultas</CardTitle>
              <CardDescription>Suas sessões agendadas</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingAppointments ? (
                <div className="text-center py-8 text-muted-foreground animate-pulse">Carregando...</div>
              ) : appointments.filter(a => a.status !== 'cancelado' && a.status !== 'recusado').length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="w-12 h-12 mx-auto mb-3 opacity-40" />
                  <p>Nenhuma consulta agendada</p>
                  <p className="text-sm">Agende com um psicólogo para começar</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {appointments.filter(a => a.status !== 'cancelado' && a.status !== 'recusado').map((appt) => (
                    <button
                      key={appt.id}
                      type="button"
                      onClick={() => navigate(`/dashboard/paciente/psicologos?open=${appt.psychologist_id}&date=${appt.appointment_date}`)}
                      className="w-full text-left flex items-center gap-3 p-3 rounded-lg bg-accent/50 border border-accent hover:bg-accent hover:shadow-card transition-all duration-200 cursor-pointer"
                      title="Abrir agenda do profissional"
                    >
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Calendar className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {appt.psychologist_name}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(appt.appointment_date)}
                          </span>
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {formatTime(appt.start_time)} — {formatTime(appt.end_time)}
                          </span>
                        </div>
                      </div>
                      <div className="shrink-0">
                        {appt.status === 'confirmado' ? (
                          <span className="text-xs font-medium text-green-600 bg-green-100 px-2 py-0.5 rounded-full">Confirmada</span>
                        ) : (
                          <span className="text-xs font-medium text-yellow-600 bg-yellow-100 px-2 py-0.5 rounded-full">Pendente</span>
                        )}
                      </div>
                    </button>
                  ))}

                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-card border-0">
            <CardHeader>
              <CardTitle>Recursos de Apoio</CardTitle>
              <CardDescription>Conteúdos para seu bem-estar</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p>Em breve</p>
                <p className="text-sm">Artigos e exercícios de bem-estar</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default PatientDashboard;
