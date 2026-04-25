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
import { Brain, ArrowRight, ArrowLeft, LogOut, Check, X } from "lucide-react";
import { validateStrongPassword, PASSWORD_RULE_TEXT } from "@/lib/passwordValidation";

const PatientOnboarding = () => {
  const { user, signUp, signIn, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  const [nomeCompleto, setNomeCompleto] = useState("");
  const [telefone, setTelefone] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [genero, setGenero] = useState("");
  const [estadoCivil, setEstadoCivil] = useState("");
  const [profissao, setProfissao] = useState("");

  // Credentials (only when no logged-in user yet)
  const [email, setEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [queixaPrincipal, setQueixaPrincipal] = useState("");
  const [historicoFamiliar, setHistoricoFamiliar] = useState("");
  const [medicamentos, setMedicamentos] = useState("");
  const [tratamentosAnteriores, setTratamentosAnteriores] = useState("");
  const [expectativas, setExpectativas] = useState("");

  const needsAccount = !user;

  const pwChecks = {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    special: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password),
  };

  const emailsMatch = email && email === confirmEmail;
  const passwordsMatch = password && password === confirmPassword;
  const passwordStrong = validateStrongPassword(password) === null;

  const step1Valid = needsAccount
    ? !!nomeCompleto && !!dataNascimento && !!email && emailsMatch && passwordStrong && passwordsMatch
    : !!nomeCompleto && !!dataNascimento;

  const RuleItem = ({ ok, label }: { ok: boolean; label: string }) => (
    <li className={`flex items-center gap-2 text-xs ${ok ? "text-primary" : "text-muted-foreground"}`}>
      {ok ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
      {label}
    </li>
  );

  const handleNextStep1 = async () => {
    if (!step1Valid) return;

    if (needsAccount) {
      setIsLoading(true);
      try {
        await signUp(email, password);
        try {
          await signIn(email, password);
        } catch {
          toast.success("Cadastro criado! Verifique seu e-mail para confirmar.");
          navigate(`/auth/paciente`);
          return;
        }
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (currentUser) {
          await supabase
            .from("profiles")
            .update({ role: "paciente" })
            .eq("user_id", currentUser.id);
          await refreshProfile();
        }
      } catch (error: any) {
        toast.error(error.message || "Erro ao criar conta");
        setIsLoading(false);
        return;
      }
      setIsLoading(false);
    }

    setStep(2);
  };

  const handleSubmit = async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) {
      toast.error("Sessão expirada. Faça login novamente.");
      navigate("/auth/paciente");
      return;
    }
    setIsLoading(true);
    try {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ nome_completo: nomeCompleto, telefone, onboarding_completed: true })
        .eq("user_id", currentUser.id);

      if (profileError) throw profileError;

      const { error: patientError } = await supabase
        .from("patient_profiles")
        .insert({
          user_id: currentUser.id,
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
      const userEmail = currentUser.email || email;
      if (userEmail) sessionStorage.setItem("pending_email_confirm", userEmail);
      toast.success("Cadastro concluído!");
      navigate("/dashboard/paciente");
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar dados");
    } finally {
      setIsLoading(false);
    }
  };

  const handleExit = async () => {
    if (user) {
      await signOut();
    }
    navigate("/");
  };

  return (
    <div className="min-h-screen flex items-center justify-center gradient-soft p-4 relative">
      <Button
        variant="ghost"
        onClick={handleExit}
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
              {step === 1 ? "Preencha seus dados básicos e crie suas credenciais" : "Nos ajude a entender melhor sua situação"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {step === 1 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome Completo <span className="text-destructive">*</span></Label>
                  <Input value={nomeCompleto} onChange={(e) => setNomeCompleto(e.target.value)} placeholder="Seu nome completo" required />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(11) 99999-9999" />
                </div>
                <div className="space-y-2">
                  <Label>Data de Nascimento <span className="text-destructive">*</span></Label>
                  <Input type="date" value={dataNascimento} onChange={(e) => setDataNascimento(e.target.value)} required />
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

                {needsAccount && (
                  <>
                    <div className="pt-2 border-t border-border">
                      <p className="text-sm font-medium text-foreground mb-3">Credenciais de acesso</p>
                    </div>
                    <div className="space-y-2">
                      <Label>E-mail</Label>
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="seu@email.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Confirmar E-mail</Label>
                      <Input
                        type="email"
                        value={confirmEmail}
                        onChange={(e) => setConfirmEmail(e.target.value)}
                        placeholder="Repita seu e-mail"
                      />
                      {confirmEmail && !emailsMatch && (
                        <p className="text-xs text-destructive">Os e-mails não coincidem</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Senha</Label>
                      <Input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={PASSWORD_RULE_TEXT}
                      />
                      {password && (
                        <ul className="space-y-1 mt-1">
                          <RuleItem ok={pwChecks.length} label="Mínimo 8 caracteres" />
                          <RuleItem ok={pwChecks.upper} label="Uma letra maiúscula" />
                          <RuleItem ok={pwChecks.lower} label="Uma letra minúscula" />
                          <RuleItem ok={pwChecks.special} label="Um caractere especial (!@#$...)" />
                        </ul>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Confirmar Senha</Label>
                      <Input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Repita sua senha"
                      />
                      {confirmPassword && !passwordsMatch && (
                        <p className="text-xs text-destructive">As senhas não coincidem</p>
                      )}
                    </div>
                  </>
                )}

                <Button
                  onClick={handleNextStep1}
                  className="w-full gradient-primary text-primary-foreground"
                  disabled={!step1Valid || isLoading}
                >
                  {isLoading ? "Criando conta..." : <>Próximo <ArrowRight className="ml-2 w-4 h-4" /></>}
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
      </div>
    </div>
  );
};

export default PatientOnboarding;
