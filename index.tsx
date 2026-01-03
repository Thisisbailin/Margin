
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ClerkProvider } from '@clerk/clerk-react';

// 优先读取 VITE_ 前缀的变量，以匹配用户在 Cloudflare Pages 设置的名称
const PUBLISHABLE_KEY = process.env.VITE_CLERK_PUBLISHABLE_KEY || process.env.CLERK_PUBLISHABLE_KEY;

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    {PUBLISHABLE_KEY ? (
      <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
        <App />
      </ClerkProvider>
    ) : (
      <div className="h-screen flex items-center justify-center p-12 text-center font-serif italic text-ink bg-paper">
        <div className="max-w-md animate-fade-in">
          <h2 className="text-3xl font-display mb-4">Margin Configuration Required</h2>
          <p className="text-gray-500 mb-8 leading-relaxed">
            Please ensure <code className="bg-surface px-2 py-1 rounded text-accent">VITE_CLERK_PUBLISHABLE_KEY</code> is correctly set in your Cloudflare Pages environment variables.
          </p>
          <div className="text-[10px] uppercase tracking-widest text-gray-300 font-bold">
            Environment Sync Required
          </div>
        </div>
      </div>
    )}
  </React.StrictMode>
);
