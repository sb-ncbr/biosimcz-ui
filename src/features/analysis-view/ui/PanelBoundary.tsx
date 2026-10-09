"use client";

import { Component, type ReactNode } from "react";
import { Alert, AlertDescription, Button } from "@/shared/ui";

type PanelBoundaryProps = { children: ReactNode; height: number };
type PanelBoundaryState = { failed: boolean };

// A crash or failed chunk load in one panel must not take the whole page down.
class PanelBoundary extends Component<PanelBoundaryProps, PanelBoundaryState> {
  state: PanelBoundaryState = { failed: false };

  static getDerivedStateFromError(): PanelBoundaryState {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="flex w-full items-center justify-center p-4" style={{ minHeight: this.props.height }}>
        <Alert variant="error" role="alert" className="max-w-sm">
          <AlertDescription className="flex flex-col items-start gap-3">
            This analysis failed to display.
            <Button type="button" size="sm" variant="outline" onClick={() => this.setState({ failed: false })}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }
}

export { PanelBoundary };
