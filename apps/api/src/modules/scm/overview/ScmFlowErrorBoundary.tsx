import { Component, type ReactNode } from "react";

interface Props {
  fallback: ReactNode;
  children: ReactNode;
}
interface State {
  hasError: boolean;
}

/** If the flow visualization throws while rendering (or its lazy chunk fails to load), fall back
 * to the plain list view instead of breaking the whole Overview page. */
export class ScmFlowErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };
  static getDerivedStateFromError(): State {
    return { hasError: true };
  }
  componentDidCatch(error: unknown) {
    console.warn(
      "SCM flow view failed to render; showing the list view instead.",
      error,
    );
  }
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}
