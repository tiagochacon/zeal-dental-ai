import { useState, useCallback, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2, Save, UserCircle, Pencil } from "lucide-react";

export default function DentistProfile() {
  const [isEditing, setIsEditing] = useState(false);
  // Use a ref to track editing state that survives re-renders from query refetches
  // This ref is the single source of truth for "are we editing right now?"
  const editingRef = useRef(false);
  const [formData, setFormData] = useState({
    name: "",
    croNumber: "",
  });

  const { data: profile, isLoading } = trpc.auth.getProfile.useQuery(undefined, {
    // Disable automatic refetching to prevent resetting edit state
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const utils = trpc.useUtils();

  // Sync profile data to form ONLY when not editing
  useEffect(() => {
    if (profile && !editingRef.current) {
      setFormData({
        name: profile.name || "",
        croNumber: profile.croNumber || "",
      });
    }
  }, [profile]);

  const updateProfileMutation = trpc.auth.updateProfile.useMutation({
    onSuccess: () => {
      toast.success("Perfil atualizado com sucesso!");
      // Exit editing mode AFTER successful save
      editingRef.current = false;
      setIsEditing(false);
      // Invalidate to refresh cached data (will trigger useEffect above, 
      // but editingRef is already false so it will sync new data)
      utils.auth.getProfile.invalidate();
    },
    onError: (error) => {
      // Stay in editing mode on error so user can fix and retry
      toast.error(error.message || "Erro ao atualizar perfil");
    },
  });

  const handleStartEditing = useCallback(() => {
    // Sync latest profile data before entering edit mode
    if (profile) {
      setFormData({
        name: profile.name || "",
        croNumber: profile.croNumber || "",
      });
    }
    // Set ref BEFORE state to ensure useEffect guard is active
    editingRef.current = true;
    setIsEditing(true);
  }, [profile]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
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
  }, [formData, updateProfileMutation]);

  const handleCancel = useCallback(() => {
    // Reset form to original profile data
    if (profile) {
      setFormData({
        name: profile.name || "",
        croNumber: profile.croNumber || "",
      });
    }
    editingRef.current = false;
    setIsEditing(false);
  }, [profile]);

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
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nome Completo */}
          <div className="space-y-2">
            <Label htmlFor="profile-name" className="text-sm font-medium">
              Nome Completo <span className="text-destructive">*</span>
            </Label>
            <Input
              id="profile-name"
              type="text"
              placeholder="Dr. João Silva"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              disabled={!isEditing}
              className={!isEditing ? "bg-muted/50 cursor-not-allowed" : ""}
            />
          </div>

          {/* CRO */}
          <div className="space-y-2">
            <Label htmlFor="profile-cro" className="text-sm font-medium">
              CRO/Número de Registro <span className="text-destructive">*</span>
            </Label>
            <Input
              id="profile-cro"
              type="text"
              placeholder="CRO-SP 12345"
              value={formData.croNumber}
              onChange={(e) => setFormData(prev => ({ ...prev, croNumber: e.target.value }))}
              disabled={!isEditing}
              className={!isEditing ? "bg-muted/50 cursor-not-allowed" : ""}
            />
          </div>

          {/* Editing indicator */}
          {isEditing && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <Pencil className="h-4 w-4 text-blue-400" />
              <p className="text-sm text-blue-300">
                Modo de edição ativo. Faça suas alterações e clique em <strong>Salvar</strong>.
              </p>
            </div>
          )}

          {/* Botões de Ação */}
          <div className="flex gap-3 pt-4">
            {!isEditing ? (
              <Button
                type="button"
                onClick={handleStartEditing}
                className="w-full"
                variant="default"
              >
                <Pencil className="mr-2 h-4 w-4" />
                Editar Perfil
              </Button>
            ) : (
              <>
                <Button
                  type="submit"
                  disabled={updateProfileMutation.isPending}
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
                      Salvar
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
              <span className="text-destructive">*</span> Campos obrigatórios para assinatura no PDF
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
