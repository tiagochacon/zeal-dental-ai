import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Lock, TrendingUp, Sparkles, Crown } from "lucide-react";
import { useLocation } from "wouter";

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature?: string;
}

export function UpgradeModal({ open, onOpenChange, feature = "Negociação" }: UpgradeModalProps) {
  const [, setLocation] = useLocation();

  const handleUpgrade = () => {
    onOpenChange(false);
    setLocation("/pricing");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10">
            <Lock className="h-6 w-6 text-blue-500" />
          </div>
          <DialogTitle className="text-center text-xl">
            Recurso Exclusivo PRO
          </DialogTitle>
          <DialogDescription className="text-center">
            A análise de <span className="font-semibold text-foreground">{feature}</span> está disponível no Plano PRO
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
            <h4 className="font-medium flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-blue-500" />
              O que você desbloqueia:
            </h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                Análise de perfil neurológico do paciente
              </li>
              <li className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                Mapeamento de objeções verdadeiras e ocultas
              </li>
              <li className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                Script PARE personalizado para fechamento
              </li>
              <li className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                Gatilhos mentais recomendados
              </li>
              <li className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                Termômetro de Rapport com breakdown detalhado
              </li>
            </ul>
          </div>

          <div className="text-center text-sm text-muted-foreground">
            <p>Aumente sua taxa de aceitação de tratamentos</p>
            <p>com insights baseados em Neurovendas</p>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button onClick={handleUpgrade} className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600">
            <Crown className="mr-2 h-4 w-4" />
            Fazer Upgrade para PRO
          </Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="w-full">
            Continuar no plano atual
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
