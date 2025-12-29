import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Loader2, Plus, Mic, User, Clock, FileText, LayoutDashboard, Users, Star, Menu, X } from "lucide-react";
import { useLocation } from "wouter";
import { getLoginUrl } from "@/const";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { user, loading: authLoading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  const { data: consultations, isLoading } = trpc.consultations.list.useQuery(
    undefined,
    { enabled: !!user }
  );

  const { data: patients } = trpc.patients.list.useQuery(
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
    window.location.href = getLoginUrl();
    return null;
  }

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
    <div className="min-h-screen bg-background flex">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-64 border-r border-border bg-sidebar flex flex-col
        transform transition-transform duration-200 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo */}
        <div className="p-6 border-b border-sidebar-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="ZEAL" className="h-8 w-auto" />
            <span className="text-xl font-bold text-foreground">Zeal</span>
          </div>
          <button 
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 hover:bg-sidebar-accent rounded-lg"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            <li>
              <button
                onClick={() => { setLocation("/"); setSidebarOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-primary text-primary-foreground font-medium"
              >
                <LayoutDashboard className="h-5 w-5" />
                Dashboard
              </button>
            </li>
            <li>
              <button
                onClick={() => { setLocation("/patients"); setSidebarOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
              >
                <Users className="h-5 w-5" />
                Pacientes
              </button>
            </li>
          </ul>
        </nav>

        {/* User Profile */}
        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold">
              {user.name?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase() || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.name || "Usuário"}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Header */}
        <header className="p-4 lg:p-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 hover:bg-muted rounded-lg"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-xl lg:text-3xl font-bold">
                Olá, {user.name?.split(' ')[0] || 'Doutor(a)'}!
              </h1>
              <p className="text-sm text-muted-foreground hidden sm:block">
                Bem-vindo ao seu painel de controle Zeal
              </p>
            </div>
          </div>
          <Button onClick={() => setLocation("/new-consultation")} size="sm" className="shrink-0">
            <Plus className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Nova</span> Consulta
          </Button>
        </header>

        {/* Stats Cards */}
        <div className="px-4 lg:px-6 grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4 lg:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs lg:text-sm text-muted-foreground">Total de Pacientes</p>
                  <p className="text-2xl lg:text-3xl font-bold mt-1 lg:mt-2">{totalPatients}</p>
                  <p className="text-xs text-muted-foreground mt-1 hidden sm:block">pacientes cadastrados</p>
                </div>
                <Users className="h-6 w-6 lg:h-8 lg:w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-4 lg:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs lg:text-sm text-muted-foreground">Consultas Realizadas</p>
                  <p className="text-2xl lg:text-3xl font-bold mt-1 lg:mt-2">{completedConsultations}</p>
                  <p className="text-xs text-muted-foreground mt-1 hidden sm:block">consultas completas</p>
                </div>
                <FileText className="h-6 w-6 lg:h-8 lg:w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-4 lg:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs lg:text-sm text-muted-foreground">Em Andamento</p>
                  <p className="text-2xl lg:text-3xl font-bold mt-1 lg:mt-2">{pendingConsultations}</p>
                  <p className="text-xs text-muted-foreground mt-1 hidden sm:block">consultas pendentes</p>
                </div>
                <Clock className="h-6 w-6 lg:h-8 lg:w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border border-l-4 border-l-yellow-500">
            <CardContent className="p-4 lg:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs lg:text-sm text-muted-foreground">Avaliação Média</p>
                  <p className="text-2xl lg:text-3xl font-bold mt-1 lg:mt-2">N/A</p>
                  <p className="text-xs text-muted-foreground mt-1 hidden sm:block">0 avaliações</p>
                </div>
                <Star className="h-6 w-6 lg:h-8 lg:w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Consultations */}
        <div className="p-4 lg:p-6">
          <Card className="bg-card border-border">
            <CardContent className="p-4 lg:p-6">
              <div className="flex items-center gap-3 mb-4 lg:mb-6">
                <Mic className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-base lg:text-lg font-semibold">Consultas Recentes</h2>
              </div>

              {isLoading ? (
                <div className="flex justify-center py-8 lg:py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : recentConsultations.length === 0 ? (
                <div className="text-center py-8 lg:py-12 text-muted-foreground">
                  <Mic className="h-12 w-12 lg:h-16 lg:w-16 mx-auto mb-4 opacity-30" />
                  <p className="text-base lg:text-lg">Nenhuma consulta registrada ainda</p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => setLocation("/new-consultation")}
                  >
                    Iniciar Primeira Consulta
                  </Button>
                </div>
              ) : (
                <div className="space-y-2 lg:space-y-3">
                  {recentConsultations.map((consultation) => (
                    <div
                      key={consultation.id}
                      className="flex items-center justify-between p-3 lg:p-4 rounded-lg border border-border hover:border-primary/50 cursor-pointer transition-colors"
                      onClick={() => {
                        if (consultation.status === "draft" && !consultation.transcript) {
                          setLocation(`/consultation/${consultation.id}/review`);
                        } else {
                          setLocation(`/consultation/${consultation.id}`);
                        }
                      }}
                    >
                      <div className="flex items-center gap-3 lg:gap-4 min-w-0">
                        <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                          <User className="h-4 w-4 lg:h-5 lg:w-5 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm lg:text-base truncate">{consultation.patientName}</p>
                          <p className="text-xs lg:text-sm text-muted-foreground">
                            {new Date(consultation.createdAt).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium shrink-0 ${statusColors[consultation.status]}`}>
                        {statusLabels[consultation.status]}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
