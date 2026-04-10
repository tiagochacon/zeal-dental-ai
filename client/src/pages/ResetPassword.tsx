import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Eye, EyeOff, ShieldCheck, CheckCircle2, AlertCircle, XCircle } from "lucide-react";
import { Link, useSearch } from "wouter";
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";

function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { score, label: "Fraca", color: "bg-red-500" };
  if (score <= 2) return { score, label: "Razoável", color: "bg-amber-500" };
  if (score <= 3) return { score, label: "Boa", color: "bg-blue-500" };
  return { score, label: "Forte", color: "bg-emerald-500" };
}

export default function ResetPassword() {
  const searchString = useSearch();
  const token = useMemo(() => new URLSearchParams(searchString).get("token") || "", [searchString]);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const strength = getPasswordStrength(password);
  const passwordsMatch = password.length > 0 && confirmPassword.length > 0 && password === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  const resetMutation = trpc.auth.resetPassword.useMutation({
    onSuccess: () => {
      setSuccess(true);
    },
    onError: (err) => {
      setError(err.message || "Erro ao redefinir senha.");
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("Token de recuperação não encontrado. Solicite uma nova recuperação.");
      return;
    }

    if (password.length < 6) {
      setError("A senha deve ter no mínimo 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    resetMutation.mutate({ token, newPassword: password });
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-[800px] h-[800px] bg-primary/15 rounded-full blur-[180px] -translate-x-1/2 -translate-y-1/2 animate-pulse" />
        </div>
        <div className="w-full max-w-[440px] relative z-10 px-4 sm:px-8 flex flex-col items-center">
          <div className="flex items-center justify-center gap-3 mb-10">
            <img src="/logo.png" alt="ZEAL" className="h-14 w-auto drop-shadow-2xl" />
            <span className="text-4xl font-bold text-foreground tracking-tight">Zeal</span>
          </div>
          <div className="w-full surface-glass rounded-[32px] p-8 sm:p-10 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.5)] border border-white/5 relative overflow-hidden text-center">
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-bold text-foreground mb-2">Link inválido</h2>
            <p className="text-muted-foreground mb-6">
              Este link de recuperação é inválido ou está incompleto. Solicite uma nova recuperação de senha.
            </p>
            <Link href="/forgot-password">
              <Button className="w-full h-12 font-medium text-base bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl">
                Solicitar nova recuperação
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

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

          {success ? (
            /* Success State */
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="h-8 w-8 text-emerald-400" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-3">Senha redefinida!</h2>
              <p className="text-muted-foreground mb-8">
                Sua senha foi alterada com sucesso. Você já pode fazer login com a nova senha.
              </p>
              <Link href="/login">
                <Button className="w-full h-12 font-medium text-base bg-primary text-primary-foreground hover:bg-primary/90 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_4px_14px_rgba(147,130,255,0.25)] rounded-xl transition-all duration-300">
                  Ir para o login
                </Button>
              </Link>
            </div>
          ) : (
            /* Form State */
            <>
              <div className="text-center mb-8">
                <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-5">
                  <ShieldCheck className="h-7 w-7 text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-2">Redefinir senha</h2>
                <p className="text-muted-foreground text-sm">
                  Crie uma nova senha segura para sua conta.
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
                {/* New Password */}
                <div className="relative">
                  <label className="text-sm font-medium text-foreground/80 mb-2 block">Nova senha</label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={resetMutation.isPending}
                      className="w-full h-12 bg-black/20 border border-white/5 rounded-xl text-foreground placeholder:text-muted-foreground/50 px-4 pr-12 text-base transition-all duration-300 focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary focus-visible:bg-black/40 disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  {/* Password Strength Indicator */}
                  {password.length > 0 && (
                    <div className="mt-2">
                      <div className="flex gap-1 mb-1">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <div
                            key={i}
                            className={`h-1 flex-1 rounded-full transition-colors ${
                              i <= strength.score ? strength.color : "bg-white/10"
                            }`}
                          />
                        ))}
                      </div>
                      <p className={`text-xs ${strength.score <= 1 ? "text-red-400" : strength.score <= 2 ? "text-amber-400" : strength.score <= 3 ? "text-blue-400" : "text-emerald-400"}`}>
                        {strength.label}
                      </p>
                    </div>
                  )}
                </div>

                {/* Confirm Password */}
                <div className="relative">
                  <label className="text-sm font-medium text-foreground/80 mb-2 block">Confirmar senha</label>
                  <div className="relative">
                    <Input
                      type={showConfirm ? "text" : "password"}
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={resetMutation.isPending}
                      className="w-full h-12 bg-black/20 border border-white/5 rounded-xl text-foreground placeholder:text-muted-foreground/50 px-4 pr-12 text-base transition-all duration-300 focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary focus-visible:bg-black/40 disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  {/* Match Indicator */}
                  {confirmPassword.length > 0 && (
                    <p className={`text-xs mt-1.5 flex items-center gap-1 ${passwordsMatch ? "text-emerald-400" : "text-red-400"}`}>
                      {passwordsMatch ? (
                        <><CheckCircle2 className="h-3.5 w-3.5" /> Senhas coincidem</>
                      ) : (
                        <><XCircle className="h-3.5 w-3.5" /> Senhas não coincidem</>
                      )}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={resetMutation.isPending || !passwordsMatch || password.length < 6}
                  className="w-full h-12 font-medium text-base mt-4 bg-primary text-primary-foreground hover:bg-primary/90 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_4px_14px_rgba(147,130,255,0.25)] rounded-xl transition-all duration-300 disabled:opacity-50"
                >
                  {resetMutation.isPending ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      Redefinindo...
                    </>
                  ) : (
                    "Redefinir senha"
                  )}
                </Button>
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
