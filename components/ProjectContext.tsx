import React from 'react';
import { Book, Project } from '../types';

interface ProjectContextProps {
  project: Project;
  activeBookId?: string;
  onBookSelect: (book: Book) => void;
}

const ProjectContext: React.FC<ProjectContextProps> = ({ 
  project, 
  activeBookId, 
  onBookSelect,
}) => {
  return (
    <div className="flex flex-col h-full font-sans">
      <div className="mb-10">
         <h2 className="text-lg font-display text-ink leading-tight mb-2 tracking-tight">
          {project.name}
         </h2>
         <div className="w-6 h-px bg-accent mb-4" />
      </div>

      <div className="flex-1">
        <div className="space-y-4">
          {project.books.map((book) => (
            <div 
              key={book.id}
              onClick={() => onBookSelect(book)}
              className={`
                group cursor-pointer rounded-lg p-4 transition-all duration-300 relative
                ${book.id === activeBookId 
                  ? 'bg-white shadow-soft ring-1 ring-black/5' 
                  : 'hover:bg-black/5 text-gray-500'}
              `}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1 pr-4">
                  <h3 className={`font-serif text-sm transition-colors ${book.id === activeBookId ? 'text-ink font-medium' : 'group-hover:text-ink'}`}>
                    {book.title}
                  </h3>
                  <p className="text-[10px] uppercase tracking-widest text-gray-400 mt-1.5">
                    {book.author}
                  </p>
                </div>
                {book.id === activeBookId && (
                   <div className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shadow-[0_0_8px_rgba(194,142,91,0.6)]" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stats Summary at bottom */}
      <div className="mt-auto pt-8 border-t border-black/5">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-gray-400">
           <span>{project.books.length} Texts</span>
           <span>Project Focus</span>
        </div>
      </div>
    </div>
  );
};

export default ProjectContext;