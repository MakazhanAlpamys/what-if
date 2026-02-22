"use client";

import { Component, type ReactNode } from "react";
import ErrorIcon from "@/components/ErrorIcon";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
          <div className="max-w-md text-center">
            <div className="mb-4">
              <ErrorIcon className="inline h-12 w-12" />
            </div>
            <h2 className="mb-2 text-lg font-semibold text-[var(--text-secondary)]">
              Something went wrong
            </h2>
            <p className="mb-6 text-sm text-[var(--text-faint)]">
              An unexpected error occurred. Please try reloading the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="cursor-pointer rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-500"
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
