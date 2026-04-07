import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Phone, CalendarCheck, PhoneOff, Plus, Search } from "lucide-react";
import { motion } from "framer-motion";
import { useLocation, Link } from "wouter";

export default function Calls() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");

  const callsQuery = trpc.calls.list.useQuery(undefined, {
    enabled: !!user,
    refetchOnWindowFocus: false,
  });

  const calls = callsQuery.data || [];
  const filtered = calls.filter((c: any) =>
    c.leadName?.toLowerCase().includes(search.toLowerCase())
  );

  function formatDuration(seconds: number | null | undefined) {
    if (!seconds) return null;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}min ${s}s`;
  }

  const statusConfig: Record<string, { label: string; className: string }> = {
    analyzed: { label: "Analisada", className: "bg-transparent border border-white/10 text-foreground/80 gap-1.5 before:content-[''] before:block before:w-1.5 before:h-1.5 before:rounded-full before:bg-green-400 before:shadow-[0_0_8px_rgba(74,222,128,0.8)]" },
    transcribed: { label: "Transcrita", className: "bg-transparent border border-white/10 text-foreground/80 gap-1.5 before:content-[''] before:block before:w-1.5 before:h-1.5 before:rounded-full before:bg-blue-400 before:shadow-[0_0_8px_rgba(96,165,250,0.8)]" },
    finalized: { label: "Finalizada", className: "bg-transparent border border-white/10 text-foreground/80 gap-1.5 before:content-[''] before:block before:w-1.5 before:h-1.5 before:rounded-full before:bg-purple-400 before:shadow-[0_0_8px_rgba(192,132,252,0.8)]" },
  };

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
          <h1 className="text-xl lg:text-3xl font-bold text-foreground">Ligações</h1>
          <p className="text-sm text-muted-foreground hidden sm:block">
            Histórico de ligações com leads
          </p>
        </div>
        <Button
          className="bg-blue-600 hover:bg-blue-700"
          onClick={() => setLocation("/calls/new")}
        >
          <Plus className="h-4 w-4 mr-2" />
          Nova Ligação
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome do lead..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 h-11 surface-glass border-white/5 text-foreground placeholder:text-muted-foreground transition-all focus-visible:ring-1 focus-visible:ring-primary/50"
        />
      </div>

      {/* List */}
      <div className="surface-glass border border-white/5 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden bg-gradient-to-b from-white/[0.03] to-transparent">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
        <div className="flex items-center gap-2 mb-6">
          <Phone className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-medium text-foreground tracking-tight">Histórico de Ligações</h2>
        </div>

        {callsQuery.isLoading ? (
          <div className="flex flex-col">
            {[1, 2, 3].map((i) => (
              <div key={i} className="py-4 border-b border-white/5 last:border-0">
                <Skeleton className="h-12 w-full rounded-xl" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="p-4 rounded-full bg-primary/10 mb-4 border border-primary/20 w-fit mx-auto">
              <Phone className="h-8 w-8 text-primary/70" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {search ? "Nenhuma ligação encontrada" : "Nenhuma ligação registrada"}
            </h3>
            <p className="text-muted-foreground mb-4">
              {search ? "Tente outro termo de busca" : "Comece registrando sua primeira ligação"}
            </p>
            {!search && (
              <Button
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() => setLocation("/calls/new")}
              >
                <Plus className="h-4 w-4 mr-2" />
                Nova Ligação
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col">
            {filtered.map((call: any) => {
              const config = statusConfig[call.status] ?? { label: "Pendente", className: "bg-transparent border border-white/10 text-foreground/80 gap-1.5 before:content-[''] before:block before:w-1.5 before:h-1.5 before:rounded-full before:bg-gray-400 before:shadow-[0_0_8px_rgba(156,163,175,0.8)]" };
              const duration = formatDuration(call.audioDurationSeconds);
              return (
                <Link key={call.id} href={`/calls/${call.id}`}>
                  <div className="py-4 px-3 border-b border-white/5 last:border-0 hover:bg-white/[0.03] transition-colors rounded-xl cursor-pointer group">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform ${
                          call.schedulingResult === "scheduled" ? 'bg-emerald-500/10 border border-emerald-500/20' :
                          call.schedulingResult === "not_scheduled" ? 'bg-red-500/10 border border-red-500/20' :
                          'bg-blue-500/10 border border-blue-500/20'
                        }`}>
                          {call.schedulingResult === "scheduled" ? (
                            <CalendarCheck className="w-4 h-4 text-emerald-400" />
                          ) : call.schedulingResult === "not_scheduled" ? (
                            <PhoneOff className="w-4 h-4 text-destructive" />
                          ) : (
                            <Phone className="w-4 h-4 text-blue-400" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-sm text-foreground tracking-tight">{call.leadName}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            {call.createdAt && (
                              <span>
                                {new Date(call.createdAt).toLocaleDateString("pt-BR", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </span>
                            )}
                            {duration && (
                              <>
                                <span>·</span>
                                <span>{duration}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <span className={`inline-flex items-center text-[10px] font-medium uppercase tracking-wider px-2.5 py-1 rounded-full ${config.className}`}>
                        {config.label}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}
