import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Brain, ArrowLeft, Clock, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DAY_NAMES_PT } from "@/lib/datetime";

interface Slot {
  id: string;
  day_of_week: number;
  start_time: string; // "HH:MM:SS"
  end_time: string;
  is_available: boolean;
}

const HOURS_OPTIONS = Array.from({ length: 24 }, (_, i) => i);

const PsychologistAvailability = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // form
  const [dow, setDow] = useState<string>("1");
  const [startHour, setStartHour] = useState<string>("9");
  const [endHour, setEndHour] = useState<string>("18");

  const fetchSlots = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("availability_slots")
      .select("*")
      .eq("psychologist_id", user.id)
      .order("day_of_week")
      .order("start_time");
    if (error) {
      toast.error("Erro ao carregar disponibilidade");
      return;
    }
    setSlots((data as Slot[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchSlots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleAdd = async () => {
    if (!user) return;
    const sh = Number(startHour);
    const eh = Number(endHour);
    if (sh >= eh) {
      toast.error("Hora de início deve ser antes da hora de fim");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("availability_slots").insert({
      psychologist_id: user.id,
      day_of_week: Number(dow),
      start_time: `${String(sh).padStart(2, "0")}:00:00`,
      end_time: `${String(eh).padStart(2, "0")}:00:00`,
      is_available: true,
    });
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar slot");
      return;
    }
    toast.success("Disponibilidade adicionada");
    fetchSlots();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("availability_slots").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao remover");
      return;
    }
    toast.success("Removido");
    fetchSlots();
  };

  const groupedByDow = DAY_NAMES_PT.map((name, dayIdx) => ({
    dayIdx,
    name,
    slots: slots.filter((s) => s.day_of_week === dayIdx),
  }));

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto flex items-center gap-3 py-4 px-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/psicologo")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
            <Brain className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">Disponibilidade</h2>
            <p className="text-xs text-muted-foreground">Defina os horários em que você atende</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-4 md:p-8 max-w-3xl">
        <Card className="shadow-card border-0 mb-6">
          <CardContent className="p-6">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <Plus className="w-4 h-4" /> Adicionar horário
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Dia</label>
                <Select value={dow} onValueChange={setDow}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DAY_NAMES_PT.map((n, i) => (
                      <SelectItem key={i} value={String(i)}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Início</label>
                <Select value={startHour} onValueChange={setStartHour}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {HOURS_OPTIONS.map((h) => (
                      <SelectItem key={h} value={String(h)}>{String(h).padStart(2, "0")}:00</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Fim</label>
                <Select value={endHour} onValueChange={setEndHour}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {HOURS_OPTIONS.map((h) => (
                      <SelectItem key={h} value={String(h)}>{String(h).padStart(2, "0")}:00</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleAdd} disabled={saving} className="gradient-primary text-primary-foreground">
                {saving ? "..." : "Adicionar"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Os horários cadastrados aqui são os que aparecerão como livres para os pacientes.
            </p>
          </CardContent>
        </Card>

        {loading ? (
          <p className="text-center py-8 text-muted-foreground animate-pulse">Carregando...</p>
        ) : (
          <div className="space-y-3">
            {groupedByDow.map(({ dayIdx, name, slots: daySlots }) => (
              <Card key={dayIdx} className="shadow-card border-0">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <h4 className="font-semibold text-foreground">{name}</h4>
                    <span className="text-xs text-muted-foreground">
                      {daySlots.length === 0 ? "(sem disponibilidade)" : `(${daySlots.length} faixa${daySlots.length > 1 ? "s" : ""})`}
                    </span>
                  </div>
                  {daySlots.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {daySlots.map((s) => (
                        <div
                          key={s.id}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent text-accent-foreground text-sm"
                        >
                          <span>
                            {s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}
                          </span>
                          <button
                            onClick={() => handleDelete(s.id)}
                            className="text-muted-foreground hover:text-destructive"
                            aria-label="Remover"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default PsychologistAvailability;
