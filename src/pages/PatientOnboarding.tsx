import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Brain, ArrowRight, ArrowLeft, LogOut } from "lucide-react";

const PatientOnboarding = () => {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  const [nomeCompleto, setNomeCompleto] = useState("");
  const [telefone, setTelefone] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [genero, setGenero] = useState("");
  const [estadoCivil, setEstadoCivil] = useState("");
  const [profissao, setProfissao] = useState("");

  const [queixaPrincipal, setQueixaPrincipal] = useState("");
  const [historicoFamiliar, setHistoricoFamiliar] = useState("");
  const [medicamentos, setMedicamentos] = useState("");
  const [tratamentosAnteriores, setTratamentosAnteriores] = useState("");
  const [expectativas, setExpectativas] = useState("");

  const handleSubmit = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ nome_completo: nomeCompleto, telefone, onboarding_completed: true })
        .eq("user_id", user.id);

      if (profileError) throw profileError;

      const { error: patientError } = await supabase
        .from("patient_profiles")
        .insert({
          user_id: user.id,
          data_nascimento: dataNascimento || null,
          genero,
          estado_civil: estadoCivil,
          profissao,
          queixa_principal: queixaPrincipal,
          historico_familiar: historicoFamiliar,
          medicamentos,
          tratamentos_anteriores: tratamentosAnteriores,
          expectativas,
        });

      if (patientError) throw patientError;

      await refreshProfile();
      toast.success("Cadastro concluído!");
      navigate("/dashboard/paciente");
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar dados");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center gradient-soft p-4 relative">
      <Button
        variant="ghost"
        onClick={() => navigate("/perfil")}
        className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
      >
        <LogOut className="mr-2 w-4 h-4" /> Sair
      </Button>
      <div className="w-full max-w-lg animate-fade-in">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl gradient-primary mb-3">
            <Brain className="w-6 h-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Cadastro do Paciente</h1>
          <div className="flex justify-center gap-2 mt-4">
            {[1, 2].map((s) => (
              <div
                key={s}
                className={`h-2 rounded-full transition-all duration-300 ${
                  s <= step ? "w-16 gradient-primary" : "w-8 bg-muted"
                }`}
              />
            ))}
          </div>
        </div>

        <Card className="shadow-elevated border-0">
          <CardHeader>
            <CardTitle>{step === 1 ? "Dados Pessoais" : "Ficha de Anamnese"}</CardTitle>
            <CardDescription>
              {step === 1 ? "Preencha seus dados básicos" : "Nos ajude a entender melhor sua situação"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {step === 1 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome Completo</Label>
                  <Input value={nomeCompleto} onChange={(e) => setNomeCompleto(e.target.value)} placeholder="Seu nome completo" />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(11) 99999-9999" />
                </div>
                <div className="space-y-2">
                  <Label>Data de Nascimento</Label>
                  <Input type="date" value={dataNascimento} onChange={(e) => setDataNascimento(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Gênero</Label>
                    <Select value={genero} onValueChange={setGenero}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="masculino">Masculino</SelectItem>
                        <SelectItem value="feminino">Feminino</SelectItem>
                        <SelectItem value="nao-binario">Não-binário</SelectItem>
                        <SelectItem value="prefiro-nao-dizer">Prefiro não dizer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Estado Civil</Label>
                    <Select value={estadoCivil} onValueChange={setEstadoCivil}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="solteiro">Solteiro(a)</SelectItem>
                        <SelectItem value="casado">Casado(a)</SelectItem>
                        <SelectItem value="divorciado">Divorciado(a)</SelectItem>
                        <SelectItem value="viuvo">Viúvo(a)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Profissão</Label>
                  <Input value={profissao} onChange={(e) => setProfissao(e.target.value)} placeholder="Sua profissão" />
                </div>
                <Button onClick={() => setStep(2)} className="w-full gradient-primary text-primary-foreground" disabled={!nomeCompleto}>
                  Próximo <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Queixa Principal</Label>
                  <Textarea value={queixaPrincipal} onChange={(e) => setQueixaPrincipal(e.target.value)} placeholder="O que te trouxe aqui? Descreva como tem se sentido..." rows={3} />
                </div>
                <div className="space-y-2">
                  <Label>Histórico Familiar</Label>
                  <Textarea value={historicoFamiliar} onChange={(e) => setHistoricoFamiliar(e.target.value)} placeholder="Há histórico de problemas psicológicos na família?" rows={2} />
                </div>
                <div className="space-y-2">
                  <Label>Medicamentos em uso</Label>
                  <Input value={medicamentos} onChange={(e) => setMedicamentos(e.target.value)} placeholder="Liste medicamentos que toma atualmente" />
                </div>
                <div className="space-y-2">
                  <Label>Tratamentos Anteriores</Label>
                  <Textarea value={tratamentosAnteriores} onChange={(e) => setTratamentosAnteriores(e.target.value)} placeholder="Já fez terapia ou tratamento psicológico antes?" rows={2} />
                </div>
                <div className="space-y-2">
                  <Label>Expectativas</Label>
                  <Textarea value={expectativas} onChange={(e) => setExpectativas(e.target.value)} placeholder="O que espera alcançar com o acompanhamento?" rows={2} />
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                    <ArrowLeft className="mr-2 w-4 h-4" /> Voltar
                  </Button>
                  <Button onClick={handleSubmit} className="flex-1 gradient-primary text-primary-foreground" disabled={isLoading}>
                    {isLoading ? "Salvando..." : "Concluir Cadastro"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <Button
            variant="ghost"
            onClick={() => navigate("/perfil")}
            className="text-muted-foreground hover:text-foreground"
          >
            <LogOut className="mr-2 w-4 h-4" /> Sair e escolher outro perfil
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PatientOnboarding;
