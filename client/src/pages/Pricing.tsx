import { useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Check, Crown, CreditCard, Loader2, UserPlus, Zap, X } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";

// Stripe Payment Links
const PAYMENT_LINKS = {
  BASIC: "https://buy.stripe.com/9B6aEY8KNfDw9Ms3f6b7y00",
  PRO: "https://buy.stripe.com/8x27sMd131MG4s8aHyb7y01",
};

const PLANS = [
  {
    key: "TRIAL",
    name: "Trial Gratuito",
    description: "Teste o ZEAL por 7 dias sem compromisso",
    price: "Grátis",
    interval: "7 dias",
    consultationLimit: 7,
    features: [
      { text: "Até 7 consultas", included: true },
      { text: "Transcrição automática de áudio", included: true },
      { text: "Notas Clínicas com IA", included: true },
      { text: "Odontograma automático", included: true },
      { text: "Análise de Negociação/Neurovendas", included: true },
      { text: "Exportação de PDF", included: false },
      { text: "Suporte prioritário", included: false },
    ],
    cta: "Começar Trial",
    highlighted: false,
  },
  {
    key: "BASIC",
    name: "ZEAL Básico",
    description: "Perfeito para consultórios pequenos",
    price: "R$ 99,90",
    interval: "por mês",
    consultationLimit: 20,
    features: [
      { text: "Até 20 consultas/mês", included: true },
      { text: "Transcrição automática de áudio", included: true },
      { text: "Notas Clínicas com IA", included: true },
      { text: "Odontograma automático", included: true },
      { text: "Exportação de PDF", included: true },
      { text: "Análise de Negociação/Neurovendas", included: false },
      { text: "Perfil psicográfico do paciente", included: false },
      { text: "Script de fechamento PARE", included: false },
      { text: "Suporte prioritário", included: false },
    ],
    cta: "Assinar Agora",
    highlighted: false,
  },
  {
    key: "PRO",
    name: "ZEAL Pro",
    description: "Para consultórios em crescimento",
    price: "R$ 199,90",
    interval: "por mês",
    consultationLimit: 50,
    features: [
      { text: "Até 50 consultas/mês", included: true },
      { text: "Transcrição automática de áudio", included: true },
      { text: "Notas Clínicas com IA", included: true },
      { text: "Odontograma automático", included: true },
      { text: "Exportação de PDF", included: true },
      { text: "Análise de Negociação/Neurovendas", included: true },
      { text: "Perfil psicográfico do paciente", included: true },
      { text: "Script de fechamento PARE", included: true },
      { text: "Suporte prioritário", included: true },
    ],
    cta: "Assinar Agora",
    highlighted: true,
  },
];

export default function Pricing() {
  const { user, refresh } = useAuth();
  const [location, setLocation] = useLocation();

  // Check for successful payment return
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentSuccess = urlParams.get("success");
    const sessionId = urlParams.get("session_id");

    if (paymentSuccess === "true" && sessionId) {
      toast.success("Pagamento realizado com sucesso! Ativando sua assinatura...");
      refresh().then(() => {
        window.history.replaceState({}, "", "/pricing");
        setTimeout(() => {
          setLocation("/");
        }, 1500);
      });
    }
  }, [refresh, setLocation]);

  const startTrial = trpc.billing.startTrial.useMutation({
    onSuccess: () => {
      toast.success("Trial ativado com sucesso! Bem-vindo ao ZEAL!");
      refresh().then(() => {
        window.location.href = "/";
      });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const getPaymentLinkWithEmail = (baseUrl: string) => {
    if (!user?.email) return baseUrl;
    const url = new URL(baseUrl);
    url.searchParams.set('prefilled_email', user.email);
    return url.toString();
  };

  const handlePlanAction = (planKey: string) => {
    // If user is already logged in, handle directly
    if (user) {
      if (planKey === "TRIAL") {
        startTrial.mutate();
      } else if (planKey === "BASIC") {
        window.open(getPaymentLinkWithEmail(PAYMENT_LINKS.BASIC), "_blank");
        toast.info("Você será redirecionado para a página de pagamento.");
      } else if (planKey === "PRO") {
        window.open(getPaymentLinkWithEmail(PAYMENT_LINKS.PRO), "_blank");
        toast.info("Você será redirecionado para a página de pagamento.");
      }
      return;
    }

    // If not logged in, redirect to register with selected plan
    setLocation(`/register?plan=${planKey}`);
  };

  // Determine which plans to show based on user's current subscription
  const visiblePlans = (() => {
    if (!user) return PLANS; // Show all plans for visitors
    
    const tier = user.subscriptionTier;
    if (tier === "basic") {
      // Only show Pro for basic users
      return PLANS.filter(p => p.key === "PRO");
    }
    if (tier === "pro" || tier === "unlimited") {
      // Show nothing or current plan info
      return PLANS.filter(p => p.key === "PRO");
    }
    return PLANS; // trial/free users see all
  })();

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <div className="container max-w-6xl py-8">
        <div className="flex items-center gap-4 mb-8">
          {user ? (
            <Link href={user.clinicRole === 'crc' ? '/crc' : user.clinicRole === 'gestor' ? '/gestor' : '/'}>
              <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar ao Dashboard
              </Button>
            </Link>
          ) : (
            <Link href="/login">
              <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Já tenho conta
              </Button>
            </Link>
          )}
        </div>

        {/* Title */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">
            Escolha o plano ideal para seu consultório
          </h1>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            Automatize sua rotina clínica e aumente o faturamento com inteligência artificial
          </p>
          {!user && (
            <p className="text-slate-500 text-sm mt-3">
              Escolha seu plano e crie sua conta em seguida
            </p>
          )}
        </div>

        {/* Plans Grid */}
        <div className={`grid gap-6 max-w-5xl mx-auto ${visiblePlans.length === 1 ? 'md:grid-cols-1 max-w-md' : visiblePlans.length === 2 ? 'md:grid-cols-2 max-w-3xl' : 'md:grid-cols-3'}`}>
          {visiblePlans.map((plan) => (
            <Card
              key={plan.key}
              className={`relative overflow-hidden transition-all duration-300 hover:scale-[1.02] ${
                plan.highlighted
                  ? "bg-gradient-to-b from-purple-500/10 to-indigo-500/10 border-purple-500/50 shadow-lg shadow-purple-500/10"
                  : "bg-slate-900/50 border-slate-800 hover:border-slate-700"
              }`}
            >
              {plan.highlighted && (
                <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-center text-xs font-semibold py-1.5">
                  MAIS POPULAR
                </div>
              )}

              <CardHeader className={plan.highlighted ? "pt-10" : ""}>
                <CardTitle className="text-xl text-white flex items-center gap-2">
                  {plan.key === "PRO" && <Crown className="h-5 w-5 text-purple-400" />}
                  {plan.key === "TRIAL" && <Zap className="h-5 w-5 text-emerald-400" />}
                  {plan.name}
                </CardTitle>
                <CardDescription className="text-slate-400">
                  {plan.description}
                </CardDescription>
                <div className="mt-4">
                  <span className="text-3xl font-bold text-white">{plan.price}</span>
                  <span className="text-slate-400 ml-2">/{plan.interval}</span>
                </div>
              </CardHeader>

              <CardContent>
                <ul className="space-y-3">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2">
                      {feature.included ? (
                        <Check className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                      ) : (
                        <X className="h-4 w-4 text-slate-600 mt-0.5 shrink-0" />
                      )}
                      <span className={`text-sm ${feature.included ? 'text-slate-300' : 'text-slate-600'}`}>
                        {feature.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter>
                <Button
                  className={`w-full ${
                    plan.highlighted
                      ? "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white"
                      : plan.key === "TRIAL"
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                        : "bg-blue-600 hover:bg-blue-700 text-white"
                  }`}
                  onClick={() => handlePlanAction(plan.key)}
                  disabled={startTrial.isPending}
                >
                  {startTrial.isPending && plan.key === "TRIAL" ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Ativando...
                    </>
                  ) : plan.key === "TRIAL" ? (
                    <>
                      <UserPlus className="mr-2 h-4 w-4" />
                      {plan.cta}
                    </>
                  ) : (
                    <>
                      <CreditCard className="mr-2 h-4 w-4" />
                      {plan.cta}
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        {/* Footer note */}
        <div className="text-center mt-8 text-sm text-slate-500">
          <p>Todos os planos incluem acesso à plataforma web. Cancele a qualquer momento.</p>
          <p className="mt-1">Pagamento seguro via Stripe. Cartão de crédito ou débito.</p>
        </div>
      </div>
    </div>
  );
}
