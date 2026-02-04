import React from 'react';
import { Document, Project, AgentMessage, LexemeEntry, LexemeStat } from './types';
import FocusModule from './components/FocusModule';

interface HomeProps {
  activeProject: Project;
  activeDocument: Document | undefined;
  onDocumentSelect: (document: Document) => void;
  projectMessages: AgentMessage[];
  projectInput: string;
  setProjectInput: (val: string) => void;
  onProjectChat: () => void;
  isProjectChatLoading: boolean;
  projectLexicon: LexemeEntry[];
  readingProgress: number;
  recordInteraction: (lemma: string, type: 'implicit' | 'explicit', weight: number, occurrenceId?: string) => void;
  updateLexeme: (lemma: string, updates: Partial<LexemeStat>) => void;
  onImportClick: () => void;
  userId?: string;
  onOpenTraffic: () => void;
  onOpenSettings: () => void;
}

const Home: React.FC<HomeProps> = ({
  activeProject,
  activeDocument,
  onDocumentSelect,
  projectMessages,
  projectInput,
  setProjectInput,
  onProjectChat,
  isProjectChatLoading,
  projectLexicon,
  readingProgress,
  recordInteraction,
  updateLexeme,
  onImportClick,
  userId,
  onOpenTraffic,
  onOpenSettings
}) => {
  return (
    <div className="h-screen w-screen bg-paper text-ink font-sans overflow-hidden">
      <div className="h-full w-full p-6 md:p-14">
        <div className="max-w-[1500px] mx-auto h-full flex flex-col">
          <div className="flex-1 min-h-0">
            <FocusModule
              activeProject={activeProject}
              activeDocument={activeDocument}
              onDocumentSelect={onDocumentSelect}
              projectMessages={projectMessages}
              projectInput={projectInput}
              setProjectInput={setProjectInput}
              onProjectChat={onProjectChat}
              isProjectChatLoading={isProjectChatLoading}
              projectLexicon={projectLexicon}
              readingProgress={readingProgress}
              recordInteraction={recordInteraction}
              updateLexeme={updateLexeme}
              onImportClick={onImportClick}
              userId={userId}
              onOpenTraffic={onOpenTraffic}
              onOpenSettings={onOpenSettings}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
