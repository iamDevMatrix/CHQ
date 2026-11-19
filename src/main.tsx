import { Component, StrictMode, Suspense, lazy, useEffect, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import GuestMenu from './pages/GuestMenu';
import { clearMenuCache } from './hooks';
import './styles.css';

// Admin is code-split: guests scanning the QR never download it.
const Admin = lazy(() => import('./pages/Admin'));

/** Last line of defence: a render error shows a way out instead of a blank screen. */
class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error(error);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="crash">
        <p>Something went wrong while showing the menu.</p>
        <button className="primary" onClick={() => { clearMenuCache(); window.location.reload(); }}>Reload menu</button>
      </div>
    );
  }
}

// Hash routing (#/admin) works on any static host with no rewrite rules.
function App() {
  const [route, setRoute] = useState(window.location.hash);
  useEffect(() => {
    const on = () => setRoute(window.location.hash);
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route.startsWith('#/admin') ? (
    <Suspense fallback={<div className="center-msg">Loading…</div>}>
      <Admin />
    </Suspense>
  ) : (
    <GuestMenu />
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
