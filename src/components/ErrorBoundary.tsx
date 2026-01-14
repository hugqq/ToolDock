/**
 * 全局错误边界组件
 * 捕获 React 组件树中的 JavaScript 错误，防止整个应用崩溃
 */
import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(_error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    // 本地桌面应用，仅在控制台记录错误，不做网络上报
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // 检查是否为开发模式 (Vite 环境变量)
      const isDev = import.meta.env.DEV;

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 bg-(--bg-main)">
          <div className="flex flex-col items-center gap-4 max-w-md text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
              <AlertTriangle size={32} className="text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-(--text-main)">
              Something went wrong
            </h2>
            <p className="text-(--text-muted) text-sm">
              An unexpected error occurred. Please try again or return to the home page.
            </p>
            {isDev && this.state.error && (
              <details className="w-full text-left mt-4">
                <summary className="cursor-pointer text-sm text-(--text-muted) hover:text-(--text-main)">
                  View error details
                </summary>
                <pre className="mt-2 p-4 bg-(--card-bg) border border-(--border-color) rounded-xl text-xs overflow-auto max-h-48 text-red-500">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
            <div className="flex gap-3 mt-4">
              <button
                onClick={this.handleReset}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary-hover transition-colors font-medium"
              >
                <RefreshCw size={16} />
                Retry
              </button>
              <button
                onClick={() => window.location.replace("/")}
                className="flex items-center gap-2 px-4 py-2 bg-(--card-bg) border border-(--border-color) text-(--text-main) rounded-xl hover:bg-(--bg-main) transition-colors font-medium"
              >
                <Home size={16} />
                Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
