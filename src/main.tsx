import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Self-host the pixel font (latin subset) so it ships in the bundle instead of a
// render-blocking, network-variable request to Google Fonts — keeps FCP/TTI fast
// and deterministic in CI, and leaves no external origin to preconnect to.
import '@fontsource/press-start-2p/latin.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
