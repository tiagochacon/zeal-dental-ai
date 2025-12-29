import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Loader2, Plus, User, Search, Phone, Mail, Calendar, Trash2, Edit, LayoutDashboard, Users, Menu, X } from "lucide-react";
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

export default function Patients() {
  const [, setLocation] = useLocation();
  const { user, loading: authLoading } = useAuth();
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

  const handleSubmit = (e: React.FormEvent) => {
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
  };

  const handleEdit = (patient: NonNullable<typeof patients>[number]) => {
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
    setEditingPatient(patient.id);
  };

  const handleDelete = (id: number) => {
    if (confirm("Tem certeza que deseja remover este paciente?")) {
      deleteMutation.mutate({ id });
    }
  };

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

  const PatientForm = ({ isEdit = false }: { isEdit?: boolean }) => (
    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
      <div className="space-y-2">
        <Label htmlFor={`${isEdit ? 'edit-' : ''}name`} className="text-sm">Nome Completo *</Label>
        <Input
          id={`${isEdit ? 'edit-' : ''}name`}
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Nome do paciente"
          required
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor={`${isEdit ? 'edit-' : ''}birthDate`} className="text-sm">Data de Nascimento</Label>
          <Input
            id={`${isEdit ? 'edit-' : ''}birthDate`}
            type="date"
            value={formData.birthDate}
            onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${isEdit ? 'edit-' : ''}cpf`} className="text-sm">CPF</Label>
          <Input
            id={`${isEdit ? 'edit-' : ''}cpf`}
            value={formData.cpf}
            onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
            placeholder="000.000.000-00"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor={`${isEdit ? 'edit-' : ''}phone`} className="text-sm">Telefone</Label>
          <Input
            id={`${isEdit ? 'edit-' : ''}phone`}
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="(00) 00000-0000"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${isEdit ? 'edit-' : ''}email`} className="text-sm">E-mail</Label>
          <Input
            id={`${isEdit ? 'edit-' : ''}email`}
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="email@exemplo.com"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${isEdit ? 'edit-' : ''}medicalHistory`} className="text-sm">Histórico Médico</Label>
        <Textarea
          id={`${isEdit ? 'edit-' : ''}medicalHistory`}
          value={formData.medicalHistory}
          onChange={(e) => setFormData({ ...formData, medicalHistory: e.target.value })}
          placeholder="Condições médicas relevantes..."
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${isEdit ? 'edit-' : ''}allergies`} className="text-sm">Alergias</Label>
        <Input
          id={`${isEdit ? 'edit-' : ''}allergies`}
          value={formData.allergies}
          onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
          placeholder="Alergias conhecidas"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${isEdit ? 'edit-' : ''}medications`} className="text-sm">Medicamentos em Uso</Label>
        <Textarea
          id={`${isEdit ? 'edit-' : ''}medications`}
          value={formData.medications}
          onChange={(e) => setFormData({ ...formData, medications: e.target.value })}
          placeholder="Medicamentos que o paciente utiliza..."
          rows={2}
        />
      </div>

      <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-4">
        <Button 
          type="button" 
          variant="outline" 
          onClick={() => isEdit ? setEditingPatient(null) : setIsCreateOpen(false)}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={isEdit ? updateMutation.isPending : createMutation.isPending}>
          {(isEdit ? updateMutation.isPending : createMutation.isPending) ? (
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
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-primary text-primary-foreground font-medium"
              >
                <Users className="h-5 w-5" />
                Pacientes
              </button>
            </li>
          </ul>
        </nav>

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
        <header className="p-4 lg:p-6 flex items-center justify-between gap-4 border-b border-border">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 hover:bg-muted rounded-lg"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-xl lg:text-2xl font-bold">Pacientes</h1>
              <p className="text-xs lg:text-sm text-muted-foreground hidden sm:block">
                Gerencie o cadastro de pacientes
              </p>
            </div>
          </div>

          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1 lg:mr-2" />
                <span className="hidden sm:inline">Novo</span> Paciente
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto mx-4">
              <DialogHeader>
                <DialogTitle>Cadastrar Novo Paciente</DialogTitle>
                <DialogDescription className="text-sm">
                  Preencha os dados do paciente. Apenas o nome é obrigatório.
                </DialogDescription>
              </DialogHeader>
              <PatientForm />
            </DialogContent>
          </Dialog>
        </header>

        <div className="p-4 lg:p-6">
          {/* Search */}
          <div className="mb-4 lg:mb-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar paciente..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Patient List */}
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredPatients?.length === 0 ? (
            <Card>
              <CardContent className="py-8 lg:py-12 text-center">
                <User className="h-10 w-10 lg:h-12 lg:w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-sm lg:text-base text-muted-foreground">
                  {searchQuery ? "Nenhum paciente encontrado" : "Nenhum paciente cadastrado"}
                </p>
                {!searchQuery && (
                  <Button 
                    variant="link" 
                    className="mt-2"
                    onClick={() => setIsCreateOpen(true)}
                  >
                    Cadastrar primeiro paciente
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 lg:gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredPatients?.map((patient) => (
                <Card key={patient.id} className="hover:border-primary/50 transition-colors">
                  <CardHeader className="pb-2 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 lg:gap-3 min-w-0">
                        <div className="p-1.5 lg:p-2 rounded-full bg-primary/10 shrink-0">
                          <User className="h-4 w-4 lg:h-5 lg:w-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <CardTitle className="text-sm lg:text-base truncate">{patient.name}</CardTitle>
                          {patient.birthDate && (
                            <CardDescription className="flex items-center gap-1 mt-1 text-xs">
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
                          className="h-7 w-7 lg:h-8 lg:w-8"
                          onClick={() => handleEdit(patient)}
                        >
                          <Edit className="h-3 w-3 lg:h-4 lg:w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-7 w-7 lg:h-8 lg:w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(patient.id)}
                        >
                          <Trash2 className="h-3 w-3 lg:h-4 lg:w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 text-xs lg:text-sm p-4 pt-0">
                    {patient.phone && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        <span className="truncate">{patient.phone}</span>
                      </div>
                    )}
                    {patient.email && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        <span className="truncate">{patient.email}</span>
                      </div>
                    )}
                    {patient.allergies && (
                      <div className="mt-2 p-2 rounded bg-destructive/10 text-destructive text-xs">
                        <strong>Alergias:</strong> {patient.allergies}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Edit Dialog */}
      <Dialog open={editingPatient !== null} onOpenChange={(open) => !open && setEditingPatient(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto mx-4">
          <DialogHeader>
            <DialogTitle>Editar Paciente</DialogTitle>
            <DialogDescription className="text-sm">
              Atualize os dados do paciente.
            </DialogDescription>
          </DialogHeader>
          <PatientForm isEdit />
        </DialogContent>
      </Dialog>
    </div>
  );
}
