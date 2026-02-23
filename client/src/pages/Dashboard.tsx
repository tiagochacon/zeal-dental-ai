import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Loader2, Plus, Mic, User, Clock, FileText, Users } from "lucide-react";
import { useLocation } from "wouter";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const { data: consultations, isLoading } = trpc.consultations.list.useQuery(
    undefined,
    { enabled: !!user }
  );

  const { data: patients } = trpc.patients.list.useQuery(
    undefined,
    { enabled: !!user }
  );

  const recentConsultations = consultations?.slice(0, 5) || [];
  const totalPatients = patients?.length || 0;
  const completedConsultations = consultations?.filter(c => c.status === "finalized").length || 0;
  const pendingConsultations = consultations?.filter(c => c.status !== "finalized").length || 0;

  const statusLabels: Record<string, string> = {
    draft: "Rascunho",
    transcribed: "Transcrito",
    reviewed: "Revisado",
    finalized: "Finalizado",
  };

  const statusColors: Record<string, string> = {
    draft: "bg-yellow-500/20 text-yellow-400",
    transcribed: "bg-blue-500/20 text-blue-400",
    reviewed: "bg-purple-500/20 text-purple-400",
    finalized: "bg-green-500/20 text-green-400",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-3xl font-bold">
            Olá, {user?.name?.split(' ')[0] || 'Doutor(a)'}!
          </h1>
          <p className="text-sm text-muted-foreground hidden sm:block">
            Bem-vindo ao seu painel de controle Zeal
          </p>
        </div>
        <Button onClick={() => setLocation("/new-consultation")} size="sm" className="shrink-0">
          <Plus className="h-4 w-4 mr-1 sm:mr-2" />
          <span className="hidden sm:inline">Nova</span> Consulta
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-3">
        <Card className="bg-card border-border">
          <CardContent className="p-4 lg:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Total de Pacientes</p>
                <p className="text-2xl lg:text-3xl font-bold">{totalPatients}</p>
                <p className="text-xs text-muted-foreground mt-1 hidden sm:block">pacientes cadastrados</p>
              </div>
              <Users className="h-8 w-8 lg:h-10 lg:w-10 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4 lg:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Consultas Realizadas</p>
                <p className="text-2xl lg:text-3xl font-bold">{completedConsultations}</p>
                <p className="text-xs text-muted-foreground mt-1 hidden sm:block">consultas completas</p>
              </div>
              <FileText className="h-8 w-8 lg:h-10 lg:w-10 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border col-span-2 lg:col-span-1">
          <CardContent className="p-4 lg:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Em Andamento</p>
                <p className="text-2xl lg:text-3xl font-bold">{pendingConsultations}</p>
                <p className="text-xs text-muted-foreground mt-1 hidden sm:block">consultas pendentes</p>
              </div>
              <Clock className="h-8 w-8 lg:h-10 lg:w-10 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Consultations */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Mic className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Consultas Recentes</h2>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : recentConsultations.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="p-8 text-center">
              <Mic className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhuma consulta ainda</h3>
              <p className="text-muted-foreground mb-4">
                Comece gravando sua primeira consulta
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
                className="bg-card border-border hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => setLocation(`/consultation/${consultation.id}`)}
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{consultation.patientName || "Paciente"}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(consultation.createdAt).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[consultation.status] || statusColors.draft}`}>
                    {statusLabels[consultation.status] || consultation.status}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
