import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ArrowLeft, UserPlus, Trash2, Phone, Stethoscope, Shield, KeyRound } from "lucide-react";
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

  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [passwordTargetMember, setPasswordTargetMember] = useState<{ id: number; name: string } | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);

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

  const updateMemberPassword = trpc.clinic.updateMemberPassword.useMutation({
    onSuccess: () => {
      toast.success("Senha alterada com sucesso!");
      setShowPasswordDialog(false);
      setNewPassword("");
      setPasswordTargetMember(null);
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
        <div className="flex flex-wrap gap-8 lg:gap-16 mb-10 px-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Shield className="h-3.5 w-3.5" />
              <span className="text-xs font-semibold uppercase tracking-wider">Gestores</span>
            </div>
            <p className="text-4xl font-black text-foreground tracking-tighter">{gestores.length}</p>
          </div>
          <div className="flex flex-col gap-1 border-l border-white/10 pl-8 lg:pl-16">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Phone className="h-3.5 w-3.5" />
              <span className="text-xs font-semibold uppercase tracking-wider">CRCs</span>
            </div>
            <p className="text-4xl font-black text-foreground tracking-tighter">{crcs.length}</p>
          </div>
          <div className="flex flex-col gap-1 border-l border-white/10 pl-8 lg:pl-16">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Stethoscope className="h-3.5 w-3.5" />
              <span className="text-xs font-semibold uppercase tracking-wider">Dentistas</span>
            </div>
            <p className="text-4xl font-black text-foreground tracking-tighter">{dentists.length}</p>
          </div>
        </div>

        {/* Members List */}
        <div className="surface-glass border border-white/5 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden bg-gradient-to-b from-white/[0.03] to-transparent">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
          <h2 className="text-lg font-medium text-foreground mb-6 tracking-tight">Membros da Clínica</h2>
          
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum membro cadastrado ainda. Clique em "Adicionar" para começar.
            </p>
          ) : (
            <div className="flex flex-col">
              {members.map((member: any) => (
                <div key={member.id} className="flex flex-col sm:flex-row sm:items-center gap-4 py-4 px-3 border-b border-white/5 last:border-0 hover:bg-white/[0.03] transition-colors rounded-xl group">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm shadow-sm group-hover:scale-105 transition-transform ${
                    member.clinicRole === 'gestor' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                    member.clinicRole === 'crc' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                    member.clinicRole === 'dentista' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                    'bg-primary/10 text-primary border border-primary/20'
                  }`}>
                    {member.name?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-foreground text-sm tracking-tight">{member.name || "Sem nome"}</p>
                    <p className="text-xs text-muted-foreground">{member.email}</p>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-6 sm:gap-4 mt-2 sm:mt-0 w-full sm:w-auto">
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                        member.clinicRole === 'gestor' ? 'bg-amber-500/10' :
                        member.clinicRole === 'crc' ? 'bg-blue-500/10' :
                        member.clinicRole === 'dentista' ? 'bg-emerald-500/10' :
                        'bg-white/5'
                      }`}>
                        {getRoleIcon(member.clinicRole)}
                      </div>
                      <span className="text-xs font-medium text-muted-foreground">{getRoleLabel(member.clinicRole)}</span>
                    </div>
                    {member.clinicRole !== "gestor" && member.id !== user?.id && (
                      <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const newRole = member.clinicRole === "crc" ? "dentista" : "crc";
                            updateMember.mutate({ memberId: member.id, clinicRole: newRole });
                          }}
                          className="text-xs h-8 hover:bg-white/5"
                        >
                          Tornar {member.clinicRole === "crc" ? "Dentista" : "CRC"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setPasswordTargetMember({ id: member.id, name: member.name || member.email });
                            setNewPassword("");
                            setShowNewPassword(false);
                            setShowPasswordDialog(true);
                          }}
                          className="h-8 text-muted-foreground hover:text-foreground hover:bg-white/5"
                          title="Alterar senha"
                        >
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm(`Remover ${member.name || member.email} da clínica?`)) {
                              removeMember.mutate({ memberId: member.id });
                            }
                          }}
                          className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
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

      {/* Change Member Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={(open) => { setShowPasswordDialog(open); if (!open) { setNewPassword(""); setShowNewPassword(false); } }}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle>Alterar Senha</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <p className="text-sm text-muted-foreground">
              Definindo nova senha para: <span className="font-medium text-foreground">{passwordTargetMember?.name}</span>
            </p>
            <div className="relative">
              <Input
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Nova senha (mínimo 6 caracteres)"
                type={showNewPassword ? "text" : "password"}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showNewPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              O membro usará esta nova senha no próximo login.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowPasswordDialog(false); setNewPassword(""); setShowNewPassword(false); }}>
              Cancelar
            </Button>
            <Button
              disabled={newPassword.trim().length < 6 || updateMemberPassword.isPending}
              onClick={() => {
                if (passwordTargetMember) {
                  updateMemberPassword.mutate({ memberId: passwordTargetMember.id, newPassword: newPassword.trim() });
                }
              }}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {updateMemberPassword.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <KeyRound className="h-4 w-4 mr-1" />}
              Salvar Senha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
