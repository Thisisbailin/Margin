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
    <div className="flex flex-col font-sans h-full">
      <div className="mb-8">
         <h2 className="text-lg font-display text-ink leading-tight mb-2 tracking-tight">
          {project.name}
         </h2>
         <div className="w-6 h-px bg-accent" />
      </div>

      <div className="flex-1 space-y-3">
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
  );
};

export default ProjectContext;