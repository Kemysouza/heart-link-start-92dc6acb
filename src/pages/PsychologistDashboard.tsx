import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Brain, Calendar, Users, LogOut, MessageSquare, Clock } from "lucide-react";
import { toLocalDateString, addDays, formatBR } from "@/lib/datetime";

interface Stat {
  patients: number;
  weekAppointments: number;
  unreadMessages: number;
}

interface UpcomingAppt {
  id: string;
  patient_id: string;
  patient_name: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: string;
}

const PsychologistDashboard = () => {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stat>({ patients: 0, weekAppointments: 0, unreadMessages: 0 });
  const [upcoming, setUpcoming] = useState<UpcomingAppt[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!user) return;

    const today = new Date();
    const todayStr = toLocalDateString(today);
    const weekEnd = addDays(today, 7);
    const weekEndStr = toLocalDateString(weekEnd);

    const [patientsRes, weekApptsRes, msgsRes, upcomingRes] = await Promise.all([
      supabase.from("psychologist_patients").select("id", { count: "exact", head: true }).eq("psychologist_id", user.id),
      supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("psychologist_id", user.id)
        .gte("appointment_date", todayStr)
        .lte("appointment_date", weekEndStr)
        .in("status", ["agendado", "confirmado"]),
      supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("receiver_id", user.id)
        .eq("is_read", false),
      supabase
        .from("appointments")
        .select("id, patient_id, appointment_date, start_time, end_time, status")
        .eq("psychologist_id", user.id)
        .gte("appointment_date", todayStr)
        .in("status", ["agendado", "confirmado"])
        .order("appointment_date")
        .order("start_time")
        .limit(5),
    ]);

    setStats({
      patients: patientsRes.count ?? 0,
      weekAppointments: weekApptsRes.count ?? 0,
      unreadMessages: msgsRes.count ?? 0,
    });

    const apptList = (upcomingRes.data ?? []) as Omit<UpcomingAppt, "patient_name">[];
    if (apptList.length === 0) {
      setUpcoming([]);
      setLoading(false);
      return;
    }
    const patientIds = Array.from(new Set(apptList.map((a) => a.patient_id)));
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, nome_completo")
      .in("user_id", patientIds);
    const nameMap = new Map(profiles?.map((p) => [p.user_id, p.nome_completo]) ?? []);
    setUpcoming(
      apptList.map((a) => ({ ...a, patient_name: nameMap.get(a.patient_id) || "Paciente" })),
    );
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchAll();
    if (!user) return;
    const channel = supabase
      .channel("psych-dashboard")
      .on("postgres_changes",
        { event: "*", schema: "public", table: "appointments", filter: `psychologist_id=eq.${user.id}` },
        fetchAll)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `receiver_id=eq.${user.id}` },
        fetchAll)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchAll]);

  const formatHour = (t: string) => t.slice(0, 5);

  return (
    <div className="min-h-screen bg-background">
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
            <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sair">
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
          <p className="text-muted-foreground mt-1">Resumo do seu consultório</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 animate-slide-up">
          <StatCard icon={Users} value={loading ? "—" : String(stats.patients)} label="Pacientes" sub="Ativos"
            onClick={() => navigate("/dashboard/psicologo/pacientes")} />
          <StatCard icon={Calendar} value={loading ? "—" : String(stats.weekAppointments)} label="Consultas" sub="Próximos 7 dias" />
          <StatCard icon={MessageSquare} value={loading ? "—" : String(stats.unreadMessages)} label="Mensagens" sub="Não lidas"
            onClick={() => navigate("/dashboard/psicologo/mensagens")} />
          <StatCard icon={Clock} value="" label="Disponibilidade" sub="Configurar horários"
            onClick={() => navigate("/dashboard/psicologo/disponibilidade")} />
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="shadow-card border-0">
            <CardContent className="p-6">
              <h3 className="font-semibold text-foreground mb-1">Próximas Consultas</h3>
              <p className="text-sm text-muted-foreground mb-4">Agenda confirmada</p>
              {loading ? (
                <p className="text-center py-8 text-muted-foreground animate-pulse">Carregando...</p>
              ) : upcoming.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="w-12 h-12 mx-auto mb-3 opacity-40" />
                  <p>Nenhuma consulta agendada</p>
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {upcoming.map((a) => {
                    const d = new Date(a.appointment_date + "T00:00:00");
                    return (
                      <li key={a.id} className="py-3 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-foreground">{a.patient_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatBR(d)} · {formatHour(a.start_time)}–{formatHour(a.end_time)}
                          </p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          a.status === "confirmado"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"
                        }`}>
                          {a.status}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-card border-0">
            <CardContent className="p-6">
              <h3 className="font-semibold text-foreground mb-1">Atalhos</h3>
              <p className="text-sm text-muted-foreground mb-4">Acesse as principais áreas</p>
              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" onClick={() => navigate("/dashboard/psicologo/pacientes")}>
                  <Users className="w-4 h-4 mr-2" /> Pacientes
                </Button>
                <Button variant="outline" onClick={() => navigate("/dashboard/psicologo/mensagens")}>
                  <MessageSquare className="w-4 h-4 mr-2" /> Mensagens
                </Button>
                <Button variant="outline" onClick={() => navigate("/dashboard/psicologo/disponibilidade")}>
                  <Clock className="w-4 h-4 mr-2" /> Disponibilidade
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

const StatCard = ({
  icon: Icon, value, label, sub, onClick,
}: {
  icon: typeof Users;
  value: string;
  label: string;
  sub: string;
  onClick?: () => void;
}) => (
  <Card
    className={`shadow-card border-0 ${onClick ? "cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all duration-200" : ""}`}
    onClick={onClick}
    role={onClick ? "button" : undefined}
    tabIndex={onClick ? 0 : undefined}
  >
    <CardContent className="p-6">
      <div className="flex items-center justify-between mb-3">
        <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
          <Icon className="w-5 h-5 text-accent-foreground" />
        </div>
      </div>
      {value && <p className="text-2xl font-bold text-foreground">{value}</p>}
      <p className="text-sm text-muted-foreground">{label} · {sub}</p>
      {onClick && <p className="text-xs text-primary mt-1">Abrir →</p>}
    </CardContent>
  </Card>
);

export default PsychologistDashboard;
