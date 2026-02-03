import React from 'react';
import { Book, Project, AgentMessage, LexiconItem } from './types';
import FocusModule from './components/FocusModule';

interface HomeProps {
  activeProject: Project;
  activeBook: Book | undefined;
  onBookSelect: (book: Book) => void;
  projectMessages: AgentMessage[];
  projectInput: string;
  setProjectInput: (val: string) => void;
  onProjectChat: () => void;
  isProjectChatLoading: boolean;
  projectLexicon: LexiconItem[];
  readingProgress: number;
  recordInteraction: (lemma: string, type: 'implicit' | 'explicit', weight: number, occurrenceId: string) => void;
  generateWordDefinition: (word: string) => Promise<string>;
  onImportClick: () => void;
  onEnterReading: () => void;
}

const Home: React.FC<HomeProps> = ({
  activeProject,
  activeBook,
  onBookSelect,
  projectMessages,
  projectInput,
  setProjectInput,
  onProjectChat,
  isProjectChatLoading,
  projectLexicon,
  readingProgress,
  recordInteraction,
  generateWordDefinition,
  onImportClick,
  onEnterReading
}) => {
  const hasActiveBook = Boolean(activeBook);

  return (
    <div className="h-screen w-screen bg-paper text-ink font-sans overflow-hidden">
      <div className="h-full w-full p-6 md:p-16">
        <div className="max-w-[1400px] mx-auto h-full flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <div>
              <div className="text-[10px] uppercase tracking-[0.4em] text-accent font-bold">Project Synthesis Engine</div>
              <div className="text-xs font-serif italic text-gray-400 mt-2">Home Workspace</div>
            </div>
            {hasActiveBook && (
              <button
                onClick={onEnterReading}
                className="px-5 py-3 rounded-full border border-black/5 bg-white text-[10px] font-bold uppercase tracking-widest text-ink hover:border-accent/30 hover:text-accent transition-all"
              >
                Continue Reading
              </button>
            )}
          </div>

          <div className="flex-1 min-h-0">
            <FocusModule
              activeProject={activeProject}
              activeBook={activeBook}
              onBookSelect={onBookSelect}
              projectMessages={projectMessages}
              projectInput={projectInput}
              setProjectInput={setProjectInput}
              onProjectChat={onProjectChat}
              isProjectChatLoading={isProjectChatLoading}
              projectLexicon={projectLexicon}
              readingProgress={readingProgress}
              recordInteraction={recordInteraction}
              generateWordDefinition={generateWordDefinition}
              onImportClick={onImportClick}
              onClose={onEnterReading}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
