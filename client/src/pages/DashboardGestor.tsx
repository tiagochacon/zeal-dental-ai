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
        <div className="surface-glass rounded-3xl p-8 sm:p-10 mb-8 border border-white/5 shadow-2xl bg-gradient-to-b from-white/[0.03] to-transparent">
          <div className="flex items-center gap-3 mb-8">
            <TrendingUp className="h-5 w-5 text-foreground/70" />
            <h2 className="text-lg font-medium text-foreground tracking-tight">
              Funil de Conversão
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 lg:gap-8 mb-12">
            {/* Ligações */}
            <div className="flex flex-col gap-2 pl-6 border-l border-white/10">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <PhoneCall className="h-3.5 w-3.5" />
                <span className="text-xs font-semibold uppercase tracking-wider">Ligações</span>
              </div>
              <p className="text-4xl lg:text-5xl font-black text-foreground tracking-tighter">{stats.totalCalls}</p>
            </div>

            {/* Agendamentos */}
            <div className="flex flex-col gap-2 pl-6 border-l border-white/10">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <CalendarCheck className="h-3.5 w-3.5" />
                <span className="text-xs font-semibold uppercase tracking-wider">Agendamentos</span>
              </div>
              <div className="flex items-baseline gap-3">
                <p className="text-4xl lg:text-5xl font-black text-foreground tracking-tighter">{stats.scheduledCalls}</p>
                {stats.totalCalls > 0 && (
                  <span className="text-sm font-medium text-emerald-400">+{leadToScheduled}%</span>
                )}
              </div>
            </div>

            {/* Comparecimento */}
            <div className="flex flex-col gap-2 pl-6 border-l border-white/10">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Users className="h-3.5 w-3.5" />
                <span className="text-xs font-semibold uppercase tracking-wider">Comparecimentos</span>
              </div>
              <div className="flex items-baseline gap-3">
                <p className="text-4xl lg:text-5xl font-black text-foreground tracking-tighter">{stats.totalConsultations}</p>
                {stats.scheduledCalls > 0 && (
                  <span className="text-sm font-medium text-emerald-400">+{scheduledToConsultation}%</span>
                )}
              </div>
            </div>

            {/* Fechamentos */}
            <div className="flex flex-col gap-2 pl-6 border-l border-white/10">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <TrendingUp className="h-3.5 w-3.5" />
                <span className="text-xs font-semibold uppercase tracking-wider">Fechamentos</span>
              </div>
              <div className="flex items-baseline gap-3">
                <p className="text-4xl lg:text-5xl font-black text-foreground tracking-tighter">{stats.closedTreatments}</p>
                {stats.totalConsultations > 0 && (
                  <span className="text-sm font-medium text-emerald-400">+{consultationToClosed}%</span>
                )}
              </div>
            </div>
          </div>

          {/* Funnel Bar */}
          {(() => {
            // Use the max value across all funnel stages as the 100% reference
            const maxVal = Math.max(stats.totalCalls, stats.scheduledCalls, stats.totalConsultations, stats.closedTreatments, 1);
            const pct = (val: number) => maxVal > 0 ? `${Math.round((val / maxVal) * 100)}%` : "0%";
            return (
              <div className="space-y-4 max-w-2xl">
                <div className="flex items-center gap-4 group">
                  <span className="text-sm text-muted-foreground w-28 group-hover:text-foreground transition-colors">Ligações</span>
                  <div className="flex-1 h-[3px] bg-white/5 rounded-full relative overflow-hidden">
                    <div className="absolute top-0 left-0 h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.4)] transition-all duration-700 ease-out" style={{ width: pct(stats.totalCalls) }} />
                  </div>
                  <span className="text-sm font-medium text-foreground w-12 text-right">{stats.totalCalls}</span>
                </div>
                <div className="flex items-center gap-4 group">
                  <span className="text-sm text-muted-foreground w-28 group-hover:text-foreground transition-colors">Agendados</span>
                  <div className="flex-1 h-[3px] bg-white/5 rounded-full relative overflow-hidden">
                    <div className="absolute top-0 left-0 h-full rounded-full bg-gradient-to-r from-amber-600 to-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.4)] transition-all duration-700 ease-out" style={{ width: pct(stats.scheduledCalls) }} />
                  </div>
                  <span className="text-sm font-medium text-foreground w-12 text-right">{stats.scheduledCalls}</span>
                </div>
                <div className="flex items-center gap-4 group">
                  <span className="text-sm text-muted-foreground w-28 group-hover:text-foreground transition-colors">Comparecim.</span>
                  <div className="flex-1 h-[3px] bg-white/5 rounded-full relative overflow-hidden">
                    <div className="absolute top-0 left-0 h-full rounded-full bg-gradient-to-r from-indigo-600 to-purple-400 shadow-[0_0_10px_rgba(192,132,252,0.4)] transition-all duration-700 ease-out" style={{ width: pct(stats.totalConsultations) }} />
                  </div>
                  <span className="text-sm font-medium text-foreground w-12 text-right">{stats.totalConsultations}</span>
                </div>
                <div className="flex items-center gap-4 group">
                  <span className="text-sm text-muted-foreground w-28 group-hover:text-foreground transition-colors">Fechamentos</span>
                  <div className="flex-1 h-[3px] bg-white/5 rounded-full relative overflow-hidden">
                    <div className="absolute top-0 left-0 h-full rounded-full bg-gradient-to-r from-emerald-600 to-teal-400 shadow-[0_0_10px_rgba(45,212,191,0.4)] transition-all duration-700 ease-out" style={{ width: pct(stats.closedTreatments) }} />
                  </div>
                  <span className="text-sm font-medium text-foreground w-12 text-right">{stats.closedTreatments}</span>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Rankings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 mb-10">
          {/* CRC Ranking */}
          <div>
            <h2 className="text-xs font-semibold text-muted-foreground mb-4 uppercase tracking-widest flex items-center gap-2">
              Ranking CRCs
            </h2>
            {crcs.length === 0 ? (
              <p className="text-sm text-muted-foreground/50 py-4">Nenhum CRC cadastrado</p>
            ) : (
              <div className="space-y-1">
                {crcs.map((crc: any, i: number) => (
                  <div key={crc.id} className="flex items-center gap-4 py-3 px-2 border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors rounded-lg">
                    <span className={`text-base font-medium w-6 text-center ${i === 0 ? "text-foreground" : "text-muted-foreground"}`}>
                      {i + 1}
                    </span>
                    <div className="flex-1">
                      <p className="font-medium text-foreground text-sm tracking-tight">{crc.name}</p>
                      <p className="text-xs text-muted-foreground">{crc.email}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Dentist Ranking */}
          <div>
            <h2 className="text-xs font-semibold text-muted-foreground mb-4 uppercase tracking-widest flex items-center gap-2">
              Ranking Dentistas
            </h2>
            {dentists.length === 0 ? (
              <p className="text-sm text-muted-foreground/50 py-4">Nenhum dentista cadastrado</p>
            ) : (
              <div className="space-y-1">
                {dentists.map((d: any, i: number) => (
                  <div key={d.id} className="flex items-center gap-4 py-3 px-2 border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors rounded-lg">
                    <span className={`text-base font-medium w-6 text-center ${i === 0 ? "text-foreground" : "text-muted-foreground"}`}>
                      {i + 1}
                    </span>
                    <div className="flex-1">
                      <p className="font-medium text-foreground text-sm tracking-tight">{d.name}</p>
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
            <div className="group flex items-center gap-4 p-5 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-all cursor-pointer">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                <UserPlus className="h-4 w-4 text-blue-400 group-hover:text-blue-300 transition-colors" />
              </div>
              <div>
                <h3 className="font-medium text-sm text-foreground tracking-tight">Gerenciar Time</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Adicionar CRCs e Dentistas</p>
              </div>
            </div>
          </Link>
          <Link href="/leads">
            <div className="group flex items-center gap-4 p-5 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-all cursor-pointer">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Phone className="h-4 w-4 text-amber-400 group-hover:text-amber-300 transition-colors" />
              </div>
              <div>
                <h3 className="font-medium text-sm text-foreground tracking-tight">Ver Leads</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Acompanhar leads e ligações</p>
              </div>
            </div>
          </Link>
          <Link href="/patients">
            <div className="group flex items-center gap-4 p-5 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-all cursor-pointer">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Users className="h-4 w-4 text-emerald-400 group-hover:text-emerald-300 transition-colors" />
              </div>
              <div>
                <h3 className="font-medium text-sm text-foreground tracking-tight">Ver Pacientes</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Acompanhar tratamentos</p>
              </div>
            </div>
          </Link>
        </div>
    </motion.div>
  );
}
