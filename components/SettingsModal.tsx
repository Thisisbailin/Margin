
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
        onClose();
      }
    } catch (err) {
      console.error("Failed to open key selector", err);
    }
  };

  const tiers = [
    { level: 'L1', name: 'Lexical Base', model: 'Gemini Flash-Lite', usage: 'Terrain 词义查询', color: 'bg-green-500/10 text-green-600' },
    { level: 'L2', name: 'Contextual Margin', model: 'Gemini Flash 3', usage: '阅读实时解析', color: 'bg-accent/10 text-accent' },
    { level: 'L3', name: 'Synthesis Engine', model: 'Gemini Pro 3', usage: '项目深度研究', color: 'bg-blue-500/10 text-blue-600' },
  ];

  return (
    <div className="fixed inset-0 z-[100] bg-ink/30 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-paper w-full max-w-lg p-10 rounded-[2.5rem] shadow-float border border-black/5 flex flex-col gap-10 overflow-y-auto no-scrollbar max-h-[90vh]">
        <div className="flex justify-between items-center">
          <h2 className="font-display text-3xl text-ink italic">Configuration</h2>
          <button onClick={onClose} className="p-2 hover:bg-black/5 rounded-full transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* API Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-accent"></div>
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">Intelligence Source</h3>
          </div>
          <div className="bg-surface p-6 rounded-3xl border border-black/5">
             <div className="flex justify-between items-center mb-4">
                <span className="text-xs font-serif italic text-ink/70">API Protocol</span>
                <span className="text-[9px] font-bold text-accent uppercase tracking-widest">Active via Cloudflare</span>
             </div>
             <button 
                onClick={handleKeySelection}
                className="w-full py-3 bg-ink text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-black transition-all"
              >
                Switch to Private Key
              </button>
          </div>
        </section>

        {/* Intelligence Tiers Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-secondary"></div>
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">Intelligence Tiers</h3>
          </div>
          <div className="space-y-3">
            {tiers.map(tier => (
              <div key={tier.level} className="flex items-center gap-5 p-4 bg-surface rounded-2xl border border-black/5 group hover:border-accent/30 transition-all">
                <div className={`w-10 h-10 rounded-xl ${tier.color} flex items-center justify-center font-bold text-xs`}>{tier.level}</div>
                <div className="flex-1">
                   <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-ink">{tier.name}</span>
                      <span className="text-[9px] text-gray-400">{tier.model}</span>
                   </div>
                   <p className="text-[10px] text-gray-400 mt-0.5">{tier.usage}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Reading Preference */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-accent/30"></div>
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">Analysis Depth</h3>
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
          v2.5 Hybrid Intelligence Architecture
        </p>
      </div>
    </div>
  );
};

export default SettingsModal;
