import React from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  /** Shown in the heading, e.g. "Database". */
  label?: string;
  children: React.ReactNode;
}

interface State {
  error: Error | null;
  stack: string;
  showDetail: boolean;
}

/**
 * Keeps one broken screen from blanking the whole app.
 *
 * Before this existed, a single bad render anywhere in the admin panel took the
 * entire window down to a white page (a tab that threw on a missing field did
 * exactly that). The owner now gets a readable message, the rest of the app
 * keeps working, and a developer can expand the technical detail.
 */
export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, stack: "", showDetail: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[${this.props.label || "section"}] render failed:`, error, info.componentStack);
    this.setState({ stack: String(info.componentStack || "") });
  }

  private reset = () => this.setState({ error: null, stack: "", showDetail: false });

  render() {
    const { error, stack, showDetail } = this.state;
    if (!error) return this.props.children;

    const heading = this.props.label
      ? `There is a problem on the "${this.props.label}" screen`
      : "There is a problem on this screen";

    return (
      <div className="p-4 sm:p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{heading}</AlertTitle>
          <AlertDescription className="space-y-3">
            <p className="text-sm">
              Your data is safe - nothing was changed. Click "Try again" to reload this screen. If it keeps
              failing, save a backup first and send the technical detail below.
            </p>
            <p className="text-sm font-medium break-words">{error.message}</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={this.reset}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Try again
              </Button>
              <Button size="sm" variant="ghost" onClick={() => this.setState({ showDetail: !showDetail })}>
                {showDetail ? "Hide" : "Show"} technical detail
              </Button>
            </div>
            {showDetail && (
              <pre className="max-h-64 overflow-auto rounded bg-black/5 p-2 text-xs whitespace-pre-wrap">
                {`${error.name}: ${error.message}\n${error.stack || ""}\n--- component stack ---${stack}`}
              </pre>
            )}
          </AlertDescription>
        </Alert>
      </div>
    );
  }
}
