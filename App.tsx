
import React, { useState, useEffect, useMemo } from 'react';
import { Book, Project, Sentence, WordOccurrence, AgentMessage, UserProficiency, PanelState, AnnotationContext, LexiconItem, VocabularyStat, MemoryInteraction, Familiarity } from './types';
import { MOCK_PROJECT } from './constants';
import ReaderToken from './components/ReaderToken';
import MarginSidebar from './components/MarginSidebar';
import ProjectContext from './components/ProjectContext';
import LayoutShell from './components/LayoutShell';
import SettingsModal from './components/SettingsModal';
import LexisDeck from './components/LexisDeck';
import { streamAnnotation, generateWordDefinition, streamProjectChat } from './services/geminiService';
import ReactMarkdown from 'react-markdown';

const App: React.FC = () => {
  const [leftPanelState, setLeftPanelState] = useState<PanelState>('collapsed');
  const [rightPanelState, setRightPanelState] = useState<PanelState>('collapsed');
  const [isZenMode, setIsZenMode] = useState(true);

  const [focusView, setFocusView] = useState<'project' | 'lexis'>('project');
  const [userProficiency, setUserProficiency] = useState<UserProficiency>(() => {
    const saved = localStorage.getItem('margin_proficiency');
    return saved ? (saved as UserProficiency) : UserProficiency.Intermediate;
  });
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeProject, setActiveProject] = useState<Project>(MOCK_PROJECT);
  const [activeBook, setActiveBook] = useState<Book | undefined>(MOCK_PROJECT.books[0]);
  const [readingProgress, setReadingProgress] = useState(0.15); 
  
  const [projectMessages, setProjectMessages] = useState<AgentMessage[]>([]);
  const [projectInput, setProjectInput] = useState("");
  const [isProjectChatLoading, setIsProjectChatLoading] = useState(false);
  
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [focusedSentenceId, setFocusedSentenceId] = useState<string | null>(null);
  const [activeToken, setActiveToken] = useState<WordOccurrence | null>(null);

  useEffect(() => {
    localStorage.setItem('margin_proficiency', userProficiency);
  }, [userProficiency]);

  // 联动逻辑：Margin 侧边栏关闭时自动进入 Zen，并收起左侧
  useEffect(() => {
    if (rightPanelState === 'collapsed') {
      setIsZenMode(true);
      setLeftPanelState('collapsed');
    } else if (rightPanelState === 'default') {
      setIsZenMode(false);
    }
  }, [rightPanelState]);

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
              if (!stats[t.lemma]) stats[t.lemma] = { count: 0, firstPos: currentTokenCount };
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
        lemma, totalOccurrences: analysis.count,
        firstDiscoveryProgress: analysis.firstPos / terrainAnalysis.totalTokensInBook,
        relativeDifficulty: 1 / Math.log(analysis.count + 1.1),
        masteryScore: 0, implicitScore: 0, explicitScore: 0,
        familiarity: Familiarity.Unknown, reviewCount: 0, interactions: [],
        lastEncounterDate: Date.now()
      };
      const newInteraction: MemoryInteraction = { timestamp: Date.now(), occurrenceId, type, weight };
      let newImplicit = current.implicitScore ?? 0;
      let newExplicit = current.explicitScore ?? 0;
      if (type === 'implicit') newImplicit = Math.min(1, newImplicit + (weight * current.relativeDifficulty));
      else newExplicit = Math.min(1, Math.max(0, newExplicit + (weight * current.relativeDifficulty)));
      const newScore = (newImplicit * 0.4) + (newExplicit * 0.6);
      stats[lemma] = { ...current, masteryScore: newScore, implicitScore: newImplicit, explicitScore: newExplicit, interactions: [...(current.interactions || []), newInteraction], lastEncounterDate: Date.now() };
      return { ...prev, vocabularyStats: stats };
    });
  };

  const handleSentenceClick = async (sentence: Sentence) => {
    if (rightPanelState === 'collapsed') setRightPanelState('default');
    setFocusedSentenceId(sentence.id);
    setActiveToken(null); 
    const context: AnnotationContext = {
      targetSentence: sentence.text, surroundingContext: sentence.text,
      bookTitle: activeBook?.title || "", author: activeBook?.author || "",
      language: activeBook?.language || "", projectName: activeProject.name,
      projectDescription: activeProject.description, proficiency: userProficiency,
      targetMastery: 0.5, isFocusedLookup: false
    };
    setIsAiLoading(true);
    setMessages([{ id: Date.now().toString(), role: 'user', content: `解构此句: ${sentence.text}`, type: 'annotation' }]);
    const agentMsgId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: agentMsgId, role: 'agent', content: '', type: 'annotation' }]);
    await streamAnnotation(context, "深度解读该句子的修辞与语境", (text) => {
      setMessages(prev => prev.map(m => m.id === agentMsgId ? { ...m, content: text } : m));
    });
    setIsAiLoading(false);
  };

  const handleTokenClick = async (token: WordOccurrence, sentenceId: string) => {
    if (rightPanelState === 'collapsed') setRightPanelState('default');
    setActiveToken(token);
    setFocusedSentenceId(sentenceId); 
    const context: AnnotationContext = {
      targetSentence: token.text, surroundingContext: token.text,
      bookTitle: activeBook?.title || "", author: activeBook?.author || "",
      language: activeBook?.language || "", projectName: activeProject.name,
      projectDescription: activeProject.description, proficiency: userProficiency,
      targetMastery: activeProject.vocabularyStats[token.lemma]?.masteryScore || 0,
      isFocusedLookup: true
    };
    setIsAiLoading(true);
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: `解析词汇: ${token.text}`, type: 'annotation' }]);
    const agentMsgId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: agentMsgId, role: 'agent', content: '', type: 'annotation' }]);
    await streamAnnotation(context, `详细解析 "${token.text}" 的用法`, (text) => {
      setMessages(prev => prev.map(m => m.id === agentMsgId ? { ...m, content: text } : m));
    });
    setIsAiLoading(false);
  };

  const projectLexicon = useMemo(() => {
    const allLemmas = Object.keys(terrainAnalysis.stats);
    return allLemmas.map(lemma => {
      const analysis = terrainAnalysis.stats[lemma];
      const existing = activeProject.vocabularyStats[lemma];
      const baseStat: VocabularyStat = existing || {
        lemma, totalOccurrences: analysis.count,
        firstDiscoveryProgress: analysis.firstPos / terrainAnalysis.totalTokensInBook,
        relativeDifficulty: 1 / Math.log(analysis.count + 1.1),
        masteryScore: 0, implicitScore: 0, explicitScore: 0,
        familiarity: Familiarity.Unknown, reviewCount: 0, interactions: [],
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

  // 全屏 Focus 模块内容
  const focusModule = (
    <div className="h-full flex flex-col overflow-hidden pb-16">
      <div className="flex justify-between items-center mb-10">
        <nav className="flex items-center gap-10">
          <button onClick={() => setFocusView('project')} className={`text-4xl font-display transition-all ${focusView === 'project' ? 'text-ink' : 'text-ink/10 hover:text-ink/30'}`}>Project</button>
          <button onClick={() => setFocusView('lexis')} className={`text-4xl font-display transition-all ${focusView === 'lexis' ? 'text-ink' : 'text-ink/10 hover:text-ink/30'}`}>Terrain</button>
        </nav>
      </div>
      {focusView === 'project' ? (
        <div className="flex-1 flex gap-12 overflow-hidden animate-fade-in mb-4">
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
                    <div className={`text-[9px] uppercase tracking-widest text-gray-400 mb-3 ${m.role === 'user' ? 'text-right' : ''}`}>{m.role === 'agent' ? 'Project Mentor' : 'Researcher'}</div>
                    <div className={`prose prose-sm font-serif ${m.role === 'user' ? 'bg-accent/5 p-6 rounded-3xl italic' : 'text-ink'}`}><ReactMarkdown>{m.content}</ReactMarkdown></div>
                  </div>
                ))
              )}
            </div>
            <div className="p-8 bg-paper/80 border-t border-black/5">
              <div className="flex gap-4 items-center bg-white px-6 py-4 rounded-2xl shadow-sm border border-black/5">
                <input value={projectInput} onChange={e => setProjectInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleProjectChat()} placeholder="探索关联..." className="flex-1 bg-transparent border-none focus:ring-0 font-serif italic text-lg outline-none" />
                <button onClick={handleProjectChat} className="text-accent hover:text-accent-hover transition-colors"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg></button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col mb-4 overflow-hidden">
          <LexisDeck lexicon={projectLexicon} bookProgress={readingProgress} onUpdateLexicon={(lemma, updates) => recordInteraction(lemma, 'explicit', 0.5, 'deck-review')} onGenerateDefinition={generateWordDefinition} onNavigateToContext={() => {}} isExpanded={true} />
        </div>
      )}
    </div>
  );

  return (
    <div className="h-screen bg-paper text-ink font-sans flex flex-col md:flex-row overflow-hidden relative">
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} proficiency={userProficiency} onProficiencyChange={setUserProficiency} />

      {/* 排版式主触发按钮 (仅收起时显示) */}
      {rightPanelState === 'collapsed' && (
        <button onClick={() => setRightPanelState('default')} className="fixed top-12 right-12 z-[60] text-ink/20 hover:text-accent transition-all group flex flex-col items-end gap-1.5">
          <div className="w-8 h-[1.5px] bg-current" />
          <div className="w-5 h-[1.5px] bg-current" />
          <div className="w-7 h-[1.5px] bg-current" />
          <span className="text-[9px] uppercase tracking-[0.4em] font-bold mt-2 opacity-0 group-hover:opacity-100 transition-opacity">Focus</span>
        </button>
      )}

      {/* 左侧 Project 面板 (纯净模式，无控制按钮) */}
      <LayoutShell side="left" state={leftPanelState} onStateChange={setLeftPanelState} title="Project" headerContent={<div className="text-[9px] font-bold uppercase tracking-[0.2em] text-accent">Landscape</div>}>
        <div className="p-8 h-full overflow-y-auto no-scrollbar">
          <ProjectContext project={activeProject} activeBookId={activeBook?.id} onBookSelect={setActiveBook} />
        </div>
      </LayoutShell>

      {/* 主阅读区域 */}
      <main className={`h-full overflow-y-auto no-scrollbar flex-1 relative transition-all duration-700 ${leftPanelState === 'expanded' || rightPanelState === 'expanded' ? 'opacity-0 scale-95 translate-y-4' : 'opacity-100 scale-100 translate-y-0'}`}>
        <div className="mx-auto px-12 py-32 max-w-2xl">
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
                      <div key={sentence.id} onClick={() => handleSentenceClick(sentence)} className={`transition-all duration-500 cursor-pointer ${paragraph.type === 'prose' ? 'inline' : 'block mb-4'} ${focusedSentenceId === sentence.id ? 'bg-accent/5 ring-1 ring-accent/10 rounded-lg px-2 -mx-2 py-0.5' : ''}`}>
                        <p className="text-xl leading-[2.5] font-serif text-ink inline">
                          {sentence.tokens.map((token, idx) => (
                            <React.Fragment key={token.id}>
                               <ReaderToken token={{...token, masteryScore: activeProject.vocabularyStats[token.lemma]?.masteryScore || 0}} isActive={activeToken?.id === token.id} isSentenceFocused={focusedSentenceId === sentence.id} onClick={() => handleTokenClick(token, sentence.id)} isZenMode={isZenMode} />
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

      {/* 右侧 Margin 面板 (集成控制中心) */}
      <LayoutShell 
        side="right" state={rightPanelState} onStateChange={setRightPanelState} title="Margin"
        expandedContent={focusModule}
        headerContent={
          <div className="flex items-center gap-10 w-full">
            <span className="font-display text-xl italic text-ink tracking-tight flex-shrink-0">Margin</span>
            <div className="flex items-center gap-6">
              <button onClick={() => setLeftPanelState(leftPanelState === 'collapsed' ? 'default' : 'collapsed')} className={`transition-all ${leftPanelState !== 'collapsed' ? 'text-accent' : 'text-faded hover:text-ink'}`} title="Project Context">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18c-2.305 0-4.408.867-6 2.292m0-14.25v14.25" /></svg>
              </button>
              <button onClick={() => setIsZenMode(!isZenMode)} className={`transition-all ${isZenMode ? 'text-accent' : 'text-faded hover:text-ink'}`} title="Zen Mode">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </button>
              <button onClick={() => setIsSettingsOpen(true)} className="text-faded hover:text-ink transition-all" title="Settings">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.094c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774a1.125 1.125 0 01.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738a1.125 1.125 0 01-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.02-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527a1.125 1.125 0 01-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 01.12-1.45l.774-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </button>
              <button onClick={() => setRightPanelState('expanded')} className="text-faded hover:text-accent transition-all" title="Focus Workspace">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg>
              </button>
            </div>
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

export default App;
