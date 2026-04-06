import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import {
  Loader2,
  FileText,
  Search,
  Trash2,
  ChevronRight,
  Plus,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { consultationStatusConfig } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

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
      toast.error("Erro ao remover consulta. Tente novamente.");
    },
  });

  const filteredConsultations = consultations?.filter(consultation => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      consultation.patientName.toLowerCase().includes(query) ||
      (consultationStatusConfig[consultation.status as keyof typeof consultationStatusConfig]?.label ?? consultation.status).toLowerCase().includes(query)
    );
  }) || [];

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-lg lg:text-2xl font-bold">Consultas Realizadas</h1>
          <p className="text-xs lg:text-sm text-muted-foreground">
            Visualize e gerencie todas as consultas
          </p>
        </div>
        <Button size="sm" onClick={() => setLocation("/new-consultation")} className="shrink-0">
          <Plus className="h-4 w-4 mr-2" />
          Nova Consulta
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por paciente ou status..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 h-11 surface-glass border-white/5 text-foreground placeholder:text-muted-foreground transition-all focus-visible:ring-1 focus-visible:ring-primary/50"
        />
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
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-6 w-20 rounded-full" />
                    <Skeleton className="h-8 w-16 rounded-md" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredConsultations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="p-4 rounded-full bg-muted mb-4">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                {searchQuery ? "Nenhuma consulta encontrada" : "Nenhuma consulta ainda"}
              </h3>
              <p className="text-muted-foreground text-sm max-w-sm mb-6">
                {searchQuery
                  ? `Nenhuma consulta corresponde a "${searchQuery}".`
                  : "Grave sua primeira consulta para começar a usar o sistema."}
              </p>
              {!searchQuery && (
                <Button onClick={() => setLocation("/new-consultation")}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Consulta
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredConsultations.map(consultation => (
                <div
                  key={consultation.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-xl surface-glass border border-white/5 hover:bg-white/5 hover:border-primary/30 transition-all duration-200 cursor-pointer group"
                  onClick={() => setLocation(`/consultation/${consultation.id}`)}
                >
                  <div className="min-w-0">
                    <p className="font-medium text-sm lg:text-base truncate">
                      {consultation.patientName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(consultation.createdAt).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                    <Badge className={consultationStatusConfig[consultation.status as keyof typeof consultationStatusConfig]?.className}>
                      {consultationStatusConfig[consultation.status as keyof typeof consultationStatusConfig]?.label ?? consultation.status}
                    </Badge>

                    {/* Treatment Closed Badge */}
                    {consultation.status === "finalized" && (consultation as any).treatmentClosed === true && (
                      <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-none font-medium gap-1 shadow-inner shadow-emerald-500/10">
                        <CheckCircle2 className="h-3 w-3" />
                        Fechado
                      </Badge>
                    )}
                    {consultation.status === "finalized" && (consultation as any).treatmentClosed === false && (
                      <Badge className="bg-destructive/10 text-destructive border-none font-medium gap-1 shadow-inner shadow-destructive/10">
                        <XCircle className="h-3 w-3" />
                        Não Fechado
                      </Badge>
                    )}

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLocation(`/consultation/${consultation.id}`);
                          }}
                        >
                          Ver
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Ver consulta</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteId(consultation.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Remover</TooltipContent>
                    </Tooltip>
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
              Esta ação é permanente e removerá a transcrição, notas clínicas e arquivos de áudio.
              Esta operação não pode ser desfeita.
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
                "Excluir Permanentemente"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
