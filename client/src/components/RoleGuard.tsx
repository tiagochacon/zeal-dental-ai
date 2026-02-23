import { useAuth } from "@/_core/hooks/useAuth";
import { Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { useEffect } from "react";

type ClinicRole = "gestor" | "crc" | "dentista";

interface RoleGuardProps {
  /** Roles that are allowed to access this content */
  allowedRoles: ClinicRole[];
  /** Content to render when access is granted */
  children: React.ReactNode;
  /** Optional fallback when user doesn't have the right role */
  fallback?: React.ReactNode;
}

/**
 * RoleGuard component that controls access based on clinicRole.
 * 
 * - If user has no clinicRole (legacy dentist user), they are treated as "dentista"
 * - Admin users bypass all role checks
 * - Gestor can see everything (read access to all)
 */
export function RoleGuard({ allowedRoles, children, fallback }: RoleGuardProps) {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      setLocation("/login");
    }
  }, [loading, user, setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  // Admin users bypass all role checks
  if (user.role === "admin") {
    return <>{children}</>;
  }

  // Get effective clinic role
  const effectiveRole: ClinicRole = (user as any).clinicRole || "dentista";

  // Gestor has read access to everything
  if (effectiveRole === "gestor" || allowedRoles.includes(effectiveRole)) {
    return <>{children}</>;
  }

  // Access denied
  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center max-w-md p-8">
        <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">Acesso Restrito</h2>
        <p className="text-muted-foreground mb-4">
          Você não tem permissão para acessar esta área. 
          Entre em contato com o gestor da sua clínica.
        </p>
        <button
          onClick={() => setLocation("/")}
          className="text-blue-400 hover:text-blue-300 font-medium"
        >
          Voltar ao início
        </button>
      </div>
    </div>
  );
}

/**
 * Hook to get the effective clinic role of the current user
 */
export function useClinicRole(): {
  role: ClinicRole | null;
  isGestor: boolean;
  isCRC: boolean;
  isDentista: boolean;
  clinicId: number | null;
  loading: boolean;
} {
  const { user, loading } = useAuth();

  if (!user) {
    return { role: null, isGestor: false, isCRC: false, isDentista: false, clinicId: null, loading };
  }

  const role: ClinicRole = (user as any).clinicRole || "dentista";
  
  return {
    role,
    isGestor: role === "gestor" || user.role === "admin",
    isCRC: role === "crc",
    isDentista: role === "dentista" || (!role && user.role !== "admin"),
    clinicId: (user as any).clinicId || null,
    loading,
  };
}
