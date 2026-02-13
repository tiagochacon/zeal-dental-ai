import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Loader2, LayoutDashboard, Users, Menu, X, LogOut, UserCircle, FileText, Sparkles, Crown } from "lucide-react";
import { useLocation } from "wouter";
import { getLoginUrl } from "@/const";
import DentistProfile from "@/components/DentistProfile";
import { trpc } from "@/lib/trpc";
import { UpgradeModal } from "@/components/UpgradeModal";

export default function Profile() {
  const [, setLocation] = useLocation();
  const { user, loading: authLoading, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Get subscription info to show upgrade CTA
  const { data: planInfo } = trpc.billing.getPlanInfo.useQuery(undefined, { enabled: !!user });
  // Admin users are always treated as unlimited/PRO
  const isAdmin = user?.role === 'admin';
  const isPro = isAdmin || planInfo?.tier === 'pro' || planInfo?.tier === 'unlimited';
  const isBasic = !isAdmin && planInfo?.tier === 'basic';
  const isTrial = !isAdmin && !isPro && !isBasic && planInfo?.tier === 'trial';

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    window.location.href = getLoginUrl();
    return null;
  }

  // Determine upgrade trigger type
  const getUpgradeTrigger = () => {
    if (isTrial) return "trial_limit";
    if (isBasic) return "basic_limit";
    return "feature_gate";
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-64 border-r border-border bg-sidebar flex flex-col
        transform transition-transform duration-200 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo with Plan Badge */}
        <div className="p-6 border-b border-sidebar-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="ZEAL" className="h-8 w-auto" />
            <span className="text-xl font-bold text-foreground">Zeal</span>
            {/* Plan Status Badge */}
            {user?.role === 'admin' ? (
              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-500 text-white mt-0.5">
                ADMIN
              </span>
            ) : isPro ? (
              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 text-white mt-0.5">
                PRO
              </span>
            ) : isBasic ? (
              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-slate-500 text-white mt-0.5">
                BASIC
              </span>
            ) : (
              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500 text-white mt-0.5">
                TRIAL
              </span>
            )}
          </div>
          <button 
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 hover:bg-sidebar-accent rounded-lg"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            <li>
              <button
                onClick={() => { setLocation("/"); setSidebarOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
              >
                <LayoutDashboard className="h-5 w-5" />
                Dashboard
              </button>
            </li>
            <li>
              <button
                onClick={() => { setLocation("/patients"); setSidebarOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
              >
                <Users className="h-5 w-5" />
                Pacientes
              </button>
            </li>
            <li>
              <button
                onClick={() => { setLocation("/consultations"); setSidebarOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
              >
                <FileText className="h-5 w-5" />
                Consultas
              </button>
            </li>
            <li>
              <button
                onClick={() => { setLocation("/profile"); setSidebarOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-primary text-primary-foreground font-medium"
              >
                <UserCircle className="h-5 w-5" />
                Meu Perfil
              </button>
            </li>
          </ul>

          {/* Upgrade CTA Button - Only show for Basic and Trial users (not Admin or Pro) */}
          {user?.role !== 'admin' && !isPro && (
            <div className="mt-6">
              <button
                onClick={() => setShowUpgradeModal(true)}
                className="
                  w-full flex items-center gap-3 px-4 py-3 rounded-xl
                  bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600
                  hover:from-blue-500 hover:via-indigo-500 hover:to-purple-500
                  shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40
                  transition-all duration-300 transform hover:scale-[1.02]
                  border border-indigo-400/30
                  group
                "
              >
                <div className="p-1.5 rounded-lg bg-white/20 group-hover:bg-white/30 transition-colors shrink-0">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <div className="flex flex-col items-start min-w-0">
                  <span className="text-sm font-semibold text-white truncate">
                    {isBasic ? 'Upgrade para PRO' : 'Assinar Plano PRO'}
                  </span>
                  <span className="text-xs text-indigo-200 truncate">
                    {isBasic ? 'Desbloqueie Negociação e mais' : 'Desbloqueie todo o potencial'}
                  </span>
                </div>
                <Crown className="h-4 w-4 text-yellow-300 ml-auto shrink-0 animate-pulse" />
              </button>
            </div>
          )}

          {/* Pro/Admin Badge - Show for Pro users or Admin */}
          {(isPro || user?.role === 'admin') && (
            <div className="mt-6">
              <div className={`
                w-full flex items-center gap-3 px-4 py-3 rounded-xl
                ${user?.role === 'admin' 
                  ? 'bg-gradient-to-r from-amber-600/20 to-yellow-600/20 border border-amber-500/30' 
                  : 'bg-gradient-to-r from-emerald-600/20 to-teal-600/20 border border-emerald-500/30'
                }
              `}>
                <Crown className={`h-5 w-5 shrink-0 ${user?.role === 'admin' ? 'text-amber-400' : 'text-emerald-400'}`} />
                <span className={`text-sm font-medium truncate ${user?.role === 'admin' ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {user?.role === 'admin' ? 'Acesso Admin' : 'Plano PRO Ativo'}
                </span>
              </div>
            </div>
          )}
        </nav>

        {/* User Profile */}
        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold">
              {user.name?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase() || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.name || "Usuário"}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={logout}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Header */}
        <header className="p-4 lg:p-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 hover:bg-muted rounded-lg"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-xl lg:text-3xl font-bold">
                Meu Perfil Profissional
              </h1>
              <p className="text-sm text-muted-foreground hidden sm:block">
                Gerencie suas informações profissionais
              </p>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="p-4 lg:p-6">
          <div className="max-w-2xl mx-auto">
            <DentistProfile />
          </div>
        </div>
      </main>

      {/* Upgrade Modal */}
      <UpgradeModal
        open={showUpgradeModal}
        onOpenChange={setShowUpgradeModal}
        trigger={getUpgradeTrigger()}
        currentPlan={planInfo?.tier || "trial"}
        consultationsUsed={planInfo?.used || 0}
        consultationsLimit={planInfo?.limit || 7}
      />
    </div>
  );
}
