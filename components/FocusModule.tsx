import React, { useState } from 'react';
import { Project, Document, AgentMessage, LexemeEntry, LexemeStat } from '../types';
import HomeProject from './home/HomeProject';
import HomeTerrain from './home/HomeTerrain';
import HomeMeditation from './home/HomeMeditation';
import AccountMenu from './account/AccountMenu';
import SyncStatusIndicator from './sync/SyncStatusIndicator';

interface FocusModuleProps {
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

const FocusModule: React.FC<FocusModuleProps> = ({
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
  const [view, setView] = useState<'project' | 'terrain' | 'meditation'>('project');

  const navItems = [
    { key: 'project' as const, label: 'Project' },
    { key: 'terrain' as const, label: 'Terrain' },
    { key: 'meditation' as const, label: 'Meditation' }
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden pb-12">
      <div className="flex items-center justify-between mb-12">
        <nav className="flex flex-wrap items-center gap-6 md:gap-10">
          {navItems.map((item) => (
            <button
              key={item.key}
              onClick={() => setView(item.key)}
              className={`text-3xl md:text-4xl font-display transition-all ${
                view === item.key ? 'text-ink' : 'text-ink/10 hover:text-ink/30'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <SyncStatusIndicator />
          <AccountMenu onOpenTraffic={onOpenTraffic} onOpenSettings={onOpenSettings} />
        </div>
      </div>

      {view === 'project' ? (
        <HomeProject
          activeProject={activeProject}
          activeDocument={activeDocument}
          onDocumentSelect={onDocumentSelect}
          projectMessages={projectMessages}
          projectInput={projectInput}
          setProjectInput={setProjectInput}
          onProjectChat={onProjectChat}
          isProjectChatLoading={isProjectChatLoading}
          onImportClick={onImportClick}
        />
      ) : view === 'terrain' ? (
        <HomeTerrain
          projectLexicon={projectLexicon}
          readingProgress={readingProgress}
          recordInteraction={recordInteraction}
          updateLexeme={updateLexeme}
        />
      ) : (
        <HomeMeditation userId={userId} projectId={activeProject.id} bookId={activeDocument?.id} />
      )}
    </div>
  );
};

export default FocusModule;
