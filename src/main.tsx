import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initializeHubCache } from './lib/hub-seed-data'

// Seed the hub cache with known highway hubs on startup
initializeHubCache();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
