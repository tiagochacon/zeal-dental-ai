import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Users, Plus, Search, Phone, Mail, ArrowLeft, Trash2 } from "lucide-react";
import { useLocation, Link } from "wouter";
import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export default function Leads() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [showNewLead, setShowNewLead] = useState(false);
  const [newLead, setNewLead] = useState({ name: "", phone: "", email: "", source: "", notes: "" });

  const leadsQuery = trpc.leads.list.useQuery(undefined, {
    enabled: !!user,
    refetchOnWindowFocus: false,
  });

  const utils = trpc.useUtils();

  const createLead = trpc.leads.create.useMutation({
    onSuccess: () => {
      toast.success("Lead cadastrado com sucesso!");
      setShowNewLead(false);
      setNewLead({ name: "", phone: "", email: "", source: "", notes: "" });
      utils.leads.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteLead = trpc.leads.delete.useMutation({
    onSuccess: () => {
      toast.success("Lead removido");
      utils.leads.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const leads = leadsQuery.data || [];
  const filtered = leads.filter((l: any) =>
    l.name?.toLowerCase().includes(search.toLowerCase()) ||
    l.phone?.includes(search) ||
    l.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl lg:text-3xl font-bold text-foreground">Meus Leads</h1>
          <p className="text-sm text-muted-foreground hidden sm:block">Gerencie seus leads e prospects</p>
        </div>
        <Button onClick={() => setShowNewLead(true)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-1" />
          Novo Lead
        </Button>
      </div>
        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, telefone ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-11 bg-secondary border-border rounded-xl"
          />
        </div>

        {/* Leads List */}
        {leadsQuery.isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {search ? "Nenhum lead encontrado" : "Nenhum lead cadastrado"}
            </h3>
            <p className="text-muted-foreground mb-4">
              {search ? "Tente outro termo de busca" : "Comece cadastrando seu primeiro lead"}
            </p>
            {!search && (
              <Button onClick={() => setShowNewLead(true)} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4 mr-1" />
                Cadastrar Lead
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((lead: any) => (
              <div
                key={lead.id}
                className="bg-card border border-border rounded-xl p-4 hover:border-blue-500/30 transition-all"
              >
                <div className="flex items-center justify-between">
                  <Link href={`/leads/${lead.id}`}>
                    <div className="cursor-pointer flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-semibold text-foreground">{lead.name}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          lead.isConverted
                            ? "bg-green-600/20 text-green-400"
                            : "bg-amber-600/20 text-amber-400"
                        }`}>
                          {lead.isConverted ? "Convertido" : "Ativo"}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        {lead.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {lead.phone}
                          </span>
                        )}
                        {lead.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {lead.email}
                          </span>
                        )}
                        {lead.source && (
                          <span className="text-xs bg-secondary px-2 py-0.5 rounded">{lead.source}</span>
                        )}
                      </div>
                    </div>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (confirm("Tem certeza que deseja remover este lead?")) {
                        deleteLead.mutate({ id: lead.id });
                      }
                    }}
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      {/* New Lead Dialog */}
      <Dialog open={showNewLead} onOpenChange={setShowNewLead}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Lead</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (newLead.name.trim()) {
                createLead.mutate(newLead);
              }
            }}
            className="space-y-4"
          >
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">Nome *</label>
              <Input
                value={newLead.name}
                onChange={(e) => setNewLead({ ...newLead, name: e.target.value })}
                placeholder="Nome do lead"
                className="bg-secondary border-border"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">Telefone</label>
              <Input
                value={newLead.phone}
                onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })}
                placeholder="(11) 99999-9999"
                className="bg-secondary border-border"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">Email</label>
              <Input
                value={newLead.email}
                onChange={(e) => setNewLead({ ...newLead, email: e.target.value })}
                placeholder="email@exemplo.com"
                className="bg-secondary border-border"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">Origem</label>
              <Input
                value={newLead.source}
                onChange={(e) => setNewLead({ ...newLead, source: e.target.value })}
                placeholder="Ex: Instagram, Indicação, Google..."
                className="bg-secondary border-border"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">Observações</label>
              <textarea
                value={newLead.notes}
                onChange={(e) => setNewLead({ ...newLead, notes: e.target.value })}
                placeholder="Notas sobre o lead..."
                className="w-full min-h-[80px] bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground px-4 py-3 text-sm resize-none"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowNewLead(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!newLead.name.trim() || createLead.isPending} className="bg-blue-600 hover:bg-blue-700">
                {createLead.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Cadastrar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
