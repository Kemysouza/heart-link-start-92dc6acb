import { useEffect, useState } from "react";
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

  useEffect(() => {
    if (!user) return;
    fetchContacts();

    const channel = supabase
      .channel("psych-inbox")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => {
        fetchContacts();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  const fetchContacts = async () => {
    if (!user) return;

    // Get all messages where psychologist is sender or receiver
    const { data: msgs } = await supabase
      .from("messages")
      .select("*")
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    if (!msgs || msgs.length === 0) {
      setContacts([]);
      setLoading(false);
      return;
    }

    // Group by other user
    const contactMap = new Map<string, { last_message: string; last_time: string; unread: number }>();
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
        const c = contactMap.get(otherId)!;
        c.unread++;
      }
    }

    // Get names
    const ids = Array.from(contactMap.keys());
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, nome_completo")
      .in("user_id", ids);

    const nameMap = new Map(profiles?.map((p) => [p.user_id, p.nome_completo]) || []);

    const result: ChatContact[] = ids.map((id) => ({
      user_id: id,
      nome_completo: nameMap.get(id) || null,
      last_message: contactMap.get(id)!.last_message,
      last_time: contactMap.get(id)!.last_time,
      unread_count: contactMap.get(id)!.unread,
    }));

    setContacts(result);
    setLoading(false);
  };

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
              >
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center shrink-0">
                    <User className="w-6 h-6 text-accent-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-foreground truncate">{c.nome_completo || "Paciente"}</h3>
                      <span className="text-xs text-muted-foreground shrink-0">{formatTime(c.last_time)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground truncate">{c.last_message}</p>
                      {c.unread_count > 0 && (
                        <span className="ml-2 shrink-0 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-semibold">
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
