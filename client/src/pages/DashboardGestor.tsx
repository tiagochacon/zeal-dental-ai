import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Loader2, Users, Phone, CalendarCheck, TrendingUp, UserPlus, PhoneCall, BarChart3 } from "lucide-react";
import { useLocation, Link } from "wouter";
import { motion } from "framer-motion";

export default function DashboardGestor() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  const clinicQuery = trpc.clinic.getMyClinic.useQuery(undefined, {
    enabled: !!user,
    refetchOnWindowFocus: false,
  });

  const statsQuery = trpc.clinic.getStats.useQuery(undefined, {
    enabled: !!user && !!clinicQuery.data,
    refetchOnWindowFocus: false,
  });

  const membersQuery = trpc.clinic.getMembers.useQuery(undefined, {
    enabled: !!user && !!clinicQuery.data,
    refetchOnWindowFocus: false,
  });

  if (loading || clinicQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // If no clinic, redirect to setup
  if (!clinicQuery.data) {
    setLocation("/clinic-setup");
    return null;
  }

  const rawStats = statsQuery.data;
  const stats = rawStats && 'funnel' in rawStats ? rawStats.funnel : {
    totalLeads: 0,
    convertedLeads: 0,
    totalCalls: 0,
    scheduledCalls: 0,
    totalConsultations: 0,
    closedTreatments: 0,
  };

  const members = membersQuery.data || [];
  const crcs = members.filter((m: any) => m.clinicRole === "crc");
  const dentists = members.filter((m: any) => m.clinicRole === "dentista");

  // Funnel percentages
  const leadToScheduled = stats.totalCalls > 0 ? Math.round((stats.scheduledCalls / stats.totalCalls) * 100) : 0;
  const scheduledToConsultation = stats.scheduledCalls > 0 ? Math.round((stats.totalConsultations / stats.scheduledCalls) * 100) : 0;
  const consultationToClosed = stats.totalConsultations > 0 ? Math.round((stats.closedTreatments / stats.totalConsultations) * 100) : 0;

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
          <h1 className="text-xl lg:text-3xl font-bold text-foreground">{clinicQuery.data?.name || 'Painel Gestor'}</h1>
          <p className="text-sm text-muted-foreground hidden sm:block">Painel do Gestor</p>
        </div>
        <Link href="/team">
          <Button variant="outline" size="sm">
            <Users className="h-4 w-4 mr-1" />
            Meu Time
          </Button>
        </Link>
      </div>
        {/* Funnel de Conversão */}
        <div className="bg-card border border-border rounded-xl p-6 mb-6">
          <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-400" />
            Funil de Conversão
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {/* Ligações */}
            <div className="bg-gradient-to-br from-blue-600/10 to-blue-600/5 border border-blue-500/20 rounded-xl p-4 text-center">
              <PhoneCall className="h-8 w-8 text-blue-400 mx-auto mb-2" />
              <p className="text-3xl font-bold text-foreground">{stats.totalCalls}</p>
              <p className="text-xs text-muted-foreground">Ligações</p>
            </div>

            {/* Agendamentos */}
            <div className="bg-gradient-to-br from-amber-600/10 to-amber-600/5 border border-amber-500/20 rounded-xl p-4 text-center">
              <CalendarCheck className="h-8 w-8 text-amber-400 mx-auto mb-2" />
              <p className="text-3xl font-bold text-foreground">{stats.scheduledCalls}</p>
              <p className="text-xs text-muted-foreground">Agendamentos</p>
              {stats.totalCalls > 0 && (
                <p className="text-xs text-amber-400 mt-1">{leadToScheduled}% das ligações</p>
              )}
            </div>

            {/* Comparecimento */}
            <div className="bg-gradient-to-br from-purple-600/10 to-purple-600/5 border border-purple-500/20 rounded-xl p-4 text-center">
              <Users className="h-8 w-8 text-purple-400 mx-auto mb-2" />
              <p className="text-3xl font-bold text-foreground">{stats.totalConsultations}</p>
              <p className="text-xs text-muted-foreground">Comparecimento</p>
              {stats.scheduledCalls > 0 && (
                <p className="text-xs text-purple-400 mt-1">{scheduledToConsultation}% dos agendamentos</p>
              )}
            </div>

            {/* Fechamentos */}
            <div className="bg-gradient-to-br from-green-600/10 to-green-600/5 border border-green-500/20 rounded-xl p-4 text-center">
              <TrendingUp className="h-8 w-8 text-green-400 mx-auto mb-2" />
              <p className="text-3xl font-bold text-foreground">{stats.closedTreatments}</p>
              <p className="text-xs text-muted-foreground">Fechamentos</p>
              {stats.totalConsultations > 0 && (
                <p className="text-xs text-green-400 mt-1">{consultationToClosed}% das consultas</p>
              )}
            </div>
          </div>

          {/* Funnel Bar */}
          {(() => {
            // Use the max value across all funnel stages as the 100% reference
            const maxVal = Math.max(stats.totalCalls, stats.scheduledCalls, stats.totalConsultations, stats.closedTreatments, 1);
            const pct = (val: number) => maxVal > 0 ? `${Math.round((val / maxVal) * 100)}%` : "0%";
            return (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-24">Ligações</span>
                  <div className="flex-1 h-6 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: pct(stats.totalCalls) }} />
                  </div>
                  <span className="text-xs font-mono text-foreground w-10 text-right">{stats.totalCalls}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-24">Agendados</span>
                  <div className="flex-1 h-6 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: pct(stats.scheduledCalls) }} />
                  </div>
                  <span className="text-xs font-mono text-foreground w-10 text-right">{stats.scheduledCalls}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-24">Comparecim.</span>
                  <div className="flex-1 h-6 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: pct(stats.totalConsultations) }} />
                  </div>
                  <span className="text-xs font-mono text-foreground w-10 text-right">{stats.totalConsultations}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-24">Fechamentos</span>
                  <div className="flex-1 h-6 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: pct(stats.closedTreatments) }} />
                  </div>
                  <span className="text-xs font-mono text-foreground w-10 text-right">{stats.closedTreatments}</span>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Rankings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* CRC Ranking */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
              <Phone className="h-5 w-5 text-blue-400" />
              Ranking CRCs
            </h2>
            {crcs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum CRC cadastrado</p>
            ) : (
              <div className="space-y-3">
                {crcs.map((crc: any, i: number) => (
                  <div key={crc.id} className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg">
                    <span className={`text-lg font-bold ${i === 0 ? "text-amber-400" : i === 1 ? "text-gray-400" : i === 2 ? "text-amber-700" : "text-muted-foreground"}`}>
                      #{i + 1}
                    </span>
                    <div className="flex-1">
                      <p className="font-medium text-foreground text-sm">{crc.name}</p>
                      <p className="text-xs text-muted-foreground">{crc.email}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Dentist Ranking */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
              <Users className="h-5 w-5 text-purple-400" />
              Ranking Dentistas
            </h2>
            {dentists.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum dentista cadastrado</p>
            ) : (
              <div className="space-y-3">
                {dentists.map((d: any, i: number) => (
                  <div key={d.id} className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg">
                    <span className={`text-lg font-bold ${i === 0 ? "text-amber-400" : i === 1 ? "text-gray-400" : i === 2 ? "text-amber-700" : "text-muted-foreground"}`}>
                      #{i + 1}
                    </span>
                    <div className="flex-1">
                      <p className="font-medium text-foreground text-sm">{d.name}</p>
                      <p className="text-xs text-muted-foreground">{d.email}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link href="/team">
            <div className="bg-card border border-border rounded-xl p-6 hover:border-blue-500/30 transition-all cursor-pointer">
              <UserPlus className="h-8 w-8 text-blue-400 mb-3" />
              <h3 className="font-semibold text-foreground">Gerenciar Time</h3>
              <p className="text-xs text-muted-foreground mt-1">Adicionar CRCs e Dentistas</p>
            </div>
          </Link>
          <Link href="/leads">
            <div className="bg-card border border-border rounded-xl p-6 hover:border-amber-500/30 transition-all cursor-pointer">
              <Phone className="h-8 w-8 text-amber-400 mb-3" />
              <h3 className="font-semibold text-foreground">Ver Leads</h3>
              <p className="text-xs text-muted-foreground mt-1">Acompanhar leads e ligações</p>
            </div>
          </Link>
          <Link href="/patients">
            <div className="bg-card border border-border rounded-xl p-6 hover:border-green-500/30 transition-all cursor-pointer">
              <Users className="h-8 w-8 text-green-400 mb-3" />
              <h3 className="font-semibold text-foreground">Ver Pacientes</h3>
              <p className="text-xs text-muted-foreground mt-1">Acompanhar consultas e tratamentos</p>
            </div>
          </Link>
        </div>
    </motion.div>
  );
}
