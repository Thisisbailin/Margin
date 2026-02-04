
import React, { useState, useRef } from 'react';
import { parseEpubFile, type ParsedEpub } from '../services/epubService';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (epubData: ParsedEpub, originalFile: File) => Promise<void>;
}

const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, onImport }) => {
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
      await onImport(epubData, file);
      onClose();
    } catch (err: any) {
      alert(err.message);
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
            <h2 className="font-display text-4xl text-ink italic mb-2">Import EPUB</h2>
            <p className="text-sm font-serif text-gray-400 italic">Bring in a clean, structured reading source.</p>
          </div>
        </div>

        <div
          onClick={() => fileInputRef.current?.click()}
          className="w-full h-56 border-2 border-dashed border-gray-200 rounded-[2rem] flex flex-col items-center justify-center cursor-pointer hover:border-accent/30 hover:bg-accent/5 transition-all group"
        >
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".epub" className="hidden" />
          <div className="w-12 h-12 bg-surface rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-accent">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0018 18c-2.305 0-4.408.867-6 2.292m0-14.25v14.25" />
            </svg>
          </div>
          <p className="text-sm font-serif italic text-gray-400">Drop .epub file here or click to browse</p>
          <p className="text-[10px] uppercase tracking-[0.3em] text-gray-300 mt-2">EPUB ONLY</p>
        </div>

        <div className="flex gap-4">
          <button onClick={onClose} className="flex-1 py-5 rounded-2xl text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:bg-black/5 transition-all">Close</button>
          {isProcessing && (
            <div className="flex-[2] py-5 bg-ink text-white rounded-2xl text-[10px] font-bold uppercase tracking-widest shadow-xl flex items-center justify-center">
              {statusMessage}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Fixed: Added missing default export to resolve App.tsx line 10 error
export default ImportModal;
