import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Brain, User, Stethoscope } from "lucide-react";

const RoleSelect = () => {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const selectRole = async (role: "paciente" | "psicologo") => {
    // Not logged in: go to login screen for that role
    if (!user) {
      navigate(`/auth/${role}`);
      return;
    }

    // Logged in but no role yet: persist role and go to onboarding
    const { error } = await supabase
      .from("profiles")
      .update({ role })
      .eq("user_id", user.id);

    if (error) {
      toast.error("Erro ao selecionar perfil");
      return;
    }

    await refreshProfile();
    navigate(role === "psicologo" ? "/onboarding/psicologo" : "/onboarding/paciente");
  };

  return (
    <div className="min-h-screen flex items-center justify-center gradient-soft p-4">
      <div className="w-full max-w-2xl animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl gradient-primary mb-4">
            <Brain className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">Como deseja usar o MindCare?</h1>
          <p className="text-muted-foreground mt-2">Selecione seu perfil para continuar</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card
            className="cursor-pointer shadow-card border-2 border-transparent hover:border-primary hover:shadow-elevated transition-all duration-300 group"
            onClick={() => selectRole("paciente")}
          >
            <CardHeader className="text-center pb-2">
              <div className="mx-auto w-20 h-20 rounded-2xl bg-accent flex items-center justify-center mb-3 group-hover:gradient-primary transition-all duration-300">
                <User className="w-10 h-10 text-accent-foreground group-hover:text-primary-foreground transition-colors" />
              </div>
              <CardTitle className="text-xl">Sou Paciente</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-center">
                Quero encontrar apoio psicológico e cuidar da minha saúde mental
              </CardDescription>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer shadow-card border-2 border-transparent hover:border-primary hover:shadow-elevated transition-all duration-300 group"
            onClick={() => selectRole("psicologo")}
          >
            <CardHeader className="text-center pb-2">
              <div className="mx-auto w-20 h-20 rounded-2xl bg-accent flex items-center justify-center mb-3 group-hover:gradient-primary transition-all duration-300">
                <Stethoscope className="w-10 h-10 text-accent-foreground group-hover:text-primary-foreground transition-colors" />
              </div>
              <CardTitle className="text-xl">Sou Psicólogo(a)</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-center">
                Quero atender pacientes e gerenciar meu consultório online
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default RoleSelect;
