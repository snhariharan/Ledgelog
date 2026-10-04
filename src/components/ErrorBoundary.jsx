import React from 'react';
import { AlertCircle } from 'lucide-react';

/** Keeps one broken page from blanking the whole app. */
export default class ErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) { return { error }; }

  componentDidCatch(error, info) { console.error('[ErrorBoundary]', error, info?.componentStack); }

  componentDidUpdate(prev) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="loading-screen" role="alert">
        <AlertCircle size={36} style={{ color: 'var(--red)', marginBottom: '0.75rem' }}/>
        <div style={{ fontWeight: 700, color: 'var(--text-1)', marginBottom: '0.25rem' }}>Something went wrong on this page</div>
        <div style={{ color: 'var(--text-3)', fontSize: '0.82rem', maxWidth: 380, textAlign: 'center', marginBottom: '1rem' }}>
          {this.state.error.message}
        </div>
        <button className="btn-pri" onClick={() => this.setState({ error: null })}>Try again</button>
      </div>
    );
  }
}
