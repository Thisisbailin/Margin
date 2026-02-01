
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ClerkProvider } from '@clerk/clerk-react';

/**
 * 鲁棒的环境变量读取函数
 * 适配 Cloudflare Pages, Vite, 以及不同的预览环境
 */
const getEnv = (key: string): string | undefined => {
  // 1. 尝试从 process.env 读取 (标准 Node/Webpack/CRA 习惯)
  try { if (process.env[key]) return process.env[key]; } catch {}
  
  // 2. 尝试从 import.meta.env 读取 (Vite/ESM 习惯)
  try { 
    const metaEnv = (import.meta as any).env;
    if (metaEnv && metaEnv[key]) return metaEnv[key]; 
  } catch {}

  // 3. 尝试从全局作用域读取
  try { if ((globalThis as any).process?.env?.[key]) return (globalThis as any).process.env[key]; } catch {}
  
  return undefined;
};

// 尝试读取你设置的变量
const PUBLISHABLE_KEY = getEnv('VITE_CLERK_PUBLISHABLE_KEY') || getEnv('CLERK_PUBLISHABLE_KEY');

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
        <div className="max-w-md animate-fade-in space-y-8">
          <div className="space-y-4">
            <h2 className="text-4xl font-display text-ink leading-tight">Margin <span className="text-accent">Environment</span> Missing</h2>
            <p className="text-gray-500 leading-relaxed">
              We couldn't detect your <code className="bg-surface px-2 py-1 rounded text-accent text-sm">VITE_CLERK_PUBLISHABLE_KEY</code>.
            </p>
          </div>
          
          <div className="p-6 bg-surface rounded-3xl border border-black/5 text-left space-y-4">
            <div className="text-[10px] uppercase tracking-widest text-gray-400 font-bold border-b border-black/5 pb-2">Troubleshooting for Cloudflare Pages</div>
            <ul className="text-xs space-y-3 text-gray-600">
              <li className="flex gap-3">
                <span className="text-accent font-bold">1.</span>
                <span>Ensure variables are set for <b>both</b> "Production" and "Preview" environments in Cloudflare dashboard.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-accent font-bold">2.</span>
                <span>You must <b>Redeploy</b> your site after changing environment variables for them to take effect.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-accent font-bold">3.</span>
                <span>If you are in the <b>Editor Preview</b>, check if the editor supports passing secrets to the preview frame.</span>
              </li>
            </ul>
          </div>

          <div className="text-[9px] uppercase tracking-widest text-gray-300 font-bold pt-4">
            Awaiting Secure Protocol...
          </div>
        </div>
      </div>
    )}
  </React.StrictMode>
);
