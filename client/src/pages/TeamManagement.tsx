import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ArrowLeft, UserPlus, Trash2, Phone, Stethoscope, Shield } from "lucide-react";
import { useLocation, Link } from "wouter";
import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export default function TeamManagement() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberPassword, setNewMemberPassword] = useState("");
  const [newMemberRole, setNewMemberRole] = useState<"crc" | "dentista">("crc");

  const clinicQuery = trpc.clinic.getMyClinic.useQuery(undefined, {
    enabled: !!user,
    refetchOnWindowFocus: false,
  });

  const membersQuery = trpc.clinic.getMembers.useQuery(undefined, {
    enabled: !!user && !!clinicQuery.data,
    refetchOnWindowFocus: false,
  });

  const utils = trpc.useUtils();

  const addMember = trpc.clinic.addMember.useMutation({
    onSuccess: () => {
      toast.success("Membro adicionado com sucesso!");
      utils.clinic.getMembers.invalidate();
      setShowAddDialog(false);
      setNewMemberEmail("");
      setNewMemberName("");
      setNewMemberPassword("");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const removeMember = trpc.clinic.removeMember.useMutation({
    onSuccess: () => {
      toast.success("Membro removido!");
      utils.clinic.getMembers.invalidate();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateMember = trpc.clinic.updateMember.useMutation({
    onSuccess: () => {
      toast.success("Papel atualizado!");
      utils.clinic.getMembers.invalidate();
    },
    onError: (err: any) => toast.error(err.message),
  });

  if (loading || clinicQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!clinicQuery.data) {
    setLocation("/clinic-setup");
    return null;
  }

  const members = membersQuery.data || [];
  const crcs = members.filter((m: any) => m.clinicRole === "crc");
  const dentists = members.filter((m: any) => m.clinicRole === "dentista");
  const gestores = members.filter((m: any) => m.clinicRole === "gestor");

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "gestor": return <Shield className="h-4 w-4 text-amber-400" />;
      case "crc": return <Phone className="h-4 w-4 text-blue-400" />;
      case "dentista": return <Stethoscope className="h-4 w-4 text-green-400" />;
      default: return null;
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "gestor": return "Gestor";
      case "crc": return "CRC";
      case "dentista": return "Dentista";
      default: return role;
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl lg:text-3xl font-bold text-foreground">Meu Time</h1>
          <p className="text-sm text-muted-foreground hidden sm:block">Gerencie os membros da clínica</p>
        </div>
        <Button onClick={() => setShowAddDialog(true)} size="sm" className="bg-blue-600 hover:bg-blue-700">
          <UserPlus className="h-4 w-4 mr-1" />
          Adicionar
        </Button>
      </div>
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <Shield className="h-6 w-6 text-amber-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground">{gestores.length}</p>
            <p className="text-xs text-muted-foreground">Gestores</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <Phone className="h-6 w-6 text-blue-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground">{crcs.length}</p>
            <p className="text-xs text-muted-foreground">CRCs</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <Stethoscope className="h-6 w-6 text-green-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground">{dentists.length}</p>
            <p className="text-xs text-muted-foreground">Dentistas</p>
          </div>
        </div>

        {/* Members List */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Membros da Clínica</h2>
          
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum membro cadastrado ainda. Clique em "Adicionar Membro" para começar.
            </p>
          ) : (
            <div className="space-y-3">
              {members.map((member: any) => (
                <div key={member.id} className="flex items-center gap-3 p-4 bg-secondary/50 rounded-lg">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                    {member.name?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-foreground text-sm">{member.name || "Sem nome"}</p>
                    <p className="text-xs text-muted-foreground">{member.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {getRoleIcon(member.clinicRole)}
                    <span className="text-xs font-medium text-muted-foreground">{getRoleLabel(member.clinicRole)}</span>
                  </div>
                  {member.clinicRole !== "gestor" && member.id !== user?.id && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const newRole = member.clinicRole === "crc" ? "dentista" : "crc";
                          updateMember.mutate({ memberId: member.id, clinicRole: newRole });
                        }}
                        className="text-xs"
                      >
                        Trocar para {member.clinicRole === "crc" ? "Dentista" : "CRC"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm(`Remover ${member.name || member.email} da clínica?`)) {
                            removeMember.mutate({ memberId: member.id });
                          }
                        }}
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground text-center mt-4">
          O membro precisa ter uma conta no ZEAL. Adicione pelo e-mail de cadastro.
        </p>
      {/* Add Member Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Membro</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Nome completo</label>
              <Input
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                placeholder="Nome do membro"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">E-mail</label>
              <Input
                value={newMemberEmail}
                onChange={(e) => setNewMemberEmail(e.target.value)}
                placeholder="email@exemplo.com"
                type="email"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Senha de acesso</label>
              <Input
                value={newMemberPassword}
                onChange={(e) => setNewMemberPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                type="password"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Papel</label>
              <div className="grid grid-cols-2 gap-3">
                <div
                  onClick={() => setNewMemberRole("crc")}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    newMemberRole === "crc"
                      ? "border-blue-500 bg-blue-500/10"
                      : "border-border hover:border-blue-500/30"
                  }`}
                >
                  <Phone className="h-5 w-5 text-blue-400 mb-1" />
                  <p className="font-medium text-foreground text-sm">CRC</p>
                  <p className="text-xs text-muted-foreground">Vendas e agendamento</p>
                </div>
                <div
                  onClick={() => setNewMemberRole("dentista")}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    newMemberRole === "dentista"
                      ? "border-green-500 bg-green-500/10"
                      : "border-border hover:border-green-500/30"
                  }`}
                >
                  <Stethoscope className="h-5 w-5 text-green-400 mb-1" />
                  <p className="font-medium text-foreground text-sm">Dentista</p>
                  <p className="text-xs text-muted-foreground">Consultas e tratamentos</p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancelar</Button>
            <Button
              disabled={!newMemberEmail.trim() || !newMemberName.trim() || !newMemberPassword.trim() || addMember.isPending}
              onClick={() => addMember.mutate({ name: newMemberName.trim(), email: newMemberEmail.trim(), password: newMemberPassword.trim(), clinicRole: newMemberRole })}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {addMember.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <UserPlus className="h-4 w-4 mr-1" />}
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
