import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Brain, ArrowRight, ArrowLeft } from "lucide-react";

const ESPECIALIDADES = [
  "Depressão", "Ansiedade", "Luto", "Transtornos Alimentares",
  "Terapia de Casal", "Psicologia Infantil", "TDAH", "Trauma e TEPT",
  "Dependência Química", "Autoestima", "Estresse", "Fobias",
];

const CRP_REGEX = /^\d{2}\/\d{4,6}$/;

const PsychologistOnboarding = () => {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  const [nomeCompleto, setNomeCompleto] = useState("");
  const [telefone, setTelefone] = useState("");
  const [crp, setCrp] = useState("");
  const [trajetoria, setTrajetoria] = useState("");
  const [especialidades, setEspecialidades] = useState<string[]>([]);

  const toggleEspecialidade = (esp: string) => {
    setEspecialidades((prev) =>
      prev.includes(esp) ? prev.filter((e) => e !== esp) : [...prev, esp],
    );
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (!CRP_REGEX.test(crp)) {
      toast.error("CRP inválido. Use o formato XX/NNNNNN, ex: 06/123456");
      setStep(1);
      return;
    }
    setIsLoading(true);
    try {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ nome_completo: nomeCompleto, telefone, onboarding_completed: true })
        .eq("user_id", user.id);
      if (profileError) throw profileError;

      const { error: psychError } = await supabase
        .from("psychologist_profiles")
        .upsert(
          {
            user_id: user.id,
            crp,
            trajetoria_profissional: trajetoria,
            especializacoes: especialidades,
          },
          { onConflict: "user_id" },
        );
      if (psychError) throw psychError;

      await refreshProfile();
      toast.success("Cadastro concluído!");
      navigate("/dashboard/psicologo");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Erro ao salvar dados";
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center gradient-soft p-4">
      <div className="w-full max-w-lg animate-fade-in">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl gradient-primary mb-3">
            <Brain className="w-6 h-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Cadastro Profissional</h1>
          <div className="flex justify-center gap-2 mt-4">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-2 rounded-full transition-all duration-300 ${
                  s <= step ? "w-12 gradient-primary" : "w-8 bg-muted"
                }`}
              />
            ))}
          </div>
        </div>

        <Card className="shadow-elevated border-0">
          <CardHeader>
            <CardTitle>
              {step === 1 && "Dados Pessoais"}
              {step === 2 && "Informações Profissionais"}
              {step === 3 && "Especializações"}
            </CardTitle>
            <CardDescription>
              {step === 1 && "Preencha seus dados básicos"}
              {step === 2 && "Conte-nos sobre sua trajetória"}
              {step === 3 && "Selecione suas áreas de atuação"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {step === 1 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome Completo</Label>
                  <Input value={nomeCompleto} onChange={(e) => setNomeCompleto(e.target.value)} placeholder="Dr(a). Nome Sobrenome" />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(11) 99999-9999" inputMode="tel" />
                </div>
                <div className="space-y-2">
                  <Label>CRP</Label>
                  <Input value={crp} onChange={(e) => setCrp(e.target.value)} placeholder="06/123456" />
                  <p className="text-xs text-muted-foreground">Formato: UF/Nº — ex: 06/123456</p>
                </div>
                <Button
                  onClick={() => {
                    if (!CRP_REGEX.test(crp)) {
                      toast.error("CRP inválido. Use o formato XX/NNNNNN");
                      return;
                    }
                    setStep(2);
                  }}
                  className="w-full gradient-primary text-primary-foreground"
                  disabled={!nomeCompleto.trim() || !crp}
                >
                  Próximo <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Trajetória Profissional</Label>
                  <Textarea
                    value={trajetoria}
                    onChange={(e) => setTrajetoria(e.target.value)}
                    placeholder="Conte sobre sua formação, experiência e abordagem terapêutica..."
                    rows={6}
                    maxLength={2000}
                  />
                  <p className="text-xs text-muted-foreground">{trajetoria.length}/2000</p>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                    <ArrowLeft className="mr-2 w-4 h-4" /> Voltar
                  </Button>
                  <Button onClick={() => setStep(3)} className="flex-1 gradient-primary text-primary-foreground">
                    Próximo <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {ESPECIALIDADES.map((esp) => (
                    <label
                      key={esp}
                      className={`flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
                        especialidades.includes(esp)
                          ? "border-primary bg-accent"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <Checkbox
                        checked={especialidades.includes(esp)}
                        onCheckedChange={() => toggleEspecialidade(esp)}
                      />
                      <span className="text-sm font-medium">{esp}</span>
                    </label>
                  ))}
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                    <ArrowLeft className="mr-2 w-4 h-4" /> Voltar
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    className="flex-1 gradient-primary text-primary-foreground"
                    disabled={isLoading || especialidades.length === 0}
                  >
                    {isLoading ? "Salvando..." : "Concluir Cadastro"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PsychologistOnboarding;
