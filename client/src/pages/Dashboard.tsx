import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Loader2, Plus, Mic, Calendar, User, Clock, FileText } from "lucide-react";
import { useLocation } from "wouter";
import { getLoginUrl } from "@/const";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { user, loading: authLoading } = useAuth();
  
  const { data: consultations, isLoading } = trpc.consultations.list.useQuery(
    undefined,
    { enabled: !!user }
  );

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <div className="mb-8">
          <img src="/logo.png" alt="ZEAL" className="h-16 w-auto" />
        </div>
        <Card className="max-w-md w-full mx-4">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Acesso Restrito</CardTitle>
            <CardDescription>Faça login para acessar o painel</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button onClick={() => window.location.href = getLoginUrl()}>
              Entrar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const recentConsultations = consultations?.slice(0, 5) || [];
  const statusLabels: Record<string, string> = {
    draft: "Rascunho",
    transcribed: "Transcrito",
    reviewed: "Revisado",
    finalized: "Finalizado",
  };

  const statusColors: Record<string, string> = {
    draft: "bg-yellow-500/20 text-yellow-500",
    transcribed: "bg-blue-500/20 text-blue-500",
    reviewed: "bg-purple-500/20 text-purple-500",
    finalized: "bg-green-500/20 text-green-500",
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="ZEAL" className="h-10 w-auto" />
              <span className="text-xl font-bold text-primary">ZEAL</span>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => setLocation("/patients")}>
                <User className="h-4 w-4 mr-2" />
                Pacientes
              </Button>
              <div className="text-sm text-muted-foreground">
                {user.name || user.email}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">
            Olá, {user.name?.split(' ')[0] || 'Doutor(a)'}!
          </h1>
          <p className="text-muted-foreground">
            Bem-vindo ao ZEAL - Assistente de IA para Consultas Odontológicas
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
          <Card 
            className="cursor-pointer hover:border-primary transition-colors"
            onClick={() => setLocation("/new-consultation")}
          >
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-primary/10">
                  <Mic className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">Nova Consulta</h3>
                  <p className="text-sm text-muted-foreground">
                    Iniciar gravação de áudio
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:border-primary transition-colors"
            onClick={() => setLocation("/patients")}
          >
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-primary/10">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">Pacientes</h3>
                  <p className="text-sm text-muted-foreground">
                    Gerenciar cadastros
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:border-primary transition-colors opacity-50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-primary/10">
                  <Calendar className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">Agenda</h3>
                  <p className="text-sm text-muted-foreground">
                    Em breve
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Consultations */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Consultas Recentes</CardTitle>
                <CardDescription>
                  Últimas consultas registradas
                </CardDescription>
              </div>
              <Button onClick={() => setLocation("/new-consultation")}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Consulta
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : recentConsultations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma consulta registrada ainda</p>
                <Button 
                  variant="link" 
                  className="mt-2"
                  onClick={() => setLocation("/new-consultation")}
                >
                  Iniciar primeira consulta
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {recentConsultations.map((consultation) => (
                  <div
                    key={consultation.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-border hover:border-primary/50 cursor-pointer transition-colors"
                    onClick={() => {
                      if (consultation.status === "draft" && !consultation.transcript) {
                        setLocation(`/consultation/${consultation.id}/review`);
                      } else {
                        setLocation(`/consultation/${consultation.id}`);
                      }
                    }}
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-full bg-muted">
                        <User className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <h4 className="font-medium">{consultation.patientName}</h4>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {new Date(consultation.createdAt).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: 'long',
                            year: 'numeric',
                          })}
                        </div>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[consultation.status]}`}>
                      {statusLabels[consultation.status]}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
