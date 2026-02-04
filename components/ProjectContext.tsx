import React from 'react';
import { Document, Project, DocumentType } from '../types';

interface ProjectContextProps {
  project: Project;
  activeDocumentId?: string;
  onDocumentSelect: (document: Document) => void;
  onImportClick?: () => void;
  showImport?: boolean;
  showHeader?: boolean;
  headerLabel?: string;
}

const ProjectContext: React.FC<ProjectContextProps> = ({
  project,
  activeDocumentId,
  onDocumentSelect,
  onImportClick,
  showImport = true,
  showHeader = true,
  headerLabel = 'Project Materials'
}) => {
  return (
    <div className="flex flex-col font-sans h-full">
      {showHeader && (
        <div className="mb-8">
          <div className="text-[9px] uppercase tracking-[0.3em] text-accent font-bold mb-2">{headerLabel}</div>
          <h2 className="text-xl font-display text-ink leading-tight mb-3 tracking-tight">{project.name}</h2>
          <div className="w-8 h-px bg-accent/20" />
        </div>
      )}

      <div className="flex-1 space-y-4">
        {project.documents.length === 0 ? (
          <div className="border border-dashed border-black/10 rounded-2xl p-6 text-center text-sm font-serif italic text-gray-400">
            No materials yet. Import an EPUB to begin.
          </div>
        ) : (
          project.documents.map((doc) => (
            <div
              key={doc.id}
              onClick={() => onDocumentSelect(doc)}
              className={`
                group cursor-pointer rounded-2xl p-4 transition-all duration-500 relative
                ${doc.id === activeDocumentId ? 'bg-white shadow-soft ring-1 ring-black/5 scale-[1.02]' : 'hover:bg-white/40 text-gray-500'}
              `}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1 pr-4">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className={`text-[8px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded-full ${
                        doc.type === DocumentType.Book ? 'bg-secondary/10 text-secondary' : 'bg-accent/10 text-accent'
                      }`}
                    >
                      {doc.type}
                    </span>
                  </div>
                  <h3
                    className={`font-serif text-[14px] leading-snug transition-colors ${
                      doc.id === activeDocumentId ? 'text-ink font-medium' : 'group-hover:text-ink'
                    }`}
                  >
                    {doc.title}
                  </h3>
                  {doc.author && (
                    <p className="text-[9px] uppercase tracking-widest text-gray-400 mt-2 font-medium">{doc.author}</p>
                  )}
                </div>
                {doc.id === activeDocumentId && (
                  <div className="w-1.5 h-1.5 rounded-full bg-accent mt-2 shadow-[0_0_12px_rgba(194,142,91,0.8)]" />
                )}
              </div>
            </div>
          ))
        )}

        {showImport && (
          <button
            onClick={onImportClick}
            className="w-full py-4 border border-dashed border-gray-200 rounded-2xl text-[10px] uppercase font-bold tracking-widest text-gray-300 hover:text-accent hover:border-accent/30 transition-all flex items-center justify-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Import EPUB
          </button>
        )}
      </div>
    </div>
  );
};

export default ProjectContext;
