import { Button } from "@/components/ui/button";
import { AlertCircle, Home } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <div className="flex items-center justify-center py-20">
      <div className="text-center max-w-md mx-auto px-4">
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="absolute inset-0 bg-destructive/20 rounded-full animate-pulse" />
            <AlertCircle className="relative h-16 w-16 text-destructive" />
          </div>
        </div>

        <h1 className="text-5xl font-bold text-foreground mb-2">404</h1>

        <h2 className="text-xl font-semibold text-foreground mb-4">
          Página não encontrada
        </h2>

        <p className="text-muted-foreground mb-8 leading-relaxed">
          A página que você procura não existe ou foi movida.
        </p>

        <Button
          onClick={() => setLocation("/")}
        >
          <Home className="w-4 h-4 mr-2" />
          Voltar ao Início
        </Button>
      </div>
    </div>
  );
}
