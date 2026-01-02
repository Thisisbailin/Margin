
import React, { useState, useEffect, useMemo } from 'react';
import { Book, Project, Sentence, WordOccurrence, AgentMessage, UserProficiency, PanelState, AnnotationContext, LexiconItem, VocabularyStat, MemoryInteraction, Familiarity, MaterialType } from './types';
import { MOCK_PROJECT } from './constants';
import ReaderToken from './components/ReaderToken';
import MarginSidebar from './components/MarginSidebar';
import FocusModule from './components/FocusModule';
import LayoutShell from './components/LayoutShell';
import SettingsModal from './components/SettingsModal';
import ImportModal from './components/ImportModal';
import { streamAnnotation, generateWordDefinition, streamProjectChat } from './services/geminiService';
import { ingestArticleContent } from './services/articleService';
import { speakText, speakBilingual } from './services/ttsService';
import ProjectContext from './components/ProjectContext';

const App: React.FC = () => {
  const [leftPanelState, setLeftPanelState] = useState<PanelState>('collapsed');
  const [rightPanelState, setRightPanelState] = useState<PanelState>('collapsed');
  const [isZenMode, setIsZenMode] = useState(true);

  const [userProficiency, setUserProficiency] = useState<UserProficiency>(() => {
    const saved = localStorage.getItem('margin_proficiency');
    return saved ? (saved as UserProficiency) : UserProficiency.Intermediate;
  });
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
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

  const handleImportArticle = async (input: string, title: string, isUrl: boolean) => {
    const chapter = await ingestArticleContent(input, title, isUrl);
    
    // Calculate word count approximately
    let wordCount = 0;
    chapter.content.forEach(p => p.sentences.forEach(s => wordCount += s.tokens.length));

    const newArticle: Book = {
      id: `article-${Date.now()}`,
      type: MaterialType.Article,
      title: chapter.title,
      author: chapter.subtitle?.replace(/^by\s+/i, '') || 'Acquired Content',
      language: 'English',
      progress: 0,
      chapters: [chapter],
      wordCount: wordCount,
      readingTime: Math.max(1, Math.ceil(wordCount / 200)),
      sourceUrl: isUrl ? input : undefined
    };

    setActiveProject(prev => ({
      ...prev,
      books: [...prev.books, newArticle]
    }));
    setActiveBook(newArticle);
    setReadingProgress(0);
    setLeftPanelState('collapsed');
  };

  const recordInteraction = (lemma: string, type: 'implicit' | 'explicit', weight: number, occurrenceId: string, definition?: string) => {
    setActiveProject(prev => {
      const stats = { ...prev.vocabularyStats };
      const analysis = terrainAnalysis.stats[lemma] || { count: 1, firstPos: 1 };
      const current = stats[lemma] || {
        lemma, totalOccurrences: analysis.count,
        firstDiscoveryProgress: analysis.firstPos / (terrainAnalysis.totalTokensInBook || 1),
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
      stats[lemma] = { 
        ...current, 
        masteryScore: newScore, 
        implicitScore: newImplicit, 
        explicitScore: newExplicit, 
        interactions: [...(current.interactions || []), newInteraction], 
        lastEncounterDate: Date.now(),
        definition: definition || current.definition
      };
      return { ...prev, vocabularyStats: stats };
    });
  };

  const handleSentenceClick = async (sentence: Sentence) => {
    if (rightPanelState === 'collapsed') setRightPanelState('default');
    setFocusedSentenceId(sentence.id);
    setActiveToken(null); 
    
    speakText(sentence.text, 'Kore');

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
    
    let resultText = "";
    await streamAnnotation(context, "深度解读该句子的修辞与语境", (text) => {
      resultText = text;
      setMessages(prev => prev.map(m => m.id === agentMsgId ? { ...m, content: text } : m));
    });
    
    setIsAiLoading(false);
  };

  const handleTokenClick = async (token: WordOccurrence, sentenceId: string) => {
    if (rightPanelState === 'collapsed') setRightPanelState('default');
    setActiveToken(token);
    setFocusedSentenceId(sentenceId); 
    
    speakText(token.text, 'Kore');

    setIsAiLoading(true);
    recordInteraction(token.lemma, 'explicit', -0.1, token.id);

    const context: AnnotationContext = {
      targetSentence: token.text, surroundingContext: token.text,
      bookTitle: activeBook?.title || "", author: activeBook?.author || "",
      language: activeBook?.language || "", projectName: activeProject.name,
      projectDescription: activeProject.description, proficiency: userProficiency,
      targetMastery: activeProject.vocabularyStats[token.lemma]?.masteryScore || 0,
      isFocusedLookup: true
    };
    
    const userMsg: AgentMessage = { id: Date.now().toString(), role: 'user', content: `解析词汇: ${token.text}`, type: 'annotation' };
    const agentMsgId = (Date.now() + 1).toString();
    
    setMessages(prev => [...prev, userMsg, { 
      id: agentMsgId, 
      role: 'agent', 
      content: '', 
      type: 'annotation'
    }]);
    
    let fullResponse = "";
    await streamAnnotation(context, `详细解析 "${token.text}" 的用法`, (text) => {
      fullResponse = text;
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
        firstDiscoveryProgress: analysis.firstPos / (terrainAnalysis.totalTokensInBook || 1),
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

  return (
    <div className="h-screen bg-paper text-ink font-sans flex flex-col md:flex-row overflow-hidden relative">
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        proficiency={userProficiency} 
        onProficiencyChange={setUserProficiency} 
      />

      <ImportModal 
        isOpen={isImportOpen} 
        onClose={() => setIsImportOpen(false)} 
        onImport={handleImportArticle} 
      />

      {rightPanelState === 'collapsed' && (
        <button 
          onClick={() => setRightPanelState('default')} 
          className="fixed top-12 right-12 z-[60] text-ink/20 hover:text-accent transition-all group flex flex-col items-end gap-1.5"
        >
          <div className="w-8 h-[1.5px] bg-current" />
          <div className="w-5 h-[1.5px] bg-current" />
          <div className="w-7 h-[1.5px] bg-current" />
          <span className="text-[9px] uppercase tracking-[0.4em] font-bold mt-2 opacity-0 group-hover:opacity-100 transition-opacity">Focus</span>
        </button>
      )}

      <LayoutShell 
        side="left" state={leftPanelState} onStateChange={setLeftPanelState} title="Landscape"
        headerContent={<div className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">Landscape</div>}
      >
        <div className="p-8 h-full">
           <ProjectContext project={activeProject} activeBookId={activeBook?.id} onBookSelect={setActiveBook} onImportClick={() => setIsImportOpen(true)} />
        </div>
      </LayoutShell>

      <main className={`h-full overflow-y-auto no-scrollbar flex-1 relative transition-all duration-700 ${leftPanelState === 'expanded' || rightPanelState === 'expanded' ? 'opacity-0 scale-95 translate-y-4' : 'opacity-100 scale-100 translate-y-0'}`}>
        <div className="mx-auto px-12 py-32 max-w-2xl">
          <header className="mb-28 text-center animate-fade-in">
             <div className="flex flex-col items-center gap-4 mb-8">
                <span className={`px-4 py-1 rounded-full text-[9px] font-bold uppercase tracking-[0.3em] ${activeBook?.type === MaterialType.Book ? 'bg-secondary/10 text-secondary' : 'bg-accent/10 text-accent'}`}>
                   {activeBook?.type}
                </span>
                <div className="text-[10px] uppercase tracking-[0.5em] text-accent font-bold opacity-60">{activeBook?.author}</div>
             </div>
             <h1 className="text-6xl md:text-7xl font-display text-ink mb-10 tracking-tight leading-[1.1]">{activeBook?.title}</h1>
             <div className="w-16 h-px bg-accent/30 mx-auto" />
             {activeBook?.sourceUrl && (
               <a href={activeBook.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-8 inline-block text-[10px] text-gray-400 hover:text-accent transition-colors font-serif italic">
                 Source: {new URL(activeBook.sourceUrl).hostname} ↗
               </a>
             )}
          </header>
          {activeBook?.chapters.map((chapter) => (
            <section key={chapter.id} className="mb-32">
              {activeBook.type === MaterialType.Book && (
                <h2 className="text-4xl font-display mb-20 text-ink/20 italic tracking-tighter">{chapter.title}</h2>
              )}
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

      <LayoutShell 
        side="right" state={rightPanelState} onStateChange={setRightPanelState} title="Margin"
        expandedContent={
          <FocusModule 
            activeProject={activeProject} activeBook={activeBook} onBookSelect={setActiveBook}
            projectMessages={projectMessages} projectInput={projectInput} setProjectInput={setProjectInput}
            onProjectChat={handleProjectChat} isProjectChatLoading={isProjectChatLoading}
            projectLexicon={projectLexicon} readingProgress={readingProgress}
            recordInteraction={recordInteraction} generateWordDefinition={generateWordDefinition}
            onClose={() => setRightPanelState('default')}
            onImportClick={() => setIsImportOpen(true)}
          />
        }
        headerContent={
          <div className="flex items-center justify-between w-full pr-4">
            <span className="font-display text-2xl italic text-ink tracking-tight">Margin</span>
            <div className="flex items-center gap-6">
              <button onClick={() => setLeftPanelState(leftPanelState === 'collapsed' ? 'default' : 'collapsed')} className={`transition-all ${leftPanelState !== 'collapsed' ? 'text-accent' : 'text-faded hover:text-ink'}`} title="Project Landscape">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0018 18c-2.305 0-4.408.867-6 2.292m0-14.25v14.25" /></svg>
              </button>
              <button onClick={() => setIsZenMode(!isZenMode)} className={`transition-all ${isZenMode ? 'text-accent' : 'text-faded hover:text-ink'}`} title="Zen Mode">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </button>
              <button onClick={() => setIsSettingsOpen(true)} className="text-faded hover:text-ink transition-all" title="Settings"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.094c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774a1.125 1.125 0 01.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738a1.125 1.125 0 01-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.02-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527a1.125 1.125 0 01-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 01.12-1.45l.774-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" /></svg></button>
              <button onClick={() => setRightPanelState('expanded')} className="text-faded hover:text-accent transition-all" title="Focus Workspace"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg></button>
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
