import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Phone, Users, CalendarCheck, PhoneOff, TrendingUp, Plus } from "lucide-react";
import { useLocation, Link } from "wouter";
import { motion } from "framer-motion";

export default function DashboardCRC() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const leadsQuery = trpc.leads.list.useQuery(undefined, {
    enabled: !!user,
    refetchOnWindowFocus: false,
  });

  const callsQuery = trpc.calls.list.useQuery(undefined, {
    enabled: !!user,
    refetchOnWindowFocus: false,
  });

  const leads = leadsQuery.data || [];
  const calls = callsQuery.data || [];
  const isLoading = leadsQuery.isLoading || callsQuery.isLoading;

  const totalLeads = leads.length;
  const convertedLeads = leads.filter((l: any) => l.isConverted).length;
  const totalCalls = calls.length;
  const scheduledCalls = calls.filter((c: any) => c.schedulingResult === "scheduled").length;
  const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;

  const recentLeads = leads.slice(0, 5);
  const recentCalls = calls.slice(0, 5);

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl lg:text-3xl font-bold text-foreground">
            Olá, {user?.name?.split(" ")[0]}!
          </h1>
          <p className="text-sm text-muted-foreground hidden sm:block">
            Painel de Relacionamento com Leads
          </p>
        </div>
        <Button
          className="bg-blue-600 hover:bg-blue-700"
          onClick={() => setLocation("/leads")}
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo Lead
        </Button>
      </div>

      {/* Stats Cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-blue-600/20 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-400" />
              </div>
              <span className="text-sm text-muted-foreground">Total Leads</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{totalLeads}</p>
          </div>

          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-green-600/20 flex items-center justify-center">
                <Phone className="w-5 h-5 text-green-400" />
              </div>
              <span className="text-sm text-muted-foreground">Ligações</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{totalCalls}</p>
          </div>

          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-amber-600/20 flex items-center justify-center">
                <CalendarCheck className="w-5 h-5 text-amber-400" />
              </div>
              <span className="text-sm text-muted-foreground">Agendados</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{scheduledCalls}</p>
          </div>

          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-purple-600/20 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-purple-400" />
              </div>
              <span className="text-sm text-muted-foreground">Conversão</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{conversionRate}%</p>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Button
            className="h-auto p-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl flex items-center justify-start gap-3"
            onClick={() => setLocation("/calls/new")}
          >
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
              <Phone className="w-5 h-5" />
            </div>
            <div className="text-left">
              <p className="font-semibold">Nova Ligação</p>
              <p className="text-sm opacity-80">Registrar ligação com lead</p>
            </div>
          </Button>

          <Button
            variant="outline"
            className="h-auto p-5 rounded-xl flex items-center justify-start gap-3 border-border hover:border-primary/50"
            onClick={() => setLocation("/leads")}
          >
            <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-foreground">Meus Leads</p>
              <p className="text-sm text-muted-foreground">Ver todos os leads</p>
            </div>
          </Button>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Leads */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">Leads Recentes</h3>
              <Link href="/leads" className="text-sm text-blue-400 hover:text-blue-300">Ver todos</Link>
            </div>
            {recentLeads.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">Nenhum lead cadastrado ainda</p>
            ) : (
              <div className="space-y-3">
                {recentLeads.map((lead: any) => (
                  <Link key={lead.id} href={`/leads/${lead.id}`}>
                    <div className="flex items-center justify-between p-3 rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer">
                      <div>
                        <p className="font-medium text-foreground text-sm">{lead.name}</p>
                        <p className="text-xs text-muted-foreground">{lead.phone || lead.email || "Sem contato"}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        lead.isConverted 
                          ? "bg-green-600/20 text-green-400" 
                          : "bg-amber-600/20 text-amber-400"
                      }`}>
                        {lead.isConverted ? "Convertido" : "Ativo"}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Recent Calls */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">Ligações Recentes</h3>
              <Link href="/calls" className="text-sm text-blue-400 hover:text-blue-300">Ver todas</Link>
            </div>
            {recentCalls.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">Nenhuma ligação registrada ainda</p>
            ) : (
              <div className="space-y-3">
                {recentCalls.map((call: any) => (
                  <Link key={call.id} href={`/calls/${call.id}`}>
                    <div className="flex items-center justify-between p-3 rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer">
                      <div className="flex items-center gap-3">
                        {call.schedulingResult === "scheduled" ? (
                          <CalendarCheck className="w-4 h-4 text-green-400" />
                        ) : call.schedulingResult === "not_scheduled" ? (
                          <PhoneOff className="w-4 h-4 text-red-400" />
                        ) : (
                          <Phone className="w-4 h-4 text-muted-foreground" />
                        )}
                        <div>
                          <p className="font-medium text-foreground text-sm">{call.leadName}</p>
                          <p className="text-xs text-muted-foreground">
                            {call.createdAt ? new Date(call.createdAt).toLocaleDateString("pt-BR") : ""}
                          </p>
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        call.status === "analyzed" ? "bg-green-600/20 text-green-400" :
                        call.status === "transcribed" ? "bg-blue-600/20 text-blue-400" :
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
      </div>
    </motion.div>
  );
}
