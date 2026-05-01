import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, Calendar, LogOut, Search, MessageSquare } from "lucide-react";
import { toLocalDateString, formatBR } from "@/lib/datetime";

interface UpcomingAppt {
  id: string;
  psychologist_id: string;
  psychologist_name: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: string;
}

const PatientDashboard = () => {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [upcoming, setUpcoming] = useState<UpcomingAppt[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    const todayStr = toLocalDateString(new Date());

    const [apptsRes, msgsRes] = await Promise.all([
      supabase
        .from("appointments")
        .select("id, psychologist_id, appointment_date, start_time, end_time, status")
        .eq("patient_id", user.id)
        .gte("appointment_date", todayStr)
        .in("status", ["agendado", "confirmado"])
        .order("appointment_date")
        .order("start_time")
        .limit(5),
      supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("receiver_id", user.id)
        .eq("is_read", false),
    ]);

    setUnreadCount(msgsRes.count ?? 0);

    const apptList = (apptsRes.data ?? []) as Omit<UpcomingAppt, "psychologist_name">[];
    if (apptList.length === 0) {
      setUpcoming([]);
      setLoading(false);
      return;
    }
    const psychIds = Array.from(new Set(apptList.map((a) => a.psychologist_id)));
    const { data: profiles } = await supabase
      .from("psychologist_directory")
      .select("user_id, nome_completo")
      .in("user_id", psychIds);
    const nameMap = new Map(profiles?.map((p) => [p.user_id, p.nome_completo]) ?? []);
    setUpcoming(
      apptList.map((a) => ({ ...a, psychologist_name: nameMap.get(a.psychologist_id) || "Profissional" })),
    );
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchAll();
    if (!user) return;
    const channel = supabase
      .channel("patient-dashboard")
      .on("postgres_changes",
        { event: "*", schema: "public", table: "appointments", filter: `patient_id=eq.${user.id}` },
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
              <p className="text-xs text-muted-foreground">Painel do Paciente</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:block">
              Olá, {profile?.nome_completo || "Paciente"}
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
            Olá, {profile?.nome_completo?.split(" ")[0] || "Paciente"}!
          </h1>
          <p className="text-muted-foreground mt-1">Como você está se sentindo hoje?</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8 animate-slide-up">
          <Card
            className="shadow-card border-0 cursor-pointer hover:shadow-elevated hover:scale-[1.02] transition-all duration-200"
            onClick={() => navigate("/dashboard/paciente/psicologos")}
          >
            <CardContent className="p-6">
              <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center mb-3">
                <Search className="w-5 h-5 text-accent-foreground" />
              </div>
              <p className="font-semibold text-foreground">Encontrar Psicólogos</p>
              <p className="text-sm text-muted-foreground">Busque profissionais e agende</p>
              <p className="text-xs text-primary mt-1">Abrir →</p>
            </CardContent>
          </Card>

          <Card className="shadow-card border-0">
            <CardContent className="p-6">
              <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center mb-3">
                <Calendar className="w-5 h-5 text-accent-foreground" />
              </div>
              <p className="text-2xl font-bold text-foreground">{loading ? "—" : upcoming.length}</p>
              <p className="text-sm text-muted-foreground">Consultas · Agendadas</p>
            </CardContent>
          </Card>

          <Card className="shadow-card border-0">
            <CardContent className="p-6">
              <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center mb-3">
                <MessageSquare className="w-5 h-5 text-accent-foreground" />
              </div>
              <p className="text-2xl font-bold text-foreground">{loading ? "—" : unreadCount}</p>
              <p className="text-sm text-muted-foreground">Mensagens · Não lidas</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="shadow-card border-0">
            <CardHeader>
              <CardTitle>Próximas Consultas</CardTitle>
              <CardDescription>Sessões agendadas</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-center py-8 text-muted-foreground animate-pulse">Carregando...</p>
              ) : upcoming.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="w-12 h-12 mx-auto mb-3 opacity-40" />
                  <p>Nenhuma consulta agendada</p>
                  <p className="text-sm">Encontre um profissional para começar</p>
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {upcoming.map((a) => {
                    const d = new Date(a.appointment_date + "T00:00:00");
                    return (
                      <li key={a.id} className="py-3 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-foreground">{a.psychologist_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatBR(d)} · {formatHour(a.start_time)}–{formatHour(a.end_time)}
                          </p>
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
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
            <CardHeader>
              <CardTitle>Recursos de Apoio</CardTitle>
              <CardDescription>Conteúdos para seu bem-estar</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">Em breve: artigos e exercícios de bem-estar.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default PatientDashboard;
