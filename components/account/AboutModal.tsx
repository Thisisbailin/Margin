import React from 'react';
import ReactMarkdown from 'react-markdown';
import manifesto from '../../docs/margin-manifesto.md?raw';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[160] bg-ink/40 backdrop-blur-sm flex items-center justify-center p-4 md:p-8 animate-fade-in">
      <div className="bg-paper w-full max-w-5xl rounded-[2.5rem] shadow-float border border-black/5 max-h-[92vh] overflow-hidden">
        <div className="flex items-center justify-between px-6 md:px-10 py-6 border-b border-black/5">
          <div>
            <div className="text-[10px] uppercase tracking-[0.4em] text-accent font-bold">About</div>
            <h2 className="font-display text-3xl text-ink italic mt-2">Margin Manifesto</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-black/5 rounded-full transition-colors" aria-label="Close">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-6 md:px-10 py-8 overflow-y-auto no-scrollbar max-h-[75vh]">
          <div className="prose prose-sm md:prose-lg max-w-none font-serif text-ink">
            <ReactMarkdown>{manifesto}</ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AboutModal;
