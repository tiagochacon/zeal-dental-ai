import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import {
  Building2,
  CreditCard,
  Crown,
  FileText,
  BarChart3,
  LayoutDashboard,
  LogOut,
  PanelLeft,
  Phone,
  Sparkles,
  UserCircle,
  Users,
  UsersRound,
} from "lucide-react";
import { Separator } from "./ui/separator";
import { CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";
import { UsageIndicator } from './UsageIndicator';
import { trpc } from "@/lib/trpc";

type MenuItem = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  path: string;
};

// Menu items per role
const dentistMenuItems: MenuItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: FileText, label: "Consultas", path: "/consultations" },
  { icon: Users, label: "Pacientes", path: "/patients" },
  { icon: UserCircle, label: "Meu Perfil", path: "/profile" },
  { icon: CreditCard, label: "Assinatura", path: "/subscription" },
];

const crcMenuItems: MenuItem[] = [
  { icon: LayoutDashboard, label: "Dashboard CRC", path: "/crc" },
  { icon: UsersRound, label: "Leads", path: "/leads" },
  { icon: Phone, label: "Ligações", path: "/calls" },
  { icon: UserCircle, label: "Meu Perfil", path: "/profile" },
];

const gestorMenuItems: MenuItem[] = [
  { icon: BarChart3, label: "Painel Gestor", path: "/gestor" },
  { icon: UsersRound, label: "Meu Time", path: "/team" },
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: FileText, label: "Consultas", path: "/consultations" },
  { icon: Users, label: "Pacientes", path: "/patients" },
  { icon: Phone, label: "Leads", path: "/leads" },
  { icon: UserCircle, label: "Meu Perfil", path: "/profile" },
  { icon: CreditCard, label: "Assinatura", path: "/subscription" },
];

// Admin without clinic gets dentist menu + clinic setup option
const adminMenuItems: MenuItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: FileText, label: "Consultas", path: "/consultations" },
  { icon: Users, label: "Pacientes", path: "/patients" },
  { icon: UserCircle, label: "Meu Perfil", path: "/profile" },
  { icon: CreditCard, label: "Assinatura", path: "/subscription" },
  { icon: Building2, label: "Configurar Cl\u00ednica", path: "/clinic-setup" },
];

function getMenuItemsForUser(user: { role?: string; clinicRole?: string | null; clinicId?: number | null } | null): MenuItem[] {
  if (!user) return dentistMenuItems;
  
  // If user has a clinic role, use that
  if (user.clinicRole === 'gestor') return gestorMenuItems;
  if (user.clinicRole === 'crc') return crcMenuItems;
  if (user.clinicRole === 'dentista') return dentistMenuItems;
  
  // Admin without clinic role gets admin menu with clinic setup
  if (user.role === 'admin') return adminMenuItems;
  
  // Default: dentist menu
  return dentistMenuItems;
}

function getRoleLabel(user: { role?: string; clinicRole?: string | null } | null): string | null {
  if (!user) return null;
  if (user.clinicRole === 'gestor') return 'GESTOR';
  if (user.clinicRole === 'crc') return 'CRC';
  if (user.clinicRole === 'dentista') return 'DENTISTA';
  if (user.role === 'admin') return 'ADMIN';
  return null;
}

function getRoleBadgeColor(user: { role?: string; clinicRole?: string | null } | null): string {
  if (!user) return 'bg-gray-500';
  if (user.clinicRole === 'gestor') return 'bg-purple-600';
  if (user.clinicRole === 'crc') return 'bg-blue-600';
  if (user.clinicRole === 'dentista') return 'bg-emerald-600';
  if (user.role === 'admin') return 'bg-amber-600';
  return 'bg-gray-500';
}

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-6">
            <h1 className="text-2xl font-semibold tracking-tight text-center text-foreground">
              Acesse sua conta
            </h1>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Fa\u00e7a login para acessar o painel do ZEAL.
            </p>
          </div>
          <Button
            onClick={() => {
              window.location.href = "/login";
            }}
            size="lg"
            className="w-full shadow-lg hover:shadow-xl transition-all bg-blue-600 hover:bg-blue-700"
          >
            Entrar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  
  // Get menu items based on user role
  const menuItems = useMemo(() => getMenuItemsForUser(user), [user]);
  const roleLabel = useMemo(() => getRoleLabel(user), [user]);
  const roleBadgeColor = useMemo(() => getRoleBadgeColor(user), [user]);
  
  const activeMenuItem = menuItems.find(item => item.path === location);
  
  // Get subscription info to determine if user needs upgrade CTA
  const { data: subscriptionInfo } = trpc.billing.getPlanInfo.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const isPro = subscriptionInfo?.tier === 'pro' || subscriptionInfo?.tier === 'unlimited';
  
  // CRC users don't need subscription upgrade CTA
  const showUpgradeCTA = !isPro && user?.clinicRole !== 'crc' && user?.clinicRole !== 'gestor';

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r-0"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-16 justify-center">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed ? (
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-semibold tracking-tight truncate">
                    Zeal
                  </span>
                  {roleLabel && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${roleBadgeColor} text-white`}>
                      {roleLabel}
                    </span>
                  )}
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0">
            <SidebarMenu className="px-2 py-1">
              {menuItems.map(item => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className={`h-10 transition-all font-normal`}
                    >
                      <item.icon
                        className={`h-4 w-4 ${isActive ? "text-primary" : ""}`}
                      />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
            
            {/* Upgrade CTA Button - Only show for non-Pro users (not CRC) */}
            {showUpgradeCTA && (
              <div className="px-2 mt-4">
                <button
                  onClick={() => setLocation("/subscription")}
                  className={`
                    w-full flex items-center gap-3 px-3 py-3 rounded-xl
                    bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600
                    hover:from-blue-500 hover:via-indigo-500 hover:to-purple-500
                    shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40
                    transition-all duration-300 transform hover:scale-[1.02]
                    border border-indigo-400/30
                    group
                    ${isCollapsed ? 'justify-center' : ''}
                  `}
                >
                  <div className="p-1.5 rounded-lg bg-white/20 group-hover:bg-white/30 transition-colors shrink-0">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                  {!isCollapsed && (
                    <div className="flex flex-col items-start min-w-0">
                      <span className="text-sm font-semibold text-white truncate">
                        Fazer Upgrade
                      </span>
                      <span className="text-xs text-indigo-200 truncate">
                        Desbloqueie o PRO
                      </span>
                    </div>
                  )}
                  {!isCollapsed && (
                    <Crown className="h-4 w-4 text-yellow-300 ml-auto shrink-0 animate-pulse" />
                  )}
                </button>
              </div>
            )}
            
            {/* Pro Badge - Show for Pro users */}
            {isPro && (
              <div className="px-2 mt-4">
                <div
                  className={`
                    w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
                    bg-gradient-to-r from-emerald-600/20 to-teal-600/20
                    border border-emerald-500/30
                    ${isCollapsed ? 'justify-center' : ''}
                  `}
                >
                  <Crown className="h-4 w-4 text-emerald-400 shrink-0" />
                  {!isCollapsed && (
                    <span className="text-sm font-medium text-emerald-400 truncate">
                      Plano PRO Ativo
                    </span>
                  )}
                </div>
              </div>
            )}
          </SidebarContent>

          {user?.clinicRole !== 'crc' && <UsageIndicator />}

          <SidebarFooter className="p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 border shrink-0">
                    <AvatarFallback className="text-xs font-medium">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none">
                      {user?.name || "-"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-1.5">
                      {user?.email || "-"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem
                  onClick={() => setLocation("/profile")}
                  className="cursor-pointer"
                >
                  <UserCircle className="mr-2 h-4 w-4" />
                  <span>Meu Perfil</span>
                </DropdownMenuItem>
                <Separator className="my-1" />
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sair</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-2 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-1">
                  <span className="tracking-tight text-foreground">
                    {activeMenuItem?.label ?? "Menu"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </SidebarInset>
    </>
  );
}
