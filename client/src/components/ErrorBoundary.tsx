import { cn } from "@/lib/utils";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  retryCount: number;
}

/**
 * Global Error Boundary component that catches JavaScript errors anywhere in the child component tree.
 * Specifically designed to handle DOM-related errors like "removeChild" issues that can occur
 * due to browser extensions (e.g., Google Translate) or race conditions in React's reconciliation.
 * 
 * For DOM-related errors, it will auto-retry up to 2 times before showing the error UI.
 */
class ErrorBoundary extends Component<Props, State> {
  private retryTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    this.setState({ errorInfo });
    
    console.error("ErrorBoundary caught an error:", error);
    console.error("Component stack:", errorInfo.componentStack);
    
    this.logError(error, errorInfo);

    // Auto-retry for DOM-related errors (caused by browser extensions)
    if (this.isDOMRelatedError(error) && this.state.retryCount < 2) {
      this.retryTimeout = setTimeout(() => {
        this.setState((prev) => ({
          hasError: false,
          error: null,
          errorInfo: null,
          retryCount: prev.retryCount + 1,
        }));
      }, 300);
    }
  }

  componentWillUnmount(): void {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }
  }

  private logError(error: Error, errorInfo: React.ErrorInfo): void {
    try {
      const errorReport = {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        isDOMError: this.isDOMRelatedError(error),
        retryCount: this.state.retryCount,
      };

      console.error("[ErrorBoundary] Error Report:", errorReport);
      
      try {
        const existingErrors = JSON.parse(sessionStorage.getItem("errorBoundaryLogs") || "[]");
        existingErrors.push(errorReport);
        if (existingErrors.length > 10) {
          existingErrors.shift();
        }
        sessionStorage.setItem("errorBoundaryLogs", JSON.stringify(existingErrors));
      } catch {
        // Ignore storage errors
      }
    } catch {
      // Ignore logging errors
    }
  }

  private isDOMRelatedError(error: Error): boolean {
    const domErrorPatterns = [
      "removeChild",
      "appendChild",
      "insertBefore",
      "replaceChild",
      "NotFoundError",
      "The node to be removed is not a child of this node",
      "Failed to execute",
    ];
    
    const errorString = `${error.message} ${error.stack || ""}`;
    return domErrorPatterns.some(pattern => errorString.includes(pattern));
  }

  private handleReload = (): void => {
    try {
      if (typeof window !== "undefined" && (window as any).__REACT_QUERY_DEVTOOLS_GLOBAL_HOOK__) {
        (window as any).__REACT_QUERY_DEVTOOLS_GLOBAL_HOOK__.clear?.();
      }
    } catch {
      // Ignore
    }
    
    window.location.reload();
  };

  private handleReset = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null, retryCount: 0 });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isDOMError = this.state.error && this.isDOMRelatedError(this.state.error);

      return (
        <div className="flex items-center justify-center min-h-screen p-8 bg-background">
          <div className="flex flex-col items-center w-full max-w-2xl p-8">
            <AlertTriangle
              size={48}
              className="text-destructive mb-6 flex-shrink-0"
            />

            <h2 className="text-xl mb-4 text-foreground">
              {isDOMError 
                ? "Ocorreu um erro de exibição. Recarregue a página."
                : "Ocorreu um erro inesperado."
              }
            </h2>

            {isDOMError && (
              <p className="text-sm text-muted-foreground mb-4 text-center">
                Esse erro geralmente é causado por um problema de sincronização e pode ser resolvido
                recarregando a página.
              </p>
            )}

            <div className="p-4 w-full rounded bg-muted overflow-auto mb-6 max-h-48">
              <pre className="text-sm text-muted-foreground whitespace-break-spaces">
                {this.state.error?.message || "Erro desconhecido"}
              </pre>
            </div>

            <div className="flex gap-4">
              <button
                onClick={this.handleReload}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg",
                  "bg-primary text-primary-foreground",
                  "hover:opacity-90 cursor-pointer"
                )}
              >
                <RotateCcw size={16} />
                Recarregar página
              </button>
              
              {!isDOMError && (
                <button
                  onClick={this.handleReset}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg",
                    "bg-secondary text-secondary-foreground",
                    "hover:opacity-90 cursor-pointer"
                  )}
                >
                  Tentar novamente
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
