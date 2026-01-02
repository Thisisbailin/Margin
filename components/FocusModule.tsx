
import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Project, Book, AgentMessage, LexiconItem, VocabularyStat } from '../types';
import ProjectContext from './ProjectContext';
import TerrainMap from './TerrainMap';

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
  onClose: () => void;
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
  onClose
}) => {
  const [view, setView] = useState<'project' | 'terrain'>('project');

  return (
    <div className="h-full flex flex-col overflow-hidden pb-16">
      {/* 导航 Header */}
      <div className="flex justify-between items-center mb-10">
        <nav className="flex items-center gap-10">
          <button 
            onClick={() => setView('project')} 
            className={`text-4xl font-display transition-all ${view === 'project' ? 'text-ink' : 'text-ink/10 hover:text-ink/30'}`}
          >
            Project
          </button>
          <button 
            onClick={() => setView('terrain')} 
            className={`text-4xl font-display transition-all ${view === 'terrain' ? 'text-ink' : 'text-ink/10 hover:text-ink/30'}`}
          >
            Terrain
          </button>
        </nav>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={onClose} 
            className="p-3 hover:bg-black/5 rounded-full transition-colors text-ink/30 hover:text-ink"
            title="Return to Reading"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* 视图内容 */}
      {view === 'project' ? (
        <div className="flex-1 flex gap-12 overflow-hidden animate-fade-in mb-4">
          {/* 左侧：书籍目录与项目简介 */}
          <div className="w-80 flex flex-col gap-10">
            <div className="bg-surface p-8 rounded-[2rem] border border-black/5">
              <h3 className="font-display text-2xl text-ink mb-3">{activeProject.name}</h3>
              <p className="text-xs font-serif text-gray-400 leading-relaxed italic">{activeProject.description}</p>
            </div>
            <div className="flex-1 overflow-y-auto no-scrollbar">
              {/* Pass onImportClick to ProjectContext */}
              <ProjectContext project={activeProject} activeBookId={activeBook?.id} onBookSelect={onBookSelect} onImportClick={onImportClick} />
            </div>
          </div>

          {/* 右侧：项目聊天工作区 */}
          <div className="flex-1 bg-white/50 rounded-[2.5rem] flex flex-col overflow-hidden border border-black/5 shadow-soft">
            <div className="flex-1 p-10 overflow-y-auto space-y-10 no-scrollbar">
              {projectMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center opacity-10">
                  <span className="text-[120px] font-display mb-4">Ω</span>
                  <p className="font-serif italic text-xl">Project Synthesis Workspace</p>
                </div>
              ) : (
                projectMessages.map(m => (
                  <div key={m.id} className={`max-w-2xl ${m.role === 'user' ? 'ml-auto' : 'mr-auto'}`}>
                    <div className={`text-[9px] uppercase tracking-widest text-gray-400 mb-3 ${m.role === 'user' ? 'text-right' : ''}`}>
                      {m.role === 'agent' ? 'Project Mentor' : 'Researcher'}
                    </div>
                    <div className={`prose prose-sm font-serif ${m.role === 'user' ? 'bg-accent/5 p-6 rounded-3xl italic' : 'text-ink'}`}>
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            <div className="p-8 bg-paper/80 border-t border-black/5">
              <div className="flex gap-4 items-center bg-white px-6 py-4 rounded-2xl shadow-sm border border-black/5">
                <input 
                  value={projectInput} 
                  onChange={e => setProjectInput(e.target.value)} 
                  onKeyDown={e => e.key === 'Enter' && onProjectChat()} 
                  placeholder="探索跨文本关联..." 
                  className="flex-1 bg-transparent border-none focus:ring-0 font-serif italic text-lg outline-none" 
                />
                <button 
                  onClick={onProjectChat} 
                  disabled={isProjectChatLoading}
                  className="text-accent hover:text-accent-hover transition-colors disabled:opacity-30"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col mb-4 overflow-hidden">
          <TerrainMap 
            lexicon={projectLexicon} 
            bookProgress={readingProgress} 
            onUpdateLexicon={(lemma, updates) => recordInteraction(lemma, 'explicit', 0.5, 'deck-review')} 
            onGenerateDefinition={generateWordDefinition} 
            onNavigateToContext={() => {}} 
            isExpanded={true} 
          />
        </div>
      )}
    </div>
  );
};

export default FocusModule;
