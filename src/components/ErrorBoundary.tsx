import React from 'react';

interface ErrorBoundaryState {
  error: Error | null;
}

// Catches render-time errors anywhere in the tree below it. Async errors inside
// ImporterProgress's own import loop are already handled (they end in its own
// "Critical Error" screen) — this is specifically the backstop for anything that
// wasn't: a genuine render crash would otherwise blank the entire page.
export class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Unhandled render error:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="app-container">
          <div className="glass-panel center-align">
            <div className="badge-wrapper danger">❌ Something went wrong</div>
            <p className="description-text">
              {this.state.error.message || 'An unexpected error occurred.'} Your import history is safe — reloading will take you back
              to the start.
            </p>
            <div className="form-actions center-align mt-4">
              <button className="btn btn-primary" onClick={() => window.location.assign('/')}>
                ← Back to Home
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
