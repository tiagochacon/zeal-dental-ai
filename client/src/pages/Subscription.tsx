import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Check, 
  Crown, 
  Sparkles, 
  CreditCard, 
  ExternalLink, 
  Loader2,
  Calendar,
  Zap,
  AlertTriangle,
  ArrowUpRight,
  Shield,
  Clock,
  FileText,
  Mic,
  Brain,
  TrendingUp
} from "lucide-react";
import { toast } from "sonner";

// Stripe Payment Links
const PAYMENT_LINKS = {
  BASIC: "https://buy.stripe.com/9B6aEY8KNfDw9Ms3f6b7y00",
  PRO: "https://buy.stripe.com/8x27sMd131MG4s8aHyb7y01",
};

const PLAN_DETAILS = {
  trial: {
    name: "Trial Gratuito",
    color: "text-slate-400",
    bgColor: "bg-slate-500/10",
    borderColor: "border-slate-500/30",
    limit: 7,
    features: [
      "7 consultas de teste",
      "Transcrição automática de áudio",
      "Notas Clínicas com IA",
      "Odontograma automático",
      "Análise de Negociação/Neurovendas",
    ],
  },
  basic: {
    name: "ZEAL Básico",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
    limit: 20,
    features: [
      "20 consultas/mês",
      "Transcrição automática de áudio",
      "Notas Clínicas com IA",
      "Odontograma automático",
      "Exportação de PDF",
    ],
  },
  pro: {
    name: "ZEAL Pro",
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/30",
    limit: 50,
    features: [
      "50 consultas/mês",
      "Transcrição automática de áudio",
      "Notas Clínicas com IA",
      "Odontograma automático",
      "Exportação de PDF",
      "Análise de Negociação/Neurovendas",
      "Perfil psicográfico do paciente",
      "Script de fechamento PARE",
      "Suporte prioritário",
    ],
  },
  unlimited: {
    name: "Acesso Ilimitado",
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/10",
    borderColor: "border-yellow-500/30",
    limit: Infinity,
    features: [
      "Consultas ilimitadas",
      "Todos os recursos do PRO",
      "Suporte VIP",
    ],
  },
};

export default function Subscription() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  
  const { data: subscriptionInfo, isLoading, refetch } = trpc.stripe.getSubscriptionInfo.useQuery();
  const { data: planInfo } = trpc.billing.getPlanInfo.useQuery();
  
  const isGestor = user?.clinicRole === 'gestor';
  
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
      toast.success("Assinatura realizada com sucesso! Bem-vindo ao ZEAL.");
      refetch();
    } else if (params.get("canceled") === "true") {
      toast.info("Checkout cancelado. Você pode tentar novamente quando quiser.");
    }
  }, [refetch]);

  const isAdmin = user?.role === "admin";
  const currentTier = planInfo?.tier || "trial";
  const planDetails = PLAN_DETAILS[currentTier as keyof typeof PLAN_DETAILS] || PLAN_DETAILS.trial;
  const usedConsultations = planInfo?.used || 0;
  const maxConsultations = planInfo?.limit || 7;
  const remainingConsultations = maxConsultations === Infinity ? Infinity : Math.max(0, maxConsultations - usedConsultations);
  const usagePercent = maxConsultations === Infinity ? 0 : Math.min((usedConsultations / maxConsultations) * 100, 100);

  const handleManageSubscription = () => {
    createPortal.mutate();
  };

  const handleUpgrade = (plan: "basic" | "pro") => {
    const email = user?.email || "";
    const link = plan === "basic" ? PAYMENT_LINKS.BASIC : PAYMENT_LINKS.PRO;
    const url = email ? `${link}?prefilled_email=${encodeURIComponent(email)}` : link;
    window.open(url, "_blank");
    toast.info("Redirecionando para o checkout...");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <CreditCard className="h-8 w-8 text-primary" />
            {isGestor ? "Assinatura da Clínica" : "Minha Assinatura"}
          </h1>
          <p className="text-muted-foreground">
            {isGestor 
              ? "Gerencie o plano da clínica e acompanhe o uso do time"
              : "Gerencie seu plano e acompanhe seu uso do ZEAL"
            }
          </p>
        </div>

        {/* Current Plan Card */}
        <Card className={`${planDetails.borderColor} ${planDetails.bgColor}`}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {currentTier === "pro" || currentTier === "unlimited" ? (
                  <Crown className="h-6 w-6 text-yellow-500" />
                ) : currentTier === "basic" ? (
                  <Zap className="h-6 w-6 text-blue-500" />
                ) : (
                  <Clock className="h-6 w-6 text-slate-400" />
                )}
                <div>
                  <CardTitle className={planDetails.color}>{planDetails.name}</CardTitle>
                  <CardDescription>
                    {isAdmin ? "Acesso administrativo" : "Seu plano atual"}
                  </CardDescription>
                </div>
              </div>
              <Badge 
                variant="outline" 
                className={`${planDetails.bgColor} ${planDetails.color} ${planDetails.borderColor}`}
              >
                {subscriptionInfo?.subscriptionStatus === "active" ? "Ativo" : 
                 subscriptionInfo?.subscriptionStatus === "trialing" ? "Trial" :
                 isAdmin ? "Admin" : "Inativo"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Usage Progress */}
            {!isAdmin && currentTier !== "unlimited" && (
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {isGestor ? "Consultas do time" : "Consultas utilizadas"}
                  </span>
                  <span className={planDetails.color}>
                    {usedConsultations} / {maxConsultations}
                  </span>
                </div>
                <Progress 
                  value={usagePercent} 
                  className="h-2"
                />
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {remainingConsultations === Infinity 
                      ? "Consultas ilimitadas"
                      : `${remainingConsultations} consulta${remainingConsultations !== 1 ? 's' : ''} restante${remainingConsultations !== 1 ? 's' : ''}`
                    }
                  </p>
                  {usagePercent >= 80 && (
                    <p className="text-xs text-amber-400 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Próximo do limite
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Plan Features */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Recursos incluídos:</p>
              <div className="grid grid-cols-2 gap-2">
                {planDetails.features.map((feature, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Subscription Details */}
            {subscriptionInfo?.subscriptionEndDate && !isAdmin && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>
                  {subscriptionInfo.subscriptionStatus === "active" 
                    ? `Próxima renovação: ${new Date(subscriptionInfo.subscriptionEndDate).toLocaleDateString("pt-BR")}`
                    : `Trial expira em: ${new Date(subscriptionInfo.subscriptionEndDate).toLocaleDateString("pt-BR")}`
                  }
                </span>
              </div>
            )}
          </CardContent>
          
          {/* Actions */}
          {!isAdmin && (currentTier === "basic" || currentTier === "pro") && (
            <CardFooter className="flex gap-3">
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
                Gerenciar Pagamento
                <ExternalLink className="h-4 w-4 ml-2" />
              </Button>
              <Button 
                variant="ghost" 
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                onClick={() => setShowCancelDialog(true)}
              >
                Cancelar Assinatura
              </Button>
            </CardFooter>
          )}
        </Card>

        {/* Upgrade Options */}
        {(currentTier === "trial" || currentTier === "basic") && !isAdmin && (
          <>
            <Separator />
            
            <div className="space-y-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <ArrowUpRight className="h-5 w-5 text-primary" />
                Fazer Upgrade
              </h2>
              <p className="text-muted-foreground">
                Desbloqueie mais recursos e aumente sua produtividade
              </p>

              <div className="grid md:grid-cols-2 gap-4">
                {/* Basic Plan */}
                {currentTier === "trial" && (
                  <Card className="border-blue-500/30 hover:border-blue-500/50 transition-colors">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2 text-blue-400">
                          <Zap className="h-5 w-5" />
                          ZEAL Básico
                        </CardTitle>
                      </div>
                      <CardDescription>Para dentistas em crescimento</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold">R$ 99,90</span>
                        <span className="text-muted-foreground">/mês</span>
                      </div>
                      <ul className="space-y-2 text-sm">
                        <li className="flex items-center gap-2">
                          <Mic className="h-4 w-4 text-blue-400" />
                          20 consultas/mês
                        </li>
                        <li className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-blue-400" />
                          Notas Clínicas com IA
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-500" />
                          Odontograma automático
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-500" />
                          Exportação de PDF
                        </li>
                      </ul>
                    </CardContent>
                    <CardFooter>
                      <Button 
                        className="w-full bg-blue-600 hover:bg-blue-700"
                        onClick={() => handleUpgrade("basic")}
                      >
                        Assinar Básico
                        <ArrowUpRight className="h-4 w-4 ml-2" />
                      </Button>
                    </CardFooter>
                  </Card>
                )}

                {/* Pro Plan */}
                <Card className="border-purple-500/30 hover:border-purple-500/50 transition-colors relative">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0">
                      <Sparkles className="h-3 w-3 mr-1" />
                      Mais Popular
                    </Badge>
                  </div>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-purple-400">
                        <Crown className="h-5 w-5" />
                        ZEAL Pro
                      </CardTitle>
                    </div>
                    <CardDescription>Para consultórios de alta performance</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold">R$ 199,90</span>
                      <span className="text-muted-foreground">/mês</span>
                    </div>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-center gap-2">
                        <Mic className="h-4 w-4 text-purple-400" />
                        50 consultas/mês
                      </li>
                      <li className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-purple-400" />
                        Tudo do Básico +
                      </li>
                      <li className="flex items-center gap-2">
                        <Brain className="h-4 w-4 text-purple-400" />
                        Análise de Negociação/Neurovendas
                      </li>
                      <li className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-purple-400" />
                        Perfil psicográfico do paciente
                      </li>
                      <li className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-purple-400" />
                        Script de fechamento PARE
                      </li>
                      <li className="flex items-center gap-2">
                        <Crown className="h-4 w-4 text-purple-400" />
                        Suporte prioritário
                      </li>
                    </ul>
                  </CardContent>
                  <CardFooter>
                    <Button 
                      className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                      onClick={() => handleUpgrade("pro")}
                    >
                      Assinar Pro
                      <Crown className="h-4 w-4 ml-2" />
                    </Button>
                  </CardFooter>
                </Card>
              </div>
            </div>
          </>
        )}

        {/* Cancel Dialog */}
        <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
          <DialogContent className="bg-slate-900 border-slate-800">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-400">
                <AlertTriangle className="h-5 w-5" />
                Cancelar Assinatura
              </DialogTitle>
              <DialogDescription>
                Tem certeza que deseja cancelar sua assinatura? Você perderá acesso às funcionalidades premium ao final do período atual.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <p className="text-sm text-muted-foreground">
                Ao cancelar, você ainda terá acesso até o final do período pago. Após isso, sua conta será rebaixada para o plano gratuito.
              </p>
            </div>
            <DialogFooter className="gap-2">
              <Button 
                variant="outline" 
                onClick={() => setShowCancelDialog(false)}
              >
                Manter Assinatura
              </Button>
              <Button 
                variant="destructive"
                onClick={() => {
                  handleManageSubscription();
                  setShowCancelDialog(false);
                }}
              >
                Cancelar Assinatura
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </div>
  );
}
