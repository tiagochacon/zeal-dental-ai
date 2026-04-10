import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Eye, EyeOff, AlertCircle, CheckCircle, Crown, Zap, CreditCard } from "lucide-react";
import { useLocation, Link } from "wouter";
import { useEffect, useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useStripeCheckout, type StripePlan } from "@/hooks/useStripeCheckout";

const PLAN_INFO: Record<string, { name: string; price: string; icon: React.ReactNode; color: string }> = {
  TRIAL: {
    name: "Trial Gratuito",
    price: "Grátis por 7 dias",
    icon: <Zap className="h-4 w-4 text-emerald-400" />,
    color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  },
  BASIC: {
    name: "ZEAL Básico",
    price: "R$ 179,90/mês",
    icon: <CreditCard className="h-4 w-4 text-blue-400" />,
    color: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  },
  PRO: {
    name: "ZEAL Pro",
    price: "R$ 349,90/mês",
    icon: <Crown className="h-4 w-4 text-purple-400" />,
    color: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  },
};

export default function Register() {
  const [, setLocation] = useLocation();
  const { user, loading, refresh } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isProcessingPlan, setIsProcessingPlan] = useState(false);
  const { startCheckout } = useStripeCheckout();

  // Get selected plan from URL query params
  const selectedPlan = useMemo(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const plan = urlParams.get("plan");
    if (plan && ["TRIAL", "BASIC", "PRO"].includes(plan)) return plan;
    return "TRIAL"; // Default to trial if no plan specified
  }, []);

  const planInfo = PLAN_INFO[selectedPlan];

  const startTrial = trpc.billing.startTrial.useMutation({
    onSuccess: () => {
      toast.success("Trial ativado com sucesso! Bem-vindo ao ZEAL!");
      refresh().then(() => {
        window.location.href = "/gestor";
      });
    },
    onError: (error) => {
      toast.error(error.message);
      setIsProcessingPlan(false);
    },
  });

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: async (data) => {
      toast.success("Conta criada com sucesso!");
      await refresh();

      // Handle plan activation after registration
      if (selectedPlan === "TRIAL") {
        setIsProcessingPlan(true);
        startTrial.mutate();
      } else if (selectedPlan === "BASIC" || selectedPlan === "PRO") {
        // Use createCheckoutSession via tRPC (reliable redirect, no popup blocker)
        setIsProcessingPlan(true);
        toast.info("Redirecionando para a página de pagamento...");
        startCheckout(selectedPlan.toLowerCase() as StripePlan);
      } else {
        setLocation("/");
      }
    },
    onError: (err) => {
      setError(err.message || "Erro ao criar conta. Tente novamente.");
    },
  });

  useEffect(() => {
    if (user && !loading && !isProcessingPlan) {
      // If user is already logged in and not processing a plan, redirect
      setLocation("/");
    }
  }, [user, loading, setLocation, isProcessingPlan]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const validateForm = () => {
    if (!name || !email || !password || !confirmPassword) {
      setError("Por favor, preencha todos os campos.");
      return false;
    }
    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return false;
    }
    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return false;
    }
    return true;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (!validateForm()) return;

    registerMutation.mutate({ name, email, password });
  };

  const passwordStrength = password.length >= 8 ? "strong" : password.length >= 6 ? "medium" : "weak";

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-background via-[#0d1a2d] to-background relative overflow-hidden">
      {/* Animated Background Effects - Deep Blue Theme */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-[800px] h-[800px] bg-blue-600/15 rounded-full blur-[180px] -translate-x-1/2 -translate-y-1/2 animate-pulse" />
        <div className="absolute bottom-0 right-0 w-[700px] h-[700px] bg-cyan-600/10 rounded-full blur-[160px] translate-x-1/2 translate-y-1/2 animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/3 w-[500px] h-[500px] bg-blue-800/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative z-10 flex-col justify-center px-16">
        <div className="max-w-lg">
          <div className="flex items-center gap-4 mb-8">
            <img src="/logo.png" alt="ZEAL" className="h-16 w-auto drop-shadow-2xl" />
            <span className="text-5xl font-bold text-white tracking-tight">Zeal</span>
          </div>
          
          <h1 className="text-4xl font-bold text-white mb-6 leading-tight">
            Comece Sua Revolução<br />
            <span className="text-blue-400">Clínica Agora</span>
          </h1>
          
          <p className="text-xl text-foreground/70 mb-8 leading-relaxed">
            Recupere seu tempo e eleve o faturamento do seu consultório. 
            A ZEAL automatiza sua burocracia clínica e utiliza Neurovendas para aumentar a aceitação dos seus tratamentos.
          </p>
          
          <div className="space-y-5">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-full bg-green-600/20 flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-5 h-5 text-green-400" />
              </div>
              <span className="text-foreground/70 leading-relaxed">Teste grátis por 7 dias — sem cartão de crédito necessário.</span>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-full bg-green-600/20 flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-5 h-5 text-green-400" />
              </div>
              <span className="text-foreground/70 leading-relaxed">Economize 2h por dia em burocracia clínica com documentação automática.</span>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-full bg-cyan-600/20 flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-5 h-5 text-cyan-400" />
              </div>
              <span className="text-cyan-400 font-medium leading-relaxed">Aumente sua taxa de fechamento em até 40% com Neurovendas.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Register Form */}
      <div className="w-full lg:w-1/2 relative z-10 flex items-center justify-center px-4 sm:px-8 py-8">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <img src="/logo.png" alt="ZEAL" className="h-12 w-auto" />
            <span className="text-3xl font-bold text-white tracking-tight">Zeal</span>
          </div>

          <div className="bg-card/90 backdrop-blur-2xl rounded-3xl p-8 sm:p-10 border border-border shadow-2xl">
            <h2 className="text-2xl font-bold text-foreground mb-2">Criar sua conta</h2>
            <p className="text-muted-foreground mb-4">Preencha os dados abaixo para começar</p>

            {/* Selected Plan Badge */}
            {planInfo && (
              <div className={`mb-6 p-3 rounded-xl border flex items-center gap-3 ${planInfo.color}`}>
                {planInfo.icon}
                <div>
                  <p className="text-sm font-semibold">{planInfo.name}</p>
                  <p className="text-xs opacity-80">{planInfo.price}</p>
                </div>
                <Link href="/pricing" className="ml-auto text-xs underline opacity-70 hover:opacity-100 transition-opacity">
                  Trocar
                </Link>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleRegister} className="space-y-4">
              {/* Name Field */}
              <div className="relative">
                <label className="text-sm font-medium text-muted-foreground mb-2 block">Nome completo</label>
                <Input
                  type="text"
                  placeholder="Dr. João Silva"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={registerMutation.isPending || isProcessingPlan}
                  className="w-full h-12 bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground px-4 text-base focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all disabled:opacity-50"
                />
              </div>

              {/* Email Field */}
              <div className="relative">
                <label className="text-sm font-medium text-muted-foreground mb-2 block">E-mail</label>
                <Input
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={registerMutation.isPending || isProcessingPlan}
                  className="w-full h-12 bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground px-4 text-base focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all disabled:opacity-50"
                />
              </div>

              {/* Password Field */}
              <div className="relative">
                <label className="text-sm font-medium text-muted-foreground mb-2 block">Senha</label>
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={registerMutation.isPending || isProcessingPlan}
                  className="w-full h-12 bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground px-4 pr-12 text-base focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-[42px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
                {/* Password Strength Indicator */}
                {password && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                      <div 
                        className={`h-full transition-all ${
                          passwordStrength === "strong" ? "w-full bg-green-500" :
                          passwordStrength === "medium" ? "w-2/3 bg-yellow-500" :
                          "w-1/3 bg-red-500"
                        }`}
                      />
                    </div>
                    <span className={`text-xs ${
                      passwordStrength === "strong" ? "text-green-400" :
                      passwordStrength === "medium" ? "text-yellow-400" :
                      "text-red-400"
                    }`}>
                      {passwordStrength === "strong" ? "Forte" :
                       passwordStrength === "medium" ? "Média" : "Fraca"}
                    </span>
                  </div>
                )}
              </div>

              {/* Confirm Password Field */}
              <div className="relative">
                <label className="text-sm font-medium text-muted-foreground mb-2 block">Confirmar senha</label>
                <Input
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Digite a senha novamente"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={registerMutation.isPending || isProcessingPlan}
                  className="w-full h-12 bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground px-4 pr-12 text-base focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-[42px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
                {/* Password Match Indicator */}
                {confirmPassword && (
                  <div className="mt-2 flex items-center gap-2">
                    {password === confirmPassword ? (
                      <>
                        <CheckCircle className="h-4 w-4 text-green-400" />
                        <span className="text-xs text-green-400">Senhas coincidem</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-4 w-4 text-red-400" />
                        <span className="text-xs text-red-400">Senhas não coincidem</span>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Register Button */}
              <Button 
                type="submit"
                disabled={registerMutation.isPending || isProcessingPlan}
                className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold text-base rounded-xl mt-4 transition-all duration-200 shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
              >
                {registerMutation.isPending || isProcessingPlan ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    {isProcessingPlan ? "Ativando plano..." : "Criando conta..."}
                  </>
                ) : selectedPlan === "TRIAL" ? (
                  "Criar conta e começar Trial"
                ) : (
                  "Criar conta e assinar"
                )}
              </Button>

              {/* Terms */}
              <p className="text-xs text-muted-foreground text-center mt-4">
                Ao criar sua conta, você concorda com nossos{" "}
                <a href="#" className="text-blue-400 hover:text-blue-300">Termos de Uso</a>{" "}
                e{" "}
                <a href="#" className="text-blue-400 hover:text-blue-300">Política de Privacidade</a>
              </p>

              {/* Divider */}
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 text-muted-foreground bg-card">ou</span>
                </div>
              </div>

              {/* Login Link */}
              <div className="text-center">
                <span className="text-muted-foreground">Já tem uma conta? </span>
                <Link href="/login" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
                  Faça login
                </Link>
              </div>
            </form>
          </div>

          {/* Footer Info */}
          <p className="text-center text-muted-foreground text-sm mt-6">
            Sistema seguro e em conformidade com LGPD
          </p>
        </div>
      </div>
    </div>
  );
}
