import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'
import { scheduleHubCacheInitialization } from './lib/hub-seed-data'

// Defer hub-cache seeding until the browser is idle so React can paint first.
scheduleHubCacheInitialization();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
