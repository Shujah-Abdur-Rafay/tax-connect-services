import React from 'react';

/**
 * App-wide error boundary.
 *
 * Without one, any uncaught render error (e.g. a context hook used outside its
 * provider) unmounts the whole React tree and the user is left staring at a
 * blank white page. This boundary catches that, logs it, and shows a friendly
 * recovery card with "Reload" / "Go home" actions instead of a blank screen.
 *
 * In App.tsx it is keyed on the current route's pathname so that navigating to
 * a different page automatically clears a previously caught error.
 */
interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Optional custom fallback. Receives the error + a reset callback. */
  fallback?: (error: Error, reset: () => void) => React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Surface the failure for diagnostics; this is the only record we get since
    // the component tree below has been torn down.
    console.error('[ErrorBoundary] Uncaught render error:', error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-6 text-center">
        <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <svg
              className="h-6 w-6 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
              />
            </svg>
          </div>
          <h1 className="mb-2 text-xl font-semibold text-gray-900">Something went wrong</h1>
          <p className="mb-6 text-sm text-gray-600">
            This page hit an unexpected error. You can reload to try again, or head back to the
            homepage.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              Reload page
            </button>
            <button
              type="button"
              onClick={() => {
                window.location.href = '/';
              }}
              className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              Go to homepage
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
