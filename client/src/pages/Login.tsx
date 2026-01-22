import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
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
  const [shake, setShake] = useState(false);
  const loginMutation = trpc.auth.emailLogin.useMutation({
    onSuccess: async () => {
      toast.success("Login realizado com sucesso!");
      setError("");
      await refresh();
      setLocation("/");
    },
    onError: (err) => {
      setError(err.message || "Erro ao fazer login. Verifique suas credenciais.");
      setShake(true);
      setTimeout(() => setShake(false), 600);
    },
  });

  useEffect(() => {
    if (user && !loading) {
      setLocation("/");
    }
  }, [user, loading, setLocation]);

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
      setShake(true);
      setTimeout(() => setShake(false), 600);
      return;
    }

    loginMutation.mutate({ email, password });
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 24 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
    shake: { x: [0, -8, 8, -6, 6, 0], transition: { duration: 0.5 } },
  };

  const formVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
  };

  const fieldVariants = {
    hidden: { opacity: 0, y: 8 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  };

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
            Assistente de IA<br />
            <span className="text-blue-400">Odontológico</span>
          </h1>
          
          <p className="text-xl text-gray-300 mb-8 leading-relaxed">
            Transforme suas consultas com inteligência artificial. 
            Transcrições automáticas, notas SOAP precisas e odontogramas detalhados.
          </p>
          
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-600/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="text-gray-300">Transcrição de áudio em tempo real</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-600/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="text-gray-300">Geração automática de notas clínicas</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-600/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="text-gray-300">Odontograma interativo e detalhado</span>
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
            <span className="text-3xl font-bold text-white tracking-tight">Zeal</span>
          </div>

          <motion.div
            variants={cardVariants}
            initial="hidden"
            animate={shake ? "shake" : "visible"}
            className="bg-[#1a1a2e]/90 backdrop-blur-2xl rounded-3xl p-8 sm:p-10 border border-white/10 shadow-2xl"
          >
            <h2 className="text-2xl font-bold text-white mb-2">Bem-vindo de volta</h2>
            <p className="text-gray-400 mb-8">Entre na sua conta para continuar</p>

            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <form onSubmit={handleLogin}>
              <motion.div variants={formVariants} initial="hidden" animate="visible" className="space-y-5">
                <motion.div variants={fieldVariants} className="relative">
                  <label className="text-sm font-medium text-gray-300 mb-2 block">E-mail</label>
                  <Input
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loginMutation.isPending}
                    className="w-full h-12 bg-[#252538] border border-white/5 rounded-xl text-white placeholder:text-gray-600 px-4 text-base focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 focus:shadow-[0_0_0_2px_rgba(59,130,246,0.35)] transition-all disabled:opacity-50"
                  />
                </motion.div>

                <motion.div variants={fieldVariants} className="relative">
                  <label className="text-sm font-medium text-gray-300 mb-2 block">Senha</label>
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loginMutation.isPending}
                    className="w-full h-12 bg-[#252538] border border-white/5 rounded-xl text-white placeholder:text-gray-600 px-4 pr-12 text-base focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 focus:shadow-[0_0_0_2px_rgba(59,130,246,0.35)] transition-all disabled:opacity-50"
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
                </motion.div>

                <motion.div variants={fieldVariants}>
                  <Button
                    type="submit"
                    disabled={loginMutation.isPending}
                    className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold text-base rounded-xl mt-6 transition-all duration-200 shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
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
                </motion.div>

                <motion.div variants={fieldVariants} className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/10"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 text-gray-500 bg-[#1a1a2e]">ou</span>
                  </div>
                </motion.div>

                <motion.div variants={fieldVariants} className="text-center">
                  <span className="text-gray-400">Não tem conta? </span>
                  <Link href="/register" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
                    Cadastre-se gratuitamente
                  </Link>
                </motion.div>
              </motion.div>
            </form>
          </motion.div>

          {/* Footer Info */}
          <p className="text-center text-muted-foreground text-sm mt-8">
            Sistema seguro e em conformidade com LGPD
          </p>
        </div>
      </div>
    </div>
  );
}
