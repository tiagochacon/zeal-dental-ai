import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ArrowLeft, Mail, CheckCircle2, AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { trpc } from "@/lib/trpc";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const resetMutation = trpc.auth.requestPasswordReset.useMutation({
    onSuccess: () => {
      setSubmitted(true);
    },
    onError: (err) => {
      setError(err.message || "Erro ao solicitar recuperação de senha.");
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email) {
      setError("Por favor, informe seu e-mail.");
      return;
    }

    resetMutation.mutate({ email });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* DS token: Reflect DS radial glow background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[800px] h-[800px] bg-primary/15 rounded-full blur-[180px] -translate-x-1/2 -translate-y-1/2 animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-[700px] h-[700px] bg-accent/15 rounded-full blur-[160px] translate-x-1/2 translate-y-1/2 animate-pulse" style={{ animationDelay: '1s' }} />
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

          {submitted ? (
            /* Success State */
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="h-8 w-8 text-emerald-400" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-3">E-mail enviado!</h2>
              <p className="text-muted-foreground mb-2">
                Se o e-mail <span className="text-foreground font-medium">{email}</span> estiver
                cadastrado, você receberá um link de recuperação em instantes.
              </p>
              <p className="text-muted-foreground text-sm mb-8">
                Verifique sua caixa de entrada e a pasta de spam. O link expira em{" "}
                <strong className="text-foreground">1 hora</strong>.
              </p>
              <Link href="/login">
                <Button className="w-full h-12 font-medium text-base bg-primary text-primary-foreground hover:bg-primary/90 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_4px_14px_rgba(147,130,255,0.25)] rounded-xl transition-all duration-300">
                  Voltar ao login
                </Button>
              </Link>
            </div>
          ) : (
            /* Form State */
            <>
              <div className="text-center mb-8">
                <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-5">
                  <Mail className="h-7 w-7 text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-2">Esqueceu sua senha?</h2>
                <p className="text-muted-foreground text-sm">
                  Informe seu e-mail e o administrador receberá um link para redefinir sua senha.
                </p>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mb-6 p-4 bg-destructive/10 border border-destructive/30 rounded-xl flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
                  <p className="text-destructive text-sm">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="relative">
                  <label className="text-sm font-medium text-foreground/80 mb-2 block">E-mail</label>
                  <Input
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={resetMutation.isPending}
                    className="w-full h-12 bg-black/20 border border-white/5 rounded-xl text-foreground placeholder:text-muted-foreground/50 px-4 text-base transition-all duration-300 focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary focus-visible:bg-black/40 disabled:opacity-50"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={resetMutation.isPending}
                  className="w-full h-12 font-medium text-base mt-4 bg-primary text-primary-foreground hover:bg-primary/90 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_4px_14px_rgba(147,130,255,0.25)] rounded-xl transition-all duration-300"
                >
                  {resetMutation.isPending ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      Enviando...
                    </>
                  ) : (
                    "Enviar solicitação"
                  )}
                </Button>

                <div className="text-center pt-2">
                  <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1.5">
                    <ArrowLeft className="h-4 w-4" />
                    Voltar ao login
                  </Link>
                </div>
              </form>
            </>
          )}
        </div>

        {/* Footer Info */}
        <p className="text-center text-muted-foreground/50 text-sm mt-8">
          Sistema seguro e em conformidade com LGPD
        </p>
      </div>
    </div>
  );
}
