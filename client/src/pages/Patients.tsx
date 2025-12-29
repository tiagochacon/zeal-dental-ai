import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Loader2, ArrowLeft, Plus, User, Search, Phone, Mail, Calendar, Trash2, Edit } from "lucide-react";
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => setLocation("/")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              <div>
                <h1 className="text-xl font-bold">Pacientes</h1>
                <p className="text-sm text-muted-foreground">
                  Gerencie o cadastro de pacientes
                </p>
              </div>
            </div>

            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Paciente
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Cadastrar Novo Paciente</DialogTitle>
                  <DialogDescription>
                    Preencha os dados do paciente. Apenas o nome é obrigatório.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome Completo *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Nome do paciente"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="birthDate">Data de Nascimento</Label>
                      <Input
                        id="birthDate"
                        type="date"
                        value={formData.birthDate}
                        onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cpf">CPF</Label>
                      <Input
                        id="cpf"
                        value={formData.cpf}
                        onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                        placeholder="000.000.000-00"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone">Telefone</Label>
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="(00) 00000-0000"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">E-mail</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="email@exemplo.com"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="medicalHistory">Histórico Médico</Label>
                    <Textarea
                      id="medicalHistory"
                      value={formData.medicalHistory}
                      onChange={(e) => setFormData({ ...formData, medicalHistory: e.target.value })}
                      placeholder="Condições médicas relevantes..."
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="allergies">Alergias</Label>
                    <Input
                      id="allergies"
                      value={formData.allergies}
                      onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
                      placeholder="Alergias conhecidas"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="medications">Medicamentos em Uso</Label>
                    <Textarea
                      id="medications"
                      value={formData.medications}
                      onChange={(e) => setFormData({ ...formData, medications: e.target.value })}
                      placeholder="Medicamentos que o paciente utiliza..."
                      rows={2}
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={createMutation.isPending}>
                      {createMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        'Cadastrar'
                      )}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-8">
        {/* Search */}
        <div className="mb-6">
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
            <CardContent className="py-12 text-center">
              <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
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
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredPatients?.map((patient) => (
              <Card key={patient.id} className="hover:border-primary/50 transition-colors">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-primary/10">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{patient.name}</CardTitle>
                        {patient.birthDate && (
                          <CardDescription className="flex items-center gap-1 mt-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(patient.birthDate).toLocaleDateString('pt-BR')}
                          </CardDescription>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
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
                <CardContent className="space-y-2 text-sm">
                  {patient.phone && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-3 w-3" />
                      {patient.phone}
                    </div>
                  )}
                  {patient.email && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-3 w-3" />
                      {patient.email}
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
      </main>

      {/* Edit Dialog */}
      <Dialog open={editingPatient !== null} onOpenChange={(open) => !open && setEditingPatient(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Paciente</DialogTitle>
            <DialogDescription>
              Atualize os dados do paciente.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nome Completo *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nome do paciente"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-birthDate">Data de Nascimento</Label>
                <Input
                  id="edit-birthDate"
                  type="date"
                  value={formData.birthDate}
                  onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-cpf">CPF</Label>
                <Input
                  id="edit-cpf"
                  value={formData.cpf}
                  onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                  placeholder="000.000.000-00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-phone">Telefone</Label>
                <Input
                  id="edit-phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">E-mail</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@exemplo.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-medicalHistory">Histórico Médico</Label>
              <Textarea
                id="edit-medicalHistory"
                value={formData.medicalHistory}
                onChange={(e) => setFormData({ ...formData, medicalHistory: e.target.value })}
                placeholder="Condições médicas relevantes..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-allergies">Alergias</Label>
              <Input
                id="edit-allergies"
                value={formData.allergies}
                onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
                placeholder="Alergias conhecidas"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-medications">Medicamentos em Uso</Label>
              <Textarea
                id="edit-medications"
                value={formData.medications}
                onChange={(e) => setFormData({ ...formData, medications: e.target.value })}
                placeholder="Medicamentos que o paciente utiliza..."
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setEditingPatient(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar Alterações'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
