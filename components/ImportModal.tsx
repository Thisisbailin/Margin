
import React, { useState, useRef } from 'react';
import { parseEpubFile } from '../services/epubService';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (content: string, title: string, isUrl: boolean, epubData?: any, originalFile?: File) => Promise<void>;
}

const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, onImport }) => {
  const [importType, setImportType] = useState<'url' | 'text' | 'file'>('url');
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.epub')) {
      alert("Please upload a valid .epub file.");
      return;
    }

    setIsProcessing(true);
    setStatusMessage('Decompressing EPUB...');
    try {
      const epubData = await parseEpubFile(file);
      setStatusMessage('Storing & Structuring...');
      // 关键修改：同时传递 epubData (文本数据) 和 originalFile (二进制文件)
      await onImport("", epubData.title, false, epubData, file);
      onClose();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsProcessing(false);
      setStatusMessage('');
    }
  };

  const handleImport = async () => {
    if (importType === 'file') {
      fileInputRef.current?.click();
      return;
    }

    const input = importType === 'url' ? url : text;
    if (!input.trim()) return;

    setIsProcessing(true);
    setStatusMessage(importType === 'url' ? 'Connecting to source...' : 'Analyzing content...');
    
    try {
      await onImport(input, title || 'New Acquisition', importType === 'url');
      onClose();
      setUrl(''); setText(''); setTitle('');
    } catch (error: any) {
      alert(error.message || "Failed. Try manual paste.");
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
            {['url', 'file', 'text'].map((type) => (
              <button 
                key={type}
                onClick={() => setImportType(type as any)}
                className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${importType === type ? 'bg-white text-accent shadow-sm' : 'text-gray-400 hover:text-ink'}`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          {importType === 'url' && (
            <div className="space-y-4 animate-fade-in">
              <label className="text-[10px] font-bold uppercase tracking-widest text-accent">Article URL</label>
              <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." className="w-full bg-surface px-6 py-5 rounded-2xl border-none focus:ring-1 focus:ring-accent outline-none font-serif text-lg" />
            </div>
          )}

          {importType === 'file' && (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-48 border-2 border-dashed border-gray-200 rounded-[2rem] flex flex-col items-center justify-center cursor-pointer hover:border-accent/30 hover:bg-accent/5 transition-all group"
            >
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".epub" className="hidden" />
              <div className="w-12 h-12 bg-surface rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-accent">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0018 18c-2.305 0-4.408.867-6 2.292m0-14.25v14.25" />
                </svg>
              </div>
              <p className="text-sm font-serif italic text-gray-400">Drop .epub file here or click to browse</p>
            </div>
          )}

          {importType === 'text' && (
            <div className="space-y-4 animate-fade-in">
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title hint..." className="w-full bg-surface px-6 py-4 rounded-2xl border-none outline-none font-serif text-lg" />
              <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Paste content..." className="w-full h-40 bg-surface px-6 py-4 rounded-2xl border-none outline-none font-serif text-base resize-none" />
            </div>
          )}
        </div>

        <div className="flex gap-4">
          <button onClick={onClose} className="flex-1 py-5 rounded-2xl text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:bg-black/5 transition-all">Close</button>
          {importType !== 'file' && (
            <button 
              onClick={handleImport} 
              disabled={isProcessing}
              className="flex-[2] py-5 bg-ink text-white rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-black transition-all shadow-xl disabled:opacity-20"
            >
              {isProcessing ? statusMessage : 'Process Content'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Fixed: Added missing default export to resolve App.tsx line 10 error
export default ImportModal;
