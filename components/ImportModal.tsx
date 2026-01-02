
import React, { useState } from 'react';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (content: string, title: string, isUrl: boolean) => Promise<void>;
}

const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, onImport }) => {
  const [importType, setImportType] = useState<'url' | 'text'>('url');
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  if (!isOpen) return null;

  const handleImport = async () => {
    const input = importType === 'url' ? url : text;
    if (!input.trim()) return;

    setIsProcessing(true);
    setStatusMessage(importType === 'url' ? 'Connecting to source...' : 'Analyzing content...');
    
    try {
      await onImport(input, title || 'New Acquisition', importType === 'url');
      onClose();
      // Reset state for next time
      setUrl('');
      setText('');
      setTitle('');
    } catch (error: any) {
      console.error(error);
      alert(error.message || "Ingestion failed. Some sites block automated access. Try pasting the text manually.");
    } finally {
      setIsProcessing(false);
      setStatusMessage('');
    }
  };

  return (
    <div className="fixed inset-0 z-[110] bg-ink/40 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-paper w-full max-w-2xl p-10 rounded-[3rem] shadow-float border border-black/5 flex flex-col gap-8 animate-fade-in max-h-[90vh] overflow-y-auto no-scrollbar">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="font-display text-4xl text-ink italic mb-2">Acquire Material</h2>
            <p className="text-sm font-serif text-gray-400 italic">Expand your project's cognitive landscape.</p>
          </div>
          <div className="flex bg-surface p-1 rounded-xl border border-black/5">
            <button 
              onClick={() => setImportType('url')}
              className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${importType === 'url' ? 'bg-white text-accent shadow-sm' : 'text-gray-400 hover:text-ink'}`}
            >
              Link
            </button>
            <button 
              onClick={() => setImportType('text')}
              className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${importType === 'text' ? 'bg-white text-accent shadow-sm' : 'text-gray-400 hover:text-ink'}`}
            >
              Raw
            </button>
          </div>
        </div>

        <div className="space-y-6">
          {importType === 'url' ? (
            <div className="space-y-4 animate-fade-in">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-accent">Article URL</label>
                <div className="relative">
                  <input 
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    placeholder="https://www.poetryfoundation.org/..."
                    className="w-full bg-surface px-6 py-5 rounded-2xl border-none focus:ring-1 focus:ring-accent outline-none font-serif text-lg pr-12"
                  />
                  <div className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-300">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                    </svg>
                  </div>
                </div>
                <p className="text-[10px] text-gray-400 px-2 italic">Note: High-quality sources like Poetry Foundation or Substack are prioritized.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6 animate-fade-in">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-accent">Title Hint (Optional)</label>
                <input 
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Meditations on Self"
                  className="w-full bg-surface px-6 py-4 rounded-2xl border-none focus:ring-1 focus:ring-accent outline-none font-serif text-lg"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-accent">Source Content</label>
                <textarea 
                  value={text}
                  onChange={e => setText(e.target.value)}
                  placeholder="Paste the text you wish to deconstruct..."
                  className="w-full h-48 bg-surface px-6 py-4 rounded-2xl border-none focus:ring-1 focus:ring-accent outline-none font-serif text-base resize-none no-scrollbar"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-4">
          <button 
            onClick={onClose}
            className="flex-1 py-5 rounded-2xl text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:bg-black/5 transition-all"
          >
            Close
          </button>
          <button 
            onClick={handleImport}
            disabled={isProcessing || (importType === 'url' ? !url.trim() : !text.trim())}
            className="flex-[2] py-5 bg-ink text-white rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-black transition-all shadow-xl disabled:opacity-20 flex items-center justify-center gap-3"
          >
            {isProcessing ? (
              <>
                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {statusMessage}
              </>
            ) : importType === 'url' ? 'Fetch & Structure' : 'Process Text'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportModal;
