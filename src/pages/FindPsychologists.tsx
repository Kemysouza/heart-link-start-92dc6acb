import { useEffect, useMemo, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Brain, ArrowLeft, User, Award, Briefcase, Calendar,
  ChevronLeft, ChevronRight, MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import {
  toLocalDateString, toLocalTimeString, startOfWeekMonday, addDays,
  isPastSlot, formatBR, formatBRShort, DAY_NAMES_PT,
} from "@/lib/datetime";

interface PsychologistInfo {
  user_id: string;
  nome_completo: string | null;
  crp: string;
  trajetoria_profissional: string | null;
  especializacoes: string[] | null;
}

interface AppointmentRow {
  id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  patient_id: string;
  status: string;
}

interface AvailabilityRow {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 7); // 7h..18h

type SlotStatus = "free" | "busy" | "unavailable" | "past" | "mine";

const FindPsychologists = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [psychologists, setPsychologists] = useState<PsychologistInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedPsych, setSelectedPsych] = useState<PsychologistInfo | null>(null);
  const [weekStart, setWeekStart] = useState(() => startOfWeekMonday(new Date()));
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [availability, setAvailability] = useState<AvailabilityRow[]>([]);
  const [booking, setBooking] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ date: Date; hour: number } | null>(null);

  // ---------- fetch ----------
  const fetchPsychologists = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("psychologist_directory")
        .select("user_id, nome_completo, crp, trajetoria_profissional, especializacoes");
      if (error) throw error;
      setPsychologists((data as PsychologistInfo[]) || []);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar psicólogos");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCalendarData = useCallback(async (psychId: string) => {
    const [apptsRes, availRes] = await Promise.all([
      supabase
        .from("appointments")
        .select("id, appointment_date, start_time, end_time, patient_id, status")
        .eq("psychologist_id", psychId)
        .in("status", ["agendado", "confirmado"]),
      supabase
        .from("availability_slots")
        .select("day_of_week, start_time, end_time, is_available")
        .eq("psychologist_id", psychId)
        .eq("is_available", true),
    ]);
    if (apptsRes.error) console.error(apptsRes.error);
    if (availRes.error) console.error(availRes.error);
    setAppointments((apptsRes.data as AppointmentRow[]) || []);
    setAvailability((availRes.data as AvailabilityRow[]) || []);
  }, []);

  useEffect(() => {
    fetchPsychologists();
  }, [fetchPsychologists]);

  // ---------- realtime: appointments deste psicólogo ----------
  useEffect(() => {
    if (!selectedPsych) return;
    const channel = supabase
      .channel(`appts-${selectedPsych.user_id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments", filter: `psychologist_id=eq.${selectedPsych.user_id}` },
        () => fetchCalendarData(selectedPsych.user_id),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedPsych, fetchCalendarData]);

  // ---------- helpers ----------
  const openCalendar = async (psych: PsychologistInfo) => {
    setSelectedPsych(psych);
    setCalendarOpen(true);
    setSelectedSlot(null);
    setWeekStart(startOfWeekMonday(new Date()));
    await fetchCalendarData(psych.user_id);
  };

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const changeWeek = (delta: number) => setWeekStart((prev) => addDays(prev, delta * 7));

  const getSlotStatus = (date: Date, hour: number): SlotStatus => {
    if (isPastSlot(date, hour)) return "past";

    const dow = date.getDay();
    const timeStr = toLocalTimeString(hour);
    const timeEndStr = toLocalTimeString(hour + 1);

    // 1) precisa estar dentro de uma faixa de availability
    const inAvailability = availability.some(
      (a) => a.day_of_week === dow && a.start_time <= timeStr && a.end_time >= timeEndStr,
    );
    if (!inAvailability) return "unavailable";

    // 2) verifica overlap com qualquer appointment
    const dateStr = toLocalDateString(date);
    const conflict = appointments.find(
      (a) => a.appointment_date === dateStr && a.start_time < timeEndStr && a.end_time > timeStr,
    );
    if (conflict) {
      return conflict.patient_id === user?.id ? "mine" : "busy";
    }
    return "free";
  };

  const handleSlotClick = (date: Date, hour: number) => {
    const status = getSlotStatus(date, hour);
    if (status !== "free") return;
    if (
      selectedSlot &&
      toLocalDateString(selectedSlot.date) === toLocalDateString(date) &&
      selectedSlot.hour === hour
    ) {
      setSelectedSlot(null);
      return;
    }
    setSelectedSlot({ date, hour });
  };

  const handleConfirmBooking = async () => {
    if (!user || !selectedPsych || !selectedSlot) return;
    setBooking(true);
    try {
      // Vincula paciente <-> psicólogo (idempotente).
      const { data: existing } = await supabase
        .from("psychologist_patients")
        .select("id")
        .eq("psychologist_id", selectedPsych.user_id)
        .eq("patient_id", user.id)
        .maybeSingle();
      if (!existing) {
        await supabase.from("psychologist_patients").insert({
          psychologist_id: selectedPsych.user_id,
          patient_id: user.id,
        });
      }

      const dateStr = toLocalDateString(selectedSlot.date);
      const startStr = toLocalTimeString(selectedSlot.hour);
      const endStr = toLocalTimeString(selectedSlot.hour + 1);

      const { error } = await supabase.from("appointments").insert({
        psychologist_id: selectedPsych.user_id,
        patient_id: user.id,
        appointment_date: dateStr,
        start_time: startStr,
        end_time: endStr,
      });
      if (error) {
        // 23P01 = exclusion_violation (slot já tomado por outro)
        if (error.code === "23P01") {
          toast.error("Este horário acabou de ser ocupado por outro paciente");
        } else {
          toast.error(error.message || "Erro ao agendar");
        }
        await fetchCalendarData(selectedPsych.user_id);
        return;
      }

      toast.success(`Consulta agendada para ${formatBR(selectedSlot.date)} às ${selectedSlot.hour}:00`);
      setSelectedSlot(null);
      // realtime já atualiza, mas garantimos
      await fetchCalendarData(selectedPsych.user_id);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao agendar");
    } finally {
      setBooking(false);
    }
  };

  const handleCancelMine = async (date: Date, hour: number) => {
    if (!user || !selectedPsych) return;
    const dateStr = toLocalDateString(date);
    const startStr = toLocalTimeString(hour);
    const mine = appointments.find(
      (a) =>
        a.appointment_date === dateStr &&
        a.start_time === startStr &&
        a.patient_id === user.id,
    );
    if (!mine) return;
    if (!confirm("Deseja cancelar este agendamento?")) return;
    const { error } = await supabase
      .from("appointments")
      .update({ status: "cancelado" })
      .eq("id", mine.id);
    if (error) {
      toast.error("Erro ao cancelar");
      return;
    }
    toast.success("Agendamento cancelado");
    await fetchCalendarData(selectedPsych.user_id);
  };

  // ---------- render ----------
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto flex items-center gap-3 py-4 px-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/paciente")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
            <Brain className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">Psicólogos</h2>
            <p className="text-xs text-muted-foreground">Profissionais disponíveis</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-4 md:p-8">
        <div className="mb-6 animate-fade-in">
          <h1 className="text-2xl font-bold text-foreground">Psicólogos Cadastrados</h1>
          <p className="text-muted-foreground mt-1">Escolha um profissional e agende sua consulta</p>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground animate-pulse">Carregando...</div>
        ) : psychologists.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <User className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg">Nenhum psicólogo cadastrado ainda</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-slide-up">
            {psychologists.map((psych) => (
              <Card
                key={psych.user_id}
                className="shadow-card border-0 hover:shadow-elevated transition-all duration-200"
              >
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center">
                      <User className="w-6 h-6 text-accent-foreground" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground text-lg">
                        {psych.nome_completo || "Profissional"}
                      </h3>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Award className="w-3.5 h-3.5" />
                        <span>CRP: {psych.crp}</span>
                      </div>
                    </div>
                  </div>

                  {psych.especializacoes && psych.especializacoes.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Especializações</p>
                      <div className="flex flex-wrap gap-1.5">
                        {psych.especializacoes.map((esp, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">{esp}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {psych.trajetoria_profissional && (
                    <div className="mb-4">
                      <div className="flex items-center gap-1 mb-1">
                        <Briefcase className="w-3.5 h-3.5 text-muted-foreground" />
                        <p className="text-xs font-medium text-muted-foreground">Trajetória Profissional</p>
                      </div>
                      <p className="text-sm text-foreground line-clamp-3">{psych.trajetoria_profissional}</p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button className="flex-1" onClick={() => openCalendar(psych)}>
                      <Calendar className="w-4 h-4 mr-2" />
                      Agendar
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => navigate(`/chat/${psych.user_id}`)}
                    >
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Mensagem
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <Dialog open={calendarOpen} onOpenChange={setCalendarOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Agenda — {selectedPsych?.nome_completo || "Profissional"}
            </DialogTitle>
          </DialogHeader>

          <div className="flex items-center justify-between mb-4">
            <Button variant="outline" size="sm" onClick={() => changeWeek(-1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="font-medium text-foreground">
              {formatBRShort(weekDays[0])} — {formatBRShort(weekDays[6])}
            </span>
            <Button variant="outline" size="sm" onClick={() => changeWeek(1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex flex-wrap gap-3 mb-3 text-xs">
            <Legend color="bg-yellow-400/80 border-yellow-500" label="Livre" />
            <Legend color="bg-red-400/80 border-red-500" label="Ocupado" />
            <Legend color="bg-emerald-400/80 border-emerald-500" label="Meu agendamento" />
            <Legend color="bg-muted border-border" label="Indisponível / passado" />
          </div>

          {availability.length === 0 && (
            <div className="mb-3 p-3 rounded-lg border border-amber-500/40 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200 text-sm">
              Este profissional ainda não cadastrou horários disponíveis.
            </div>
          )}

          <div className="overflow-x-auto">
            <div className="min-w-[600px]">
              <div className="grid grid-cols-8 gap-px bg-border rounded-t-lg overflow-hidden">
                <div className="bg-card p-2 text-xs font-medium text-muted-foreground text-center">Hora</div>
                {weekDays.map((day, i) => (
                  <div key={i} className="bg-card p-2 text-center">
                    <p className="text-xs font-semibold text-foreground">{DAY_NAMES_PT[day.getDay()]}</p>
                    <p className="text-xs text-muted-foreground">{formatBRShort(day)}</p>
                  </div>
                ))}
              </div>

              {HOURS.map((hour) => (
                <div key={hour} className="grid grid-cols-8 gap-px bg-border">
                  <div className="bg-card p-2 text-xs text-muted-foreground text-center font-mono">
                    {String(hour).padStart(2, "0")}:00
                  </div>
                  {weekDays.map((day, i) => {
                    const status = getSlotStatus(day, hour);
                    const isSelected =
                      selectedSlot &&
                      toLocalDateString(selectedSlot.date) === toLocalDateString(day) &&
                      selectedSlot.hour === hour;

                    const click =
                      status === "free"
                        ? () => handleSlotClick(day, hour)
                        : status === "mine"
                        ? () => handleCancelMine(day, hour)
                        : undefined;

                    const cls =
                      isSelected
                        ? "bg-primary/30 ring-2 ring-primary cursor-pointer"
                        : status === "free"
                        ? "bg-yellow-400/30 hover:bg-yellow-400/60 cursor-pointer"
                        : status === "busy"
                        ? "bg-red-400/30 cursor-not-allowed"
                        : status === "mine"
                        ? "bg-emerald-400/40 hover:bg-emerald-400/60 cursor-pointer"
                        : "bg-muted/40 cursor-default";

                    return (
                      <button
                        key={i}
                        type="button"
                        disabled={status === "busy" || status === "past" || status === "unavailable"}
                        onClick={click}
                        className={`p-2 text-xs text-center transition-colors ${cls}`}
                        title={
                          status === "mine"
                            ? "Clique para cancelar"
                            : status === "free"
                            ? "Clique para selecionar"
                            : status === "busy"
                            ? "Horário ocupado"
                            : status === "past"
                            ? "Horário passado"
                            : "Indisponível"
                        }
                      >
                        {isSelected && <span className="text-primary font-semibold">✓ Selecionado</span>}
                        {!isSelected && status === "free" && (
                          <span className="text-yellow-700 dark:text-yellow-300 font-medium">Livre</span>
                        )}
                        {status === "busy" && (
                          <span className="text-red-700 dark:text-red-300 font-medium">Ocupado</span>
                        )}
                        {status === "mine" && (
                          <span className="text-emerald-700 dark:text-emerald-300 font-medium">Você</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {selectedSlot && (
            <div className="mt-4 p-4 rounded-lg border bg-accent/50">
              <p className="text-sm text-foreground mb-3">
                Confirma o horário com <strong>{selectedPsych?.nome_completo}</strong> em{" "}
                <strong>{formatBR(selectedSlot.date)}</strong> às{" "}
                <strong>{selectedSlot.hour}:00</strong>?
              </p>
              <div className="flex gap-3">
                <Button onClick={handleConfirmBooking} disabled={booking}>
                  {booking ? "Agendando..." : "Sim, confirmar"}
                </Button>
                <Button variant="outline" onClick={() => setSelectedSlot(null)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const Legend = ({ color, label }: { color: string; label: string }) => (
  <div className="flex items-center gap-1.5">
    <div className={`w-4 h-4 rounded border ${color}`} />
    <span className="text-muted-foreground">{label}</span>
  </div>
);

export default FindPsychologists;
