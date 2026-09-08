import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/fraunces'
import '@fontsource/figtree/400.css'
import '@fontsource/figtree/500.css'
import '@fontsource/figtree/600.css'
import './tokens.css'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
