import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/client/lib/i18n'
import '@/client/styles/globals.css'
import { App } from '@/client/App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
