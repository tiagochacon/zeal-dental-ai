import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { PaywallGuard } from "./components/PaywallGuard";
import DashboardLayout from "./components/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import NewConsultation from "./pages/NewConsultation";
import TranscriptionReview from "./pages/TranscriptionReview";
import ConsultationDetail from "./pages/ConsultationDetail";
import Consultations from "./pages/Consultations";
import Patients from "./pages/Patients";
import Profile from "./pages/Profile";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Subscription from "./pages/Subscription";
import Pricing from "./pages/Pricing";
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";

// Lazy-loaded pages for multi-role system
const ClinicSetup = lazy(() => import("./pages/ClinicSetup"));
const DashboardCRC = lazy(() => import("./pages/DashboardCRC"));
const DashboardGestor = lazy(() => import("./pages/DashboardGestor"));
const Leads = lazy(() => import("./pages/Leads"));
const LeadDetail = lazy(() => import("./pages/LeadDetail"));
const NewCall = lazy(() => import("./pages/NewCall"));
const CallDetail = lazy(() => import("./pages/CallDetail"));
const Calls = lazy(() => import("./pages/Calls"));
const TeamManagement = lazy(() => import("./pages/TeamManagement"));

function LazyFallback() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<LazyFallback />}>
      <Switch>
        {/* Public Auth Pages - No DashboardLayout */}
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route path="/pricing" component={Pricing} />

        {/* All authenticated pages wrapped in DashboardLayout */}
        <Route>
          <DashboardLayout>
            <Suspense fallback={<LazyFallback />}>
              <Switch>
                {/* Clinic Setup */}
                <Route path="/clinic-setup" component={ClinicSetup} />

                {/* CRC Pages */}
                <Route path="/crc" component={DashboardCRC} />
                <Route path="/leads" component={Leads} />
                <Route path="/leads/:id" component={LeadDetail} />
                <Route path="/calls" component={Calls} />
                <Route path="/calls/new" component={NewCall} />
                <Route path="/calls/:id" component={CallDetail} />

                {/* Gestor Pages */}
                <Route path="/gestor" component={DashboardGestor} />
                <Route path="/team" component={TeamManagement} />

                {/* Dentist Pages (existing) */}
                <Route path="/" component={Dashboard} />
                <Route path="/profile" component={Profile} />
                <Route path="/new-consultation" component={NewConsultation} />
                <Route path="/consultation/:id/review" component={TranscriptionReview} />
                <Route path="/consultation/:id" component={ConsultationDetail} />
                <Route path="/consultations" component={Consultations} />
                <Route path="/patients" component={Patients} />
                <Route path="/subscription" component={Subscription} />

                {/* 404 */}
                <Route path="/404" component={NotFound} />
                <Route component={NotFound} />
              </Switch>
            </Suspense>
          </DashboardLayout>
        </Route>
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <PaywallGuard>
            <Router />
          </PaywallGuard>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
