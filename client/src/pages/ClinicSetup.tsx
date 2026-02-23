import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Building2, ArrowRight, CheckCircle } from "lucide-react";
import { toast } from "sonner";

export default function ClinicSetup() {
  const [, setLocation] = useLocation();
  const { user, loading, refresh } = useAuth();
  const [clinicName, setClinicName] = useState("");
  const [step, setStep] = useState<"name" | "done">("name");

  const createClinic = trpc.clinic.create.useMutation({
    onSuccess: async () => {
      toast.success("Clínica criada com sucesso!");
      setStep("done");
      await refresh();
      setTimeout(() => setLocation("/"), 1500);
    },
    onError: (err) => {
      toast.error(err.message || "Erro ao criar clínica");
    },
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    setLocation("/login");
    return null;
  }

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-background via-[#0d1a2d] to-background relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-[800px] h-[800px] bg-blue-600/15 rounded-full blur-[180px] -translate-x-1/2 -translate-y-1/2 animate-pulse" />
        <div className="absolute bottom-0 right-0 w-[700px] h-[700px] bg-cyan-600/10 rounded-full blur-[160px] translate-x-1/2 translate-y-1/2 animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="w-full relative z-10 flex items-center justify-center px-4 sm:px-8 py-8">
        <div className="w-full max-w-lg">
          <div className="flex items-center justify-center gap-3 mb-8">
            <img src="/logo.png" alt="ZEAL" className="h-12 w-auto" />
            <span className="text-3xl font-bold text-white tracking-tight">Zeal</span>
          </div>

          <div className="bg-card/90 backdrop-blur-2xl rounded-3xl p-8 sm:p-10 border border-border shadow-2xl">
            {step === "name" && (
              <>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-full bg-blue-600/20 flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-blue-400" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-foreground">Configure sua Clínica</h2>
                    <p className="text-muted-foreground text-sm">Primeiro passo para começar</p>
                  </div>
                </div>

                <p className="text-muted-foreground mb-6">
                  Olá, <span className="text-foreground font-medium">{user.name}</span>! 
                  Para começar a usar o ZEAL, precisamos configurar sua clínica. 
                  Depois você poderá adicionar dentistas e CRCs ao seu time.
                </p>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (clinicName.trim()) {
                      createClinic.mutate({ name: clinicName.trim() });
                    }
                  }}
                  className="space-y-4"
                >
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-2 block">
                      Nome da Clínica
                    </label>
                    <Input
                      type="text"
                      placeholder="Ex: Clínica Odontológica Sorriso"
                      value={clinicName}
                      onChange={(e) => setClinicName(e.target.value)}
                      disabled={createClinic.isPending}
                      className="w-full h-12 bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground px-4 text-base"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={!clinicName.trim() || createClinic.isPending}
                    className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold text-base rounded-xl transition-all"
                  >
                    {createClinic.isPending ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                        Criando...
                      </>
                    ) : (
                      <>
                        Criar Clínica
                        <ArrowRight className="h-5 w-5 ml-2" />
                      </>
                    )}
                  </Button>
                </form>

                <div className="mt-6 pt-6 border-t border-border">
                  <p className="text-xs text-muted-foreground text-center">
                    Você será o <span className="text-blue-400 font-medium">Gestor</span> desta clínica e poderá 
                    adicionar membros da equipe depois.
                  </p>
                </div>
              </>
            )}

            {step === "done" && (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-green-600/20 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-400" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-2">Clínica Criada!</h2>
                <p className="text-muted-foreground">Redirecionando para o painel...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
