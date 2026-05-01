import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Brain, ArrowLeft, MessageSquare, User } from "lucide-react";

interface ChatContact {
  user_id: string;
  nome_completo: string | null;
  last_message: string;
  last_time: string;
  unread_count: number;
}

const PsychologistChats = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchContacts = useCallback(async () => {
    if (!user) return;

    const { data: msgs, error } = await supabase
      .from("messages")
      .select("*")
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[Inbox] erro ao listar mensagens:", error);
      setLoading(false);
      return;
    }

    if (!msgs || msgs.length === 0) {
      setContacts([]);
      setLoading(false);
      return;
    }

    type Acc = { last_message: string; last_time: string; unread: number };
    const contactMap = new Map<string, Acc>();
    for (const msg of msgs) {
      const otherId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
      if (!contactMap.has(otherId)) {
        contactMap.set(otherId, {
          last_message: msg.content,
          last_time: msg.created_at,
          unread: 0,
        });
      }
      if (msg.receiver_id === user.id && !msg.is_read) {
        contactMap.get(otherId)!.unread += 1;
      }
    }

    const ids = Array.from(contactMap.keys());

    // Busca nomes via RPC, que respeita as regras de visibilidade.
    // Em paralelo para não serializar.
    const nameResults = await Promise.all(
      ids.map(async (id) => {
        const { data } = await supabase.rpc("get_user_display_name", { target_user_id: id });
        return [id, (data as string | null) ?? null] as const;
      }),
    );
    const nameMap = new Map(nameResults);

    const result: ChatContact[] = ids.map((id) => {
      const acc = contactMap.get(id)!;
      return {
        user_id: id,
        nome_completo: nameMap.get(id) ?? null,
        last_message: acc.last_message,
        last_time: acc.last_time,
        unread_count: acc.unread,
      };
    });

    setContacts(result);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchContacts();
    if (!user) return;

    const channel = supabase
      .channel("psych-inbox")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => fetchContacts(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchContacts]);

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    }
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto flex items-center gap-3 py-4 px-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/psicologo")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
              <Brain className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Mensagens</h2>
              <p className="text-xs text-muted-foreground">Conversas com pacientes</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-4 md:p-8 max-w-2xl">
        {loading ? (
          <div className="text-center py-12 text-muted-foreground animate-pulse">Carregando...</div>
        ) : contacts.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg">Nenhuma conversa ainda</p>
            <p className="text-sm">Quando um paciente enviar uma mensagem, aparecerá aqui</p>
          </div>
        ) : (
          <div className="space-y-2">
            {contacts.map((c) => (
              <Card
                key={c.user_id}
                className="border-0 shadow-card cursor-pointer hover:shadow-elevated transition-all"
                onClick={() => navigate(`/dashboard/psicologo/chat/${c.user_id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter") navigate(`/dashboard/psicologo/chat/${c.user_id}`);
                }}
              >
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center shrink-0">
                    <User className="w-6 h-6 text-accent-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-foreground truncate">
                        {c.nome_completo || "Paciente"}
                      </h3>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatTime(c.last_time)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground truncate">{c.last_message}</p>
                      {c.unread_count > 0 && (
                        <span
                          className="ml-2 shrink-0 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-semibold"
                          aria-label={`${c.unread_count} mensagens não lidas`}
                        >
                          {c.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default PsychologistChats;
