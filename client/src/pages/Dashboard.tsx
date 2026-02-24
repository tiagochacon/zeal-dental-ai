import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { Plus, Mic, User, FileText, Users, Clock, ChevronRight, TrendingUp } from "lucide-react";
import { useLocation } from "wouter";
import { consultationStatusConfig } from "@/lib/utils";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  // Redirect CRC users to their dashboard
  useEffect(() => {
    if (user?.clinicRole === 'crc') {
      setLocation('/crc');
    }
  }, [user, setLocation]);

  const { data: consultations, isLoading: consultationsLoading } = trpc.consultations.list.useQuery(
    undefined,
    { enabled: !!user }
  );

  const { data: patients, isLoading: patientsLoading } = trpc.patients.list.useQuery(
    undefined,
    { enabled: !!user }
  );

  const isLoading = consultationsLoading || patientsLoading;
  const recentConsultations = consultations?.slice(0, 5) || [];
  const totalPatients = patients?.length || 0;
  const completedConsultations = consultations?.filter(c => c.status === "finalized").length || 0;
  const pendingConsultations = consultations?.filter(c => c.status !== "finalized").length || 0;

  const kpiCards = [
    {
      label: "Total de Pacientes",
      value: totalPatients,
      sub: "pacientes cadastrados",
      icon: Users,
      color: "blue",
    },
    {
      label: "Consultas Realizadas",
      value: completedConsultations,
      sub: "consultas finalizadas",
      icon: FileText,
      color: "green",
    },
    {
      label: "Em Andamento",
      value: pendingConsultations,
      sub: "consultas pendentes",
      icon: Clock,
      color: "amber",
    },
  ];

  const colorMap: Record<string, string> = {
    blue: "text-blue-500 bg-blue-500/10",
    green: "text-emerald-500 bg-emerald-500/10",
    amber: "text-amber-500 bg-amber-500/10",
  };

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-3xl font-bold">
            Olá, {user?.name?.split(' ')[0] || 'Doutor(a)'}!
          </h1>
          <p className="text-sm text-muted-foreground hidden sm:block">
            Dashboard Dentista — Painel de controle
          </p>
        </div>
        <Button onClick={() => setLocation("/new-consultation")} size="sm" className="shrink-0">
          <Plus className="h-4 w-4 mr-1 sm:mr-2" />
          <span className="hidden sm:inline">Nova</span> Consulta
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3">
        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <Skeleton className="h-10 w-10 rounded-xl" />
                  </div>
                  <Skeleton className="h-8 w-16 mb-2" />
                  <Skeleton className="h-4 w-32" />
                </CardContent>
              </Card>
            ))
          : kpiCards.map((card) => {
              const Icon = card.icon;
              return (
                <Card key={card.label} className="relative overflow-hidden">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className={`p-2.5 rounded-xl ${colorMap[card.color]}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <TrendingUp className="h-4 w-4 text-muted-foreground/40" />
                    </div>
                    <p className="text-3xl font-bold tracking-tight">{card.value}</p>
                    <p className="text-sm text-muted-foreground mt-1">{card.label}</p>
                  </CardContent>
                  <div className="absolute -right-4 -bottom-4 h-24 w-24 rounded-full bg-muted/30" />
                </Card>
              );
            })}
      </div>

      {/* Recent Consultations */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Mic className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Consultas Recentes</h2>
          </div>
          {(consultations?.length ?? 0) > 5 && (
            <Button variant="ghost" size="sm" onClick={() => setLocation("/consultations")}>
              Ver todas
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>

        {consultationsLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4 flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-6 w-20 rounded-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : recentConsultations.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="p-4 rounded-full bg-muted mb-4">
                <Mic className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Nenhuma consulta ainda</h3>
              <p className="text-muted-foreground text-sm max-w-sm mb-6">
                Comece gravando sua primeira consulta para gerar notas SOAP, odontogramas e muito mais.
              </p>
              <Button onClick={() => setLocation("/new-consultation")}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Consulta
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {recentConsultations.map((consultation) => (
              <Card
                key={consultation.id}
                className="hover:shadow-md hover:border-primary/30 transition-all duration-200 cursor-pointer"
                onClick={() => setLocation(`/consultation/${consultation.id}`)}
              >
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{consultation.patientName || "Paciente"}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(consultation.createdAt).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${consultationStatusConfig[consultation.status as keyof typeof consultationStatusConfig]?.className ?? consultationStatusConfig.draft.className}`}>
                      {consultationStatusConfig[consultation.status as keyof typeof consultationStatusConfig]?.label ?? consultation.status}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
