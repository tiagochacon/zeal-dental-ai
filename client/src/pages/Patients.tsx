import { useState, useCallback, memo } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Loader2, Plus, User, Search, Phone, Mail, Calendar, Trash2, Edit, LayoutDashboard, Users, Menu, X, LogOut, UserCircle } from "lucide-react";
import { useLocation } from "wouter";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";

interface PatientFormData {
  name: string;
  birthDate: string;
  phone: string;
  email: string;
  cpf: string;
  medicalHistory: string;
  allergies: string;
  medications: string;
}

const initialFormData: PatientFormData = {
  name: "",
  birthDate: "",
  phone: "",
  email: "",
  cpf: "",
  medicalHistory: "",
  allergies: "",
  medications: "",
};

// Componente de formulário movido para fora para evitar re-renderização
interface PatientFormProps {
  formData: PatientFormData;
  onFieldChange: (field: keyof PatientFormData, value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  isEdit: boolean;
  isPending: boolean;
}

const PatientForm = memo(function PatientForm({ 
  formData, 
  onFieldChange, 
  onSubmit, 
  onCancel, 
  isEdit, 
  isPending 
}: PatientFormProps) {
  const prefix = isEdit ? 'edit-' : '';
  
  return (
    <form onSubmit={onSubmit} className="space-y-4 mt-4">
      <div className="space-y-2">
        <Label htmlFor={`${prefix}name`} className="text-sm">Nome Completo *</Label>
        <Input
          id={`${prefix}name`}
          value={formData.name}
          onChange={(e) => onFieldChange('name', e.target.value)}
          placeholder="Nome do paciente"
          required
          autoComplete="off"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor={`${prefix}birthDate`} className="text-sm">Data de Nascimento</Label>
          <Input
            id={`${prefix}birthDate`}
            type="date"
            value={formData.birthDate}
            onChange={(e) => onFieldChange('birthDate', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${prefix}cpf`} className="text-sm">CPF</Label>
          <Input
            id={`${prefix}cpf`}
            value={formData.cpf}
            onChange={(e) => onFieldChange('cpf', e.target.value)}
            placeholder="000.000.000-00"
            autoComplete="off"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor={`${prefix}phone`} className="text-sm">Telefone</Label>
          <Input
            id={`${prefix}phone`}
            value={formData.phone}
            onChange={(e) => onFieldChange('phone', e.target.value)}
            placeholder="(00) 00000-0000"
            autoComplete="off"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${prefix}email`} className="text-sm">E-mail</Label>
          <Input
            id={`${prefix}email`}
            type="email"
            value={formData.email}
            onChange={(e) => onFieldChange('email', e.target.value)}
            placeholder="email@exemplo.com"
            autoComplete="off"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${prefix}medicalHistory`} className="text-sm">Histórico Médico</Label>
        <Textarea
          id={`${prefix}medicalHistory`}
          value={formData.medicalHistory}
          onChange={(e) => onFieldChange('medicalHistory', e.target.value)}
          placeholder="Condições médicas relevantes..."
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${prefix}allergies`} className="text-sm">Alergias</Label>
        <Input
          id={`${prefix}allergies`}
          value={formData.allergies}
          onChange={(e) => onFieldChange('allergies', e.target.value)}
          placeholder="Alergias conhecidas"
          autoComplete="off"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${prefix}medications`} className="text-sm">Medicamentos em Uso</Label>
        <Textarea
          id={`${prefix}medications`}
          value={formData.medications}
          onChange={(e) => onFieldChange('medications', e.target.value)}
          placeholder="Medicamentos que o paciente utiliza..."
          rows={2}
        />
      </div>

      <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-4">
        <Button 
          type="button" 
          variant="outline" 
          onClick={onCancel}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Salvando...
            </>
          ) : (
            isEdit ? 'Salvar Alterações' : 'Cadastrar'
          )}
        </Button>
      </div>
    </form>
  );
});

export default function Patients() {
  const [, setLocation] = useLocation();
  const { user, loading: authLoading, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<number | null>(null);
  const [formData, setFormData] = useState<PatientFormData>(initialFormData);

  const utils = trpc.useUtils();

  const { data: patients, isLoading } = trpc.patients.list.useQuery(
    undefined,
    { enabled: !!user }
  );

  const createMutation = trpc.patients.create.useMutation({
    onSuccess: () => {
      toast.success("Paciente cadastrado com sucesso!");
      setIsCreateOpen(false);
      setFormData(initialFormData);
      utils.patients.list.invalidate();
    },
    onError: () => {
      toast.error("Erro ao cadastrar paciente");
    },
  });

  const updateMutation = trpc.patients.update.useMutation({
    onSuccess: () => {
      toast.success("Paciente atualizado com sucesso!");
      setEditingPatient(null);
      setFormData(initialFormData);
      utils.patients.list.invalidate();
    },
    onError: () => {
      toast.error("Erro ao atualizar paciente");
    },
  });

  const deleteMutation = trpc.patients.delete.useMutation({
    onSuccess: () => {
      toast.success("Paciente removido com sucesso!");
      utils.patients.list.invalidate();
    },
    onError: () => {
      toast.error("Erro ao remover paciente");
    },
  });

  // Callback estável para atualização de campos
  const handleFieldChange = useCallback((field: keyof PatientFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    if (editingPatient) {
      updateMutation.mutate({
        id: editingPatient,
        ...formData,
      });
    } else {
      createMutation.mutate(formData);
    }
  }, [formData, editingPatient, updateMutation, createMutation]);

  const handleEdit = useCallback((patient: NonNullable<typeof patients>[number]) => {
    setEditingPatient(patient.id);
    setFormData({
      name: patient.name,
      birthDate: patient.birthDate || "",
      phone: patient.phone || "",
      email: patient.email || "",
      cpf: patient.cpf || "",
      medicalHistory: patient.medicalHistory || "",
      allergies: patient.allergies || "",
      medications: patient.medications || "",
    });
  }, []);

  const handleDelete = useCallback((id: number) => {
    if (confirm("Tem certeza que deseja remover este paciente?")) {
      deleteMutation.mutate({ id });
    }
  }, [deleteMutation]);

  const handleCancelCreate = useCallback(() => {
    setIsCreateOpen(false);
    setFormData(initialFormData);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingPatient(null);
    setFormData(initialFormData);
  }, []);

  const filteredPatients = patients?.filter(patient =>
    patient.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    patient.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    patient.phone?.includes(searchQuery)
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
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-primary text-primary-foreground"
              >
                <Users className="h-5 w-5" />
                Pacientes
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
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="text-sm font-medium text-primary">
                {user.name?.charAt(0).toUpperCase() || "U"}
              </span>
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
            onClick={() => logout()}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="border-b border-border bg-card p-4 lg:p-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 hover:bg-accent rounded-lg"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-xl lg:text-2xl font-bold">Pacientes</h1>
              <p className="text-sm text-muted-foreground">Gerencie os pacientes cadastrados</p>
            </div>
          </div>
          
          <Dialog open={isCreateOpen} onOpenChange={(open) => {
            setIsCreateOpen(open);
            if (!open) setFormData(initialFormData);
          }}>
            <DialogTrigger asChild>
              <Button className="shrink-0">
                <Plus className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Novo Paciente</span>
                <span className="sm:hidden">Novo</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Cadastrar Novo Paciente</DialogTitle>
                <DialogDescription className="text-sm">
                  Preencha os dados do paciente. Apenas o nome é obrigatório.
                </DialogDescription>
              </DialogHeader>
              <PatientForm 
                formData={formData}
                onFieldChange={handleFieldChange}
                onSubmit={handleSubmit}
                onCancel={handleCancelCreate}
                isEdit={false}
                isPending={createMutation.isPending}
              />
            </DialogContent>
          </Dialog>
        </header>

        <div className="p-4 lg:p-6">
          {/* Search */}
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar paciente por nome, email ou telefone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Patient List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredPatients && filteredPatients.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredPatients.map((patient) => (
                <Card key={patient.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <CardTitle className="text-base truncate">{patient.name}</CardTitle>
                          {patient.birthDate && (
                            <CardDescription className="text-xs flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(patient.birthDate).toLocaleDateString('pt-BR')}
                            </CardDescription>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                          onClick={() => handleEdit(patient)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(patient.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2 text-sm">
                      {patient.phone && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Phone className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{patient.phone}</span>
                        </div>
                      )}
                      {patient.email && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Mail className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{patient.email}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center">
                  {searchQuery ? "Nenhum paciente encontrado" : "Nenhum paciente cadastrado ainda"}
                </p>
                {!searchQuery && (
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => setIsCreateOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Cadastrar Primeiro Paciente
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      {/* Edit Patient Dialog */}
      <Dialog open={editingPatient !== null} onOpenChange={(open) => {
        if (!open) {
          setEditingPatient(null);
          setFormData(initialFormData);
        }
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Paciente</DialogTitle>
            <DialogDescription className="text-sm">
              Atualize os dados do paciente.
            </DialogDescription>
          </DialogHeader>
          <PatientForm 
            formData={formData}
            onFieldChange={handleFieldChange}
            onSubmit={handleSubmit}
            onCancel={handleCancelEdit}
            isEdit={true}
            isPending={updateMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
