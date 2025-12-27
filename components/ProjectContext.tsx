import React from 'react';
import { Book, Project } from '../types';

interface ProjectContextProps {
  project: Project;
  activeBookId?: string;
  onBookSelect: (book: Book) => void;
  adviceContent?: string;
  onGenerateAdvice: () => void;
  isGeneratingAdvice: boolean;
}

const ProjectContext: React.FC<ProjectContextProps> = ({ 
  project, 
  activeBookId, 
  onBookSelect,
}) => {
  return (
    <div className="flex flex-col h-full font-sans">
      {/* Description Context (Simplified Header) */}
      <div className="mb-8">
         <h2 className="text-xl font-display text-ink leading-tight mb-2">
          {project.name}
         </h2>
         <p className="text-xs text-gray-500 leading-relaxed font-light">
          {project.description}
         </p>
      </div>

      {/* Book List */}
      <div className="mb-8 flex-1">
        <div className="space-y-3">
          {project.books.map((book) => (
            <div 
              key={book.id}
              onClick={() => onBookSelect(book)}
              className={`
                group cursor-pointer rounded-lg p-3 transition-all duration-300 relative overflow-hidden
                ${book.id === activeBookId 
                  ? 'bg-white shadow-soft ring-1 ring-black/5' 
                  : 'hover:bg-white/50 hover:shadow-sm text-gray-500'}
              `}
            >
              <div className="flex justify-between items-start relative z-10">
                <div className="flex-1 pr-4">
                  <h3 className={`font-serif text-sm font-medium transition-colors ${book.id === activeBookId ? 'text-ink' : 'group-hover:text-ink'}`}>
                    {book.title}
                  </h3>
                  <p className="text-[10px] uppercase tracking-wide text-gray-400 mt-1">
                    {book.author}
                  </p>
                </div>
                {/* Status Indicator */}
                {book.id === activeBookId && (
                   <div className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shadow-[0_0_8px_rgba(194,142,91,0.6)]" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Active Reading Progress - moved to bottom */}
      {project.books.find(b => b.id === activeBookId) && (
        <div className="mt-auto py-6 border-t border-black/5">
           <div className="flex justify-between items-end mb-2">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">Progress</span>
              <span className="text-[10px] font-serif italic text-gray-500">{project.books.find(b => b.id === activeBookId)?.progress}%</span>
           </div>
           <div className="h-0.5 w-full bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-ink/80 transition-all duration-1000 ease-out" style={{ width: `${project.books.find(b => b.id === activeBookId)?.progress}%` }} />
           </div>
        </div>
      )}
    </div>
  );
};

export default ProjectContext;