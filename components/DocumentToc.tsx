import React from 'react';
import { TocEntry } from '../types';

interface DocumentTocProps {
  toc: TocEntry[];
  onSelect: (entry: TocEntry) => void;
  activeEntryId?: string | null;
}

const DocumentToc: React.FC<DocumentTocProps> = ({ toc, onSelect, activeEntryId }) => {
  if (!toc.length) return null;

  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-black/5 bg-white/70 p-4 shadow-soft">
      <div className="text-[9px] uppercase tracking-[0.3em] text-accent font-bold">Contents</div>
      <div className="space-y-1.5">
        {toc.map((entry) => (
          <div key={entry.id} className="group">
          <button
            onClick={() => onSelect(entry)}
            className={`w-full text-left rounded-2xl px-3 py-2 text-xs md:text-sm font-serif transition-colors disabled:opacity-40 disabled:hover:bg-transparent ${
              entry.id === activeEntryId
                ? 'bg-white text-ink shadow-soft ring-1 ring-black/5'
                : 'text-ink/70 hover:text-ink hover:bg-black/5'
            }`}
            style={{ paddingLeft: `${12 + Math.min(Math.max(entry.level - 1, 0), 6) * 12}px` }}
            disabled={!entry.sectionId && !entry.anchorId}
          >
            {entry.title}
          </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DocumentToc;
