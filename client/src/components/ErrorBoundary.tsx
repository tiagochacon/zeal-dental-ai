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
}

/**
 * Global Error Boundary component that catches JavaScript errors anywhere in the child component tree.
 * Specifically designed to handle DOM-related errors like "removeChild" issues that can occur
 * due to race conditions or timing issues in React's reconciliation process.
 */
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log error details for debugging
    this.setState({ errorInfo });
    
    // Log to console in development
    console.error("ErrorBoundary caught an error:", error);
    console.error("Component stack:", errorInfo.componentStack);
    
    // Production-safe error logging with context
    this.logError(error, errorInfo);
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
        // Check if this is a DOM-related error
        isDOMError: this.isDOMRelatedError(error),
      };

      // Log to console for now - in production, this could be sent to a logging service
      console.error("[ErrorBoundary] Error Report:", errorReport);
      
      // Store in sessionStorage for debugging
      try {
        const existingErrors = JSON.parse(sessionStorage.getItem("errorBoundaryLogs") || "[]");
        existingErrors.push(errorReport);
        // Keep only last 10 errors
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
      "Cannot read properties of null",
    ];
    
    const errorString = `${error.message} ${error.stack || ""}`;
    return domErrorPatterns.some(pattern => errorString.includes(pattern));
  }

  private handleReload = (): void => {
    // Clear any cached state that might cause the error to persist
    try {
      // Clear React Query cache if available
      if (typeof window !== "undefined" && (window as any).__REACT_QUERY_DEVTOOLS_GLOBAL_HOOK__) {
        (window as any).__REACT_QUERY_DEVTOOLS_GLOBAL_HOOK__.clear?.();
      }
    } catch {
      // Ignore
    }
    
    window.location.reload();
  };

  private handleReset = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      // Allow custom fallback UI
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

            <h2 className="text-xl mb-4">
              {isDOMError 
                ? "A display error occurred. Please reload the page."
                : "An unexpected error occurred."
              }
            </h2>

            {isDOMError && (
              <p className="text-sm text-muted-foreground mb-4 text-center">
                This error is typically caused by a timing issue and can be resolved by reloading.
              </p>
            )}

            <div className="p-4 w-full rounded bg-muted overflow-auto mb-6 max-h-48">
              <pre className="text-sm text-muted-foreground whitespace-break-spaces">
                {this.state.error?.message || "Unknown error"}
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
                Reload Page
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
                  Try Again
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
