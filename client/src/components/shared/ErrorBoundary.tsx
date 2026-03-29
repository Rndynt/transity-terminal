import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center" data-testid="error-boundary">
          <AlertTriangle className="w-10 h-10 text-destructive mb-3" />
          <h2 className="text-sm font-semibold text-foreground mb-1">Terjadi Kesalahan</h2>
          <p className="text-xs text-muted-foreground mb-4 max-w-sm">
            {this.state.error?.message || 'Terjadi kesalahan yang tidak terduga.'}
          </p>
          <Button variant="outline" size="sm" onClick={this.handleReset} data-testid="button-error-retry">
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Coba Lagi
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
