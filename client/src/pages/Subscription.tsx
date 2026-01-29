import { useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, Sparkles, CreditCard, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function Subscription() {
  const { user } = useAuth();
  const [location] = useLocation();
  
  const { data: subscriptionInfo, isLoading } = trpc.stripe.getSubscriptionInfo.useQuery();
  const createCheckout = trpc.stripe.createCheckoutSession.useMutation({
    onSuccess: (data) => {
      if (data.checkoutUrl) {
        toast.info("Redirecionando para o checkout...");
        window.open(data.checkoutUrl, "_blank");
      }
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao criar sessão de checkout");
    },
  });
  const createPortal = trpc.stripe.createPortalSession.useMutation({
    onSuccess: (data) => {
      if (data.portalUrl) {
        toast.info("Redirecionando para o portal de assinatura...");
        window.open(data.portalUrl, "_blank");
      }
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao abrir portal de assinatura");
    },
  });

  // Handle success/cancel from Stripe checkout
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "true") {
      toast.success("Assinatura realizada com sucesso! Bem-vindo ao ZEAL Pro.");
    } else if (params.get("canceled") === "true") {
      toast.info("Checkout cancelado. Você pode tentar novamente quando quiser.");
    }
  }, []);

  const isActive = subscriptionInfo?.subscriptionStatus === "active" || subscriptionInfo?.subscriptionStatus === "trialing";
  const isAdmin = user?.role === "admin";

  const handleSubscribe = (priceId: string) => {
    createCheckout.mutate({ priceId });
  };

  const handleManageSubscription = () => {
    createPortal.mutate();
  };

  const formatPrice = (price: number, currency: string) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: currency,
    }).format(price);
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
            <Crown className="h-8 w-8 text-yellow-500" />
            Assinatura ZEAL Pro
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Desbloqueie todo o potencial do ZEAL com transcrição ilimitada, 
            geração automática de Nota SOAP e muito mais.
          </p>
        </div>

        {/* Current Status */}
        {(isActive || isAdmin) && (
          <Card className="border-primary/50 bg-primary/5">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <CardTitle>Status da Assinatura</CardTitle>
                </div>
                <Badge variant={isAdmin ? "default" : "secondary"} className="bg-green-500/20 text-green-400 border-green-500/30">
                  {isAdmin ? "Admin (Acesso Total)" : "Ativo"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                {isAdmin 
                  ? "Como administrador, você tem acesso completo a todas as funcionalidades do ZEAL."
                  : "Você tem acesso completo a todas as funcionalidades premium do ZEAL Pro."}
              </p>
              {subscriptionInfo?.subscriptionEndDate && (
                <p className="text-sm text-muted-foreground mt-2">
                  Próxima renovação: {new Date(subscriptionInfo.subscriptionEndDate).toLocaleDateString("pt-BR")}
                </p>
              )}
            </CardContent>
            {!isAdmin && (
              <CardFooter>
                <Button 
                  variant="outline" 
                  onClick={handleManageSubscription}
                  disabled={createPortal.isPending}
                >
                  {createPortal.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CreditCard className="h-4 w-4 mr-2" />
                  )}
                  Gerenciar Assinatura
                  <ExternalLink className="h-4 w-4 ml-2" />
                </Button>
              </CardFooter>
            )}
          </Card>
        )}

        {/* Pricing Cards */}
        {!isActive && !isAdmin && (
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {subscriptionInfo?.plans.map((plan) => (
              <Card 
                key={plan.key} 
                className={`relative ${plan.key === "pro" ? "border-primary shadow-lg shadow-primary/20" : ""}`}
              >
                {plan.key === "pro" && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground">
                      Mais Popular
                    </Badge>
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Crown className={`h-5 w-5 ${plan.key === "pro" ? "text-yellow-500" : "text-muted-foreground"}`} />
                    {plan.name}
                  </CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold">
                      {formatPrice(plan.price, plan.currency)}
                    </span>
                    <span className="text-muted-foreground">
                      /mês
                    </span>
                  </div>
                  
                  <ul className="space-y-2">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button 
                    className="w-full" 
                    variant={plan.key === "pro" ? "default" : "outline"}
                    onClick={() => plan.priceId && handleSubscribe(plan.priceId)}
                    disabled={createCheckout.isPending || !plan.priceId}
                  >
                    {createCheckout.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : null}
                    Assinar Agora
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}

        {/* Features Comparison */}
        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle>O que está incluído no ZEAL Pro</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>Transcrição de áudio ilimitada</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>Geração automática de Nota SOAP</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>Odontograma automático</span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>Exportação de PDF profissional</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>Histórico completo de consultas</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>Suporte prioritário</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Test Mode Notice */}
        <div className="text-center text-sm text-muted-foreground">
          <p>
            Para testar o pagamento, use o cartão: <code className="bg-muted px-2 py-1 rounded">4242 4242 4242 4242</code>
          </p>
          <p className="mt-1">
            Data de validade: qualquer data futura | CVV: qualquer 3 dígitos
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
