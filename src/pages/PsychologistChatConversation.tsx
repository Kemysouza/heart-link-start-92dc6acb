import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, User } from "lucide-react";
import ChatBox from "@/components/ChatBox";

const PsychologistChatConversation = () => {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const [patientName, setPatientName] = useState("Paciente");

  useEffect(() => {
    if (!patientId) return;
    let cancelled = false;
    supabase
      .rpc("get_user_display_name", { target_user_id: patientId })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("[Chat] erro ao obter nome:", error);
          return;
        }
        if (typeof data === "string" && data) setPatientName(data);
      });
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  if (!patientId) return null;

  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="border-b bg-card shrink-0">
        <div className="container mx-auto flex items-center gap-3 py-3 px-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/dashboard/psicologo/mensagens")}
            aria-label="Voltar"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">{patientName}</h2>
            <p className="text-xs text-muted-foreground">Paciente</p>
          </div>
        </div>
      </header>
      <div className="flex-1 overflow-hidden">
        <ChatBox otherUserId={patientId} />
      </div>
    </div>
  );
};

export default PsychologistChatConversation;
