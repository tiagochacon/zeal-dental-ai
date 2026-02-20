import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2, Save, UserCircle, AlertCircle } from "lucide-react";

export default function DentistProfile() {
  const [isEditing, setIsEditing] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    croNumber: "",
  });

  const { data: profile, isLoading, refetch } = trpc.auth.getProfile.useQuery();

  const updateProfileMutation = trpc.auth.updateProfile.useMutation({
    onSuccess: () => {
      toast.success("Perfil atualizado com sucesso!");
      setIsEditing(false);
      setIsDirty(false);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao atualizar perfil");
    },
  });

  // FIX: Só atualiza formData quando NÃO está editando
  // Previne que refetch() sobrescreva mudanças em andamento
  useEffect(() => {
    if (profile && !isEditing) {
      setFormData({
        name: profile.name || "",
        croNumber: profile.croNumber || "",
      });
    }
  }, [profile, isEditing]);

  // Detecta mudanças não salvas para ativar estado "dirty"
  useEffect(() => {
    if (profile && isEditing) {
      const hasChanges =
        formData.name !== (profile.name || "") ||
        formData.croNumber !== (profile.croNumber || "");
      setIsDirty(hasChanges);
    } else {
      setIsDirty(false);
    }
  }, [formData, profile, isEditing]);

  // Previne saída acidental com mudanças não salvas
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    if (isDirty) {
      window.addEventListener("beforeunload", handleBeforeUnload);
    }

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isDirty]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Nome completo é obrigatório");
      return;
    }

    if (!formData.croNumber.trim()) {
      toast.error("CRO é obrigatório");
      return;
    }

    updateProfileMutation.mutate(formData);
  };

  const handleCancel = () => {
    if (profile) {
      setFormData({
        name: profile.name || "",
        croNumber: profile.croNumber || "",
      });
    }
    setIsEditing(false);
    setIsDirty(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <UserCircle className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl">Meu Perfil</CardTitle>
              <CardDescription>
                Gerencie suas informações profissionais
              </CardDescription>
            </div>
          </div>
          {isDirty && (
            <Badge
              variant="outline"
              className="border-amber-500/50 text-amber-600 dark:text-amber-400 gap-1"
            >
              <AlertCircle className="h-3 w-3" />
              Não salvo
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nome Completo */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium">
              Nome Completo <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              type="text"
              placeholder="Dr. João Silva"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              disabled={!isEditing}
              className={!isEditing ? "bg-muted/50" : ""}
            />
          </div>

          {/* CRO */}
          <div className="space-y-2">
            <Label htmlFor="croNumber" className="text-sm font-medium">
              CRO/Número de Registro <span className="text-destructive">*</span>
            </Label>
            <Input
              id="croNumber"
              type="text"
              placeholder="CRO-SP 12345"
              value={formData.croNumber}
              onChange={(e) =>
                setFormData({ ...formData, croNumber: e.target.value })
              }
              disabled={!isEditing}
              className={!isEditing ? "bg-muted/50" : ""}
            />
          </div>

          {/* Botões de Ação */}
          <div className="flex gap-3 pt-4">
            {!isEditing ? (
              <Button
                type="button"
                onClick={() => setIsEditing(true)}
                className="w-full"
                variant="default"
              >
                Editar Perfil
              </Button>
            ) : (
              <>
                <Button
                  type="submit"
                  disabled={updateProfileMutation.isPending || !isDirty}
                  className="flex-1"
                >
                  {updateProfileMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      {isDirty ? "Salvar Alterações" : "Sem Alterações"}
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={updateProfileMutation.isPending}
                  className="flex-1"
                >
                  Cancelar
                </Button>
              </>
            )}
          </div>

          {/* Info Message */}
          <div className="pt-2">
            <p className="text-xs text-muted-foreground">
              <span className="text-destructive">*</span> Campos obrigatórios
              para assinatura no PDF
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
