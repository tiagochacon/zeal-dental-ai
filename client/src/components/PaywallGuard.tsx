import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { Loader2 } from "lucide-react";

// Routes that don't require authentication
const AUTH_ROUTES = ["/login", "/register"];

// Routes that don't require subscription (but require auth)
const PUBLIC_ROUTES = ["/login", "/register", "/pricing", "/support", "/404", "/subscription"];

interface PaywallGuardProps {
  children: React.ReactNode;
}

export function PaywallGuard({ children }: PaywallGuardProps) {
  const { user, loading } = useAuth();
  const [location, setLocation] = useLocation();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    if (loading) return;

    // Skip check for public routes
    if (PUBLIC_ROUTES.some(route => location.startsWith(route))) {
      setIsChecking(false);
      return;
    }

    // If not logged in, redirect to login page
    if (!user) {
      // Don't redirect if already on auth routes
      if (!AUTH_ROUTES.some(route => location.startsWith(route))) {
        setLocation("/login");
        return;
      }
      setIsChecking(false);
      return;
    }

    // Admin bypass
    if (user.role === "admin") {
      setIsChecking(false);
      return;
    }

    // For CRC/Dentista in a clinic: auth.me already enriches their data with gestor's subscription fields.
    // So we check the (possibly enriched) subscriptionStatus which reflects the gestor's plan.
    // This means if the gestor cancels, CRC/Dentista will also see subscriptionStatus as inactive.
    const hasActiveSubscription = 
      user.subscriptionStatus === "active" || 
      user.subscriptionStatus === "trialing";

    // Check trial status (also enriched from gestor for clinic members)
    const hasActiveTrial = 
      user.trialEndsAt && new Date(user.trialEndsAt) > new Date();

    // If no access, redirect to pricing
    if (!hasActiveSubscription && !hasActiveTrial) {
      // For clinic members (CRC/Dentista), show a different message via pricing page
      setLocation("/pricing");
      return;
    }

    setIsChecking(false);
  }, [user, loading, location, setLocation]);

  // Show loading while checking
  if (loading || isChecking) {
    // Only show loader for protected routes
    if (!PUBLIC_ROUTES.some(route => location.startsWith(route))) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Verificando acesso...</p>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
}
