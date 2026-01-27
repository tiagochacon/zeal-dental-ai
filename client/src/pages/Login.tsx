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

  const loginMutation = trpc.auth.emailLogin.useMutation({
    onSuccess: async () => {
      toast.success("Login realizado com sucesso!");
      await refresh();
      setLocation("/");
    },
    onError: (err) => {
      setError(err.message || "Erro ao fazer login. Verifique suas credenciais.");
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
      return;
    }

    loginMutation.mutate({ email, password });
  };

<<<<<<< HEAD
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
=======
  const cardVariants = {
    hidden: { opacity: 0, y: 24 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const } },
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

  const features = [
    {
      icon: '🎯',
      title: 'Foco Total no Paciente',
      description: 'Transcrição inteligente que elimina as anotações manuais durante a consulta.',
    },
    {
      icon: '📋',
      title: 'Notas SOAP em Segundos',
      description: 'Documentação clínica impecável e automática, pronta para exportação.',
    },
    {
      icon: '🦷',
      title: 'Diagnóstico de Alto Impacto',
      description: 'Odontogramas automáticos que facilitam a compreensão e o fechamento pelo paciente.',
    },
    {
      icon: '🧠',
      title: 'Inteligência em Neurovendas',
      description: 'Scripts e gatilhos personalizados para cada perfil de paciente, baseados em neurociência.',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100">
      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-5 gap-12 items-start">
          {/* Left Side - Marketing Copy (3/5 colunas) */}
          <motion.div
            className="lg:col-span-3 space-y-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            {/* Headline */}
            <motion.h1
              className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-gray-900 leading-tight"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            >
              Sua Clínica no{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-blue-800">
                Próximo Nível
              </span>{' '}
              com Inteligência Artificial
            </motion.h1>
            
            {/* Subheadline */}
            <motion.p
              className="text-lg md:text-xl text-gray-600 leading-relaxed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              Recupere seu tempo e aumente o faturamento do seu consultório. O ZEAL{' '}
              <strong>automatiza sua burocracia clínica</strong> e utiliza{' '}
              <span className="text-blue-600 font-semibold">Neurovendas</span> para elevar a aceitação dos seus tratamentos.
            </motion.p>
            
            {/* Features */}
            <motion.div
              className="space-y-4"
              initial="hidden"
              animate="visible"
              variants={{
                visible: {
                  transition: {
                    staggerChildren: 0.1,
                    delayChildren: 0.3,
                  },
                },
              }}
            >
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                O que o ZEAL faz pela sua clínica:
              </h3>
              
              {features.map((feature, i) => (
                <motion.div
                  key={i}
                  className="flex items-start gap-4 p-4 bg-white rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
                  variants={{
                    hidden: { opacity: 0, x: -20 },
                    visible: { opacity: 1, x: 0 },
                  }}
                >
                  <span className="text-3xl flex-shrink-0">{feature.icon}</span>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 mb-1">{feature.title}</h4>
                    <p className="text-gray-600 text-sm leading-relaxed">{feature.description}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
            
            {/* Social Proof */}
            <motion.div
              className="space-y-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.5 }}
            >
              <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                <span>✓ Usado por 200+ dentistas no Brasil</span>
                <span>✓ Taxa média de conversão: 67%</span>
                <span>✓ Nota 4.9/5 no Google Reviews</span>
              </div>
              
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
                <p className="italic text-gray-700 mb-2">
                  "Fechei 4 tratamentos seguidos usando os scripts do ZEAL. Nunca tinha conseguido isso antes!"
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Dra. Ana Silva</strong> - São Paulo, SP
                </p>
              </div>
            </motion.div>
            
            {/* CTAs */}
            <motion.div
              className="flex flex-col sm:flex-row gap-4 pt-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1, duration: 0.5 }}
            >
              <Link href="/register">
                <Button
                  size="lg"
                  className="w-full sm:w-auto px-8 py-6 text-lg font-semibold bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95"
                >
                  Começar minha Revolução Clínica
                </Button>
              </Link>
              
              <Link href="/pricing">
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full sm:w-auto px-6 py-6 text-base border-2 hover:border-blue-600 hover:text-blue-600"
                >
                  Ver Planos →
                </Button>
              </Link>
            </motion.div>
          </motion.div>
>>>>>>> e4a0246 (feat: atualizar copy de login/registro com foco em revolucao clinica e IA)
          
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

          <div className="bg-card/90 backdrop-blur-2xl rounded-3xl p-8 sm:p-10 border border-border shadow-2xl">
            <h2 className="text-2xl font-bold text-foreground mb-2">Bem-vindo de volta</h2>
            <p className="text-muted-foreground mb-8">Entre na sua conta para continuar</p>

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
                <p className="text-red-400 text-sm">{error}</p>
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
                  className="w-full h-12 bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground px-4 text-base focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all disabled:opacity-50"
                />
              </div>

              {/* Password Field */}
              <div className="relative">
                <label className="text-sm font-medium text-muted-foreground mb-2 block">Senha</label>
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loginMutation.isPending}
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
              </div>

              {/* Login Button */}
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
                <Link href="/register" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
                  Cadastre-se gratuitamente
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
