import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ArrowLeft, Phone, Mail, MapPin, Edit2, Save, X, CalendarCheck, PhoneOff, Plus, UserCheck } from "lucide-react";
import { useLocation, Link, useParams } from "wouter";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export default function LeadDetail() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const leadId = parseInt(params.id || "0");
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ name: "", phone: "", email: "", source: "", notes: "" });

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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container flex items-center justify-between h-16 px-4">
          <div className="flex items-center gap-3">
            <Link href="/leads">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Leads
              </Button>
            </Link>
            <h1 className="text-lg font-bold text-foreground truncate">{lead.name}</h1>
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
                    toast.error("Nenhum dentista cadastrado na clínica. Peça ao gestor para adicionar.");
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
      </header>

      <main className="container px-4 py-6 max-w-4xl mx-auto">
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

        {/* Call Profile (from Neurovendas analysis) */}
        {lead.callProfile && (
          <div className="bg-card border border-border rounded-xl p-6 mt-6">
            <h2 className="text-lg font-semibold text-foreground mb-3">Perfil Psicológico do Lead</h2>
            <p className="text-sm text-foreground bg-secondary/50 rounded-lg p-4">{typeof lead.callProfile === 'string' ? lead.callProfile : JSON.stringify(lead.callProfile)}</p>
          </div>
        )}
      </main>

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
