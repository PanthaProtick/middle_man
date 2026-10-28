import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { LocaleProvider } from './features/locale'
import { Root } from './Root'

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Failed to find root element');
}

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const publicPortal = window.location.pathname.startsWith('/orders/');

createRoot(rootElement).render(
  <StrictMode>
    <LocaleProvider>
      <Root publishableKey={publishableKey} publicPortal={publicPortal} />
    </LocaleProvider>
  </StrictMode>,
)
