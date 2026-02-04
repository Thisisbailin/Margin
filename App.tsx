import React, { useState, useEffect, useMemo, useCallback, Suspense, lazy } from 'react';
import ReactMarkdown from 'react-markdown';
import { SignedIn, SignedOut, SignInButton, useUser } from '@clerk/clerk-react';
import {
  Document,
  Project,
  Token,
  Span,
  AgentMessage,
  UserProficiency,
  PanelState,
  AnnotationContext,
  LexemeEntry,
  LexemeStat,
  Interaction,
  DocumentType
} from './types';
import { MOCK_PROJECT } from './constants';
import { streamAnnotation, generateWordDefinition, streamProjectChat } from './services/llmService';
import { uploadEpubToSupabase } from './services/supabaseService';
import { buildDocumentFromBlocks, buildProjectIndexes } from './services/documentBuilder';
import type { ParsedEpub } from './services/epubService';
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

const buildLexemeEntries = (project: Project): LexemeEntry[] => {
  const stats = project.lexemeIndex.stats;
  const lemmas = Object.keys(stats);
  const maxOrder = Math.max(1, ...lemmas.map((lemma) => stats[lemma].firstEncounterOrder || 0));

  return lemmas.map((lemma) => {
    const stat = stats[lemma];
    const count = project.occurrenceIndex.byLemma[lemma]?.length || 0;
    const firstEncounterProgress = maxOrder ? (stat.firstEncounterOrder || 0) / maxOrder : 0;
    return {
      ...stat,
      count,
      firstEncounterProgress
    };
  });
};

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
  const [activeDocument, setActiveDocument] = useState<Document | undefined>(MOCK_PROJECT.documents[0]);
  const [readingProgress] = useState(0.15);

  const [projectMessages, setProjectMessages] = useState<AgentMessage[]>([]);
  const [projectInput, setProjectInput] = useState('');
  const [isProjectChatLoading, setIsProjectChatLoading] = useState(false);

  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [focusedSpanId, setFocusedSpanId] = useState<string | null>(null);
  const [activeToken, setActiveToken] = useState<Token | null>(null);

  const handleDocumentSelect = useCallback((document: Document) => {
    setActiveDocument(document);
    setActiveView('reader');
  }, []);

  const projectLexicon = useMemo(() => buildLexemeEntries(activeProject), [activeProject]);

  const getMasteryScore = useCallback(
    (lemma: string) => activeProject.lexemeIndex.stats[lemma]?.masteryScore || 0,
    [activeProject.lexemeIndex.stats]
  );

  useEffect(() => {
    setIsZenMode(rightPanelState === 'collapsed');
  }, [rightPanelState]);

  const updateLexeme = useCallback((lemma: string, updates: Partial<LexemeStat>) => {
    setActiveProject((prev) => {
      const nextStats = { ...prev.lexemeIndex.stats };
      const existing = nextStats[lemma] || {
        lemma,
        totalInteractions: 0,
        implicitScore: 0,
        explicitScore: 0,
        masteryScore: 0,
        firstEncounterAt: 0,
        firstEncounterOrder: 0,
        lastEncounterAt: 0
      };
      nextStats[lemma] = { ...existing, ...updates };
      return { ...prev, lexemeIndex: { stats: nextStats } };
    });
  }, []);

  const recordInteraction = useCallback(
    (lemma: string, type: 'implicit' | 'explicit', weight: number, occurrenceId?: string) => {
      setActiveProject((prev) => {
        const nextStats = { ...prev.lexemeIndex.stats };
        const nextInteractionLog = {
          byOccurrence: { ...prev.interactionLog.byOccurrence },
          byLemma: { ...prev.interactionLog.byLemma }
        };

        const resolvedOccurrenceId =
          occurrenceId || prev.occurrenceIndex.byLemma[lemma]?.[0] || `virtual-${lemma}`;

        const now = Date.now();
        let stat = nextStats[lemma];
        if (!stat) {
          const order = Object.keys(nextStats).length + 1;
          stat = {
            lemma,
            totalInteractions: 0,
            implicitScore: 0,
            explicitScore: 0,
            masteryScore: 0,
            firstEncounterAt: now,
            firstEncounterOrder: order,
            lastEncounterAt: now
          };
        }

        if (stat.firstEncounterAt === 0) {
          stat.firstEncounterAt = now;
          stat.firstEncounterOrder = stat.firstEncounterOrder || Object.keys(nextStats).length + 1;
        }

        const interaction: Interaction = {
          id: `i-${now}`,
          occurrenceId: resolvedOccurrenceId,
          lemma,
          type,
          weight,
          timestamp: now
        };

        nextInteractionLog.byOccurrence[resolvedOccurrenceId] =
          nextInteractionLog.byOccurrence[resolvedOccurrenceId] || [];
        nextInteractionLog.byLemma[lemma] = nextInteractionLog.byLemma[lemma] || [];
        nextInteractionLog.byOccurrence[resolvedOccurrenceId].push(interaction);
        nextInteractionLog.byLemma[lemma].push(interaction);

        stat.totalInteractions += 1;
        if (type === 'explicit') stat.explicitScore += weight;
        else stat.implicitScore += weight;
        stat.masteryScore = Math.min(1, stat.implicitScore * 0.1 + stat.explicitScore * 0.3);
        stat.lastEncounterAt = now;
        nextStats[lemma] = stat;

        return {
          ...prev,
          lexemeIndex: { stats: nextStats },
          interactionLog: nextInteractionLog
        };
      });
    },
    []
  );

  const handleImportEpub = async (epubData: ParsedEpub, originalFile: File) => {
    if (!user) return;

    const documentId = `doc-${Date.now()}`;

    try {
      const newDocument = buildDocumentFromBlocks({
        id: documentId,
        type: DocumentType.Book,
        title: epubData.title || 'New Material',
        author: epubData.author,
        language: epubData.language || 'English',
        sections: epubData.sections || [],
        toc: epubData.toc
      });

      await uploadEpubToSupabase(originalFile, documentId, user.id);

      setActiveProject((prev) => {
        const documents = [...prev.documents, newDocument];
        const indexes = buildProjectIndexes(documents, prev.lexemeIndex, prev.interactionLog);
        return {
          ...prev,
          documents,
          occurrenceIndex: indexes.occurrenceIndex,
          lexemeIndex: indexes.lexemeIndex,
          interactionLog: indexes.interactionLog
        };
      });
      setActiveDocument(newDocument);
      setLeftPanelState('collapsed');
    } catch (err) {
      console.error('Import failed', err);
      alert('Failed to process EPUB. Please check the file.');
    }
  };

  const handleSpanClick = (span: Span) => {
    if (isZenMode && rightPanelState === 'collapsed') {
      setRightPanelState('default');
    }
    setFocusedSpanId(span.id);
    setActiveToken(null);

    const annotationPrompt = '解构这句话的文学风格与深层含义。';
    handleAnnotate(span.text, annotationPrompt, true);
  };

  const handleTokenClick = (token: Token) => {
    setActiveToken(token);
    recordInteraction(token.lemma, 'explicit', 0.2, token.id);

    const annotationPrompt = `深入解析单词 "${token.surface}" (lemma: ${token.lemma}) 在当前语境下的用法、词根词缀及情感色彩。`;
    handleAnnotate(token.surface, annotationPrompt, false);
  };

  const handleAnnotate = async (target: string, prompt: string, isSpan: boolean) => {
    if (!activeDocument) return;

    const mastery = activeToken ? getMasteryScore(activeToken.lemma) : 0.5;
    const context: AnnotationContext = {
      targetText: target,
      surroundingContext: target,
      documentTitle: activeDocument.title,
      author: activeDocument.author,
      language: activeDocument.language,
      projectName: activeProject.name,
      projectDescription: activeProject.description,
      proficiency: userProficiency,
      targetMastery: mastery,
      isFocusedLookup: !isSpan
    };

    setIsAiLoading(true);
    const newMsgId = `msg-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: `user-${newMsgId}`, role: 'user', content: target, type: 'annotation' },
      { id: newMsgId, role: 'agent', content: '', type: 'annotation' }
    ]);

    try {
      await streamAnnotation(
        context,
        prompt,
        (fullText) => {
          setMessages((prev) => prev.map((m) => (m.id === newMsgId ? { ...m, content: fullText } : m)));
        },
        {
          user_id: user?.id || '',
          project_id: activeProject.id,
          document_id: activeDocument.id
        }
      );
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
    const agentMsg: AgentMessage = { id: agentMsgId, role: 'agent', content: '', type: 'chat' };

    setProjectMessages((prev) => [...prev, userMsg, agentMsg]);
    setProjectInput('');
    setIsProjectChatLoading(true);

    try {
      await streamProjectChat(
        activeProject,
        [...projectMessages, userMsg],
        (fullText) => {
          setProjectMessages((prev) => prev.map((m) => (m.id === agentMsgId ? { ...m, content: fullText } : m)));
        },
        {
          user_id: user?.id || '',
          project_id: activeProject.id
        }
      );
    } catch (e) {
      console.error(e);
    } finally {
      setIsProjectChatLoading(false);
    }
  };

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setLeftPanelState('collapsed');
        setRightPanelState('collapsed');
      }
    };

    window.addEventListener('resize', handleResize);
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
          <SettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            proficiency={userProficiency}
            onProficiencyChange={setUserProficiency}
          />
        </Suspense>
      )}
      {isImportOpen && (
        <Suspense fallback={null}>
          <ImportModal isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} onImport={handleImportEpub} />
        </Suspense>
      )}
      {isTrafficOpen && (
        <Suspense fallback={null}>
          <TrafficDashboardModal
            isOpen={isTrafficOpen}
            onClose={() => setIsTrafficOpen(false)}
            userId={user?.id}
            projectId={activeProject.id}
          />
        </Suspense>
      )}
      {isMeditationOpen && (
        <Suspense fallback={null}>
          <MeditationRoom
            isOpen={isMeditationOpen}
            onClose={() => setIsMeditationOpen(false)}
            userId={user?.id}
            projectId={activeProject.id}
            bookId={activeDocument?.id}
          />
        </Suspense>
      )}

      {activeView === 'home' ? (
        <Suspense fallback={<div className="h-screen w-screen bg-paper" />}>
          <HomeView
            activeProject={activeProject}
            activeDocument={activeDocument}
            onDocumentSelect={handleDocumentSelect}
            projectMessages={projectMessages}
            projectInput={projectInput}
            setProjectInput={setProjectInput}
            onProjectChat={handleProjectChat}
            isProjectChatLoading={isProjectChatLoading}
            projectLexicon={projectLexicon}
            readingProgress={readingProgress}
            recordInteraction={recordInteraction}
            updateLexeme={updateLexeme}
            generateWordDefinition={(word) =>
              generateWordDefinition(word, undefined, {
                user_id: user?.id || '',
                project_id: activeProject.id,
                document_id: activeDocument?.id || ''
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
            activeDocument={activeDocument}
            onDocumentSelect={handleDocumentSelect}
            onEnterHome={() => setActiveView('home')}
            isZenMode={isZenMode}
            focusedSpanId={focusedSpanId}
            activeToken={activeToken}
            onSpanClick={handleSpanClick}
            onTokenClick={handleTokenClick}
            messages={messages}
            isAiLoading={isAiLoading}
            userProficiency={userProficiency}
            getMasteryScore={getMasteryScore}
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
