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
    supabase
      .from("profiles")
      .select("nome_completo")
      .eq("user_id", patientId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.nome_completo) setPatientName(data.nome_completo);
      });
  }, [patientId]);

  if (!patientId) return null;

  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="border-b bg-card shrink-0">
        <div className="container mx-auto flex items-center gap-3 py-3 px-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/psicologo/mensagens")}>
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
