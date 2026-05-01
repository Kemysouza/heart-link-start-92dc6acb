import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Brain, User, Stethoscope } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const RoleSelect = () => {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [pendingRole, setPendingRole] = useState<"paciente" | "psicologo" | null>(null);
  const [saving, setSaving] = useState(false);

  // Usuário já completou o onboarding — não pode trocar de papel pela tela.
  // Esta é uma verificação UX; a regra de negócio definitiva tem que estar no
  // backend (idealmente policy de UPDATE em profiles bloqueando mudança de role
  // se onboarding_completed = true). Aqui, no mínimo, evitamos confusão.
  const alreadyOnboarded = !!profile?.onboarding_completed;

  const confirmRole = async () => {
    if (!user || !pendingRole) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ role: pendingRole })
      .eq("user_id", user.id);
    setSaving(false);
    if (error) {
      console.error("[RoleSelect]", error);
      toast.error(`Erro ao selecionar perfil: ${error.message}`);
      setPendingRole(null);
      return;
    }
    await refreshProfile();
    toast.success("Perfil selecionado");
    navigate(pendingRole === "psicologo" ? "/onboarding/psicologo" : "/onboarding/paciente");
  };

  if (alreadyOnboarded) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-soft p-4">
        <Card className="max-w-md w-full shadow-elevated border-0">
          <CardContent className="p-6 text-center">
            <p className="text-foreground mb-3">Você já completou o cadastro neste perfil.</p>
            <Button onClick={() => navigate("/")}>Voltar para o painel</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

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
          <RoleCard
            icon={User}
            title="Sou Paciente"
            description="Quero encontrar apoio psicológico e cuidar da minha saúde mental"
            onClick={() => setPendingRole("paciente")}
          />
          <RoleCard
            icon={Stethoscope}
            title="Sou Psicólogo(a)"
            description="Quero atender pacientes e gerenciar meu consultório online"
            onClick={() => setPendingRole("psicologo")}
          />
        </div>

        <p className="mt-6 text-xs text-center text-muted-foreground">
          Atenção: a escolha do perfil é definitiva após concluir o cadastro.
        </p>
      </div>

      <Dialog open={pendingRole !== null} onOpenChange={(o) => !o && setPendingRole(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar perfil</DialogTitle>
            <DialogDescription>
              Você selecionou{" "}
              <strong>
                {pendingRole === "psicologo" ? "Psicólogo(a)" : "Paciente"}
              </strong>
              . Após concluir o cadastro, este perfil não pode ser trocado nesta conta.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingRole(null)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={confirmRole} disabled={saving}>
              {saving ? "Salvando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const RoleCard = ({
  icon: Icon,
  title,
  description,
  onClick,
}: {
  icon: typeof User;
  title: string;
  description: string;
  onClick: () => void;
}) => (
  <Card
    className="cursor-pointer shadow-card border-2 border-transparent hover:border-primary hover:shadow-elevated transition-all duration-300 group"
    onClick={onClick}
    role="button"
    tabIndex={0}
    onKeyDown={(e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onClick();
      }
    }}
  >
    <CardHeader className="text-center pb-2">
      <div className="mx-auto w-20 h-20 rounded-2xl bg-accent flex items-center justify-center mb-3 group-hover:gradient-primary transition-all duration-300">
        <Icon className="w-10 h-10 text-accent-foreground group-hover:text-primary-foreground transition-colors" />
      </div>
      <CardTitle className="text-xl">{title}</CardTitle>
    </CardHeader>
    <CardContent>
      <CardDescription className="text-center">{description}</CardDescription>
    </CardContent>
  </Card>
);

export default RoleSelect;
