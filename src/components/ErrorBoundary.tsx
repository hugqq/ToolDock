/**
 * 全局错误边界组件
 * 捕获 React 组件树中的 JavaScript 错误，防止整个应用崩溃
 */
import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

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
    // 生产环境可以上报错误到监控服务
    if (process.env.NODE_ENV === "production") {
      // TODO: 上报错误到 Sentry 等服务
    }
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 bg-(--bg-main)">
          <div className="flex flex-col items-center gap-4 max-w-md text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
              <AlertTriangle size={32} className="text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-(--text-main)">
              出错了
            </h2>
            <p className="text-(--text-muted) text-sm">
              应用程序遇到了一个意外错误。请尝试刷新页面或返回首页。
            </p>
            {process.env.NODE_ENV === "development" && this.state.error && (
              <details className="w-full text-left mt-4">
                <summary className="cursor-pointer text-sm text-(--text-muted) hover:text-(--text-main)">
                  查看错误详情
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
                重试
              </button>
              <button
                onClick={() => window.location.replace("/")}
                className="px-4 py-2 bg-(--card-bg) border border-(--border-color) text-(--text-main) rounded-xl hover:bg-(--bg-main) transition-colors font-medium"
              >
                返回首页
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
