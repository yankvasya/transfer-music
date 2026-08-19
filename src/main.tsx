import { StrictMode } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { ToastProvider } from './hooks/useToast.tsx'

// hydrateRoot attaches React to the pre-rendered landing hero in index.html instead of
// replacing it, so the LCP element paints immediately and never disappears/re-renders.
// The boot state in App renders the exact same markup as the pre-rendered HTML, so the
// first hydration matches and the hero stays put while the auth hooks finish loading.
hydrateRoot(
  document.getElementById('root')!,
  <StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ToastProvider>
    </ErrorBoundary>
  </StrictMode>,
)
