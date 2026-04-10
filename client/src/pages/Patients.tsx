import { useState, useCallback, memo } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { trpc } from "@/lib/trpc";
import { motion } from "framer-motion";
import { Loader2, Plus, User, Search, Phone, Mail, Trash2, Edit, Users, ChevronRight, FileText, Calendar, Brain } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { consultationStatusConfig } from "@/lib/utils";

interface PatientFormData {
  name: string;
  phone: string;
  email: string;
  cpf: string;
  medicalHistory: string;
  allergies: string;
  medications: string;
}

interface Patient {
  id: number;
  name: string;
  phone?: string | null;
  email?: string | null;
  cpf?: string | null;
  medicalHistory?: string | null;
  allergies?: string | null;
  medications?: string | null;
  createdAt?: string | Date;
  originLeadId?: number | null;
  clinicId?: number | null;
}

const initialFormData: PatientFormData = {
  name: "",
  phone: "",
  email: "",
  cpf: "",
  medicalHistory: "",
  allergies: "",
  medications: "",
};

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
      {/* Identification group */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Identificação</p>
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

      {/* Clinical History — collapsible */}
      <Accordion type="single" collapsible className="border rounded-lg px-3">
        <AccordionItem value="clinical" className="border-none">
          <AccordionTrigger className="text-sm font-semibold hover:no-underline py-3">
            Histórico Clínico (opcional)
          </AccordionTrigger>
          <AccordionContent className="space-y-3 pb-3">
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
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
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

// ---- CRC Neurovendas Profile helpers ----
const crcProfileConfig: Record<string, {
  label: string;
  badgeClass: string;
  dica: string;
}> = {
  reptiliano: {
    label: "Reptiliano",
    badgeClass: "bg-green-600/20 text-green-400 border-green-500/30",
    dica: "Use linguagem simples e direta. Transmita segurança e controle. Elimine medos e incertezas antes de falar de valores.",
  },
  neocortex: {
    label: "Neocórtex",
    badgeClass: "bg-blue-600/20 text-blue-400 border-blue-500/30",
    dica: "Apresente dados, comparações e evidências. Este paciente decide com lógica — tenha números de sucesso em mãos.",
  },
  limbico: {
    label: "Límbico",
    badgeClass: "bg-amber-600/20 text-amber-400 border-amber-500/30",
    dica: "Conecte-se emocionalmente. Fale sobre transformação, autoestima e como o tratamento mudará a vida dele(a).",
  },
};

function ProfileBadge({ profile }: { profile: string }) {
  const config = crcProfileConfig[profile.toLowerCase()];
  if (!config) return null;
  return (
    <Badge className={`${config.badgeClass} border text-xs font-semibold mt-1`}>
      {config.label}
    </Badge>
  );
}

function AbordagemDica({ profile }: { profile: string }) {
  const config = crcProfileConfig[profile.toLowerCase()];
  if (!config) return null;
  return (
    <div className="mt-3 bg-card border border-border rounded-lg p-3">
      <p className="text-xs font-semibold text-foreground mb-1">💡 Dica de Abordagem</p>
      <p className="text-xs text-muted-foreground leading-relaxed">{config.dica}</p>
    </div>
  );
}

// Patient Detail Sheet
function PatientDetailSheet({ 
  patient, 
  open, 
  onClose 
}: { 
  patient: Patient | null; 
  open: boolean; 
  onClose: () => void; 
}) {
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const { data: patientConsultations = [] } = trpc.consultations.getByPatient.useQuery(
    { patientId: patient?.id ?? 0 },
    { enabled: !!user && open && !!patient }
  );

  // Extrair dados de neurovendas da última consulta que tem análise
  const lastAnalyzedConsultation = patientConsultations.find(
    (c: any) => c.neurovendasAnalysis || c.soapNote
  ) as any;
  const neurovendas = lastAnalyzedConsultation?.neurovendasAnalysis as any;

  // Buscar perfil do CRC via lead de origem (quando paciente veio do CRC)
  // Convert originLeadId from string to number (Supabase returns it as string)
  const leadId = patient?.originLeadId ? Number(patient.originLeadId) : 0;
  const leadQuery = trpc.leads.getById.useQuery(
    { id: leadId },
    {
      enabled: open && !!leadId,
      refetchOnWindowFocus: false,
    }
  );
  const leadData = leadQuery.data as any;
  const crcCallProfile = leadData?.callProfile as {
    nivelCerebralDominante?: "neocortex" | "limbico" | "reptiliano";
    probabilidadeAgendamento?: number;
    resumo?: string;
  } | null | undefined;
  const crcNeurovendas = leadData?.neurovendasAnalysis as any;

  if (!patient) return null;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:!max-w-2xl p-0 flex flex-col h-full">
        <div className="flex-1 overflow-y-auto p-6">
        <SheetHeader className="mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <span className="text-primary font-bold text-lg">
                {patient.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <SheetTitle className="text-left">{patient.name}</SheetTitle>
              <SheetDescription className="text-left">Ficha do paciente</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {/* Briefing do CRC — só aparece quando paciente veio de um lead do CRC */}
        {patient.originLeadId && (
          <div className="mb-6 bg-primary/5 border border-primary/20 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                <Brain className="w-3.5 h-3.5 text-primary" />
              </div>
              <p className="text-xs font-bold text-primary uppercase tracking-wider">
                Briefing do CRC — Análise de Neurovendas
              </p>
            </div>

            {leadQuery.isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ) : (
              <>
                {crcCallProfile?.nivelCerebralDominante && (
                  <ProfileBadge profile={crcCallProfile.nivelCerebralDominante} />
                )}

                {crcNeurovendas?.rapport?.nivel !== undefined && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-muted-foreground">Rapport na ligação:</span>
                    <span className={`text-xs font-bold ${
                      crcNeurovendas.rapport.nivel >= 70 ? "text-green-400" :
                      crcNeurovendas.rapport.nivel >= 40 ? "text-amber-400" :
                      "text-red-400"
                    }`}>
                      {crcNeurovendas.rapport.nivel}/100
                    </span>
                  </div>
                )}

                {(crcCallProfile?.resumo || crcNeurovendas?.resumoGeral) && (
                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                    {crcCallProfile?.resumo || crcNeurovendas?.resumoGeral}
                  </p>
                )}

                {crcCallProfile?.nivelCerebralDominante && (
                  <AbordagemDica profile={crcCallProfile.nivelCerebralDominante} />
                )}

                {crcCallProfile?.probabilidadeAgendamento !== undefined && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-muted-foreground">Probabilidade de fechamento:</span>
                    <span className={`text-xs font-semibold ${
                      crcCallProfile.probabilidadeAgendamento >= 70 ? "text-green-400" :
                      crcCallProfile.probabilidadeAgendamento >= 40 ? "text-amber-400" :
                      "text-red-400"
                    }`}>
                      {crcCallProfile.probabilidadeAgendamento}%
                    </span>
                  </div>
                )}

                {!crcCallProfile && !crcNeurovendas && !leadQuery.isLoading && (
                  <p className="text-xs text-muted-foreground">
                    Análise de neurovendas ainda não disponível para este paciente.
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* Contact Info */}
        <div className="space-y-3 mb-6">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contato</p>
          {patient.phone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>{patient.phone}</span>
            </div>
          )}
          {patient.email && (
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>{patient.email}</span>
            </div>
          )}
          {patient.cpf && (
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>CPF: {patient.cpf}</span>
            </div>
          )}
          {patient.createdAt && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4 shrink-0" />
              <span>Cadastrado em {new Date(patient.createdAt).toLocaleDateString('pt-BR')}</span>
            </div>
          )}
        </div>

        {/* Clinical History */}
        {(patient.medicalHistory || patient.allergies || patient.medications) && (
          <>
            <Separator className="mb-4" />
            <div className="space-y-3 mb-6">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Histórico Clínico</p>
              {patient.medicalHistory && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Histórico médico</p>
                  <p className="text-sm">{patient.medicalHistory}</p>
                </div>
              )}
              {patient.allergies && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Alergias</p>
                  <p className="text-sm">{patient.allergies}</p>
                </div>
              )}
              {patient.medications && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Medicamentos em uso</p>
                  <p className="text-sm">{patient.medications}</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* Neurovendas / Rapport Info from last consultation */}
        {neurovendas && (
          <>
            <Separator className="mb-4" />
            <Accordion type="single" collapsible defaultValue="rapport" className="mb-6">
              {/* Rapport */}
              {neurovendas.rapport && (
                <AccordionItem value="rapport" className="border rounded-lg px-3 mb-2">
                  <AccordionTrigger className="text-sm font-semibold hover:no-underline py-3">
                    <div className="flex items-center gap-2">
                      <span>Rapport</span>
                      <Badge variant="outline" className={`text-xs ${
                        neurovendas.rapport.nivel >= 70 ? "text-green-400 border-green-500/30" :
                        neurovendas.rapport.nivel >= 40 ? "text-yellow-400 border-yellow-500/30" :
                        "text-red-400 border-red-500/30"
                      }`}>
                        {neurovendas.rapport.nivel}/100
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-2 pb-3">
                    {neurovendas.rapport.justificativa && (
                      <p className="text-sm text-muted-foreground">{neurovendas.rapport.justificativa}</p>
                    )}
                    {neurovendas.rapport.melhoria && (
                      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-2.5">
                        <p className="text-xs font-medium text-yellow-400 mb-0.5">Sugestão</p>
                        <p className="text-sm text-muted-foreground">{neurovendas.rapport.melhoria}</p>
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              )}

              {/* Perfil Psicológico */}
              {neurovendas.perfilPsicologico && (
                <AccordionItem value="perfil" className="border rounded-lg px-3 mb-2">
                  <AccordionTrigger className="text-sm font-semibold hover:no-underline py-3">
                    <div className="flex items-center gap-2">
                      <span>Perfil Psicológico</span>
                      {neurovendas.perfilPsicologico.tipo && (
                        <Badge variant="outline" className="text-xs text-blue-400 border-blue-500/30">
                          {neurovendas.perfilPsicologico.tipo}
                        </Badge>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-2 pb-3">
                    {neurovendas.perfilPsicologico.descricao && (
                      <p className="text-sm text-muted-foreground">{neurovendas.perfilPsicologico.descricao}</p>
                    )}
                    {neurovendas.perfilPsicologico.abordagemRecomendada && (
                      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-2.5">
                        <p className="text-xs font-medium text-blue-400 mb-0.5">Abordagem Recomendada</p>
                        <p className="text-sm text-muted-foreground">{neurovendas.perfilPsicologico.abordagemRecomendada}</p>
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              )}

              {/* Gatilhos Mentais */}
              {neurovendas.gatilhosMentais && (
                <AccordionItem value="gatilhos" className="border rounded-lg px-3 mb-2">
                  <AccordionTrigger className="text-sm font-semibold hover:no-underline py-3">
                    Gatilhos Mentais
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3 pb-3">
                    {neurovendas.gatilhosMentais.positivos?.length > 0 && (
                      <div>
                        <p className="text-xs text-green-400 uppercase tracking-wide font-medium mb-1.5">✓ Use estes</p>
                        <div className="flex flex-wrap gap-1.5">
                          {neurovendas.gatilhosMentais.positivos.map((g: string, i: number) => (
                            <Badge key={i} variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30 text-xs">
                              {g}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {neurovendas.gatilhosMentais.negativos?.length > 0 && (
                      <div>
                        <p className="text-xs text-red-400 uppercase tracking-wide font-medium mb-1.5">✗ Evite estes</p>
                        <div className="flex flex-wrap gap-1.5">
                          {neurovendas.gatilhosMentais.negativos.map((g: string, i: number) => (
                            <Badge key={i} variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30 text-xs">
                              {g}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              )}

              {/* Objeções */}
              {neurovendas.objecoes?.length > 0 && (
                <AccordionItem value="objecoes" className="border rounded-lg px-3 mb-2">
                  <AccordionTrigger className="text-sm font-semibold hover:no-underline py-3">
                    <div className="flex items-center gap-2">
                      <span>Objeções</span>
                      <Badge variant="outline" className="text-xs text-amber-400 border-amber-500/30">
                        {neurovendas.objecoes.length}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-2 pb-3">
                    {neurovendas.objecoes.map((obj: any, i: number) => (
                      <div key={i} className="bg-secondary/50 rounded-lg p-3">
                        <p className="text-sm font-medium mb-1">"{obj.frase}"</p>
                        {obj.contexto && <p className="text-xs text-muted-foreground mb-2">{obj.contexto}</p>}
                        {obj.tecnicaSugerida && (
                          <div className="bg-green-600/10 border border-green-500/20 rounded p-2 mt-1">
                            <p className="text-xs font-medium text-green-400 mb-0.5">Resposta</p>
                            <p className="text-xs text-muted-foreground">{obj.tecnicaSugerida}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </AccordionContent>
                </AccordionItem>
              )}

              {/* Resumo */}
              {neurovendas.resumoGeral && (
                <AccordionItem value="resumo" className="border rounded-lg px-3">
                  <AccordionTrigger className="text-sm font-semibold hover:no-underline py-3">
                    Resumo da Análise
                  </AccordionTrigger>
                  <AccordionContent className="pb-3">
                    <p className="text-sm text-muted-foreground leading-relaxed">{neurovendas.resumoGeral}</p>
                  </AccordionContent>
                </AccordionItem>
              )}
            </Accordion>
          </>
        )}

        {/* Consultations */}
        <Separator className="mb-4" />
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Consultas ({patientConsultations.length})</p>
            <Button 
              size="sm" 
              onClick={() => { setLocation(`/new-consultation?patientId=${patient.id}`); onClose(); }}
            >
              <Plus className="h-3 w-3 mr-1" />
              Nova Consulta
            </Button>
          </div>

          {patientConsultations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <FileText className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Nenhuma consulta ainda</p>
            </div>
          ) : (
            <div className="space-y-2">
              {patientConsultations.slice(0, 10).map(consultation => {
                const statusCfg = consultationStatusConfig[consultation.status as keyof typeof consultationStatusConfig];
                return (
                  <div
                    key={consultation.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary/30 hover:bg-muted/30 transition-all cursor-pointer"
                    onClick={() => { setLocation(`/consultation/${consultation.id}`); onClose(); }}
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {new Date(consultation.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {statusCfg && (
                        <Badge className={statusCfg.className + " text-xs"}>{statusCfg.label}</Badge>
                      )}
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function Patients() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<number | null>(null);
  const [viewingPatient, setViewingPatient] = useState<Patient | null>(null);
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
      toast.error("Erro ao cadastrar paciente. Tente novamente.");
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
      toast.error("Erro ao atualizar paciente. Tente novamente.");
    },
  });

  const deleteMutation = trpc.patients.delete.useMutation({
    onSuccess: () => {
      toast.success("Paciente removido com sucesso!");
      utils.patients.list.invalidate();
    },
    onError: () => {
      toast.error("Erro ao remover paciente. Tente novamente.");
    },
  });

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
      const normalizedName = formData.name.trim().toLowerCase();
      const duplicate = patients?.some(
        patient => patient.name.trim().toLowerCase() === normalizedName
      );
      if (duplicate) {
        toast.error("Já existe um paciente com este nome.");
        return;
      }
      createMutation.mutate(formData);
    }
  }, [formData, editingPatient, updateMutation, createMutation, patients]);

  const handleEdit = useCallback((patient: Patient, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingPatient(patient.id);
    setFormData({
      name: patient.name,
      phone: patient.phone || "",
      email: patient.email || "",
      cpf: patient.cpf || "",
      medicalHistory: patient.medicalHistory || "",
      allergies: patient.allergies || "",
      medications: patient.medications || "",
    });
  }, []);

  const handleDelete = useCallback((id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Tem certeza que deseja remover este paciente? Esta ação não pode ser desfeita.")) {
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

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold">Pacientes</h1>
          <p className="text-sm text-muted-foreground">Gerencie os pacientes cadastrados</p>
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
              <DialogTitle>Adicionar Paciente</DialogTitle>
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
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar paciente por nome, email ou telefone..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 h-11 surface-glass border-white/5 text-foreground placeholder:text-muted-foreground transition-all focus-visible:ring-1 focus-visible:ring-primary/50"
        />
      </div>

      {/* Patient List */}
      <div className="surface-glass border border-white/5 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden bg-gradient-to-b from-white/[0.03] to-transparent">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
        <div className="flex items-center gap-2 mb-6">
          <Users className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-medium text-foreground tracking-tight">Lista de Pacientes</h2>
        </div>

        {isLoading ? (
          <div className="flex flex-col">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between py-4 px-2 border-b border-white/5 last:border-0">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredPatients && filteredPatients.length > 0 ? (
          <div className="flex flex-col">
            {filteredPatients.map((patient) => (
              <div 
                key={patient.id} 
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 py-4 px-3 border-b border-white/5 last:border-0 hover:bg-white/[0.03] transition-colors rounded-xl cursor-pointer group"
                onClick={() => setViewingPatient(patient as Patient)}
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <span className="text-primary font-semibold text-sm">
                      {patient.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium tracking-tight text-foreground truncate">{patient.name}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                      {patient.cpf && <span>CPF: {patient.cpf}</span>}
                      {patient.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {patient.phone}
                        </span>
                      )}
                      {patient.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {patient.email}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-1 shrink-0 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 hover:bg-white/5"
                        onClick={(e) => handleEdit(patient, e)}
                      >
                        <Edit className="h-4 w-4 text-foreground/70" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Editar</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={(e) => handleDelete(patient.id, e)}
                        disabled={deleteMutation.isPending}
                      >
                        {deleteMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Remover</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="p-4 rounded-full bg-primary/10 mb-4 border border-primary/20 w-fit mx-auto">
              <Users className="h-8 w-8 text-primary/70" />
            </div>
            <h3 className="text-lg font-semibold mb-2">
              {searchQuery ? "Nenhum paciente encontrado" : "Nenhum paciente ainda"}
            </h3>
            <p className="text-muted-foreground text-sm max-w-sm mb-6">
              {searchQuery
                ? `Nenhum paciente corresponde a "${searchQuery}".`
                : "Adicione seu primeiro paciente para começar a gerenciar sua clínica."}
            </p>
            {!searchQuery && (
              <Button onClick={() => setIsCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Paciente
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Patient Detail Sheet */}
      <PatientDetailSheet
        patient={viewingPatient}
        open={viewingPatient !== null}
        onClose={() => setViewingPatient(null)}
      />

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
    </motion.div>
  );
}
