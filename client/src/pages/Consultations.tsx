import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import {
  Loader2,
  ArrowLeft,
  FileText,
  Search,
  Trash2,
  LayoutDashboard,
  Users,
  Menu,
  X,
  LogOut,
  UserCircle,
} from "lucide-react";
import { useLocation } from "wouter";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";

export default function Consultations() {
  const [, setLocation] = useLocation();
  const { user, loading: authLoading, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: consultations, isLoading, refetch } = trpc.consultations.list.useQuery(
    undefined,
    { enabled: !!user }
  );

  const deleteMutation = trpc.consultations.delete.useMutation({
    onSuccess: () => {
      toast.success("Consulta removida com sucesso!");
      setDeleteId(null);
      refetch();
    },
    onError: () => {
      toast.error("Erro ao remover consulta");
    },
  });

  if (authLoading || isLoading) {
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

  const filteredConsultations = consultations?.filter(consultation => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      consultation.patientName.toLowerCase().includes(query) ||
      statusLabels[consultation.status].toLowerCase().includes(query)
    );
  }) || [];

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

        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            <li>
              <button
                onClick={() => { setLocation("/"); setSidebarOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
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
            <li>
              <button
                onClick={() => { setLocation("/consultations"); setSidebarOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-primary text-primary-foreground font-medium"
              >
                <FileText className="h-5 w-5" />
                Consultas
              </button>
            </li>
            <li>
              <button
                onClick={() => { setLocation("/profile"); setSidebarOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
              >
                <UserCircle className="h-5 w-5" />
                Meu Perfil
              </button>
            </li>
          </ul>
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold">
              {user.name?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase() || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.name || "Usuário"}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={logout}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <header className="p-4 lg:p-6 border-b border-border">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2 lg:gap-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 hover:bg-muted rounded-lg"
              >
                <Menu className="h-5 w-5" />
              </button>
              <Button variant="ghost" size="sm" onClick={() => setLocation("/")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Voltar</span>
              </Button>
              <div>
                <h1 className="text-lg lg:text-xl font-bold">Consultas Realizadas</h1>
                <p className="text-xs lg:text-sm text-muted-foreground">
                  Visualize e gerencie todas as consultas
                </p>
              </div>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por paciente ou status"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </header>

        <div className="p-4 lg:p-6 max-w-5xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Lista de Consultas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredConsultations.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  Nenhuma consulta encontrada
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredConsultations.map(consultation => (
                    <div
                      key={consultation.id}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-lg border border-border"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-sm lg:text-base truncate">
                          {consultation.patientName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(consultation.createdAt).toLocaleDateString("pt-BR")}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge className={statusColors[consultation.status]}>
                          {statusLabels[consultation.status]}
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setLocation(`/consultation/${consultation.id}`)}
                        >
                          Ver
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setDeleteId(consultation.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Excluir
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <Dialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir consulta</DialogTitle>
            <DialogDescription>
              Esta ação é permanente e removerá transcrição, notas e arquivos de áudio.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteId && deleteMutation.mutate({ consultationId: deleteId })}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                "Excluir"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}







