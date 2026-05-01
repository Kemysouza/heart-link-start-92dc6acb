import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Brain, ArrowLeft, Users, Download, Eye, StickyNote } from "lucide-react";
import { toast } from "sonner";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import { saveAs } from "file-saver";
import { formatBR, toLocalDateString } from "@/lib/datetime";

type ConsultationStatus = "em_andamento" | "finalizado" | "cancelado";
type PaymentStatus = "pendente" | "pago" | "nao_pago";

interface PatientData {
  user_id: string;
  nome_completo: string | null;
  data_nascimento: string | null;
  genero: string | null;
  estado_civil: string | null;
  profissao: string | null;
  queixa_principal: string | null;
  historico_familiar: string | null;
  medicamentos: string | null;
  tratamentos_anteriores: string | null;
  expectativas: string | null;
}

interface ConsultationData {
  id: string;
  patient_id: string;
  notes: string | null;
  status: ConsultationStatus;
  payment: PaymentStatus;
}

interface NextAppointment {
  patient_id: string;
  appointment_date: string;
  start_time: string;
}

interface ConsultationUpdate {
  notes?: string | null;
  status?: ConsultationStatus;
  payment?: PaymentStatus;
}

const PsychologistPatients = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [patients, setPatients] = useState<PatientData[]>([]);
  const [consultations, setConsultations] = useState<ConsultationData[]>([]);
  const [nextApptByPatient, setNextApptByPatient] = useState<Map<string, NextAppointment>>(new Map());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [selectedPatient, setSelectedPatient] = useState<PatientData | null>(null);
  const [notesPatientId, setNotesPatientId] = useState<string | null>(null);
  const [newNote, setNewNote] = useState("");
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [fichaDialogOpen, setFichaDialogOpen] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data: links, error: linksErr } = await supabase
      .from("psychologist_patients")
      .select("patient_id")
      .eq("psychologist_id", user.id);

    if (linksErr) {
      toast.error(linksErr.message || "Erro ao listar pacientes");
      setLoading(false);
      return;
    }

    if (!links || links.length === 0) {
      setPatients([]);
      setConsultations([]);
      setNextApptByPatient(new Map());
      setLoading(false);
      return;
    }

    const patientIds = links.map((l) => l.patient_id);

    const [profilesRes, patientProfilesRes, consultsRes, apptsRes] = await Promise.all([
      supabase.from("profiles").select("user_id, nome_completo").in("user_id", patientIds),
      supabase.from("patient_profiles").select("*").in("user_id", patientIds),
      supabase.from("consultations").select("id, patient_id, notes, status, payment").eq("psychologist_id", user.id),
      supabase
        .from("appointments")
        .select("patient_id, appointment_date, start_time")
        .eq("psychologist_id", user.id)
        .gte("appointment_date", toLocalDateString(new Date()))
        .in("status", ["agendado", "confirmado"])
        .order("appointment_date")
        .order("start_time"),
    ]);

    const profiles = profilesRes.data ?? [];
    const patientProfiles = patientProfilesRes.data ?? [];
    const consults = (consultsRes.data ?? []) as ConsultationData[];
    const appts = (apptsRes.data ?? []) as NextAppointment[];

    const merged: PatientData[] = patientIds.map((pid) => {
      const prof = profiles.find((p) => p.user_id === pid);
      const pat = patientProfiles.find((p) => p.user_id === pid);
      return {
        user_id: pid,
        nome_completo: prof?.nome_completo ?? null,
        data_nascimento: pat?.data_nascimento ?? null,
        genero: pat?.genero ?? null,
        estado_civil: pat?.estado_civil ?? null,
        profissao: pat?.profissao ?? null,
        queixa_principal: pat?.queixa_principal ?? null,
        historico_familiar: pat?.historico_familiar ?? null,
        medicamentos: pat?.medicamentos ?? null,
        tratamentos_anteriores: pat?.tratamentos_anteriores ?? null,
        expectativas: pat?.expectativas ?? null,
      };
    });

    // Como a query de appts já vem ordenada, o primeiro de cada paciente é o
    // próximo agendamento.
    const nextMap = new Map<string, NextAppointment>();
    for (const a of appts) {
      if (!nextMap.has(a.patient_id)) nextMap.set(a.patient_id, a);
    }

    setPatients(merged);
    setConsultations(consults);
    setNextApptByPatient(nextMap);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchData();
    if (!user) return;
    const channel = supabase
      .channel("psych-patients-page")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments", filter: `psychologist_id=eq.${user.id}` },
        fetchData,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "psychologist_patients", filter: `psychologist_id=eq.${user.id}` },
        fetchData,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchData]);

  const getConsultation = (patientId: string) => consultations.find((c) => c.patient_id === patientId);

  const upsertConsultation = async (patientId: string, data: ConsultationUpdate, successMsg: string) => {
    if (!user) return;
    const existing = getConsultation(patientId);
    try {
      if (existing) {
        const { error } = await supabase.from("consultations").update(data).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("consultations")
          .insert({ psychologist_id: user.id, patient_id: patientId, ...data });
        if (error) throw error;
      }
      toast.success(successMsg);
      fetchData();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao salvar";
      toast.error(msg);
    }
  };

  const handleSaveNotes = async () => {
    if (!notesPatientId) return;
    await upsertConsultation(notesPatientId, { notes: newNote }, "Anotação salva");
    setNotesDialogOpen(false);
    setNewNote("");
    setNotesPatientId(null);
  };

  const downloadAnamnese = async (patient: PatientData) => {
    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "Ficha de Anamnese", bold: true })] }),
            new Paragraph({ children: [new TextRun("")] }),
            new Paragraph({ children: [new TextRun({ text: "Nome: ", bold: true }), new TextRun(patient.nome_completo || "—")] }),
            new Paragraph({ children: [new TextRun({ text: "Data de Nascimento: ", bold: true }), new TextRun(patient.data_nascimento || "—")] }),
            new Paragraph({ children: [new TextRun({ text: "Gênero: ", bold: true }), new TextRun(patient.genero || "—")] }),
            new Paragraph({ children: [new TextRun({ text: "Estado Civil: ", bold: true }), new TextRun(patient.estado_civil || "—")] }),
            new Paragraph({ children: [new TextRun({ text: "Profissão: ", bold: true }), new TextRun(patient.profissao || "—")] }),
            new Paragraph({ children: [new TextRun("")] }),
            new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "Queixa Principal", bold: true })] }),
            new Paragraph({ children: [new TextRun(patient.queixa_principal || "Não informado")] }),
            new Paragraph({ children: [new TextRun("")] }),
            new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "Histórico Familiar", bold: true })] }),
            new Paragraph({ children: [new TextRun(patient.historico_familiar || "Não informado")] }),
            new Paragraph({ children: [new TextRun("")] }),
            new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "Medicamentos", bold: true })] }),
            new Paragraph({ children: [new TextRun(patient.medicamentos || "Não informado")] }),
            new Paragraph({ children: [new TextRun("")] }),
            new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "Tratamentos Anteriores", bold: true })] }),
            new Paragraph({ children: [new TextRun(patient.tratamentos_anteriores || "Não informado")] }),
            new Paragraph({ children: [new TextRun("")] }),
            new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "Expectativas", bold: true })] }),
            new Paragraph({ children: [new TextRun(patient.expectativas || "Não informado")] }),
          ],
        },
      ],
    });

    try {
      const blob = await Packer.toBlob(doc);
      const safeName = (patient.nome_completo || "paciente").replace(/[^a-zA-Z0-9-]/g, "_");
      saveAs(blob, `anamnese-${safeName}.docx`);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao gerar arquivo");
    }
  };

  const filteredPatients = patients.filter((p) =>
    !search ? true : (p.nome_completo || "").toLowerCase().includes(search.toLowerCase()),
  );

  const formatNextAppt = (patientId: string) => {
    const a = nextApptByPatient.get(patientId);
    if (!a) return "—";
    const d = new Date(a.appointment_date + "T00:00:00");
    return `${formatBR(d)} ${a.start_time.slice(0, 5)}`;
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto flex items-center gap-3 py-4 px-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/psicologo")} aria-label="Voltar">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
            <Brain className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">MindCare</h2>
            <p className="text-xs text-muted-foreground">Pacientes</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-4 md:p-8">
        <div className="mb-6 animate-fade-in flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Users className="w-6 h-6" /> Pacientes
            </h1>
            <p className="text-muted-foreground mt-1">
              Pacientes vinculados ao seu consultório
            </p>
          </div>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome..."
            className="max-w-xs"
          />
        </div>

        <Card className="shadow-card border-0 animate-slide-up">
          <CardContent className="p-0 md:p-2">
            {loading ? (
              <p className="text-center py-8 text-muted-foreground animate-pulse">Carregando...</p>
            ) : filteredPatients.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p>{search ? "Nenhum paciente encontrado" : "Nenhum paciente vinculado ainda"}</p>
                {!search && <p className="text-sm">Pacientes aparecerão aqui após o primeiro agendamento</p>}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Nascimento</TableHead>
                      <TableHead>Anamnese</TableHead>
                      <TableHead>Histórico</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Próxima Consulta</TableHead>
                      <TableHead>Pagamento</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPatients.map((patient) => {
                      const consultation = getConsultation(patient.user_id);
                      return (
                        <TableRow key={patient.user_id}>
                          <TableCell className="font-medium">{patient.nome_completo || "—"}</TableCell>
                          <TableCell>
                            {patient.data_nascimento
                              ? formatBR(new Date(patient.data_nascimento + "T00:00:00"))
                              : "—"}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedPatient(patient);
                                  setFichaDialogOpen(true);
                                }}
                                aria-label="Ver ficha"
                              >
                                <Eye className="w-3 h-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => downloadAnamnese(patient)}
                                aria-label="Baixar Word"
                              >
                                <Download className="w-3 h-3" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setNotesPatientId(patient.user_id);
                                setNewNote(consultation?.notes || "");
                                setNotesDialogOpen(true);
                              }}
                            >
                              <StickyNote className="w-3 h-3 mr-1" />
                              {consultation?.notes ? "Editar" : "Adicionar"}
                            </Button>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={consultation?.status || "em_andamento"}
                              onValueChange={(v) =>
                                upsertConsultation(patient.user_id, { status: v as ConsultationStatus }, "Status atualizado")
                              }
                            >
                              <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="em_andamento">Em andamento</SelectItem>
                                <SelectItem value="finalizado">Finalizado</SelectItem>
                                <SelectItem value="cancelado">Cancelado</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-foreground">
                              {formatNextAppt(patient.user_id)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={consultation?.payment || "pendente"}
                              onValueChange={(v) =>
                                upsertConsultation(patient.user_id, { payment: v as PaymentStatus }, "Pagamento atualizado")
                              }
                            >
                              <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pago">Pago</SelectItem>
                                <SelectItem value="nao_pago">Não pago</SelectItem>
                                <SelectItem value="pendente">Pendente</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <Dialog open={fichaDialogOpen} onOpenChange={setFichaDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ficha de Anamnese — {selectedPatient?.nome_completo}</DialogTitle>
          </DialogHeader>
          {selectedPatient && (
            <div className="space-y-4 text-sm">
              <div><strong>Data de Nascimento:</strong> {selectedPatient.data_nascimento ? formatBR(new Date(selectedPatient.data_nascimento + "T00:00:00")) : "—"}</div>
              <div><strong>Gênero:</strong> {selectedPatient.genero || "—"}</div>
              <div><strong>Estado Civil:</strong> {selectedPatient.estado_civil || "—"}</div>
              <div><strong>Profissão:</strong> {selectedPatient.profissao || "—"}</div>
              <hr className="border-border" />
              <div><strong>Queixa Principal:</strong><p className="mt-1 text-muted-foreground whitespace-pre-wrap">{selectedPatient.queixa_principal || "Não informado"}</p></div>
              <div><strong>Histórico Familiar:</strong><p className="mt-1 text-muted-foreground whitespace-pre-wrap">{selectedPatient.historico_familiar || "Não informado"}</p></div>
              <div><strong>Medicamentos:</strong><p className="mt-1 text-muted-foreground whitespace-pre-wrap">{selectedPatient.medicamentos || "Não informado"}</p></div>
              <div><strong>Tratamentos Anteriores:</strong><p className="mt-1 text-muted-foreground whitespace-pre-wrap">{selectedPatient.tratamentos_anteriores || "Não informado"}</p></div>
              <div><strong>Expectativas:</strong><p className="mt-1 text-muted-foreground whitespace-pre-wrap">{selectedPatient.expectativas || "Não informado"}</p></div>
              <Button onClick={() => downloadAnamnese(selectedPatient)} className="w-full gradient-primary text-primary-foreground">
                <Download className="w-4 h-4 mr-2" /> Baixar como Word
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={notesDialogOpen} onOpenChange={setNotesDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anotações da Consulta</DialogTitle>
          </DialogHeader>
          <Textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Escreva suas anotações sobre a consulta..."
            rows={6}
            maxLength={5000}
          />
          <p className="text-xs text-muted-foreground text-right">{newNote.length}/5000</p>
          <Button onClick={handleSaveNotes} className="w-full gradient-primary text-primary-foreground">
            Salvar Anotação
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PsychologistPatients;
