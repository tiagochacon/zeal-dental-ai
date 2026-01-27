import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
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

  const benefits = [
    {
      icon: '📈',
      text: 'Aumente sua taxa de conversão em até',
      highlight: '3x',
      rest: 'com scripts de Neurovendas personalizados',
    },
    {
      icon: '⚡',
      text: 'Economize',
      highlight: '2h por dia',
      rest: '- prontuários SOAP gerados automaticamente pela IA',
    },
    {
      icon: '🧠',
      text: 'Saiba se seu paciente é Racional, Emocional ou Ansioso',
      highlight: 'DURANTE a consulta',
      rest: '',
    },
    {
      icon: '💰',
      text: 'Planos de tratamento que',
      highlight: 'vendem sozinhos',
      rest: 'com gatilhos mentais embutidos',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
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
              Pare de Perder Pacientes por{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                Não Saber Negociar
              </span>
              .
            </motion.h1>
            
            {/* Subheadline */}
            <motion.p
              className="text-lg md:text-xl text-gray-600 leading-relaxed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              ZEAL analisa a <strong>personalidade do seu paciente em tempo real</strong> e te diz{' '}
              <strong>exatamente o que falar para fechar</strong>.{' '}
              <span className="text-blue-600 font-semibold">Neurovendas + IA Clínica</span> em uma ferramenta.
            </motion.p>
            
            {/* Benefits */}
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
                Por que dentistas estão fechando 3x mais com ZEAL:
              </h3>
              
              {benefits.map((benefit, i) => (
                <motion.div
                  key={i}
                  className="flex items-start gap-4 p-4 bg-white rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
                  variants={{
                    hidden: { opacity: 0, x: -20 },
                    visible: { opacity: 1, x: 0 },
                  }}
                >
                  <span className="text-3xl flex-shrink-0">{benefit.icon}</span>
                  <p className="text-gray-700 leading-relaxed">
                    {benefit.text}{' '}
                    <strong className="text-blue-600">{benefit.highlight}</strong>
                    {benefit.rest && ' ' + benefit.rest}
                  </p>
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
                  className="w-full sm:w-auto px-8 py-6 text-lg font-semibold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95"
                >
                  Comece Grátis - Sem Cartão
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
          
          {/* Right Side - Login Form (2/5 colunas) */}
          <motion.div
            className="lg:col-span-2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
          >
            <Card className="p-8 shadow-2xl border border-gray-100 lg:sticky lg:top-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Já tem conta? Entre aqui</h2>
              <p className="text-gray-600 mb-6">Entre na sua conta para continuar</p>

              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              )}

              <form onSubmit={handleLogin}>
                <motion.div variants={formVariants} initial="hidden" animate="visible" className="space-y-5">
                  <motion.div variants={fieldVariants} className="relative">
                    <label className="text-sm font-medium text-gray-700 mb-2 block">E-mail</label>
                    <Input
                      type="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loginMutation.isPending}
                      className="w-full h-12 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-400 px-4 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all disabled:opacity-50"
                    />
                  </motion.div>

                  <motion.div variants={fieldVariants} className="relative">
                    <label className="text-sm font-medium text-gray-700 mb-2 block">Senha</label>
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loginMutation.isPending}
                      className="w-full h-12 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-400 px-4 pr-12 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-[42px] text-gray-500 hover:text-gray-700 transition-colors"
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
                      className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold text-base rounded-lg mt-6 transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
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
                </motion.div>
              </form>
              
              <div className="mt-6 text-center">
                <p className="text-sm text-gray-600">
                  Novo por aqui?{' '}
                  <Link href="/register" className="text-blue-600 font-semibold hover:underline">
                    Criar conta grátis
                  </Link>
                </p>
              </div>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
