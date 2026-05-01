import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className="max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">Algo deu errado</h1>
          <p className="text-sm text-muted-foreground mb-4">
            Tivemos um problema inesperado. Você pode tentar recarregar a página.
            Se persistir, entre em contato com o suporte.
          </p>
          <button
            onClick={this.handleReload}
            className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium"
          >
            Recarregar
          </button>
          {import.meta.env.DEV && this.state.error && (
            <pre className="mt-6 text-left text-xs bg-muted p-3 rounded overflow-auto max-h-60">
              {String(this.state.error.stack || this.state.error)}
            </pre>
          )}
        </div>
      </div>
    );
  }
}
