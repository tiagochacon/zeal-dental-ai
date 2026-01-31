import { useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Check, Crown, CreditCard, Loader2, UserPlus, Zap } from "lucide-react";
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
      "Até 7 consultas",
      "Transcrição de áudio",
      "Geração de Nota SOAP",
      "Odontograma automático",
      "Suporte por email",
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
      "Até 20 consultas/mês",
      "Transcrição ilimitada",
      "Geração de Nota SOAP",
      "Odontograma automático",
      "Exportação de PDF",
      "Suporte por email",
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
      "Até 50 consultas/mês",
      "Transcrição ilimitada",
      "Geração de Nota SOAP",
      "Odontograma automático",
      "Exportação de PDF",
      "Relatórios avançados",
      "Suporte prioritário",
      "API access",
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
      // Refresh user data to get updated subscription status
      refresh().then(() => {
        // Clear URL params
        window.history.replaceState({}, "", "/pricing");
        // Redirect to dashboard after a short delay
        setTimeout(() => {
          setLocation("/");
        }, 1500);
      });
    }
  }, [refresh, setLocation]);

  const startTrial = trpc.billing.startTrial.useMutation({
    onSuccess: async () => {
      toast.success("Trial iniciado! Você tem 7 dias para testar o ZEAL Pro.");
      await refresh();
      // Force navigation to dashboard
      window.location.href = "/";
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao iniciar trial");
    },
  });

  const handleStartTrial = () => {
    if (!user) {
      toast.error("Você precisa estar logado para iniciar um trial");
      return;
    }
    startTrial.mutate();
  };

  const handleSubscribe = (planKey: string) => {
    if (!user) {
      toast.error("Você precisa estar logado para assinar");
      return;
    }

    const paymentLink = PAYMENT_LINKS[planKey as keyof typeof PAYMENT_LINKS];
    if (paymentLink) {
      // Add user email and client_reference_id to payment link
      const url = new URL(paymentLink);
      if (user.email) {
        url.searchParams.set("prefilled_email", user.email);
      }
      url.searchParams.set("client_reference_id", user.id.toString());
      
      toast.info("Redirecionando para o checkout seguro...");
      // Open in same tab for better UX
      window.location.href = url.toString();
    }
  };

  return (
    <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center space-y-4 mb-12">
          <h1 className="text-4xl font-bold tracking-tight">
            Planos Simples e Transparentes
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Escolha o plano perfeito para sua clínica odontológica. Sem taxas ocultas, cancele quando quiser.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/login">
              <Button variant="outline" className="w-full sm:w-auto">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar para Login
              </Button>
            </Link>
            <Link href="/register">
              <Button variant="outline" className="w-full sm:w-auto">
                <UserPlus className="h-4 w-4 mr-2" />
                Criar Nova Conta
              </Button>
            </Link>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {PLANS.map((plan) => (
            <Card
              key={plan.key}
              className={`relative flex flex-col ${
                plan.highlighted
                  ? "border-primary shadow-lg shadow-primary/20 md:scale-105"
                  : ""
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground">
                    <Crown className="h-3 w-3 mr-1" />
                    Mais Popular
                  </Badge>
                </div>
              )}

              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {plan.key === "TRIAL" ? (
                    <Zap className="h-5 w-5 text-yellow-500" />
                  ) : (
                    <Crown className="h-5 w-5 text-primary" />
                  )}
                  {plan.name}
                </CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>

              <CardContent className="flex-1 space-y-6">
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground text-sm">
                      {plan.interval}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Até {plan.consultationLimit} consultas
                  </p>
                </div>

                <ul className="space-y-3">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-3">
                      <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter className="flex flex-col gap-3">
                {plan.key === "TRIAL" ? (
                  <Button
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
                    onClick={handleStartTrial}
                    disabled={startTrial.isPending}
                  >
                    {startTrial.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Zap className="h-4 w-4 mr-2" />
                    )}
                    {plan.cta}
                  </Button>
                ) : (
                  <>
                    <Button
                      className={`w-full ${plan.highlighted ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800' : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800'}`}
                      onClick={() => handleSubscribe(plan.key)}
                    >
                      <CreditCard className="h-4 w-4 mr-2" />
                      {plan.cta}
                    </Button>
                  </>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>

        {/* FAQ */}
        <div className="max-w-3xl mx-auto space-y-6">
          <h2 className="text-2xl font-bold text-center mb-8">
            Perguntas Frequentes
          </h2>

          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Posso cancelar minha assinatura?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Sim! Você pode cancelar sua assinatura a qualquer momento. Não há compromisso de longo prazo.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">O que acontece após o trial de 7 dias?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Após o trial expirar, você será redirecionado para escolher um plano. Seu acesso será bloqueado até que você assine.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Posso fazer upgrade de plano?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Sim! Você pode fazer upgrade ou downgrade de plano a qualquer momento. As mudanças entram em vigor no próximo ciclo de faturamento.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Como funciona o limite de consultas?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  O limite de consultas é resetado no primeiro dia de cada mês. Quando você atinge o limite, você pode fazer upgrade para um plano superior ou aguardar o reset mensal.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground mt-12">
          <p>
            Pagamento seguro processado pelo Stripe. Seus dados estão protegidos.
          </p>
        </div>
      </div>
    </div>
  );
}
