
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { SignedIn, SignedOut, SignInButton, UserButton, useUser } from '@clerk/clerk-react';
import { 
  Book, Project, Sentence, WordOccurrence, AgentMessage, 
  UserProficiency, PanelState, AnnotationContext, LexiconItem, 
  VocabularyStat, MemoryInteraction, Familiarity, MaterialType, Chapter 
} from './types';
import { MOCK_PROJECT } from './constants';
import ReaderToken from './components/ReaderToken';
import MarginSidebar from './components/MarginSidebar';
import FocusModule from './components/FocusModule';
import LayoutShell from './components/LayoutShell';
import SettingsModal from './components/SettingsModal';
import ImportModal from './components/ImportModal';
import { streamAnnotation, generateWordDefinition, streamProjectChat } from './services/geminiService';
import { ingestArticleContent } from './services/articleService';
import { speakText } from './services/ttsService';
import { uploadEpubToSupabase } from './services/supabaseService';
import ProjectContext from './components/ProjectContext';

const LandingPage: React.FC = () => (
  <div className="h-screen bg-paper flex flex-col items-center justify-center p-6 text-center animate-fade-in">
    <div className="max-w-xl">
      <h1 className="text-8xl font-display italic text-ink mb-8 tracking-tighter">Margin</h1>
      <p className="text-xl font-serif text-gray-500 italic leading-relaxed mb-12">
        "In the margins of what we read, we find the center of what we think."
      </p>
      <div className="flex flex-col gap-4 items-center">
        <SignInButton mode="modal">
          <button className="px-12 py-5 bg-ink text-white rounded-2xl font-bold uppercase tracking-widest hover:bg-black transition-all shadow-xl">
            Begin Your Inquiry
          </button>
        </SignInButton>
        <p className="text-[10px] uppercase tracking-[0.3em] text-gray-300 font-bold mt-4">
          Powered by Gemini 3 & Clerk
        </p>
      </div>
    </div>
  </div>
);

const MarginApp: React.FC = () => {
  const { user } = useUser();
  const [leftPanelState, setLeftPanelState] = useState<PanelState>('collapsed');
  const [rightPanelState, setRightPanelState] = useState<PanelState>('collapsed');
  const [isZenMode, setIsZenMode] = useState(true);
  const [userProficiency, setUserProficiency] = useState<UserProficiency>(UserProficiency.Intermediate);
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isFocusModuleOpen, setIsFocusModuleOpen] = useState(false);
  
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

  // Derive lexicon for the focus module
  const projectLexicon = useMemo(() => {
    return Object.values(activeProject.vocabularyStats) as LexiconItem[];
  }, [activeProject.vocabularyStats]);

  useEffect(() => {
    if (rightPanelState === 'collapsed') {
      setIsZenMode(true);
    } else {
      setIsZenMode(false);
    }
  }, [rightPanelState]);

  const handleImportArticle = async (input: string, title: string, isUrl: boolean, epubData?: any, originalFile?: File) => {
    if (!user) return;
    
    let chapters: Chapter[] = [];
    let author = 'Acquired Content';
    let type = MaterialType.Article;
    let storagePath: string | undefined = undefined;
    const bookId = `book-${Date.now()}`;

    try {
      if (epubData) {
        type = MaterialType.Book;
        author = epubData.author;
        
        const [processedChapters, path] = await Promise.all([
          Promise.all(epubData.chapters.slice(0, 3).map(async (ch: any, idx: number) => {
            const struct = await ingestArticleContent(ch.content, ch.title, false);
            return { ...struct, number: idx + 1 };
          })),
          originalFile ? uploadEpubToSupabase(originalFile, bookId, user.id) : Promise.resolve(undefined)
        ]);
        
        chapters = processedChapters;
        storagePath = path;
      } else {
        const chapter = await ingestArticleContent(input, title, isUrl);
        chapters = [chapter];
      }
      
      const newBook: Book = {
        id: bookId,
        type,
        title: title || epubData?.title || 'New Material',
        author: author,
        language: 'English',
        progress: 0,
        chapters: chapters,
        storagePath
      };

      setActiveProject(prev => ({ ...prev, books: [...prev.books, newBook] }));
      setActiveBook(newBook);
      setLeftPanelState('collapsed');
    } catch (err) {
      console.error("Import failed", err);
      alert("Failed to process content. Please check the source or your API key.");
    }
  };

  const recordInteraction = useCallback((lemma: string, type: 'implicit' | 'explicit', weight: number, occurrenceId: string) => {
    setActiveProject(prev => {
      const stats = { ...prev.vocabularyStats };
      if (!stats[lemma]) {
        stats[lemma] = {
          lemma,
          totalOccurrences: 0,
          relativeDifficulty: 0.5,
          firstDiscoveryProgress: readingProgress,
          masteryScore: 0,
          implicitScore: 0,
          explicitScore: 0,
          familiarity: Familiarity.Unknown,
          reviewCount: 0,
          interactions: [],
          lastEncounterDate: Date.now()
        };
      }
      
      const interaction: MemoryInteraction = {
        timestamp: Date.now(),
        occurrenceId,
        type,
        weight
      };
      
      stats[lemma].interactions.push(interaction);
      stats[lemma].totalOccurrences++;
      if (type === 'explicit') {
        stats[lemma].explicitScore += weight;
        stats[lemma].reviewCount++;
      } else {
        stats[lemma].implicitScore += weight;
      }
      
      // Basic mastery calculation
      stats[lemma].masteryScore = Math.min(1, (stats[lemma].implicitScore * 0.1) + (stats[lemma].explicitScore * 0.3));
      
      return { ...prev, vocabularyStats: stats };
    });
  }, [readingProgress]);

  const handleSentenceClick = (sentence: Sentence) => {
    if (isZenMode && rightPanelState === 'collapsed') {
      setRightPanelState('default');
    }
    setFocusedSentenceId(sentence.id);
    setActiveToken(null);
    
    // Auto-annotate sentence if empty
    const annotationPrompt = `解构这句话的文学风格与深层含义。`;
    handleAnnotate(sentence.text, annotationPrompt, true);
  };

  const handleTokenClick = (token: WordOccurrence) => {
    setActiveToken(token);
    recordInteraction(token.lemma, 'explicit', 0.2, token.id);
    
    const annotationPrompt = `深入解析单词 "${token.text}" (lemma: ${token.lemma}) 在当前语境下的用法、词根词缀及情感色彩。`;
    handleAnnotate(token.text, annotationPrompt, false);
  };

  const handleAnnotate = async (target: string, prompt: string, isSentence: boolean) => {
    if (!activeBook) return;
    
    const context: AnnotationContext = {
      targetSentence: target,
      surroundingContext: target, // Simplified for now
      bookTitle: activeBook.title,
      author: activeBook.author,
      language: activeBook.language,
      projectName: activeProject.name,
      projectDescription: activeProject.description,
      proficiency: userProficiency,
      targetMastery: activeToken?.masteryScore || 0.5,
      isFocusedLookup: !isSentence
    };

    setIsAiLoading(true);
    const newMsgId = `msg-${Date.now()}`;
    setMessages(prev => [...prev, 
      { id: `user-${newMsgId}`, role: 'user', content: target, type: 'annotation' },
      { id: newMsgId, role: 'agent', content: "", type: 'annotation' }
    ]);

    try {
      await streamAnnotation(context, prompt, (fullText) => {
        setMessages(prev => prev.map(m => m.id === newMsgId ? { ...m, content: fullText } : m));
      });
    } catch (e) {
      console.error(e);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleProjectChat = async () => {
    if (!projectInput.trim() || isProjectChatLoading) return;
    
    const userMsg: AgentMessage = { id: `u-${Date.now()}`, role: 'user', content: projectInput, type: 'chat' };
    const agentMsgId = `a-${Date.now()}`;
    const agentMsg: AgentMessage = { id: agentMsgId, role: 'agent', content: "", type: 'chat' };
    
    setProjectMessages(prev => [...prev, userMsg, agentMsg]);
    setProjectInput("");
    setIsProjectChatLoading(true);

    try {
      await streamProjectChat(activeProject, [...projectMessages, userMsg], (fullText) => {
        setProjectMessages(prev => prev.map(m => m.id === agentMsgId ? { ...m, content: fullText } : m));
      });
    } catch (e) {
      console.error(e);
    } finally {
      setIsProjectChatLoading(false);
    }
  };

  return (
    <div className="h-screen bg-paper text-ink font-sans flex flex-col md:flex-row overflow-hidden relative">
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} proficiency={userProficiency} onProficiencyChange={setUserProficiency} />
      <ImportModal isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} onImport={handleImportArticle} />

      {isFocusModuleOpen && (
        <div className="fixed inset-0 z-[120] bg-paper animate-fade-in-up p-8 md:p-20 overflow-hidden">
          <FocusModule 
            activeProject={activeProject}
            activeBook={activeBook}
            onBookSelect={setActiveBook}
            projectMessages={projectMessages}
            projectInput={projectInput}
            setProjectInput={setProjectInput}
            onProjectChat={handleProjectChat}
            isProjectChatLoading={isProjectChatLoading}
            projectLexicon={projectLexicon}
            readingProgress={readingProgress}
            recordInteraction={recordInteraction}
            generateWordDefinition={generateWordDefinition}
            onImportClick={() => setIsImportOpen(true)}
            onClose={() => setIsFocusModuleOpen(false)}
          />
        </div>
      )}

      <LayoutShell side="left" state={leftPanelState} onStateChange={setLeftPanelState} title="Landscape" 
        headerContent={<div className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">Landscape</div>}
      >
        <div className="p-8 h-full flex flex-col justify-between">
           <ProjectContext project={activeProject} activeBookId={activeBook?.id} onBookSelect={setActiveBook} onImportClick={() => setIsImportOpen(true)} />
           <div className="pt-8 border-t border-black/5 flex flex-col gap-6">
              <button 
                onClick={() => setIsFocusModuleOpen(true)}
                className="w-full py-4 bg-surface border border-black/5 rounded-2xl text-[10px] font-bold uppercase tracking-widest text-ink hover:bg-white hover:shadow-soft transition-all flex items-center justify-center gap-2"
              >
                Project Synthesis Engine
              </button>
              <div className="flex items-center gap-4">
                <UserButton afterSignOutUrl="/" />
                <div className="flex flex-col">
                   <span className="text-xs font-bold text-ink">{user?.fullName || user?.username}</span>
                   <span className="text-[9px] uppercase tracking-widest text-gray-400">Researcher</span>
                </div>
              </div>
           </div>
        </div>
      </LayoutShell>

      <main className={`h-full overflow-y-auto no-scrollbar flex-1 relative transition-all duration-700 ${leftPanelState === 'expanded' || rightPanelState === 'expanded' ? 'opacity-0 scale-95 translate-y-4' : 'opacity-100 scale-100 translate-y-0'}`}>
        <div className="mx-auto px-12 py-32 max-w-2xl">
          <header className="mb-28 text-center animate-fade-in">
             <div className="text-[10px] uppercase tracking-[0.4em] text-accent font-bold mb-6">Current Reading</div>
             <h1 className="text-6xl md:text-7xl font-display text-ink mb-10 tracking-tight leading-[1.1]">{activeBook?.title}</h1>
             <div className="text-sm font-serif italic text-gray-400">by {activeBook?.author}</div>
          </header>

          <div className="space-y-24">
            {activeBook?.chapters.map((chapter) => (
              <section key={chapter.id} className="animate-fade-in">
                <div className="mb-12 border-b border-black/5 pb-4">
                   <h2 className="font-display text-2xl italic text-ink/40">{chapter.title}</h2>
                </div>
                {chapter.content.map((para) => (
                  <div key={para.id} className="mb-8 prose prose-lg max-w-none">
                    {para.sentences.map((sentence) => (
                      <span 
                        key={sentence.id}
                        onClick={() => handleSentenceClick(sentence)}
                        className={`inline transition-all duration-500 rounded-sm cursor-pointer px-1 -mx-1 py-0.5 ${focusedSentenceId === sentence.id ? 'bg-accent/5 ring-1 ring-accent/10' : 'hover:bg-black/5'}`}
                      >
                        {sentence.tokens.map((token) => (
                          <React.Fragment key={token.id}>
                            <ReaderToken 
                              token={token} 
                              onClick={handleTokenClick}
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

          <footer className="mt-40 pt-20 border-t border-black/5 text-center">
             <p className="text-[10px] uppercase tracking-widest text-gray-300 font-bold">End of Loaded Material</p>
          </footer>
        </div>
        
        {/* Floating Toggle Controls */}
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-3 z-50">
           <button 
            onClick={() => setLeftPanelState(leftPanelState === 'collapsed' ? 'default' : 'collapsed')}
            className={`p-4 rounded-full shadow-float transition-all ${leftPanelState !== 'collapsed' ? 'bg-ink text-white' : 'bg-white text-ink hover:bg-surface'}`}
           >
             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
               <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
             </svg>
           </button>
           <button 
            onClick={() => setRightPanelState(rightPanelState === 'collapsed' ? 'default' : 'collapsed')}
            className={`p-4 rounded-full shadow-float transition-all ${rightPanelState !== 'collapsed' ? 'bg-ink text-white' : 'bg-white text-ink hover:bg-surface'}`}
           >
             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
               <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 0 1-.923 1.785c-.442.496.103 1.228.718 1.025a5.503 5.503 0 0 0 2.316-1.392l.06-.06c.397-.396.944-.606 1.48-.544 1.157.133 2.344.204 3.551.204Z" />
             </svg>
           </button>
           <button 
            onClick={() => setIsSettingsOpen(true)}
            className="p-4 bg-white text-ink rounded-full shadow-float hover:bg-surface transition-all"
           >
             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
               <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.59c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 0 1 0 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 0 1-.22.127c-.332.183-.582.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.59c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.324-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.937 6.937 0 0 1 0-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281Z" />
               <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
             </svg>
           </button>
        </div>
      </main>

      <LayoutShell side="right" state={rightPanelState} onStateChange={setRightPanelState} title="Margin"
        headerContent={<div className="flex items-center justify-between w-full pr-4"><span className="font-display text-2xl italic text-ink">Margin</span></div>}
      >
        <div className="flex-1 overflow-y-auto no-scrollbar px-7 pb-20">
          <MarginSidebar messages={messages} isLoading={isAiLoading} proficiency={userProficiency} />
        </div>
      </LayoutShell>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <>
      <SignedIn>
        <MarginApp />
      </SignedIn>
      <SignedOut>
        <LandingPage />
      </SignedOut>
    </>
  );
};

export default App;
