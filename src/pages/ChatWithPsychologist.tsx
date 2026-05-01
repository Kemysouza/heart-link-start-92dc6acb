import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, User } from "lucide-react";
import ChatBox from "@/components/ChatBox";

const ChatWithPsychologist = () => {
  const { psychologistId } = useParams<{ psychologistId: string }>();
  const navigate = useNavigate();
  const [psychName, setPsychName] = useState("Profissional");

  useEffect(() => {
    if (!psychologistId) return;
    let cancelled = false;

    // Tenta primeiro o diretório público (cobre psicólogo com quem ainda não há
    // vínculo); se não, usa a RPC.
    (async () => {
      const { data: dirRow } = await supabase
        .from("psychologist_directory")
        .select("nome_completo")
        .eq("user_id", psychologistId)
        .maybeSingle();
      if (cancelled) return;
      if (dirRow?.nome_completo) {
        setPsychName(dirRow.nome_completo);
        return;
      }
      const { data: rpcName } = await supabase.rpc("get_user_display_name", {
        target_user_id: psychologistId,
      });
      if (cancelled) return;
      if (typeof rpcName === "string" && rpcName) setPsychName(rpcName);
    })();

    return () => {
      cancelled = true;
    };
  }, [psychologistId]);

  if (!psychologistId) return null;

  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="border-b bg-card shrink-0">
        <div className="container mx-auto flex items-center gap-3 py-3 px-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Voltar">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">{psychName}</h2>
            <p className="text-xs text-muted-foreground">Psicólogo(a)</p>
          </div>
        </div>
      </header>
      <div className="flex-1 overflow-hidden">
        <ChatBox otherUserId={psychologistId} />
      </div>
    </div>
  );
};

export default ChatWithPsychologist;
