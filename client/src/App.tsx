import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Dashboard from "./pages/Dashboard";
import NewConsultation from "./pages/NewConsultation";
import TranscriptionReview from "./pages/TranscriptionReview";
import ConsultationDetail from "./pages/ConsultationDetail";
import Patients from "./pages/Patients";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/new-consultation" component={NewConsultation} />
      <Route path="/consultation/:id/review" component={TranscriptionReview} />
      <Route path="/consultation/:id" component={ConsultationDetail} />
      <Route path="/patients" component={Patients} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
