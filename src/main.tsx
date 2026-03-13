import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ErrorBoundary } from 'react-error-boundary'
import './index.css'
import App from './App.tsx'
import { RootErrorFallback } from './components/UI/RootErrorFallback'
import { scheduleHubCacheInitialization } from './lib/hub-seed-data'

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
})

// Defer hub-cache seeding until the browser is idle so React can paint first.
scheduleHubCacheInitialization();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary FallbackComponent={RootErrorFallback}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
)
