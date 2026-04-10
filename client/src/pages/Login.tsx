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
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* DS token: Reflect DS radial glow background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[800px] h-[800px] bg-primary/15 rounded-full blur-[180px] -translate-x-1/2 -translate-y-1/2 animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-[700px] h-[700px] bg-accent/15 rounded-full blur-[160px] translate-x-1/2 translate-y-1/2 animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] -translate-x-1/2 -translate-y-1/2 animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      {/* Main Content */}
      <div className="w-full max-w-[440px] relative z-10 px-4 sm:px-8 flex flex-col items-center">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <img src="/logo.png" alt="ZEAL" className="h-14 w-auto drop-shadow-2xl" />
          <span className="text-4xl font-bold text-foreground tracking-tight">Zeal</span>
        </div>

        <div className="w-full surface-glass rounded-[32px] p-8 sm:p-10 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.5)] border border-white/5 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
          
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-foreground mb-2">Bem-vindo de volta</h2>
            <p className="text-muted-foreground">Entre na sua conta para continuar</p>
          </div>

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
              <label className="text-sm font-medium text-foreground/80 mb-2 block">E-mail</label>
              <Input
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loginMutation.isPending}
                className="w-full h-12 bg-black/20 border border-white/5 rounded-xl text-foreground placeholder:text-muted-foreground/50 px-4 text-base transition-all duration-300 focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary focus-visible:bg-black/40 disabled:opacity-50"
              />
            </div>

            {/* Password Field */}
            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-foreground/80">Senha</label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-primary hover:text-primary/80 transition-colors"
                >
                  Esqueci minha senha
                </Link>
              </div>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loginMutation.isPending}
                  className="w-full h-12 bg-black/20 border border-white/5 rounded-xl text-foreground placeholder:text-muted-foreground/50 px-4 pr-12 text-base transition-all duration-300 focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary focus-visible:bg-black/40 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Login Button */}
            <Button 
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full h-12 font-medium text-base mt-4 bg-primary text-primary-foreground hover:bg-primary/90 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_4px_14px_rgba(147,130,255,0.25)] rounded-xl transition-all duration-300"
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
                <div className="w-full border-t border-white/5"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 text-muted-foreground/70 bg-transparent" style={{ textShadow: '0 0 10px rgba(0,0,0,0.5)' }}>ou</span>
              </div>
            </div>

            {/* Register Link */}
            <div className="text-center">
              <span className="text-muted-foreground">Não tem conta? </span>
              <Link href="/pricing" className="text-primary hover:text-primary/80 font-medium transition-colors">
                Veja nossos planos
              </Link>
            </div>
          </form>
        </div>

        {/* Footer Info */}
        <p className="text-center text-muted-foreground/50 text-sm mt-8">
          Sistema seguro e em conformidade com LGPD
        </p>
      </div>
    </div>
  );
}
