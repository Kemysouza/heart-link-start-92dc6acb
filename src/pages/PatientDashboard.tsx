import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, Calendar, Heart, BookOpen, LogOut, Search, Clock, User } from "lucide-react";
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
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem("pending_email_confirm");
    if (stored) {
      setPendingEmail(stored);
      sessionStorage.removeItem("pending_email_confirm");
    }
  }, []);

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
            { icon: Calendar, label: "Consultas", value: "0", desc: "Agendadas", onClick: undefined },
            { icon: Search, label: "Psicólogos", value: "—", desc: "Encontrar", onClick: () => navigate("/dashboard/paciente/psicologos") },
            { icon: Heart, label: "Bem-estar", value: "—", desc: "Registros", onClick: undefined },
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
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p>Nenhuma consulta agendada</p>
                <p className="text-sm">Agende com um psicólogo para começar</p>
              </div>
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
