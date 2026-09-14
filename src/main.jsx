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

// Dev spikes for the widget-home-screen plan — never linked from the real
// app, only reachable by typing a query param into the URL, and lazy so
// neither ships in the real bundle's eager graph.
const searchParams = new URLSearchParams(window.location.search)
const isGooeySpike = searchParams.has('gooey-spike')
const isBoardSpike = searchParams.has('board-spike')
const GooeySpike = isGooeySpike ? lazy(() => import('./dev/gooey-spike.jsx')) : null
const BoardSpike = isBoardSpike ? lazy(() => import('./dev/board-spike.jsx')) : null

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      {isGooeySpike ? (
        <Suspense fallback={null}>
          <GooeySpike />
        </Suspense>
      ) : isBoardSpike ? (
        <Suspense fallback={null}>
          <BoardSpike />
        </Suspense>
      ) : (
        <App />
      )}
    </ErrorBoundary>
  </StrictMode>,
)
