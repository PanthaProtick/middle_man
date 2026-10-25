import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { ClerkProvider } from '@clerk/react';
import { SellerSession } from './features/seller/SellerSession';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Failed to find root element');
}

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const publicPortal = window.location.pathname.startsWith('/orders/');

createRoot(rootElement).render(
  <StrictMode>
    {publishableKey && !publishableKey.includes('your_clerk') && !publicPortal ? (
      <ClerkProvider publishableKey={publishableKey}>
        <SellerSession />
      </ClerkProvider>
    ) : <App />}
  </StrictMode>,
)
