import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Check, CheckCheck } from "lucide-react";
import { toast } from "sonner";

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
  /** marca local indicando que foi enviada pelo usuário e ainda não confirmada pelo servidor */
  pending?: boolean;
}

interface ChatBoxProps {
  otherUserId: string;
}

const MAX_MESSAGE_LEN = 4000;

const ChatBox = ({ otherUserId }: ChatBoxProps) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Conjunto de IDs já vistos. Usamos para deduplicar entre optimistic e realtime.
  // Mantido em ref para sobreviver a re-renders sem causar mudança de hook deps.
  const seenIdsRef = useRef<Set<string>>(new Set());

  const fetchMessages = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .or(
        `and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`,
      )
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[Chat] erro ao carregar mensagens:", error);
      toast.error("Erro ao carregar mensagens");
      setLoading(false);
      return;
    }

    const list = (data as Message[]) || [];
    seenIdsRef.current = new Set(list.map((m) => m.id));
    setMessages(list);
    setLoading(false);

    // Marca como lidas as recebidas não lidas. Não bloqueia a UI.
    const unreadIds = list
      .filter((m) => m.sender_id === otherUserId && !m.is_read)
      .map((m) => m.id);
    if (unreadIds.length > 0) {
      void supabase.from("messages").update({ is_read: true }).in("id", unreadIds);
    }
  }, [user, otherUserId]);

  useEffect(() => {
    if (!user || !otherUserId) return;
    fetchMessages();

    const channel = supabase
      .channel(`chat-${user.id}-${otherUserId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const msg = payload.new as Message;
          const isRelevant =
            (msg.sender_id === user.id && msg.receiver_id === otherUserId) ||
            (msg.sender_id === otherUserId && msg.receiver_id === user.id);
          if (!isRelevant) return;

          // Dedup: se já vimos este id (caso da própria mensagem que acabamos
          // de enviar e substituir o optimistic), ignoramos.
          if (seenIdsRef.current.has(msg.id)) return;
          seenIdsRef.current.add(msg.id);

          setMessages((prev) => [...prev, msg]);

          // Se foi recebida, marca como lida.
          if (msg.sender_id === otherUserId) {
            void supabase.from("messages").update({ is_read: true }).eq("id", msg.id);
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages" },
        (payload) => {
          const updated = payload.new as Message;
          setMessages((prev) =>
            prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)),
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, otherUserId, fetchMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const content = newMessage.trim();
    if (!content || !user) return;
    if (content.length > MAX_MESSAGE_LEN) {
      toast.error(`Mensagem muito longa (máx. ${MAX_MESSAGE_LEN} caracteres)`);
      return;
    }

    setNewMessage("");
    setSending(true);

    // Optimistic com id temporário identificável.
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const optimistic: Message = {
      id: tempId,
      sender_id: user.id,
      receiver_id: otherUserId,
      content,
      is_read: false,
      created_at: new Date().toISOString(),
      pending: true,
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const { data, error } = await supabase
        .from("messages")
        .insert({ sender_id: user.id, receiver_id: otherUserId, content })
        .select()
        .single();
      if (error) throw error;

      const realMsg = data as Message;
      // Adiciona o ID real ao set ANTES de o realtime chegar, para que o handler
      // de realtime ignore esta mesma mensagem ao chegar.
      seenIdsRef.current.add(realMsg.id);
      setMessages((prev) => prev.map((m) => (m.id === tempId ? realMsg : m)));
    } catch (err) {
      console.error("[Chat] erro ao enviar:", err);
      toast.error("Não foi possível enviar a mensagem");
      // Remove optimistic e devolve o texto ao input para o usuário tentar de novo.
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setNewMessage(content);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const formatDateLabel = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    if (d.toDateString() === today.toDateString()) return "Hoje";
    if (d.toDateString() === yesterday.toDateString()) return "Ontem";
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  };

  // Group messages by date
  const groupedMessages: { date: string; msgs: Message[] }[] = [];
  messages.forEach((msg) => {
    const dateKey = new Date(msg.created_at).toDateString();
    const last = groupedMessages[groupedMessages.length - 1];
    if (last && last.date === dateKey) {
      last.msgs.push(msg);
    } else {
      groupedMessages.push({ date: dateKey, msgs: [msg] });
    }
  });

  return (
    <div className="flex flex-col h-full">
      <div
        className="flex-1 overflow-y-auto p-4"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.04'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
        }}
      >
        <div className="max-w-2xl mx-auto space-y-1">
          {loading && (
            <div className="text-center py-8 text-muted-foreground animate-pulse">
              Carregando mensagens...
            </div>
          )}
          {!loading && messages.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-lg" aria-hidden>💬</p>
              <p>Nenhuma mensagem ainda</p>
              <p className="text-sm">Envie uma mensagem para iniciar a conversa</p>
            </div>
          )}
          {groupedMessages.map((group) => (
            <div key={group.date}>
              <div className="flex justify-center my-3">
                <span className="bg-accent text-accent-foreground text-[11px] px-3 py-1 rounded-full shadow-sm">
                  {formatDateLabel(group.msgs[0].created_at)}
                </span>
              </div>
              <div className="space-y-1">
                {group.msgs.map((msg) => {
                  const isMine = msg.sender_id === user?.id;
                  return (
                    <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`relative max-w-[75%] px-3 py-2 shadow-sm ${
                          isMine
                            ? "bg-primary/90 text-primary-foreground rounded-2xl rounded-br-sm"
                            : "bg-card text-card-foreground rounded-2xl rounded-bl-sm border"
                        } ${msg.pending ? "opacity-70" : ""}`}
                      >
                        <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                        <div
                          className={`flex items-center justify-end gap-1 mt-0.5 ${
                            isMine ? "text-primary-foreground/70" : "text-muted-foreground"
                          }`}
                        >
                          <span className="text-[10px]">{formatTime(msg.created_at)}</span>
                          {isMine && !msg.pending && (
                            msg.is_read
                              ? <CheckCheck className="w-3.5 h-3.5" aria-label="Lida" />
                              : <Check className="w-3 h-3" aria-label="Enviada" />
                          )}
                          {isMine && msg.pending && (
                            <span className="text-[10px] italic">enviando...</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="border-t bg-card shrink-0 p-3">
        <div className="max-w-2xl mx-auto flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite uma mensagem..."
            className="flex-1 rounded-full"
            maxLength={MAX_MESSAGE_LEN}
            aria-label="Mensagem"
          />
          <Button
            onClick={handleSend}
            disabled={!newMessage.trim() || sending}
            size="icon"
            className="rounded-full shrink-0"
            aria-label="Enviar"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChatBox;
