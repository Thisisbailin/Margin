
import React, { useState } from 'react';
import { UserButton } from '@clerk/clerk-react';
import { Project, Book, AgentMessage, LexiconItem, UserProficiency } from '../types';
import HomeProject from './home/HomeProject';
import HomeTerrain from './home/HomeTerrain';
import HomeMeditation from './home/HomeMeditation';
import HomeTraffic from './home/HomeTraffic';
import HomeSettings from './home/HomeSettings';

interface FocusModuleProps {
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
  // Added onImportClick to props interface
  onImportClick: () => void;
  userId?: string;
  proficiency: UserProficiency;
  onProficiencyChange: (p: UserProficiency) => void;
}

const FocusModule: React.FC<FocusModuleProps> = ({
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
  const [view, setView] = useState<'project' | 'terrain' | 'meditation' | 'traffic' | 'settings'>('project');

  const navItems = [
    { key: 'project' as const, label: 'Project' },
    { key: 'terrain' as const, label: 'Terrain' },
    { key: 'meditation' as const, label: 'Meditation' },
    { key: 'traffic' as const, label: 'Traffic' },
    { key: 'settings' as const, label: 'Settings' },
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
          <UserButton afterSignOutUrl="/" />
        </div>
      </div>

      {/* 视图内容 */}
      {view === 'project' ? (
        <HomeProject
          activeProject={activeProject}
          activeBook={activeBook}
          onBookSelect={onBookSelect}
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
          generateWordDefinition={generateWordDefinition}
        />
      ) : view === 'meditation' ? (
        <HomeMeditation
          userId={userId}
          projectId={activeProject.id}
          bookId={activeBook?.id}
        />
      ) : view === 'traffic' ? (
        <HomeTraffic
          userId={userId}
          projectId={activeProject.id}
        />
      ) : (
        <HomeSettings
          proficiency={proficiency}
          onProficiencyChange={onProficiencyChange}
        />
      )}
    </div>
  );
};

export default FocusModule;
