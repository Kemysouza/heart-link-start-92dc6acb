import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useSearchParams } from "react-router-dom";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Brain, ArrowLeft, User, Award, Briefcase, Calendar, ChevronLeft, ChevronRight, MessageSquare, CheckCircle2, Check } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface PsychologistInfo {
  user_id: string;
  nome_completo: string | null;
  trajetoria_profissional: string | null;
  especializacoes: string[] | null;
}


interface Appointment {
  appointment_date: string;
  start_time: string;
  end_time: string;
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 7); // 7h - 18h
const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const FindPsychologists = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [psychologists, setPsychologists] = useState<PsychologistInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(new Set());
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  // Calendar state
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedPsych, setSelectedPsych] = useState<PsychologistInfo | null>(null);
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [booking, setBooking] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ date: Date; hour: number } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [viewOnly, setViewOnly] = useState(false);

  useEffect(() => {
    fetchPsychologists();
    fetchConfirmed();
  }, [user]);

  // Auto-open calendar when navigated with ?open=<psych_id>&date=YYYY-MM-DD
  useEffect(() => {
    const openId = searchParams.get("open");
    const dateStr = searchParams.get("date");
    if (!openId || loading || psychologists.length === 0) return;
    const psych = psychologists.find((p) => p.user_id === openId);
    if (psych) {
      if (dateStr) {
        const [y, m, d] = dateStr.split("-").map(Number);
        const target = new Date(y, (m || 1) - 1, d || 1);
        target.setHours(0, 0, 0, 0);
        setWeekStart(target);
        setViewOnly(true);
      } else {
        setViewOnly(false);
      }
      openCalendar(psych);
      searchParams.delete("open");
      searchParams.delete("date");
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, psychologists, searchParams]);


  const fetchConfirmed = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("psychologist_patients")
      .select("psychologist_id")
      .eq("patient_id", user.id);
    setConfirmedIds(new Set((data || []).map((d: { psychologist_id: string }) => d.psychologist_id)));
  };

  const handleConfirmProfessional = async (psychId: string) => {
    if (!user) return;
    setConfirmingId(psychId);
    try {
      const { error } = await supabase
        .from("psychologist_patients")
        .insert({ psychologist_id: psychId, patient_id: user.id });
      if (error && !error.message.includes("duplicate")) throw error;
      setConfirmedIds((prev) => new Set(prev).add(psychId));
      toast({ title: "Profissional confirmado!", description: "Agora você pode agendar consultas e enviar mensagens." });
    } catch (e) {
      console.error(e);
      toast({ title: "Erro ao confirmar profissional", variant: "destructive" });
    } finally {
      setConfirmingId(null);
    }
  };

  const fetchPsychologists = async () => {
    try {
      const { data: psychProfiles, error: psychError } = await supabase
        .rpc("get_psychologist_directory");
      if (psychError) throw psychError;
      if (!psychProfiles || psychProfiles.length === 0) {
        setPsychologists([]);
        setLoading(false);
        return;
      }
      const userIds = psychProfiles.map((p: any) => p.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, nome_completo")
        .in("user_id", userIds);
      const profileMap = new Map(profiles?.map((p) => [p.user_id, p.nome_completo]) || []);
      setPsychologists(
        psychProfiles.map((pp: any) => ({
          user_id: pp.user_id,
          nome_completo: profileMap.get(pp.user_id) || null,
          trajetoria_profissional: pp.trajetoria_profissional,
          especializacoes: pp.especializacoes,
        }))
      );
    } catch {
      toast({ title: "Erro ao carregar psicólogos", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };


  const openCalendar = async (psych: PsychologistInfo) => {
    setSelectedPsych(psych);
    setCalendarOpen(true);
    await fetchCalendarData(psych.user_id);
  };

  const fetchCalendarData = async (psychId: string) => {
    const { data } = await supabase.rpc("get_psychologist_busy_slots", {
      p_psych_id: psychId,
    });
    setAppointments(((data as any[]) || []).map((r) => ({
      appointment_date: r.appointment_date,
      start_time: r.start_time,
      end_time: r.end_time,
    })) as Appointment[]);
  };

  const changeWeek = (delta: number) => {
    setWeekStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + delta * 7);
      return d;
    });
  };

  const getWeekDays = () => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    });
  };

  const getSlotStatus = (date: Date, hour: number): "free" | "busy" => {
    const timeStr = `${String(hour).padStart(2, "0")}:00:00`;
    const dateStr = date.toISOString().split("T")[0];

    const isBusy = appointments.some(
      (a) => a.appointment_date === dateStr && a.start_time <= timeStr && a.end_time > timeStr
    );

    return isBusy ? "busy" : "free";
  };

  const handleSlotClick = (date: Date, hour: number) => {
    const status = getSlotStatus(date, hour);
    if (status === "busy") return;

    // Toggle selection: click again to deselect
    if (selectedSlot && selectedSlot.date.toISOString() === date.toISOString() && selectedSlot.hour === hour) {
      setSelectedSlot(null);
      return;
    }
    setSelectedSlot({ date, hour });
  };

  const handleConfirmBooking = async () => {
    if (!user || !selectedPsych || !selectedSlot) return;
    setBooking(true);
    try {
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

      const dateStr = selectedSlot.date.toISOString().split("T")[0];
      const { error } = await supabase.from("appointments").insert({
        psychologist_id: selectedPsych.user_id,
        patient_id: user.id,
        appointment_date: dateStr,
        start_time: `${String(selectedSlot.hour).padStart(2, "0")}:00:00`,
        end_time: `${String(selectedSlot.hour + 1).padStart(2, "0")}:00:00`,
      });

      if (error) throw error;

      toast({ title: "Consulta agendada!", description: `${formatDateFull(selectedSlot.date)} às ${selectedSlot.hour}:00` });
      setSelectedSlot(null);
      setConfirmOpen(false);
      await fetchCalendarData(selectedPsych.user_id);
    } catch (err: any) {
      console.error(err);
      const msg = String(err?.message || "");
      if (msg.includes("Conflito de agenda")) {
        toast({
          title: "Horário indisponível",
          description: "O profissional já possui um atendimento neste horário. Escolha outro horário.",
          variant: "destructive",
        });
      } else {
        toast({ title: "Erro ao agendar", variant: "destructive" });
      }
    } finally {
      setBooking(false);
    }
  };

  const weekDays = getWeekDays();
  const formatDate = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}`;
  const formatDateFull = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto flex items-center justify-between py-4 px-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/paciente")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
                <Brain className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground">Encontrar Psicólogos</h2>
                <p className="text-xs text-muted-foreground">Profissionais disponíveis</p>
              </div>
            </div>
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
              <Card key={psych.user_id} className="shadow-card border-0 hover:shadow-elevated transition-all duration-200">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center">
                      <User className="w-6 h-6 text-accent-foreground" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground text-lg">{psych.nome_completo || "Profissional"}</h3>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Award className="w-3.5 h-3.5" />
                        <span>Profissional verificado</span>
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

                  {confirmedIds.has(psych.user_id) ? (
                    <>
                      <div className="w-full mb-3 rounded-md px-3 py-2 flex items-center justify-center gap-2 bg-green-500 text-white font-semibold shadow-[0_0_18px_rgba(34,197,94,0.65)] animate-fade-in">
                        <CheckCircle2 className="w-4 h-4" />
                        Confirmado
                      </div>
                      <div className="flex gap-2">
                        <Button className="flex-1" onClick={() => { setViewOnly(false); openCalendar(psych); }}>
                          <Calendar className="w-4 h-4 mr-2" />
                          Agendar Consulta
                        </Button>
                        <Button variant="outline" className="flex-1" onClick={() => navigate(`/chat/${psych.user_id}`)}>
                          <MessageSquare className="w-4 h-4 mr-2" />
                          Mensagem
                        </Button>
                      </div>
                    </>
                  ) : (
                    <Button
                      className="w-full gradient-primary text-primary-foreground"
                      onClick={() => handleConfirmProfessional(psych.user_id)}
                      disabled={confirmingId === psych.user_id}
                    >
                      <Check className="w-4 h-4 mr-2" />
                      {confirmingId === psych.user_id ? "Confirmando..." : "Confirmar este profissional"}
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Calendar Dialog */}
      <Dialog open={calendarOpen} onOpenChange={setCalendarOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Agenda — {selectedPsych?.nome_completo || "Profissional"}
            </DialogTitle>
          </DialogHeader>

          {/* Week navigation */}
          <div className="flex items-center justify-between mb-4">
            <Button variant="outline" size="sm" onClick={() => changeWeek(-1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="font-medium text-foreground">
              {formatDate(weekDays[0])} — {formatDate(weekDays[6])}
            </span>
            <Button variant="outline" size="sm" onClick={() => changeWeek(1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Legend */}
          {!viewOnly && (
            <div className="flex gap-4 mb-3 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded bg-yellow-400/80 border border-yellow-500" />
                <span className="text-muted-foreground">Disponível</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded bg-red-400/80 border border-red-500" />
                <span className="text-muted-foreground">Ocupado</span>
              </div>
            </div>
          )}

          {/* Calendar grid */}
          <div className="overflow-x-auto">
            <div className="min-w-[600px]">
              {/* Header row */}
              <div className="grid grid-cols-8 gap-px bg-border rounded-t-lg overflow-hidden">
                <div className="bg-card p-2 text-xs font-medium text-muted-foreground text-center">Hora</div>
                {weekDays.map((day, i) => (
                  <div key={i} className="bg-card p-2 text-center">
                    <p className="text-xs font-semibold text-foreground">{DAY_NAMES[day.getDay()]}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(day)}</p>
                  </div>
                ))}
              </div>

              {/* Time rows */}
              {HOURS.map((hour) => (
                <div key={hour} className="grid grid-cols-8 gap-px bg-border">
                  <div className="bg-card p-2 text-xs text-muted-foreground text-center font-mono">
                    {String(hour).padStart(2, "0")}:00
                  </div>
                  {weekDays.map((day, i) => {
                    const status = getSlotStatus(day, hour);
                    const isPast = day < new Date() && !(day.toDateString() === new Date().toDateString() && hour >= new Date().getHours());

                    const isSelected = selectedSlot && selectedSlot.date.toISOString() === day.toISOString() && selectedSlot.hour === hour;

                    return (
                      <button
                        key={i}
                        disabled={viewOnly || status === "busy" || isPast}
                        onClick={() => !viewOnly && handleSlotClick(day, hour)}
                        className={`p-2 text-xs text-center transition-colors ${
                          isSelected
                            ? "bg-primary/30 ring-2 ring-primary cursor-pointer"
                            : status === "free" && !isPast
                            ? "bg-yellow-400/30 hover:bg-yellow-400/60 cursor-pointer"
                            : status === "busy"
                            ? "bg-red-400/30 cursor-not-allowed"
                            : "bg-card cursor-default"
                        }`}
                      >
                        {isSelected && (
                          <span className="text-primary font-semibold">✓ Selecionado</span>
                        )}
                        {!isSelected && status === "free" && !isPast && (
                          <span className="text-yellow-700 dark:text-yellow-300 font-medium">Livre</span>
                        )}
                        {status === "busy" && (
                          <span className="text-red-700 dark:text-red-300 font-medium">Ocupado</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Confirmation bar */}
          {selectedSlot && (
            <div className="mt-4 p-4 rounded-lg border bg-accent/50">
              <p className="text-sm text-foreground mb-3">
                Você confirma este horário com o profissional <strong>{selectedPsych?.nome_completo}</strong> no dia{" "}
                <strong>{formatDateFull(selectedSlot.date)}</strong> às <strong>{selectedSlot.hour}:00</strong>?
              </p>
              <div className="flex gap-3">
                <Button onClick={handleConfirmBooking} disabled={booking}>
                  {booking ? "Agendando..." : "Sim, confirmar"}
                </Button>
                <Button variant="outline" onClick={() => setSelectedSlot(null)}>
                  Não, cancelar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FindPsychologists;
