
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Book, Project, Sentence, WordOccurrence, AgentMessage, UserProficiency, PanelState, AnnotationContext, LexiconItem, VocabularyStat, MemoryInteraction, Familiarity } from './types';
import { MOCK_PROJECT } from './constants';
import ReaderToken from './components/ReaderToken';
import MarginSidebar from './components/MarginSidebar';
import ProjectContext from './components/ProjectContext';
import LayoutShell from './components/LayoutShell';
import ProficiencyModal from './components/ProficiencyModal';
import LexisDeck from './components/LexisDeck';
import { streamAnnotation, generateWordDefinition, streamProjectChat } from './services/geminiService';
import ReactMarkdown from 'react-markdown';

const App: React.FC = () => {
  const [leftPanelState, setLeftPanelState] = useState<PanelState>('default');
  const [rightPanelState, setRightPanelState] = useState<PanelState>('default');
  const [focusView, setFocusView] = useState<'project' | 'lexis'>('project');
  const [userProficiency, setUserProficiency] = useState<UserProficiency | null>(null);
  const [isZenMode, setIsZenMode] = useState(false);

  const [activeProject, setActiveProject] = useState<Project>(MOCK_PROJECT);
  const [activeBook, setActiveBook] = useState<Book | undefined>(MOCK_PROJECT.books[0]);
  const [readingProgress, setReadingProgress] = useState(0.15); // 模拟阅读进度
  
  const [projectMessages, setProjectMessages] = useState<AgentMessage[]>([]);
  const [projectInput, setProjectInput] = useState("");
  const [isProjectChatLoading, setIsProjectChatLoading] = useState(false);
  
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [focusedSentenceId, setFocusedSentenceId] = useState<string | null>(null);
  const [activeToken, setActiveToken] = useState<WordOccurrence | null>(null);

  const sentenceRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // --- IMS: 计算词汇在文本中的发现时机 ---
  const terrainAnalysis = useMemo(() => {
    const stats: Record<string, { count: number, firstPos: number }> = {};
    let totalTokensInBook = 0;
    
    activeProject.books.forEach(b => {
      let currentTokenCount = 0;
      b.chapters.forEach(c => {
        c.content.forEach(p => {
          p.sentences.forEach(s => {
            s.tokens.forEach(t => {
              currentTokenCount++;
              if (!stats[t.lemma]) {
                stats[t.lemma] = { count: 0, firstPos: currentTokenCount };
              }
              stats[t.lemma].count++;
            });
          });
        });
      });
      totalTokensInBook = currentTokenCount;
    });

    return { stats, totalTokensInBook };
  }, [activeProject.books]);

  const recordInteraction = (lemma: string, type: 'implicit' | 'explicit', weight: number, occurrenceId: string) => {
    setActiveProject(prev => {
      const stats = { ...prev.vocabularyStats };
      const analysis = terrainAnalysis.stats[lemma] || { count: 1, firstPos: 1 };
      
      const current = stats[lemma] || {
        lemma,
        totalOccurrences: analysis.count,
        firstDiscoveryProgress: analysis.firstPos / terrainAnalysis.totalTokensInBook,
        relativeDifficulty: 1 / Math.log(analysis.count + 1.1),
        masteryScore: 0,
        implicitScore: 0,
        explicitScore: 0,
        familiarity: Familiarity.Unknown,
        reviewCount: 0,
        interactions: [],
        lastEncounterDate: Date.now()
      };

      const newInteraction: MemoryInteraction = { timestamp: Date.now(), occurrenceId, type, weight };
      let newImplicit = current.implicitScore ?? 0;
      let newExplicit = current.explicitScore ?? 0;
      
      if (type === 'implicit') {
        newImplicit = Math.min(1, newImplicit + (weight * current.relativeDifficulty));
      } else {
        newExplicit = Math.min(1, Math.max(0, newExplicit + (weight * current.relativeDifficulty)));
      }

      const newScore = (newImplicit * 0.4) + (newExplicit * 0.6);

      stats[lemma] = {
        ...current,
        masteryScore: newScore,
        implicitScore: newImplicit,
        explicitScore: newExplicit,
        interactions: [...(current.interactions || []), newInteraction],
        lastEncounterDate: Date.now()
      };

      return { ...prev, vocabularyStats: stats };
    });
  };

  const projectLexicon = useMemo(() => {
    const allLemmas = Object.keys(terrainAnalysis.stats);
    return allLemmas.map(lemma => {
      const analysis = terrainAnalysis.stats[lemma];
      const existing = activeProject.vocabularyStats[lemma];
      const baseStat: VocabularyStat = existing || {
        lemma,
        totalOccurrences: analysis.count,
        firstDiscoveryProgress: analysis.firstPos / terrainAnalysis.totalTokensInBook,
        relativeDifficulty: 1 / Math.log(analysis.count + 1.1),
        masteryScore: 0,
        implicitScore: 0,
        explicitScore: 0,
        familiarity: Familiarity.Unknown,
        reviewCount: 0,
        interactions: [],
        lastEncounterDate: Date.now()
      };
      return { ...baseStat, count: analysis.count, occurrences: [] } as LexiconItem;
    }).sort((a, b) => b.count - a.count);
  }, [activeProject.vocabularyStats, terrainAnalysis]);

  const handleProjectChat = async () => {
    if (!projectInput.trim() || isProjectChatLoading) return;
    const userMsg: AgentMessage = { id: Date.now().toString(), role: 'user', content: projectInput, type: 'chat' };
    const agentMsgId = (Date.now() + 1).toString();
    setProjectMessages(prev => [...prev, userMsg, { id: agentMsgId, role: 'agent', content: '', type: 'chat' }]);
    setProjectInput("");
    setIsProjectChatLoading(true);
    await streamProjectChat(activeProject, [...projectMessages, userMsg], (text) => {
      setProjectMessages(prev => prev.map(m => m.id === agentMsgId ? { ...m, content: text } : m));
    });
    setIsProjectChatLoading(false);
  };

  return (
    <div className="h-screen bg-paper text-ink font-sans flex flex-col md:flex-row overflow-hidden relative">
      <ProficiencyModal isOpen={userProficiency === null} onComplete={setUserProficiency} />

      <LayoutShell
        side="left" state={leftPanelState} onStateChange={setLeftPanelState} title="Focus"
        headerContent={<div className="text-[9px] font-bold uppercase tracking-[0.2em] text-gray-500">Cognitive Hub</div>}
        expandedContent={
          <div className="h-full flex flex-col overflow-hidden pb-12">
             <div className="flex justify-between items-center mb-10">
                <nav className="flex items-center gap-10">
                   <button onClick={() => setFocusView('project')} className={`text-4xl font-display transition-all ${focusView === 'project' ? 'text-ink' : 'text-ink/10 hover:text-ink/30'}`}>Project</button>
                   <button onClick={() => setFocusView('lexis')} className={`text-4xl font-display transition-all ${focusView === 'lexis' ? 'text-ink' : 'text-ink/10 hover:text-ink/30'}`}>Terrain</button>
                </nav>
             </div>
             
             {focusView === 'project' ? (
               <div className="flex-1 flex gap-12 overflow-hidden animate-fade-in mb-8">
                 <div className="w-80 flex flex-col gap-10">
                    <div className="bg-surface p-8 rounded-[2rem] border border-black/5">
                       <h3 className="font-display text-2xl text-ink mb-3">{activeProject.name}</h3>
                       <p className="text-xs font-serif text-gray-400 leading-relaxed italic">{activeProject.description}</p>
                    </div>
                    <div className="flex-1 overflow-y-auto no-scrollbar">
                       <ProjectContext project={activeProject} activeBookId={activeBook?.id} onBookSelect={setActiveBook} />
                    </div>
                 </div>
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
                            onKeyDown={e => e.key === 'Enter' && handleProjectChat()}
                            placeholder="探索跨文本关联..." 
                            className="flex-1 bg-transparent border-none focus:ring-0 font-serif italic text-lg outline-none"
                          />
                          <button onClick={handleProjectChat} className="text-accent hover:text-accent-hover transition-colors">
                             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>
                          </button>
                       </div>
                    </div>
                 </div>
               </div>
             ) : (
               <div className="flex-1 flex flex-col mb-8 overflow-hidden">
                <LexisDeck 
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
        }
      >
        <div className="p-6 space-y-8 h-full">
           <ProjectContext project={activeProject} activeBookId={activeBook?.id} onBookSelect={setActiveBook} />
        </div>
      </LayoutShell>

      <main className={`h-full overflow-y-auto no-scrollbar flex-1 relative transition-all duration-700 ${leftPanelState === 'expanded' || rightPanelState === 'expanded' ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
        <div className="mx-auto px-12 py-28 max-w-2xl">
          <header className="mb-28 text-center">
             <div className="text-[10px] uppercase tracking-[0.5em] text-accent mb-6 font-bold opacity-60">{activeBook?.author}</div>
             <h1 className="text-6xl md:text-7xl font-display text-ink mb-10 tracking-tight">{activeBook?.title}</h1>
             <div className="w-16 h-px bg-accent/30 mx-auto" />
          </header>
          {activeBook?.chapters.map((chapter) => (
            <section key={chapter.id} className="mb-32">
              <h2 className="text-4xl font-display mb-20 text-ink/20 italic tracking-tighter">{chapter.title}</h2>
              <div className="space-y-16">
                {chapter.content.map((paragraph) => (
                  <div key={paragraph.id} className={`${paragraph.type === 'poetry' ? 'text-center italic' : ''}`}>
                    {paragraph.sentences.map((sentence) => (
                      <div 
                        key={sentence.id} 
                        onClick={() => {
                          setFocusedSentenceId(sentence.id);
                          sentence.tokens.forEach(t => recordInteraction(t.lemma, 'implicit', 0.05, t.id));
                        }} 
                        className={`transition-all duration-500 cursor-pointer ${paragraph.type === 'prose' ? 'inline' : 'block mb-4'} ${focusedSentenceId === sentence.id ? 'bg-accent/5 ring-1 ring-accent/10 rounded-lg px-2 -mx-2 py-0.5' : ''}`}
                      >
                        <p className="text-xl leading-[2.4] font-serif text-ink inline">
                          {sentence.tokens.map((token, idx) => (
                            <React.Fragment key={token.id}>
                               <ReaderToken 
                                 token={{...token, masteryScore: activeProject.vocabularyStats[token.lemma]?.masteryScore || 0}} 
                                 isActive={activeToken?.id === token.id} 
                                 isSentenceFocused={focusedSentenceId === sentence.id} 
                                 onClick={() => {
                                   setActiveToken(token);
                                   recordInteraction(token.lemma, 'explicit', -0.2, token.id);
                                 }} 
                                 isZenMode={isZenMode} 
                               />
                               {idx < sentence.tokens.length - 1 && <span className="select-none text-ink/20"> </span>}
                            </React.Fragment>
                          ))}
                        </p>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </section>
          ))}
          <div className="h-96" />
        </div>
      </main>

      <LayoutShell side="right" state={rightPanelState} onStateChange={setRightPanelState} title="Margin">
        <div className="h-full px-6">
           <MarginSidebar messages={messages} isLoading={isAiLoading} proficiency={userProficiency || UserProficiency.Intermediate} />
        </div>
      </LayoutShell>

      <button onClick={() => setIsZenMode(!isZenMode)} className="fixed bottom-12 left-1/2 -translate-x-1/2 z-40 bg-white hover:bg-white text-ink/40 hover:text-accent transition-all rounded-full px-6 py-3 shadow-soft border border-black/5 backdrop-blur-sm flex items-center gap-3 group">
        <span className="text-[10px] font-bold uppercase tracking-widest group-hover:text-accent transition-colors">{isZenMode ? 'Focus On' : 'Zen Mode'}</span>
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
      </button>
    </div>
  );
};

export default App;
