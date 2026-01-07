import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2, Save, UserCircle } from "lucide-react";

export default function DentistProfile() {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    croNumber: "",
    birthDate: "",
    clinicName: "",
  });

  const { data: profile, isLoading, refetch } = trpc.auth.getProfile.useQuery();

  const updateProfileMutation = trpc.auth.updateProfile.useMutation({
    onSuccess: () => {
      toast.success("Perfil atualizado com sucesso!");
      setIsEditing(false);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao atualizar perfil");
    },
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name || "",
        croNumber: profile.croNumber || "",
        birthDate: profile.birthDate || "",
        clinicName: profile.clinicName || "",
      });
    }
  }, [profile]);

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
        birthDate: profile.birthDate || "",
        clinicName: profile.clinicName || "",
      });
    }
    setIsEditing(false);
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
            <Label htmlFor="name" className="text-sm font-medium">
              Nome Completo <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              type="text"
              placeholder="Dr. João Silva"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
              onChange={(e) => setFormData({ ...formData, croNumber: e.target.value })}
              disabled={!isEditing}
              className={!isEditing ? "bg-muted/50" : ""}
            />
          </div>

          {/* Data de Nascimento */}
          <div className="space-y-2">
            <Label htmlFor="birthDate" className="text-sm font-medium">
              Data de Nascimento
            </Label>
            <Input
              id="birthDate"
              type="date"
              value={formData.birthDate}
              onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
              disabled={!isEditing}
              className={!isEditing ? "bg-muted/50" : ""}
            />
          </div>

          {/* Nome da Clínica */}
          <div className="space-y-2">
            <Label htmlFor="clinicName" className="text-sm font-medium">
              Nome da Clínica
            </Label>
            <Input
              id="clinicName"
              type="text"
              placeholder="Clínica Odontológica Exemplo"
              value={formData.clinicName}
              onChange={(e) => setFormData({ ...formData, clinicName: e.target.value })}
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

