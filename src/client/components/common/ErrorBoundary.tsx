import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  override render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <div className="surface-base flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md space-y-4 text-center animate-fade-in">
          <h1 className="gradient-primary-text text-4xl font-bold tracking-tight">KinBot</h1>
          <p className="text-muted-foreground">Something went wrong. Please reload the page.</p>
          {this.state.error && (
            <pre className="mt-2 max-h-32 overflow-auto rounded-lg bg-muted p-3 text-left text-xs text-muted-foreground">
              {this.state.error.message}
            </pre>
          )}
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Reload
          </button>
        </div>
      </div>
    )
  }
}
