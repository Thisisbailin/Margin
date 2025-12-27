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
  const activeBook = project.books.find(b => b.id === activeBookId);

  return (
    <div className="flex flex-col h-full font-sans">
      {/* Header */}
      <div className="mb-10 pt-4">
         <span className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">Project</span>
         <h2 className="mt-3 text-2xl font-display text-ink leading-tight">
          {project.name}
         </h2>
         <p className="mt-3 text-sm text-gray-500 leading-relaxed font-light">
          {project.description}
         </p>
      </div>

      {/* Minimal List of Books */}
      <div className="mb-8 flex-1">
        <div className="mb-4 flex items-baseline justify-between border-b border-gray-200 pb-2">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">
            Library
          </span>
          <span className="text-[10px] text-gray-400">{project.books.length} / 9</span>
        </div>
        
        <div className="space-y-3">
          {project.books.map((book) => (
            <div 
              key={book.id}
              onClick={() => onBookSelect(book)}
              className={`
                group cursor-pointer rounded-lg p-4 transition-all duration-300 relative overflow-hidden
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
                  <p className="text-[11px] uppercase tracking-wide text-gray-400 mt-1">
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

      {/* Active Reading Progress */}
      {activeBook && (
        <div className="mt-auto py-6">
           <div className="flex justify-between items-end mb-2">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">Current Status</span>
              <span className="text-xs font-serif italic text-gray-500">{activeBook.progress}% completed</span>
           </div>
           <div className="h-0.5 w-full bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-ink/80 transition-all duration-1000 ease-out" style={{ width: `${activeBook.progress}%` }} />
           </div>
        </div>
      )}
    </div>
  );
};

export default ProjectContext;