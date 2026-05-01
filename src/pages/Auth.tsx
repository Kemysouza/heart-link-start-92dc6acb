import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Brain, Eye, EyeOff } from "lucide-react";

const MIN_PASSWORD_LEN = 10;

const validatePassword = (pw: string): string | null => {
  if (pw.length < MIN_PASSWORD_LEN) return `Senha precisa ter pelo menos ${MIN_PASSWORD_LEN} caracteres`;
  if (!/[a-zA-Z]/.test(pw)) return "Senha precisa ter pelo menos uma letra";
  if (!/\d/.test(pw)) return "Senha precisa ter pelo menos um número";
  return null;
};

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true); // default em LOGIN
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { signUp, signIn } = useAuth();

  const friendlyError = (err: unknown): string => {
    const message = err instanceof Error ? err.message : String(err);
    if (/invalid login credentials/i.test(message)) return "E-mail ou senha incorretos";
    if (/email.*registered/i.test(message)) return "Este e-mail já está cadastrado";
    if (/password.*should be at least/i.test(message)) return "Senha não atende aos critérios";
    if (/over_email_send_rate_limit/i.test(message)) return "Muitas tentativas. Aguarde alguns minutos";
    return message || "Erro ao processar";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLogin) {
      const pwErr = validatePassword(password);
      if (pwErr) {
        toast.error(pwErr);
        return;
      }
    }
    setIsLoading(true);
    try {
      if (isLogin) {
        await signIn(email.trim(), password);
        toast.success("Login realizado com sucesso");
      } else {
        const { needsEmailConfirmation } = await signUp(email.trim(), password);
        if (needsEmailConfirmation) {
          toast.success("Cadastro realizado! Verifique seu e-mail para confirmar.");
        } else {
          toast.success("Cadastro realizado com sucesso");
        }
      }
    } catch (error) {
      toast.error(friendlyError(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center gradient-soft p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl gradient-primary mb-4">
            <Brain className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">MindCare</h1>
          <p className="text-muted-foreground mt-2">Sua plataforma de saúde mental</p>
        </div>

        <Card className="shadow-elevated border-0">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">
              {isLogin ? "Entrar na sua conta" : "Criar sua conta"}
            </CardTitle>
            <CardDescription>
              {isLogin ? "Bem-vindo(a) de volta!" : "Comece sua jornada de bem-estar"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4" autoComplete="on">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete={isLogin ? "current-password" : "new-password"}
                    placeholder={isLogin ? "Sua senha" : `Mínimo ${MIN_PASSWORD_LEN} caracteres, com letra e número`}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={isLogin ? 1 : MIN_PASSWORD_LEN}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {!isLogin && password.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {validatePassword(password) ?? "✓ Senha atende aos critérios"}
                  </p>
                )}
              </div>
              <Button
                type="submit"
                className="w-full gradient-primary text-primary-foreground"
                disabled={isLoading}
              >
                {isLoading ? "Processando..." : isLogin ? "Entrar" : "Cadastrar"}
              </Button>
            </form>
            <div className="mt-6 text-center">
              <button
                onClick={() => setIsLogin((v) => !v)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {isLogin ? "Não tem conta? Cadastre-se" : "Já tem conta? Entre"}
              </button>
            </div>
          </CardContent>
        </Card>

        <p className="mt-4 text-xs text-center text-muted-foreground">
          Ao continuar, você concorda com os termos de uso e a política de privacidade.
        </p>
      </div>
    </div>
  );
};

export default Auth;
