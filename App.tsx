import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Book, Familiarity, Project, Sentence, WordOccurrence, AgentMessage, UserProficiency, PanelState, AnnotationContext, LexiconItem, VocabularyStat } from './types';
import { MOCK_PROJECT } from './constants';
import ReaderToken from './components/ReaderToken';
import MarginSidebar from './components/MarginSidebar';
import ProjectContext from './components/ProjectContext';
import LayoutShell from './components/LayoutShell';
import ProficiencyModal from './components/ProficiencyModal';
import LexisDeck from './components/LexisDeck';
import { streamAnnotation, streamProjectAdvice, generateWordDefinition, streamProjectChat } from './services/geminiService';
import ReactMarkdown from 'react-markdown';

const App: React.FC = () => {
  const [leftPanelState, setLeftPanelState] = useState<PanelState>('default');
  const [rightPanelState, setRightPanelState] = useState<PanelState>('default');
  const [focusView, setFocusView] = useState<'project' | 'lexis'>('project');
  const [isSwitcherExpanded, setIsSwitcherExpanded] = useState(false);
  const [isSidebarChatActive, setIsSidebarChatActive] = useState(false);
  const isZenMode = leftPanelState === 'collapsed' && rightPanelState === 'collapsed';
  const [userProficiency, setUserProficiency] = useState<UserProficiency | null>(null);

  const [activeProject, setActiveProject] = useState<Project>(MOCK_PROJECT);
  const [activeBook, setActiveBook] = useState<Book | undefined>(MOCK_PROJECT.books[0]);
  
  const [projectMessages, setProjectMessages] = useState<AgentMessage[]>([]);
  const [projectInput, setProjectInput] = useState("");
  const [isProjectChatLoading, setIsProjectChatLoading] = useState(false);
  const projectChatEndRef = useRef<HTMLDivElement>(null);
  const sidebarChatEndRef = useRef<HTMLDivElement>(null);
  
  const [focusedSentenceId, setFocusedSentenceId] = useState<string | null>(null);
  const [activeToken, setActiveToken] = useState<WordOccurrence | null>(null);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const sentenceRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    projectChatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [projectMessages, focusView]);

  useEffect(() => {
    if (isSidebarChatActive) {
      sidebarChatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [projectMessages, isSidebarChatActive]);

  const projectLexicon = useMemo(() => {
    const map = new Map<string, LexiconItem>();
    const stats = activeProject.vocabularyStats;
    activeProject.books.forEach(book => {
      book.content.forEach(sentence => {
        sentence.tokens.forEach(token => {
          if (token.text.match(/[a-zA-Z]/) && token.text.length > 1) {
             const key = token.lemma;
             const stat = stats[key] || { lemma: key, familiarity: token.familiarity, reviewCount: 0 };
             if (!map.has(key)) {
               map.set(key, { lemma: key, count: 0, familiarity: stat.familiarity, reviewCount: stat.reviewCount, definition: stat.definition, occurrences: [] });
             }
             const item = map.get(key)!;
             item.count++;
             if (item.occurrences.length < 5) {
               item.occurrences.push({ sentenceText: sentence.text, bookTitle: book.title, bookId: book.id, sentenceId: sentence.id, wordText: token.text, wordId: token.id });
             }
          }
        });
      });
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [activeProject]);

  const handleAssessmentComplete = (level: UserProficiency) => setUserProficiency(level);

  const handleUpdateLexicon = (lemma: string, updates: Partial<VocabularyStat>) => {
    const currentStats = activeProject.vocabularyStats[lemma] || { lemma, familiarity: Familiarity.Unknown, reviewCount: 0 };
    const newStatsMap = { ...activeProject.vocabularyStats, [lemma]: { ...currentStats, ...updates } };
    let newBooks = activeProject.books.map(book => ({
      ...book,
      content: book.content.map(sentence => ({
        ...sentence,
        tokens: sentence.tokens.map(t => t.lemma === lemma ? { ...t, familiarity: updates.familiarity ?? t.familiarity } : t)
      }))
    }));
    setActiveProject({ ...activeProject, books: newBooks, vocabularyStats: newStatsMap });
  };

  const navigateToContext = (bookId: string, sentenceId: string, wordId: string) => {
    const book = activeProject.books.find(b => b.id === bookId);
    if (book) {
      setActiveBook(book);
      setFocusedSentenceId(sentenceId);
      setLeftPanelState('default');
      setFocusView('project');
      setTimeout(() => {
        const el = sentenceRefs.current.get(sentenceId);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  };

  const handleAiRequest = async (targetText: string, prompt: string, sentenceIndex: number, tokenLemma?: string) => {
    if (tokenLemma) {
      const currentStat = activeProject.vocabularyStats[tokenLemma];
      handleUpdateLexicon(tokenLemma, { familiarity: currentStat?.familiarity === Familiarity.Unknown ? Familiarity.Seen : currentStat?.familiarity, reviewCount: (currentStat?.reviewCount || 0) + 1 });
    }
    if (rightPanelState === 'collapsed') setRightPanelState('default'); 
    setIsAiLoading(true);
    const msgId = Date.now().toString();
    setMessages(prev => [{ id: msgId, role: 'agent', content: '', type: 'annotation' }, ...prev]);
    let surroundingContext = activeBook?.content ? activeBook.content.slice(Math.max(0, sentenceIndex - 2), Math.min(activeBook.content.length, sentenceIndex + 3)).map(s => s.text).join(" ") : "";
    const contextData: AnnotationContext = { targetSentence: targetText, surroundingContext, bookTitle: activeBook?.title || '', author: activeBook?.author || '', projectName: activeProject.name, projectDescription: activeProject.description, proficiency: userProficiency || UserProficiency.Intermediate };
    await streamAnnotation(contextData, prompt, (updatedText) => {
      setMessages(currentMsgs => currentMsgs.map(msg => msg.id === msgId ? { ...msg, content: updatedText } : msg));
    });
    setIsAiLoading(false);
  };

  const handleProjectChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectInput.trim() || isProjectChatLoading) return;
    if (!isSidebarChatActive && leftPanelState === 'default') setIsSidebarChatActive(true);
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

  const handleSentenceClick = (sentence: Sentence, index: number) => {
    if (isZenMode || focusedSentenceId === sentence.id) return;
    setFocusedSentenceId(sentence.id);
    setActiveToken(null);
    handleAiRequest(sentence.text, "请分析这句话的句法逻辑和深层含义。", index);
  };

  const handleTokenClick = (token: WordOccurrence, sentence: Sentence, index: number) => {
    if (isZenMode) return;
    setActiveToken(token);
    setFocusedSentenceId(sentence.id); 
    handleAiRequest(sentence.text, `深度解析单词 "${token.text}" 在此特定语境下的含义。`, index, token.lemma);
  };

  const handleBookSelect = (book: Book) => {
    setActiveBook(book);
    setFocusedSentenceId(null);
    setMessages([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const FocusIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3" /></svg>
  );

  const AgentIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" /></svg>
  );

  return (
    <div className="h-screen bg-paper text-ink font-sans flex flex-col md:flex-row overflow-hidden relative">
      <ProficiencyModal isOpen={userProficiency === null} onComplete={handleAssessmentComplete} />

      {isZenMode && (
        <div className="fixed top-6 right-8 z-[60] flex items-center gap-3 animate-fade-in">
          <div className="flex items-center p-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/10 shadow-sm hover:bg-white/40">
             <button onClick={() => setLeftPanelState('default')} className="w-10 h-10 flex items-center justify-center rounded-full text-ink/80 hover:text-ink transition-all">{FocusIcon}</button>
             <div className="w-px h-4 bg-black/10 mx-1"></div>
             <button onClick={() => setRightPanelState('default')} className="w-10 h-10 flex items-center justify-center rounded-full text-ink/80 hover:text-ink transition-all">{AgentIcon}</button>
          </div>
        </div>
      )}

      {/* LEFT PANEL: FOCUS / PROJECT */}
      <LayoutShell
        side="left" state={leftPanelState} onStateChange={setLeftPanelState} title="Focus"
        headerContent={<div className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">Project Engine</div>}
        collapsedPeerTrigger={rightPanelState === 'collapsed' && !isZenMode ? { label: "Open Agent", icon: AgentIcon, onClick: () => setRightPanelState('default') } : null}
        expandedContent={
          <div className="h-full flex flex-col overflow-hidden">
            {/* FOCUS HEADER: Adjusted margin to prevent clipping in expanded view */}
            <div className="flex justify-between items-center mb-10 flex-shrink-0">
               <nav className="flex items-center gap-4 h-12" onMouseEnter={() => setIsSwitcherExpanded(true)} onMouseLeave={() => setIsSwitcherExpanded(false)}>
                  <span className="text-3xl md:text-5xl font-display font-medium text-ink/10 select-none pb-1">Focus</span>
                  <span className="text-2xl font-display text-gray-200 select-none pb-1">|</span>
                  <div className="flex items-center">
                    <button className={`text-3xl md:text-5xl font-display capitalize transition-all duration-500 pb-1 ${isSwitcherExpanded ? 'text-ink/20 scale-95' : 'text-ink scale-100'}`}>{focusView}</button>
                    <div className={`flex items-center gap-6 md:gap-8 transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] ${isSwitcherExpanded ? 'opacity-100 translate-x-8 max-w-[400px]' : 'opacity-0 -translate-x-4 max-w-0 pointer-events-none'}`}>
                       {['project', 'lexis'].map(mode => mode !== focusView && (
                         <button key={mode} onClick={() => { setFocusView(mode as any); setIsSwitcherExpanded(false); }} className="text-3xl md:text-5xl font-display text-accent hover:text-ink transition-all whitespace-nowrap pb-1">{mode === 'project' ? 'Project' : 'Lexis'}</button>
                       ))}
                    </div>
                  </div>
               </nav>
               <button onClick={() => setLeftPanelState('default')} className="p-2 text-gray-300 hover:text-ink transition-all rounded-full hover:bg-black/5">
                 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-10 h-10 hover:rotate-90 transition-transform"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
               </button>
            </div>
            
            <div className="flex-1 min-h-0">
               {focusView === 'project' ? (
                  <div className="grid md:grid-cols-12 gap-8 h-full overflow-hidden">
                    {/* LEFT: BIBLIOGRAPHY */}
                    <div className="md:col-span-3 flex flex-col h-full border-r border-black/5 pr-4 overflow-hidden">
                      <div className="flex justify-between items-baseline mb-4">
                        <h3 className="text-[10px] font-bold uppercase tracking-[0.4em] text-gray-900">Bibliography</h3>
                        <span className="text-[10px] text-gray-300 font-mono">Index</span>
                      </div>
                      <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 pb-20">
                        {activeProject.books.map(book => (
                          <div key={book.id} onClick={() => { handleBookSelect(book); setLeftPanelState('default'); }} className={`group/book relative p-4 transition-all cursor-pointer border-l-2 ${book.id === activeBook?.id ? 'border-accent bg-white shadow-soft ring-1 ring-black/5' : 'border-transparent hover:border-gray-200 hover:bg-white/40'}`}>
                            <div className="text-[9px] text-gray-400 uppercase tracking-widest mb-1">{book.author}</div>
                            <h4 className="text-base font-serif text-ink leading-tight mb-2">{book.title}</h4>
                            <div className="h-0.5 bg-gray-100 w-full rounded-full overflow-hidden"><div className="h-full bg-ink/20 transition-all duration-1000" style={{ width: `${book.progress}%` }} /></div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* RIGHT: PROJECT CHAT */}
                    <div className="md:col-span-9 flex flex-col h-full overflow-hidden relative">
                      <div className="mb-4 flex-shrink-0">
                        <div className="text-[10px] font-bold uppercase tracking-[0.4em] text-gray-300 mb-1">Project Synthesis Canvas</div>
                        <h4 className="text-xl font-serif text-ink italic leading-tight">Dialogue across reading vectors.</h4>
                      </div>
                      <div className="flex-1 overflow-y-auto no-scrollbar space-y-8 pb-48 pr-4">
                         {projectMessages.length === 0 ? (
                           <div className="h-full flex flex-col items-center justify-center opacity-20 text-center">
                              <span className="text-7xl font-display italic text-gray-300 mb-6">M</span>
                              <p className="text-lg font-serif italic text-gray-400 max-w-md">"Cross-textual analysis on aesthetics and labor."</p>
                           </div>
                         ) : (
                           projectMessages.map(m => (
                             <div key={m.id} className="animate-fade-in-up max-w-4xl mx-auto w-full">
                                <div className="flex items-start gap-8">
                                   <div className={`flex-shrink-0 w-12 text-[9px] uppercase tracking-widest font-bold pt-1.5 ${m.role === 'agent' ? 'text-accent' : 'text-gray-400'}`}>{m.role === 'agent' ? 'Agent' : 'User'}</div>
                                   <div className={`flex-1 prose prose-slate max-w-none font-serif leading-relaxed ${m.role === 'agent' ? 'text-gray-800 text-lg' : 'text-gray-500 italic bg-white/50 p-6 rounded-lg border border-black/5 shadow-soft'}`}><ReactMarkdown>{m.content || "..."}</ReactMarkdown></div>
                                </div>
                             </div>
                           ))
                         )}
                         <div ref={projectChatEndRef} />
                      </div>
                      {/* FIXED FOCUS CHAT INPUT: Pinned higher to ensure full visibility */}
                      <div className="absolute bottom-0 left-0 right-0 h-40 flex items-center bg-gradient-to-t from-paper via-paper to-transparent px-4 pb-8 z-20">
                         <form onSubmit={handleProjectChatSubmit} className="relative max-w-5xl mx-auto w-full">
                            <input type="text" value={projectInput} onChange={(e) => setProjectInput(e.target.value)} placeholder="Discuss overarching project themes..." className="w-full bg-white border border-black/10 rounded-xl py-5 md:py-6 pl-8 md:pl-10 pr-20 text-xl md:text-2xl focus:ring-2 focus:ring-accent transition-all font-serif placeholder:italic shadow-float" />
                            <button type="submit" disabled={isProjectChatLoading} className="absolute right-6 top-1/2 -translate-y-1/2 p-3 md:p-4 text-accent hover:text-ink transition-all disabled:opacity-30">
                               {isProjectChatLoading ? <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" /> : <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>}
                            </button>
                         </form>
                      </div>
                    </div>
                  </div>
               ) : (
                  <div className="h-full">
                    <LexisDeck lexicon={projectLexicon} onUpdateLexicon={handleUpdateLexicon} onGenerateDefinition={generateWordDefinition} onNavigateToContext={navigateToContext} isExpanded={true} bookCount={activeProject.books.length} />
                  </div>
               )}
            </div>
          </div>
        }
      >
        {/* SIDEBAR CONTENT: Books or Agent Chat */}
        <div className="flex-1 flex flex-col relative overflow-hidden bg-surface">
          <div className="flex-1 flex flex-col relative overflow-hidden">
             {isSidebarChatActive ? (
               <div className="absolute inset-0 bg-surface flex flex-col animate-fade-in z-30">
                 <div className="flex items-center justify-between p-4 px-6 border-b border-black/5 bg-paper/50">
                    <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">Project Agent</h3>
                    <button onClick={() => setIsSidebarChatActive(false)} className="p-2 text-gray-400 hover:text-ink transition-all hover:bg-black/5 rounded-full">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                 </div>
                 <div className="flex-1 overflow-y-auto no-scrollbar p-6 px-8 space-y-10 pb-20">
                    {projectMessages.length === 0 ? (
                       <div className="h-full flex flex-col items-center justify-center text-center opacity-30 pt-10"><p className="text-sm font-serif italic">Awaiting synthesis inquiry...</p></div>
                    ) : (
                      projectMessages.map(m => (
                        <div key={m.id} className="animate-fade-in-up">
                           <div className={`text-[9px] uppercase tracking-widest font-bold mb-1 ${m.role === 'agent' ? 'text-accent' : 'text-gray-400'}`}>{m.role === 'agent' ? 'Agent' : 'User'}</div>
                           <div className={`prose prose-sm font-serif leading-relaxed ${m.role === 'agent' ? 'text-gray-800' : 'text-gray-500 italic bg-white/40 p-4 rounded shadow-soft'}`}><ReactMarkdown>{m.content || "..."}</ReactMarkdown></div>
                        </div>
                      ))
                    )}
                    <div ref={sidebarChatEndRef} />
                 </div>
               </div>
             ) : (
               <div className="flex-1 overflow-y-auto no-scrollbar px-6 py-6 transition-all duration-300">
                  <ProjectContext project={activeProject} activeBookId={activeBook?.id} onBookSelect={handleBookSelect} />
               </div>
             )}
          </div>

          {/* SIDEBAR FOOTER CHAT INPUT: Pinned correctly with safe margins */}
          <div className="mt-auto border-t border-black/10 bg-white/95 backdrop-blur-md p-5 px-6 pb-6 z-40">
             <form onSubmit={handleProjectChatSubmit} className="relative">
                <input type="text" value={projectInput} onChange={(e) => setProjectInput(e.target.value)} placeholder="Inquire project depth..." className="w-full bg-surface border border-black/10 rounded-lg py-3.5 pl-5 pr-12 text-sm focus:ring-2 focus:ring-accent transition-all font-serif placeholder:italic shadow-sm" />
                <button type="submit" disabled={isProjectChatLoading} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-accent hover:text-ink transition-all disabled:opacity-30">
                  {isProjectChatLoading ? <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" /> : <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>}
                </button>
             </form>
          </div>
        </div>
      </LayoutShell>

      {/* CENTER: READING STAGE */}
      <main className={`h-full overflow-y-auto scroll-smooth no-scrollbar transition-all duration-700 flex-1 relative ${leftPanelState === 'expanded' || rightPanelState === 'expanded' ? 'opacity-0' : 'opacity-100'}`}>
        <div className={`mx-auto px-8 md:px-16 lg:px-24 py-16 md:py-24 ${isZenMode ? 'max-w-4xl' : 'max-w-3xl'}`}>
          <div className="space-y-12">
            {activeBook?.content.map((sentence, index) => {
              const isFocused = focusedSentenceId === sentence.id;
              return (
                <div key={sentence.id} ref={(el) => { if (el) sentenceRefs.current.set(sentence.id, el); else sentenceRefs.current.delete(sentence.id); }} onClick={() => handleSentenceClick(sentence, index)} className={`transition-all duration-500 ease-out ${isZenMode ? '' : 'cursor-pointer'} ${!isZenMode && isFocused ? 'transform translate-x-2 border-l border-accent/30 pl-6' : 'opacity-80 hover:opacity-100'}`}>
                  <p className="text-lg md:text-xl lg:text-2xl leading-[2.2] font-serif text-left tracking-wide text-ink/90">
                    {sentence.tokens.map((token, idx) => (
                      <React.Fragment key={token.id}>
                        <ReaderToken token={token} isActive={activeToken?.id === token.id} isSentenceFocused={isFocused} onClick={(t) => handleTokenClick(t, sentence, index)} isZenMode={isZenMode} />
                        {idx < sentence.tokens.length - 1 && <span className="select-none"> </span>}
                      </React.Fragment>
                    ))}
                  </p>
                </div>
              );
            })}
          </div>
          <div className="h-64" />
        </div>
      </main>

      {/* RIGHT PANEL: MARGIN AGENT */}
      <LayoutShell
        side="right" state={rightPanelState} onStateChange={setRightPanelState} title="Agent"
        headerContent={<div className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">Margin Notes</div>}
        collapsedPeerTrigger={leftPanelState === 'collapsed' && !isZenMode ? { label: "Open Project", icon: FocusIcon, onClick: () => setLeftPanelState('default') } : null}
      >
        <div className="h-full flex flex-col overflow-hidden relative px-6 md:px-10">
          <div className="flex-1 overflow-y-auto no-scrollbar pb-10">
             <MarginSidebar messages={messages} isLoading={isAiLoading} proficiency={userProficiency || UserProficiency.Intermediate} />
          </div>
        </div>
      </LayoutShell>
    </div>
  );
};

export default App;