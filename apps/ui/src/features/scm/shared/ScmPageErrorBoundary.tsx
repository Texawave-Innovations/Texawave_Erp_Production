"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/** Catches a render error in any SCM page so it shows a recoverable message
 * (with the actual error) instead of blanking the whole app. `ScmShell`
 * re-keys this by pathname, so navigating to a different SCM page resets it. */
export class ScmPageErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(
    error: Error,
    info: { componentStack?: string | null },
  ) {
    console.error(
      "SCM page crashed while rendering:",
      error,
      info.componentStack,
    );
  }

  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="space-y-3 rounded-lg border border-error-200 bg-error-50 p-6 text-theme-sm dark:border-error-500/30 dark:bg-error-500/10">
        <div className="font-semibold text-error-700 dark:text-error-400">
          This page hit an error and couldn&apos;t be displayed.
        </div>
        <pre className="whitespace-pre-wrap text-theme-xs text-error-600 dark:text-error-400">
          {this.state.error.message}
        </pre>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 dark:border-gray-700 dark:bg-gray-900"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
          <button
            type="button"
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 dark:border-gray-700 dark:bg-gray-900"
            onClick={() => window.location.reload()}
          >
            Reload page
          </button>
        </div>
      </div>
    );
  }
}
