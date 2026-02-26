import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, Phone, Mail, MapPin, Edit2, Save, X, CalendarCheck, PhoneOff, Plus, UserCheck, Brain, Shield, Heart, TrendingUp, Target, Lock, Crown } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useLocation, Link, useParams } from "wouter";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

// ---- Profile config for Neurovendas display ----
const profileDisplayConfig: Record<string, {
  label: string;
  badgeClass: string;
  bgGradient: string;
  iconBg: string;
  description: string;
  keyApproach: string[];
  Icon: React.ComponentType<{ className?: string }>;
}> = {
  reptiliano: {
    label: "Reptiliano",
    badgeClass: "bg-green-600/20 text-green-400 border-green-500/30",
    bgGradient: "from-green-600/10 to-green-600/5",
    iconBg: "bg-green-500/20 text-green-400",
    description: "Opera pelo instinto de sobrevivência. Priorize segurança, controle e eliminação de medos.",
    keyApproach: ["Ambiente calmo e controlado", "Explicações simples e diretas", "Garantias de segurança"],
    Icon: Shield,
  },
  neocortex: {
    label: "Neocórtex",
    badgeClass: "bg-blue-600/20 text-blue-400 border-blue-500/30",
    bgGradient: "from-blue-600/10 to-blue-600/5",
    iconBg: "bg-blue-500/20 text-blue-400",
    description: "Analítico, busca dados concretos. Apresente estatísticas, comparações e evidências científicas.",
    keyApproach: ["Dados e estatísticas de sucesso", "Comparação de opções", "Análise custo-benefício"],
    Icon: Brain,
  },
  limbico: {
    label: "Límbico",
    badgeClass: "bg-amber-600/20 text-amber-400 border-amber-500/30",
    bgGradient: "from-amber-600/10 to-amber-600/5",
    iconBg: "bg-amber-500/20 text-amber-400",
    description: "Movido por emoções e aspirações. Foque na transformação, autoestima e impacto social.",
    keyApproach: ["Histórias de transformação", "Visualização do resultado", "Conexão emocional"],
    Icon: Heart,
  },
};

function NeurovendasProfileCard({ callProfile }: { callProfile: unknown }) {
  let parsed: Record<string, unknown> | null = null;
  let plainText: string | null = null;

  try {
    if (typeof callProfile === "string") {
      parsed = JSON.parse(callProfile) as Record<string, unknown>;
    } else if (typeof callProfile === "object" && callProfile !== null) {
      parsed = callProfile as Record<string, unknown>;
    }
  } catch {
    plainText = typeof callProfile === "string" ? callProfile : null;
  }

  if (!parsed && !plainText) {
    plainText = typeof callProfile === "string" ? callProfile : String(callProfile);
  }

  // Extract fields from the callProfile JSON
  const nivelCerebral = parsed
    ? ((parsed.nivelCerebralDominante || parsed.profileType || parsed.perfilPrincipal) as string | undefined)
    : undefined;
  const profileKey = nivelCerebral?.toLowerCase();
  const config = profileKey ? profileDisplayConfig[profileKey] : undefined;
  const probabilidade = parsed?.probabilidadeAgendamento as number | undefined;
  const resumo = (parsed?.resumo || parsed?.resumoGeral) as string | undefined;

  // Fallback: if no config matched but we have parsed data, show structured view
  if (!config && parsed && !plainText) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 mt-6">
        <div className="flex items-center gap-2 mb-4">
          <Brain className="h-5 w-5 text-purple-400" />
          <h2 className="text-lg font-semibold text-foreground">Perfil de Neurovendas</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          {nivelCerebral && (
            <div className="bg-secondary/50 rounded-lg p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Nível Cerebral</p>
              <p className="text-sm font-semibold text-foreground capitalize">{nivelCerebral}</p>
            </div>
          )}
          {probabilidade !== undefined && (
            <div className="bg-secondary/50 rounded-lg p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Prob. Agendamento</p>
              <p className={`text-sm font-bold ${
                probabilidade >= 70 ? "text-green-400" :
                probabilidade >= 40 ? "text-amber-400" : "text-red-400"
              }`}>{probabilidade}%</p>
            </div>
          )}
        </div>

        {resumo && (
          <div className="border-l-4 border-purple-500 pl-4 bg-purple-500/5 rounded-r-lg p-3">
            <p className="text-sm text-foreground leading-relaxed">{resumo}</p>
          </div>
        )}
      </div>
    );
  }

  if (!config) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 mt-6">
        <div className="flex items-center gap-2 mb-4">
          <Brain className="h-5 w-5 text-purple-400" />
          <h2 className="text-lg font-semibold text-foreground">Perfil de Neurovendas</h2>
        </div>
        <p className="text-sm text-foreground bg-secondary/50 rounded-lg p-4 leading-relaxed">
          {plainText ?? ""}
        </p>
      </div>
    );
  }

  const probColor = probabilidade !== undefined
    ? probabilidade >= 70 ? "text-green-400" : probabilidade >= 40 ? "text-amber-400" : "text-red-400"
    : "";
  const probBarClass = probabilidade !== undefined
    ? probabilidade >= 70 ? "[&>div]:bg-green-500" : probabilidade >= 40 ? "[&>div]:bg-amber-500" : "[&>div]:bg-red-500"
    : "";

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden mt-6">
      {/* Header with gradient */}
      <div className={`bg-gradient-to-r ${config.bgGradient} border-b border-border px-6 py-4`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg ${config.iconBg} flex items-center justify-center`}>
            <config.Icon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground">Perfil de Neurovendas</h2>
              <Badge className={`${config.badgeClass} border text-xs font-semibold`}>
                {config.label}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{config.description}</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* Metrics Row */}
        {probabilidade !== undefined && (
          <div className="bg-secondary/30 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Probabilidade de Agendamento</span>
            </div>
            <div className="flex items-center gap-3">
              <Progress value={probabilidade} className={`h-2.5 flex-1 ${probBarClass}`} />
              <span className={`text-lg font-bold ${probColor} min-w-[3rem] text-right`}>{probabilidade}%</span>
            </div>
          </div>
        )}

        {/* How to approach */}
        <div className="bg-secondary/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Como abordar este perfil
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {config.keyApproach.map((tip, i) => (
              <div key={i} className="flex items-start gap-2 bg-card border border-border rounded-lg p-3">
                <span className="text-primary font-bold text-sm mt-0.5">{i + 1}</span>
                <span className="text-sm text-foreground">{tip}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Resumo */}
        {resumo && (
          <div className="border-l-4 border-primary pl-4 bg-primary/5 rounded-r-lg p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Resumo da Análise</p>
            <p className="text-sm text-foreground leading-relaxed">{resumo}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LeadDetail() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const leadId = parseInt(params.id || "0");
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ name: "", phone: "", email: "", source: "", notes: "" });

  // Check negotiation access via billing API (respects clinic inheritance)
  const { data: planInfo } = trpc.billing.getPlanInfo.useQuery(undefined, {
    enabled: !!user,
    refetchOnWindowFocus: false,
  });
  const hasNegotiationAccess = planInfo?.hasNegotiationAccess ?? (user?.role === 'admin');

  const leadQuery = trpc.leads.getById.useQuery({ id: leadId }, {
    enabled: !!user && leadId > 0,
    refetchOnWindowFocus: false,
  });

  const callsQuery = trpc.calls.list.useQuery(undefined, {
    enabled: !!user,
    refetchOnWindowFocus: false,
  });

  const utils = trpc.useUtils();

  const updateLead = trpc.leads.update.useMutation({
    onSuccess: () => {
      toast.success("Lead atualizado!");
      setIsEditing(false);
      utils.leads.getById.invalidate({ id: leadId });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const clinicQuery = trpc.clinic.getMyClinic.useQuery(undefined, {
    enabled: !!user,
    refetchOnWindowFocus: false,
  });

  const membersQuery = trpc.clinic.getMembers.useQuery(undefined, {
    enabled: !!user && !!clinicQuery.data,
    refetchOnWindowFocus: false,
  });

  const convertLead = trpc.leads.convert.useMutation({
    onSuccess: () => {
      toast.success("Lead convertido em paciente!");
      utils.leads.getById.invalidate({ id: leadId });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const [selectedDentistId, setSelectedDentistId] = useState<number | null>(null);
  const dentists = (membersQuery.data || []).filter((m: any) => m.clinicRole === "dentista");

  const lead = leadQuery.data;

  useEffect(() => {
    if (lead) {
      setEditData({
        name: lead.name || "",
        phone: lead.phone || "",
        email: lead.email || "",
        source: lead.source || "",
        notes: lead.notes || "",
      });
    }
  }, [lead]);

  if (loading || leadQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <h2 className="text-xl font-bold text-foreground mb-2">Lead não encontrado</h2>
          <Link href="/leads">
            <Button variant="outline">Voltar aos Leads</Button>
          </Link>
        </div>
      </div>
    );
  }

  const leadCalls = (callsQuery.data || []).filter((c: any) => c.leadId === leadId);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/leads">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Leads
            </Button>
          </Link>
          <h1 className="text-lg lg:text-2xl font-bold text-foreground truncate">{lead.name}</h1>
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            lead.isConverted ? "bg-green-600/20 text-green-400" : "bg-amber-600/20 text-amber-400"
          }`}>
            {lead.isConverted ? "Convertido" : "Ativo"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!lead.isConverted && (
            <Button
              onClick={() => {
                if (dentists.length === 0) {
                  toast.error("Nenhum dentista cadastrado na cl\u00ednica. Pe\u00e7a ao gestor para adicionar.");
                  return;
                }
                setShowConvertDialog(true);
              }}
              disabled={convertLead.isPending}
              className="bg-green-600 hover:bg-green-700"
              size="sm"
            >
              {convertLead.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <UserCheck className="h-4 w-4 mr-1" />}
              Converter em Paciente
            </Button>
          )}
        </div>
      </div>
        {/* Lead Info Card */}
        <div className="bg-card border border-border rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Informações do Lead</h2>
            {!isEditing ? (
              <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
                <Edit2 className="h-4 w-4 mr-1" />
                Editar
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditing(false)}
                >
                  <X className="h-4 w-4 mr-1" />
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={() => updateLead.mutate({ id: leadId, ...editData })}
                  disabled={updateLead.isPending}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {updateLead.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                  Salvar
                </Button>
              </div>
            )}
          </div>

          {isEditing ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Nome</label>
                <Input value={editData.name} onChange={(e) => setEditData({ ...editData, name: e.target.value })} className="bg-secondary border-border" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Telefone</label>
                <Input value={editData.phone} onChange={(e) => setEditData({ ...editData, phone: e.target.value })} className="bg-secondary border-border" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Email</label>
                <Input value={editData.email} onChange={(e) => setEditData({ ...editData, email: e.target.value })} className="bg-secondary border-border" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Origem</label>
                <Input value={editData.source} onChange={(e) => setEditData({ ...editData, source: e.target.value })} className="bg-secondary border-border" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm text-muted-foreground mb-1 block">Observações</label>
                <textarea
                  value={editData.notes}
                  onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                  className="w-full min-h-[80px] bg-secondary border border-border rounded-xl text-foreground px-4 py-3 text-sm resize-none"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-foreground">{lead.phone || "Sem telefone"}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-foreground">{lead.email || "Sem email"}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-foreground">Origem: {lead.source || "Não informada"}</span>
              </div>
              {lead.notes && (
                <div className="sm:col-span-2 mt-2">
                  <p className="text-sm text-muted-foreground">Observações:</p>
                  <p className="text-sm text-foreground mt-1">{lead.notes}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Calls Section */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">
              Ligações ({leadCalls.length})
            </h2>
            <Link href={`/calls/new?leadId=${leadId}&leadName=${encodeURIComponent(lead.name)}`}>
              <Button size="sm" className="bg-green-600 hover:bg-green-700">
                <Plus className="h-4 w-4 mr-1" />
                Nova Ligação
              </Button>
            </Link>
          </div>

          {leadCalls.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">Nenhuma ligação registrada para este lead</p>
          ) : (
            <div className="space-y-3">
              {leadCalls.map((call: any) => (
                <Link key={call.id} href={`/calls/${call.id}`}>
                  <div className="flex items-center justify-between p-3 rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer border border-border/50">
                    <div className="flex items-center gap-3">
                      {call.schedulingResult === "scheduled" ? (
                        <CalendarCheck className="w-5 h-5 text-green-400" />
                      ) : call.schedulingResult === "not_scheduled" ? (
                        <PhoneOff className="w-5 h-5 text-red-400" />
                      ) : (
                        <Phone className="w-5 h-5 text-muted-foreground" />
                      )}
                      <div>
                        <p className="font-medium text-foreground text-sm">
                          {call.createdAt ? new Date(call.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {call.audioDurationSeconds ? `${Math.floor(call.audioDurationSeconds / 60)}min ${call.audioDurationSeconds % 60}s` : "Sem áudio"}
                        </p>
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      call.status === "analyzed" ? "bg-green-600/20 text-green-400" :
                      call.status === "transcribed" ? "bg-blue-600/20 text-blue-400" :
                      call.status === "finalized" ? "bg-purple-600/20 text-purple-400" :
                      "bg-gray-600/20 text-gray-400"
                    }`}>
                      {call.status === "analyzed" ? "Analisada" :
                       call.status === "transcribed" ? "Transcrita" :
                       call.status === "finalized" ? "Finalizada" : "Pendente"}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Neurovendas Profile */}
        {lead.callProfile && hasNegotiationAccess && (
          <NeurovendasProfileCard callProfile={lead.callProfile} />
        )}
        {lead.callProfile && !hasNegotiationAccess && (
          <div className="bg-card border border-border rounded-xl p-4 mt-6">
            <div className="flex items-center gap-2 mb-2">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-semibold text-muted-foreground">Perfil de Neurovendas</p>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Disponível no plano PRO. Faça upgrade para ver o perfil comportamental do lead.
            </p>
            <Link href="/pricing">
              <Button size="sm" variant="outline" className="mt-3 flex items-center gap-2">
                <Crown className="h-4 w-4" />
                Ver Planos
              </Button>
            </Link>
          </div>
        )}
      {/* Convert Lead Dialog */}
      <Dialog open={showConvertDialog} onOpenChange={setShowConvertDialog}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle>Converter Lead em Paciente</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-4">
            Selecione o dentista que atenderá este paciente:
          </p>
          <div className="space-y-2">
            {dentists.map((d: any) => (
              <div
                key={d.id}
                onClick={() => setSelectedDentistId(d.id)}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  selectedDentistId === d.id
                    ? "border-blue-500 bg-blue-500/10"
                    : "border-border hover:border-blue-500/30"
                }`}
              >
                <p className="font-medium text-foreground text-sm">{d.name}</p>
                <p className="text-xs text-muted-foreground">{d.email}</p>
              </div>
            ))}
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowConvertDialog(false)}>Cancelar</Button>
            <Button
              disabled={!selectedDentistId || convertLead.isPending}
              onClick={() => {
                if (selectedDentistId) {
                  convertLead.mutate({ leadId, dentistId: selectedDentistId });
                  setShowConvertDialog(false);
                }
              }}
              className="bg-green-600 hover:bg-green-700"
            >
              {convertLead.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Converter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
