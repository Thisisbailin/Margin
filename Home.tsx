import React from 'react';
import { Book, Project, AgentMessage, LexiconItem, UserProficiency } from './types';
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
  userId?: string;
  proficiency: UserProficiency;
  onProficiencyChange: (p: UserProficiency) => void;
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
  userId,
  proficiency,
  onProficiencyChange
}) => {
  return (
    <div className="h-screen w-screen bg-paper text-ink font-sans overflow-hidden">
      <div className="h-full w-full p-6 md:p-14">
        <div className="max-w-[1500px] mx-auto h-full flex flex-col">
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
              userId={userId}
              proficiency={proficiency}
              onProficiencyChange={onProficiencyChange}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
