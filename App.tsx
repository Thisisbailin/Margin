
import React, { useState, useEffect, useMemo, useCallback, Suspense, lazy } from 'react';
import ReactMarkdown from 'react-markdown';
import { SignedIn, SignedOut, SignInButton, useUser } from '@clerk/clerk-react';
import { 
  Book, Project, Sentence, WordOccurrence, AgentMessage, 
  UserProficiency, PanelState, AnnotationContext, LexiconItem, 
  MemoryInteraction, Familiarity, MaterialType, Chapter 
} from './types';
import { MOCK_PROJECT } from './constants';
import { streamAnnotation, generateWordDefinition, streamProjectChat } from './services/llmService';
import { ingestArticleContent } from './services/articleService';
import { uploadEpubToSupabase } from './services/supabaseService';
import manifesto from './docs/margin-manifesto.md?raw';

const HomeView = lazy(() => import('./Home'));
const ReaderView = lazy(() => import('./ReaderPage'));
const SettingsModal = lazy(() => import('./components/SettingsModal'));
const ImportModal = lazy(() => import('./components/ImportModal'));
const TrafficDashboardModal = lazy(() => import('./components/TrafficDashboardModal'));
const MeditationRoom = lazy(() => import('./components/MeditationRoom'));

const LandingPage: React.FC = () => (
  <div className="min-h-screen bg-paper text-ink overflow-y-auto relative">
    <div className="absolute inset-0 pointer-events-none">
      <div className="absolute -top-32 -left-20 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
      <div className="absolute top-24 right-[-60px] h-80 w-80 rounded-full bg-secondary/10 blur-3xl" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(38,38,38,0.06),_transparent_45%)]" />
    </div>

    <div className="relative z-10 max-w-6xl mx-auto px-6 md:px-10 py-16">
      <header className="grid gap-12 md:grid-cols-[1.1fr_0.9fr] items-center">
        <div className="text-left">
          <div className="text-[10px] uppercase tracking-[0.4em] text-accent font-bold mb-6">Margin Research Studio</div>
          <h1 className="text-7xl md:text-8xl font-display italic text-ink mb-8 tracking-tighter">Margin</h1>
          <p className="text-xl md:text-2xl font-serif text-gray-500 italic leading-relaxed mb-10">
            "In the margins of what we read, we find the center of what we think."
          </p>
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            <SignInButton mode="modal">
              <button className="px-10 py-4 bg-ink text-white rounded-2xl font-bold uppercase tracking-widest hover:bg-black transition-all shadow-xl">
                Begin Your Inquiry
              </button>
            </SignInButton>
            <div className="text-[10px] uppercase tracking-[0.3em] text-gray-300 font-bold flex items-center gap-2">
              Powered by Qwen & Clerk
            </div>
          </div>
        </div>
        <div className="bg-white/70 border border-black/5 rounded-[2.5rem] p-8 md:p-10 shadow-soft text-left">
          <div className="text-[10px] uppercase tracking-[0.35em] text-gray-400 font-bold mb-6">Focus</div>
          <div className="space-y-5">
            <div>
              <div className="text-sm font-semibold text-ink">Between-Text Activation</div>
              <div className="text-[11px] text-gray-400">Let relations, not rules, awaken language.</div>
            </div>
            <div>
              <div className="text-sm font-semibold text-ink">Etymological Lineage</div>
              <div className="text-[11px] text-gray-400">Words unfold as genealogies, not definitions.</div>
            </div>
            <div>
              <div className="text-sm font-semibold text-ink">Dynamic Textuality</div>
              <div className="text-[11px] text-gray-400">Meaning stays alive through movement and resonance.</div>
            </div>
          </div>
        </div>
      </header>

      <section className="mt-16 md:mt-20">
        <div className="bg-white/70 border border-black/5 rounded-[2.5rem] p-8 md:p-12 shadow-soft">
          <div className="text-[10px] uppercase tracking-[0.4em] text-accent font-bold mb-4">Margin Manifesto</div>
          <div className="prose prose-sm md:prose-lg max-w-none font-serif text-ink">
            <ReactMarkdown>{manifesto}</ReactMarkdown>
          </div>
        </div>
      </section>
    </div>
  </div>
);

const MarginApp: React.FC = () => {
  const { user } = useUser();
  const [leftPanelState, setLeftPanelState] = useState<PanelState>('collapsed');
  const [rightPanelState, setRightPanelState] = useState<PanelState>('collapsed');
  const [isZenMode, setIsZenMode] = useState(true);
  const [userProficiency, setUserProficiency] = useState<UserProficiency>(UserProficiency.Intermediate);
  const [activeView, setActiveView] = useState<'home' | 'reader'>('home');
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isTrafficOpen, setIsTrafficOpen] = useState(false);
  const [isMeditationOpen, setIsMeditationOpen] = useState(false);
  
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

  const handleBookSelect = useCallback((book: Book) => {
    setActiveBook(book);
    setActiveView('reader');
  }, []);

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
            const struct = await ingestArticleContent(ch.content, ch.title, false, {
              user_id: user.id,
              project_id: activeProject.id,
            });
            return { ...struct, number: idx + 1 };
          })),
          originalFile ? uploadEpubToSupabase(originalFile, bookId, user.id) : Promise.resolve(undefined)
        ]);
        
        chapters = processedChapters;
        storagePath = path;
      } else {
        const chapter = await ingestArticleContent(input, title, isUrl, {
          user_id: user.id,
          project_id: activeProject.id,
        });
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
      }, {
        user_id: user?.id || "",
        project_id: activeProject.id,
        book_id: activeBook.id,
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
      }, {
        user_id: user?.id || "",
        project_id: activeProject.id,
      });
    } catch (e) {
      console.error(e);
    } finally {
      setIsProjectChatLoading(false);
    }
  };

  // Auto-collapse panels on mobile devices
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setLeftPanelState('collapsed');
        setRightPanelState('collapsed');
      }
    };
    
    window.addEventListener('resize', handleResize);
    // Initial check
    if (window.innerWidth < 768) {
      setLeftPanelState('collapsed');
      setRightPanelState('collapsed');
    }
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <>
      {isSettingsOpen && (
        <Suspense fallback={null}>
          <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} proficiency={userProficiency} onProficiencyChange={setUserProficiency} />
        </Suspense>
      )}
      {isImportOpen && (
        <Suspense fallback={null}>
          <ImportModal isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} onImport={handleImportArticle} />
        </Suspense>
      )}
      {isTrafficOpen && (
        <Suspense fallback={null}>
          <TrafficDashboardModal isOpen={isTrafficOpen} onClose={() => setIsTrafficOpen(false)} userId={user?.id} projectId={activeProject.id} />
        </Suspense>
      )}
      {isMeditationOpen && (
        <Suspense fallback={null}>
          <MeditationRoom
            isOpen={isMeditationOpen}
            onClose={() => setIsMeditationOpen(false)}
            userId={user?.id}
            projectId={activeProject.id}
            bookId={activeBook?.id}
          />
        </Suspense>
      )}

      {activeView === 'home' ? (
        <Suspense fallback={<div className="h-screen w-screen bg-paper" />}>
          <HomeView
            activeProject={activeProject}
            activeBook={activeBook}
            onBookSelect={handleBookSelect}
            projectMessages={projectMessages}
            projectInput={projectInput}
            setProjectInput={setProjectInput}
            onProjectChat={handleProjectChat}
            isProjectChatLoading={isProjectChatLoading}
            projectLexicon={projectLexicon}
            readingProgress={readingProgress}
            recordInteraction={recordInteraction}
            generateWordDefinition={(word) =>
              generateWordDefinition(word, undefined, {
                user_id: user?.id || "",
                project_id: activeProject.id,
                book_id: activeBook?.id || "",
              })
            }
            onImportClick={() => setIsImportOpen(true)}
            userId={user?.id}
            onOpenTraffic={() => setIsTrafficOpen(true)}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />
        </Suspense>
      ) : (
        <Suspense fallback={<div className="h-screen w-screen bg-paper" />}>
          <ReaderView
            leftPanelState={leftPanelState}
            rightPanelState={rightPanelState}
            onLeftPanelStateChange={setLeftPanelState}
            onRightPanelStateChange={setRightPanelState}
            activeProject={activeProject}
            activeBook={activeBook}
            onBookSelect={handleBookSelect}
            onEnterHome={() => setActiveView('home')}
            isZenMode={isZenMode}
            focusedSentenceId={focusedSentenceId}
            activeToken={activeToken}
            onSentenceClick={handleSentenceClick}
            onTokenClick={handleTokenClick}
            messages={messages}
            isAiLoading={isAiLoading}
            userProficiency={userProficiency}
          />
        </Suspense>
      )}
    </>
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
