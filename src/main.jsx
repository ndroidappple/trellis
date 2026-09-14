import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/fraunces'
import '@fontsource/figtree/400.css'
import '@fontsource/figtree/500.css'
import '@fontsource/figtree/600.css'
import './tokens.css'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

// Phase 0 dev spike for the widget-home-screen plan — never linked from the
// real app, only reachable by typing ?gooey-spike into the URL, and lazy so
// its liquid-gooey import never ships in the real bundle's eager graph.
const isGooeySpike = new URLSearchParams(window.location.search).has('gooey-spike')
const GooeySpike = isGooeySpike ? lazy(() => import('./dev/gooey-spike.jsx')) : null

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      {isGooeySpike ? (
        <Suspense fallback={null}>
          <GooeySpike />
        </Suspense>
      ) : (
        <App />
      )}
    </ErrorBoundary>
  </StrictMode>,
)
