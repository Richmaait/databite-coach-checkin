import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
          <div className="w-full max-w-2xl rounded-lg bg-white p-8 shadow-md">
            <h1 className="mb-2 text-2xl font-semibold text-gray-900">
              Something went wrong
            </h1>
            <p className="mb-4 text-gray-600">
              An unexpected error occurred. The technical details below are useful for diagnosing the issue.
            </p>
            {this.state.error && (
              <div className="mb-6 rounded-md bg-red-50 border border-red-200 p-4 text-left">
                <p className="text-sm font-mono font-semibold text-red-700 break-words mb-2">
                  {this.state.error.name}: {this.state.error.message}
                </p>
                {this.state.error.stack && (
                  <details className="mt-2">
                    <summary className="text-xs text-red-600 cursor-pointer hover:underline">Stack trace</summary>
                    <pre className="mt-2 text-[10px] font-mono text-red-800 whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
                      {this.state.error.stack}
                    </pre>
                  </details>
                )}
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={this.handleReset}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Try again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Reload page
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
