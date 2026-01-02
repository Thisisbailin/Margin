
import React, { useState } from 'react';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (text: string, title: string) => Promise<void>;
}

const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, onImport }) => {
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handleImport = async () => {
    if (!text.trim()) return;
    setIsProcessing(true);
    try {
      await onImport(text, title || 'Untitled Article');
      onClose();
    } catch (error) {
      alert("解析失败，请检查文本内容。");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] bg-ink/40 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-paper w-full max-w-2xl p-10 rounded-[3rem] shadow-float border border-black/5 flex flex-col gap-8 animate-fade-in">
        <div>
          <h2 className="font-display text-4xl text-ink italic mb-2">Ingest Article</h2>
          <p className="text-sm font-serif text-gray-400 italic">Gemini will parse and structure the content for your landscape.</p>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-accent">Article Title</label>
            <input 
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. The Philosophy of Silence"
              className="w-full bg-surface px-6 py-4 rounded-2xl border-none focus:ring-1 focus:ring-accent outline-none font-serif text-lg"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-accent">Paste Raw Content</label>
            <textarea 
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Paste the messy text from a website here..."
              className="w-full h-64 bg-surface px-6 py-4 rounded-2xl border-none focus:ring-1 focus:ring-accent outline-none font-serif text-base resize-none no-scrollbar"
            />
          </div>
        </div>

        <div className="flex gap-4">
          <button 
            onClick={onClose}
            className="flex-1 py-5 rounded-2xl text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:bg-black/5 transition-all"
          >
            Cancel
          </button>
          <button 
            onClick={handleImport}
            disabled={isProcessing || !text.trim()}
            className="flex-[2] py-5 bg-ink text-white rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-black transition-all shadow-xl disabled:opacity-20 flex items-center justify-center gap-3"
          >
            {isProcessing ? (
              <>
                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                AI Parsing Structure...
              </>
            ) : 'Start Ingestion'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportModal;
