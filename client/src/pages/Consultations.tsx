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
  FileText,
  Search,
  Trash2,
} from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function Consultations() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
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
      statusLabels[consultation.status]?.toLowerCase().includes(query)
    );
  }) || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-lg lg:text-xl font-bold">Consultas Realizadas</h1>
          <p className="text-xs lg:text-sm text-muted-foreground">
            Visualize e gerencie todas as consultas
          </p>
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

      {/* Consultation List */}
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

      {/* Delete Confirmation Dialog */}
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
