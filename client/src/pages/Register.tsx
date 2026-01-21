import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Eye, EyeOff, AlertCircle, CheckCircle } from "lucide-react";
import { useLocation, Link } from "wouter";
import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

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

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: async () => {
      toast.success("Conta criada com sucesso!");
      await refresh();
      // Redirect to pricing page after registration for sales funnel
      setLocation("/pricing");
    },
    onError: (err) => {
      setError(err.message || "Erro ao criar conta. Tente novamente.");
    },
  });

  useEffect(() => {
    if (user && !loading) {
      setLocation("/");
    }
  }, [user, loading, setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a12]">
        <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
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
    <div className="min-h-screen flex bg-gradient-to-br from-[#0a0a12] via-[#1a1035] to-[#0a0a12] relative overflow-hidden">
      {/* Animated Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-[800px] h-[800px] bg-purple-600/20 rounded-full blur-[180px] -translate-x-1/2 -translate-y-1/2 animate-pulse" />
        <div className="absolute bottom-0 right-0 w-[700px] h-[700px] bg-blue-600/15 rounded-full blur-[160px] translate-x-1/2 translate-y-1/2 animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/3 w-[500px] h-[500px] bg-purple-800/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative z-10 flex-col justify-center px-16">
        <div className="max-w-lg">
          <div className="flex items-center gap-4 mb-8">
            <img src="/logo.png" alt="ZEAL" className="h-16 w-auto drop-shadow-2xl" />
            <span className="text-5xl font-bold text-white tracking-tight">Zeal</span>
          </div>
          
          <h1 className="text-4xl font-bold text-white mb-6 leading-tight">
            Comece sua jornada<br />
            <span className="text-purple-400">com IA Odontológica</span>
          </h1>
          
          <p className="text-xl text-gray-300 mb-8 leading-relaxed">
            Crie sua conta gratuita e experimente o poder da inteligência artificial 
            na sua prática odontológica.
          </p>
          
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-600/20 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-400" />
              </div>
              <span className="text-gray-300">7 dias de trial gratuito</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-600/20 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-400" />
              </div>
              <span className="text-gray-300">Sem necessidade de cartão de crédito</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-600/20 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-400" />
              </div>
              <span className="text-gray-300">Cancele quando quiser</span>
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

          <div className="bg-[#1a1a2e]/90 backdrop-blur-2xl rounded-3xl p-8 sm:p-10 border border-white/10 shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-2">Criar sua conta</h2>
            <p className="text-gray-400 mb-6">Preencha os dados abaixo para começar</p>

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
                <label className="text-sm font-medium text-gray-300 mb-2 block">Nome completo</label>
                <Input
                  type="text"
                  placeholder="Dr. João Silva"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={registerMutation.isPending}
                  className="w-full h-12 bg-[#252538] border border-white/5 rounded-xl text-white placeholder:text-gray-600 px-4 text-base focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all disabled:opacity-50"
                />
              </div>

              {/* Email Field */}
              <div className="relative">
                <label className="text-sm font-medium text-gray-300 mb-2 block">E-mail</label>
                <Input
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={registerMutation.isPending}
                  className="w-full h-12 bg-[#252538] border border-white/5 rounded-xl text-white placeholder:text-gray-600 px-4 text-base focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all disabled:opacity-50"
                />
              </div>

              {/* Password Field */}
              <div className="relative">
                <label className="text-sm font-medium text-gray-300 mb-2 block">Senha</label>
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={registerMutation.isPending}
                  className="w-full h-12 bg-[#252538] border border-white/5 rounded-xl text-white placeholder:text-gray-600 px-4 pr-12 text-base focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-[42px] text-gray-500 hover:text-gray-300 transition-colors"
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
                    <div className="flex-1 h-1 rounded-full bg-gray-700 overflow-hidden">
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
                <label className="text-sm font-medium text-gray-300 mb-2 block">Confirmar senha</label>
                <Input
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Digite a senha novamente"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={registerMutation.isPending}
                  className="w-full h-12 bg-[#252538] border border-white/5 rounded-xl text-white placeholder:text-gray-600 px-4 pr-12 text-base focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-[42px] text-gray-500 hover:text-gray-300 transition-colors"
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
                disabled={registerMutation.isPending}
                className="w-full h-12 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-semibold text-base rounded-xl mt-4 transition-all duration-200 shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
              >
                {registerMutation.isPending ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    Criando conta...
                  </>
                ) : (
                  "Criar conta gratuita"
                )}
              </Button>

              {/* Terms */}
              <p className="text-xs text-gray-500 text-center mt-4">
                Ao criar sua conta, você concorda com nossos{" "}
                <a href="#" className="text-purple-400 hover:text-purple-300">Termos de Uso</a>{" "}
                e{" "}
                <a href="#" className="text-purple-400 hover:text-purple-300">Política de Privacidade</a>
              </p>

              {/* Divider */}
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 text-gray-500 bg-[#1a1a2e]">ou</span>
                </div>
              </div>

              {/* Login Link */}
              <div className="text-center">
                <span className="text-gray-400">Já tem uma conta? </span>
                <Link href="/login" className="text-purple-400 hover:text-purple-300 font-medium transition-colors">
                  Faça login
                </Link>
              </div>
            </form>
          </div>

          {/* Footer Info */}
          <p className="text-center text-gray-500 text-sm mt-6">
            Sistema seguro e em conformidade com LGPD
          </p>
        </div>
      </div>
    </div>
  );
}
