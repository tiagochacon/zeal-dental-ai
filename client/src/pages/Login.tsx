import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Eye, EyeOff, AlertCircle } from "lucide-react";
import { useLocation, Link } from "wouter";
import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function Login() {
  const [, setLocation] = useLocation();
  const { user, loading, refresh } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  // Track if login was just completed to avoid useEffect overriding redirectTo
  const [justLoggedIn, setJustLoggedIn] = useState(false);

  const loginMutation = trpc.auth.emailLogin.useMutation({
    onSuccess: async (data) => {
      toast.success("Login realizado com sucesso!");
      setJustLoggedIn(true);
      // Use window.location.href for a clean navigation after login
      // This ensures the auth state is loaded fresh without stale cache issues
      setTimeout(() => {
        window.location.href = data.redirectTo || "/";
      }, 500);
    },
    onError: (err) => {
      setError(err.message || "Erro ao fazer login. Verifique suas credenciais.");
    },
  });

  // Only redirect if user was already logged in (not after a fresh login)
  useEffect(() => {
    if (user && !loading && !justLoggedIn) {
      setLocation("/");
    }
  }, [user, loading, setLocation, justLoggedIn]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (!email || !password) {
      setError("Por favor, preencha todos os campos.");
      return;
    }

    loginMutation.mutate({ email, password });
  };

  return (
    <div className="min-h-screen flex bg-background relative overflow-hidden">
      {/* DS token: Reflect DS radial glow background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-[800px] h-[800px] bg-primary/10 rounded-full blur-[180px] -translate-x-1/2 -translate-y-1/2 animate-pulse" />
        <div className="absolute bottom-0 right-0 w-[700px] h-[700px] bg-accent/8 rounded-full blur-[160px] translate-x-1/2 translate-y-1/2 animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/3 w-[500px] h-[500px] bg-primary/6 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative z-10 flex-col justify-center px-16">
        <div className="max-w-lg">
          <div className="flex items-center gap-4 mb-8">
            <img src="/logo.png" alt="ZEAL" className="h-16 w-auto drop-shadow-2xl" />
            <span className="text-5xl font-bold text-foreground tracking-tight">Zeal</span>
          </div>
          
          <h1 className="text-4xl font-bold text-white mb-6 leading-tight">
            Sua Clínica no Próximo Nível com <span className="text-primary">Inteligência Artificial</span>
          </h1>
          
          <p className="text-xl text-foreground/70 mb-8 leading-relaxed">
            Recupere seu tempo e eleve o faturamento do seu consultório. 
            A ZEAL automatiza sua burocracia clínica e utiliza Neurovendas para aumentar a aceitação dos seus tratamentos.
          </p>
          
          <div className="space-y-5">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-primary" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="text-muted-foreground leading-relaxed">Foco Total no Paciente: Transcrição inteligente que elimina anotações manuais durante a consulta.</span>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-primary" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="text-muted-foreground leading-relaxed">Diagnósticos e Tratamentos Precisos: Documentação clínica gerada automaticamente a partir do áudio da sua consulta.</span>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-full bg-accent/15 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-accent" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="text-accent font-medium leading-relaxed">Estratégia de Neurovendas: Scripts e gatilhos personalizados para aumentar o fechamento de tratamentos.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 relative z-10 flex items-center justify-center px-4 sm:px-8">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-12">
            <img src="/logo.png" alt="ZEAL" className="h-12 w-auto" />
            <span className="text-3xl font-bold text-foreground tracking-tight">Zeal</span>
          </div>

          <div className="bg-card/90 backdrop-blur-2xl rounded-3xl p-8 sm:p-10 border border-border shadow-2xl">
            <h2 className="text-2xl font-bold text-foreground mb-2">Bem-vindo de volta</h2>
            <p className="text-muted-foreground mb-8">Entre na sua conta para continuar</p>

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-destructive/10 border border-destructive/30 rounded-xl flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
                <p className="text-destructive text-sm">{error}</p>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleLogin} className="space-y-5">
              {/* Email Field */}
              <div className="relative">
                <label className="text-sm font-medium text-muted-foreground mb-2 block">E-mail</label>
                <Input
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loginMutation.isPending}
                  className="w-full h-12 bg-secondary border border-border/60 rounded-xl text-foreground placeholder:text-muted-foreground px-4 text-base transition-all disabled:opacity-50"
                />
              </div>

              {/* Password Field */}
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-muted-foreground">Senha</label>
                  <button
                    type="button"
                    onClick={() => toast.info("Recuperação de senha em breve!")}
                    className="text-xs text-primary hover:text-primary/70 transition-colors"
                  >
                    Esqueci minha senha
                  </button>
                </div>
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loginMutation.isPending}
                  className="w-full h-12 bg-secondary border border-border/60 rounded-xl text-foreground placeholder:text-muted-foreground px-4 pr-12 text-base transition-all disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-[50px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>

              {/* Login Button */}
              <Button 
                type="submit"
                disabled={loginMutation.isPending}
                className="w-full h-12 font-semibold text-base mt-6 hover:scale-[1.02] disabled:hover:scale-100 transition-all duration-200"
              >
                {loginMutation.isPending ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    Entrando...
                  </>
                ) : (
                  "Entrar"
                )}
              </Button>

              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 text-muted-foreground bg-card">ou</span>
                </div>
              </div>

              {/* Register Link */}
              <div className="text-center">
                <span className="text-muted-foreground">Não tem conta? </span>
                <Link href="/pricing" className="text-primary hover:text-primary/70 font-medium transition-colors">
                  Veja nossos planos
                </Link>
              </div>
            </form>
          </div>

          {/* Footer Info */}
          <p className="text-center text-muted-foreground text-sm mt-8">
            Sistema seguro e em conformidade com LGPD
          </p>
        </div>
      </div>
    </div>
  );
}
