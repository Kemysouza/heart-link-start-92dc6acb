import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Pencil, Save, X, User, Briefcase, Award, Mail, Phone, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const ESPECIALIDADES = [
  "Depressão",
  "Ansiedade",
  "Luto",
  "Transtornos Alimentares",
  "Terapia de Casal",
  "Psicologia Infantil",
  "TDAH",
  "Trauma e TEPT",
  "Dependência Química",
  "Autoestima",
  "Estresse",
  "Fobias",
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function AvatarIniciais({ nome, className }: { nome: string; className?: string }) {
  const iniciais = nome
    .split(" ")
    .filter((w) => w.length > 0)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div
      className={cn(
        "rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-bold select-none",
        className
      )}
    >
      {iniciais || <User className="w-1/2 h-1/2" />}
    </div>
  );
}

export const PsychologistProfileDialog = ({ open, onOpenChange }: Props) => {
  const { user, profile, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<"dados" | "profissional">("dados");

  const [nomeCompleto, setNomeCompleto] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [crp, setCrp] = useState("");
  const [trajetoria, setTrajetoria] = useState("");
  const [especialidades, setEspecialidades] = useState<string[]>([]);

  useEffect(() => {
    if (!open || !user) return;
    const load = async () => {
      setLoading(true);
      try {
        const { data: psych } = await supabase
          .from("psychologist_profiles")
          .select("crp, trajetoria_profissional, especializacoes")
          .eq("user_id", user.id)
          .maybeSingle();

        setNomeCompleto(profile?.nome_completo || "");
        setTelefone(profile?.telefone || "");
        setEmail(profile?.email || user.email || "");
        setCrp(psych?.crp || "");
        setTrajetoria(psych?.trajetoria_profissional || "");
        setEspecialidades(psych?.especializacoes || []);
      } catch {
        toast.error("Erro ao carregar perfil");
      } finally {
        setLoading(false);
      }
    };
    load();
    setEditing(false);
    setTab("dados");
  }, [open, user, profile]);

  const toggleEspecialidade = (esp: string) => {
    if (!editing) return;
    setEspecialidades((prev) =>
      prev.includes(esp) ? prev.filter((e) => e !== esp) : [...prev, esp]
    );
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ nome_completo: nomeCompleto, telefone })
        .eq("user_id", user.id);
      if (profileError) throw profileError;

      const { error: psychError } = await supabase
        .from("psychologist_profiles")
        .update({
          crp,
          trajetoria_profissional: trajetoria,
          especializacoes: especialidades,
        })
        .eq("user_id", user.id);
      if (psychError) throw psychError;

      await refreshProfile();
      toast.success("Perfil atualizado com sucesso!");
      setEditing(false);
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar perfil");
    } finally {
      setSaving(false);
    }
  };

  const InfoRow = ({
    icon: Icon,
    label,
    value,
    placeholder,
  }: {
    icon: React.ElementType;
    label: string;
    value: React.ReactNode;
    placeholder?: string;
  }) => (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-secondary/40 border border-border/60">
      <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-accent-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground truncate">
          {value || placeholder || "—"}
        </p>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[92vh] overflow-y-auto p-0 gap-0">
        {/* Header visual */}
        <div className="relative">
          <div className="h-28 gradient-primary rounded-t-lg" />
          <div className="absolute -bottom-10 left-1/2 -translate-x-1/2">
            <AvatarIniciais nome={nomeCompleto} className="w-20 h-20 text-xl shadow-elevated border-4 border-card" />
          </div>
        </div>

        <div className="pt-12 pb-2 text-center px-6">
          <DialogTitle className="text-xl">{nomeCompleto || "Profissional"}</DialogTitle>
          <DialogDescription className="text-xs mt-1">
            {editing ? "Edite suas informações e clique em salvar" : "Visualize e edite as informações cadastradas"}
          </DialogDescription>
          {crp && (
            <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full bg-accent text-accent-foreground text-xs font-medium">
              <Award className="w-3 h-3" />
              CRP: {crp}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="px-6 mt-2">
          <div className="flex gap-1 p-1 rounded-lg bg-muted">
            {(["dados", "profissional"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "flex-1 text-xs font-medium py-1.5 rounded-md transition-all",
                  tab === t
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t === "dados" ? "Dados Pessoais" : "Profissional"}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          {loading ? (
            <div className="py-12 text-center text-muted-foreground">Carregando...</div>
          ) : (
            <>
              {tab === "dados" && (
                <div className="space-y-4">
                  {editing ? (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Nome Completo</Label>
                        <Input
                          value={nomeCompleto}
                          onChange={(e) => setNomeCompleto(e.target.value)}
                        />
                      </div>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Telefone</Label>
                          <Input
                            value={telefone}
                            onChange={(e) => setTelefone(e.target.value)}
                            placeholder="(11) 99999-9999"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>E-mail</Label>
                          <Input value={email} disabled />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      <InfoRow icon={User} label="Nome Completo" value={nomeCompleto} placeholder="Nome não informado" />
                      <InfoRow icon={Phone} label="Telefone" value={telefone} placeholder="Telefone não informado" />
                      <InfoRow icon={Mail} label="E-mail" value={email} />
                    </div>
                  )}
                </div>
              )}

              {tab === "profissional" && (
                <div className="space-y-4">
                  {editing ? (
                    <>
                      <div className="space-y-2">
                        <Label>CRP</Label>
                        <Input
                          value={crp}
                          onChange={(e) => setCrp(e.target.value)}
                          placeholder="Ex: 06/123456"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Trajetória Profissional</Label>
                        <Textarea
                          value={trajetoria}
                          onChange={(e) => setTrajetoria(e.target.value)}
                          rows={5}
                          placeholder="Conte sobre sua formação, experiência e abordagem terapêutica..."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Especializações</Label>
                        <div className="grid grid-cols-2 gap-2">
                          {ESPECIALIDADES.map((esp) => {
                            const selected = especialidades.includes(esp);
                            return (
                              <label
                                key={esp}
                                className={cn(
                                  "flex items-center gap-2 p-2.5 rounded-lg border-2 transition-all duration-200",
                                  "cursor-pointer",
                                  selected
                                    ? "border-primary bg-accent"
                                    : "border-border hover:border-primary/50"
                                )}
                              >
                                <Checkbox
                                  checked={selected}
                                  onCheckedChange={() => toggleEspecialidade(esp)}
                                />
                                <span className="text-sm font-medium">{esp}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-start gap-3 p-3 rounded-xl bg-secondary/40 border border-border/60">
                        <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center shrink-0">
                          <Award className="w-4 h-4 text-accent-foreground" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">CRP</p>
                          <p className="text-sm font-medium text-foreground">{crp || "—"}</p>
                        </div>
                      </div>

                      <div className="p-4 rounded-xl bg-secondary/40 border border-border/60">
                        <div className="flex items-center gap-2 mb-2">
                          <Briefcase className="w-4 h-4 text-muted-foreground" />
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Trajetória Profissional</p>
                        </div>
                        <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
                          {trajetoria || "Nenhuma trajetória cadastrada."}
                        </p>
                      </div>

                      <div className="p-4 rounded-xl bg-secondary/40 border border-border/60">
                        <div className="flex items-center gap-2 mb-3">
                          <Sparkles className="w-4 h-4 text-muted-foreground" />
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Especializações</p>
                        </div>
                        {especialidades.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Nenhuma especialização selecionada.</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {especialidades.map((esp) => (
                              <span
                                key={esp}
                                className="px-3 py-1.5 rounded-full bg-accent text-accent-foreground text-xs font-medium border border-primary/20"
                              >
                                {esp}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-card/50 rounded-b-lg flex justify-end gap-2">
          {!editing ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
              <Button
                onClick={() => setEditing(true)}
                className="gradient-primary text-primary-foreground"
                disabled={loading}
              >
                <Pencil className="w-4 h-4 mr-2" /> Editar perfil
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setEditing(false)} disabled={saving}>
                <X className="w-4 h-4 mr-2" /> Cancelar
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="gradient-primary text-primary-foreground"
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? "Salvando..." : "Salvar alterações"}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
