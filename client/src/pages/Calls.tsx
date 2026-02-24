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
    analyzed: { label: "Analisada", className: "bg-green-600/20 text-green-400" },
    transcribed: { label: "Transcrita", className: "bg-blue-600/20 text-blue-400" },
    finalized: { label: "Finalizada", className: "bg-purple-600/20 text-purple-400" },
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
          className="pl-10 h-11 bg-secondary border-border rounded-xl"
        />
      </div>

      {/* List */}
      {callsQuery.isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Phone className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
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
        <div className="space-y-3">
          {filtered.map((call: any) => {
            const config = statusConfig[call.status] ?? { label: "Pendente", className: "bg-gray-600/20 text-gray-400" };
            const duration = formatDuration(call.audioDurationSeconds);
            return (
              <Link key={call.id} href={`/calls/${call.id}`}>
                <div className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-all cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                        {call.schedulingResult === "scheduled" ? (
                          <CalendarCheck className="w-5 h-5 text-green-400" />
                        ) : call.schedulingResult === "not_scheduled" ? (
                          <PhoneOff className="w-5 h-5 text-red-400" />
                        ) : (
                          <Phone className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{call.leadName}</p>
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
                    <span className={`text-xs px-2 py-0.5 rounded-full ${config.className}`}>
                      {config.label}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
