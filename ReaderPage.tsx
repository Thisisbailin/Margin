import React from 'react';
import { UserButton } from '@clerk/clerk-react';
import {
  AgentMessage,
  Book,
  PanelState,
  Project,
  Sentence,
  UserProficiency,
  WordOccurrence
} from './types';
import LayoutShell from './components/LayoutShell';
import MarginSidebar from './components/MarginSidebar';
import ProjectContext from './components/ProjectContext';
import ReaderToken from './components/ReaderToken';

interface ReaderPageProps {
  leftPanelState: PanelState;
  rightPanelState: PanelState;
  onLeftPanelStateChange: (state: PanelState) => void;
  onRightPanelStateChange: (state: PanelState) => void;
  activeProject: Project;
  activeBook: Book | undefined;
  onBookSelect: (book: Book) => void;
  onImportClick: () => void;
  onEnterHome: () => void;
  user: { fullName?: string | null; username?: string | null } | null;
  onOpenSettings: () => void;
  onOpenTraffic: () => void;
  onOpenMeditation: () => void;
  isZenMode: boolean;
  focusedSentenceId: string | null;
  activeToken: WordOccurrence | null;
  onSentenceClick: (sentence: Sentence) => void;
  onTokenClick: (token: WordOccurrence) => void;
  messages: AgentMessage[];
  isAiLoading: boolean;
  userProficiency: UserProficiency;
}

const ReaderPage: React.FC<ReaderPageProps> = ({
  leftPanelState,
  rightPanelState,
  onLeftPanelStateChange,
  onRightPanelStateChange,
  activeProject,
  activeBook,
  onBookSelect,
  onImportClick,
  onEnterHome,
  user,
  onOpenSettings,
  onOpenTraffic,
  onOpenMeditation,
  isZenMode,
  focusedSentenceId,
  activeToken,
  onSentenceClick,
  onTokenClick,
  messages,
  isAiLoading,
  userProficiency
}) => {
  return (
    <div className="h-screen w-screen bg-paper text-ink font-sans flex flex-col md:flex-row overflow-hidden relative">
      <LayoutShell
        side="left"
        state={leftPanelState}
        onStateChange={onLeftPanelStateChange}
        title="Landscape"
        headerContent={<div className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">Landscape</div>}
      >
        <div className="p-8 h-full flex flex-col justify-between">
          <ProjectContext
            project={activeProject}
            activeBookId={activeBook?.id}
            onBookSelect={onBookSelect}
            onImportClick={onImportClick}
          />
          <div className="pt-8 border-t border-black/5 flex flex-col gap-6">
            <button
              onClick={onEnterHome}
              className="w-full py-4 bg-surface border border-black/5 rounded-2xl text-[10px] font-bold uppercase tracking-widest text-ink hover:bg-white hover:shadow-soft transition-all flex items-center justify-center gap-2"
            >
              Project Synthesis Engine
            </button>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-4">
                <UserButton afterSignOutUrl="/" />
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-ink">{user?.fullName || user?.username}</span>
                  <span className="text-[9px] uppercase tracking-widest text-gray-400">Researcher</span>
                </div>
              </div>
              <button
                onClick={onOpenSettings}
                className="w-full py-2.5 bg-white border border-black/5 rounded-xl text-[10px] font-bold uppercase tracking-widest text-ink hover:bg-surface transition-all"
              >
                Settings
              </button>
              <button
                onClick={onOpenTraffic}
                className="w-full py-2.5 bg-white border border-black/5 rounded-xl text-[10px] font-bold uppercase tracking-widest text-ink hover:bg-surface transition-all"
              >
                AI Traffic Hub
              </button>
              <button
                onClick={onOpenMeditation}
                className="w-full py-2.5 bg-white border border-black/5 rounded-xl text-[10px] font-bold uppercase tracking-widest text-ink hover:bg-surface transition-all"
              >
                冥想室
              </button>
            </div>
          </div>
        </div>
      </LayoutShell>

      <main
        className={`h-full w-full overflow-y-auto no-scrollbar flex-1 relative transition-all duration-700 ${
          leftPanelState === 'expanded' || rightPanelState === 'expanded'
            ? 'md:opacity-0 md:scale-95 md:translate-y-4'
            : 'opacity-100 scale-100 translate-y-0'
        }`}
      >
        <div className="mx-auto px-4 md:px-12 py-20 md:py-32 max-w-2xl">
          <header className="mb-16 md:mb-28 text-center animate-fade-in">
            <div className="text-[10px] uppercase tracking-[0.4em] text-accent font-bold mb-6">Current Reading</div>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-display text-ink mb-6 md:mb-10 tracking-tight leading-[1.1]">
              {activeBook?.title}
            </h1>
            <div className="text-xs md:text-sm font-serif italic text-gray-400">by {activeBook?.author}</div>
          </header>

          <div className="space-y-12 md:space-y-24">
            {activeBook?.chapters.map((chapter) => (
              <section key={chapter.id} className="animate-fade-in">
                <div className="mb-8 md:mb-12 border-b border-black/5 pb-4">
                  <h2 className="font-display text-lg md:text-2xl italic text-ink/40">{chapter.title}</h2>
                </div>
                {chapter.content.map((para) => (
                  <div key={para.id} className="mb-8 prose prose-sm md:prose-lg max-w-none">
                    {para.sentences.map((sentence) => (
                      <span
                        key={sentence.id}
                        onClick={() => onSentenceClick(sentence)}
                        className={`inline transition-all duration-500 rounded-sm cursor-pointer px-1 -mx-1 py-0.5 ${
                          focusedSentenceId === sentence.id ? 'bg-accent/5 ring-1 ring-accent/10' : 'hover:bg-black/5'
                        }`}
                      >
                        {sentence.tokens.map((token) => (
                          <React.Fragment key={token.id}>
                            <ReaderToken
                              token={token}
                              onClick={onTokenClick}
                              isActive={activeToken?.id === token.id}
                              isSentenceFocused={focusedSentenceId === sentence.id}
                              isZenMode={isZenMode}
                            />
                            {' '}
                          </React.Fragment>
                        ))}
                      </span>
                    ))}
                  </div>
                ))}
              </section>
            ))}
          </div>

          <footer className="mt-20 md:mt-40 pt-10 md:pt-20 border-t border-black/5 text-center">
            <p className="text-[10px] uppercase tracking-widest text-gray-300 font-bold">End of Loaded Material</p>
          </footer>
        </div>

        <div className="fixed bottom-6 md:bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-2 md:gap-3 z-40">
          <button
            onClick={() => onLeftPanelStateChange(leftPanelState === 'collapsed' ? 'default' : 'collapsed')}
            className={`p-3 md:p-4 rounded-full shadow-float transition-all ${
              leftPanelState !== 'collapsed' ? 'bg-ink text-white' : 'bg-white text-ink hover:bg-surface'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 md:w-5 md:h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
            </svg>
          </button>
          <button
            onClick={() => onRightPanelStateChange(rightPanelState === 'collapsed' ? 'default' : 'collapsed')}
            className={`p-3 md:p-4 rounded-full shadow-float transition-all ${
              rightPanelState !== 'collapsed' ? 'bg-ink text-white' : 'bg-white text-ink hover:bg-surface'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 md:w-5 md:h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 0 1-.923 1.785c-.442.496.103 1.228.718 1.025a5.503 5.503 0 0 0 2.316-1.392l.06-.06c.397-.396.944-.606 1.48-.544 1.157.133 2.344.204 3.551.204Z" />
            </svg>
          </button>
        </div>
      </main>

      <LayoutShell
        side="right"
        state={rightPanelState}
        onStateChange={onRightPanelStateChange}
        title="Margin"
        headerContent={
          <div className="flex items-center justify-between w-full pr-4">
            <span className="font-display text-2xl italic text-ink">Margin</span>
          </div>
        }
      >
        <div className="flex-1 overflow-y-auto no-scrollbar px-7 pb-20">
          <MarginSidebar messages={messages} isLoading={isAiLoading} proficiency={userProficiency} />
        </div>
      </LayoutShell>
    </div>
  );
};

export default ReaderPage;
