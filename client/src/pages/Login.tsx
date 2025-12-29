import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { getLoginUrl } from "@/const";
import { useEffect } from "react";

export default function Login() {
  const [, setLocation] = useLocation();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (user && !loading) {
      setLocation("/");
    }
  }, [user, loading, setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <img src="/logo.png" alt="ZEAL" className="h-20 w-auto mb-4" />
          <h1 className="text-3xl font-bold text-foreground">Zeal</h1>
          <p className="text-muted-foreground mt-2 text-center">
            Assistente de IA para Consultas Odontológicas
          </p>
        </div>

        {/* Login Card */}
        <Card className="border-border bg-card/80 backdrop-blur">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Bem-vindo ao Zeal</CardTitle>
            <CardDescription>
              Faça login para acessar o painel de controle
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              className="w-full" 
              size="lg"
              onClick={() => window.location.href = getLoginUrl()}
            >
              Entrar com Manus
            </Button>
            
            <div className="text-center text-xs text-muted-foreground">
              <p>Ao entrar, você concorda com nossos</p>
              <p>
                <a href="#" className="text-primary hover:underline">Termos de Serviço</a>
                {" e "}
                <a href="#" className="text-primary hover:underline">Política de Privacidade</a>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Features */}
        <div className="mt-8 grid grid-cols-3 gap-4 text-center">
          <div className="p-4">
            <div className="text-2xl mb-2">🎙️</div>
            <p className="text-xs text-muted-foreground">Transcrição de Áudio</p>
          </div>
          <div className="p-4">
            <div className="text-2xl mb-2">📋</div>
            <p className="text-xs text-muted-foreground">Nota SOAP Automática</p>
          </div>
          <div className="p-4">
            <div className="text-2xl mb-2">🦷</div>
            <p className="text-xs text-muted-foreground">Diagnóstico Clínico</p>
          </div>
        </div>
      </div>
    </div>
  );
}
