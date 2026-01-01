
import React from 'react';
import { UserProficiency } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  proficiency: UserProficiency;
  onProficiencyChange: (p: UserProficiency) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen, 
  onClose, 
  proficiency, 
  onProficiencyChange 
}) => {
  if (!isOpen) return null;

  const handleKeySelection = async () => {
    try {
      if (window.aistudio && window.aistudio.openSelectKey) {
        await window.aistudio.openSelectKey();
        // 按照规范，点击后即视为成功（处理潜在的 race condition）
        onClose();
      } else {
        alert("此环境不支持动态密钥切换。");
      }
    } catch (err) {
      console.error("Failed to open key selector", err);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-ink/30 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-paper w-full max-w-lg p-10 rounded-[2.5rem] shadow-float border border-black/5 flex flex-col gap-10">
        <div className="flex justify-between items-center">
          <h2 className="font-display text-3xl text-ink italic">System Configuration</h2>
          <button onClick={onClose} className="p-2 hover:bg-black/5 rounded-full transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* API Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-accent"></div>
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">Intelligence Engine</h3>
          </div>
          <div className="bg-surface p-6 rounded-3xl border border-black/5">
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm font-serif italic text-ink/70">API Key Source</span>
              <span className="px-2 py-1 bg-accent/10 text-accent text-[9px] font-bold uppercase rounded tracking-widest">
                {process.env.API_KEY ? 'Active' : 'Missing'}
              </span>
            </div>
            <p className="text-[11px] text-gray-400 leading-relaxed mb-6">
              默认使用 Cloudflare 部署的环境变量。您可以切换为自己的付费 API 密钥以获得更高的配额和性能。
            </p>
            <div className="flex gap-3">
              <button 
                onClick={handleKeySelection}
                className="flex-1 py-3 bg-ink text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-black transition-all"
              >
                Change API Key
              </button>
              <a 
                href="https://ai.google.dev/gemini-api/docs/billing" 
                target="_blank" 
                rel="noreferrer"
                className="px-4 py-3 border border-black/10 rounded-xl text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:bg-black/5 flex items-center justify-center"
              >
                Docs
              </a>
            </div>
          </div>
        </section>

        {/* Reading Preference Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-secondary"></div>
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">Reading Depth</h3>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {(Object.values(UserProficiency) as UserProficiency[]).map((p) => (
              <button
                key={p}
                onClick={() => onProficiencyChange(p)}
                className={`py-4 rounded-2xl border text-[10px] font-bold uppercase tracking-widest transition-all ${proficiency === p ? 'bg-white border-accent text-accent shadow-sm scale-105' : 'bg-surface border-transparent text-gray-400 hover:border-black/10'}`}
              >
                {p}
              </button>
            ))}
          </div>
        </section>

        <p className="text-center text-[9px] text-gray-300 font-serif italic">
          Your configurations are synced to local storage for persistence.
        </p>
      </div>
    </div>
  );
};

export default SettingsModal;
