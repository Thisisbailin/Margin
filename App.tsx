import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Book, Familiarity, Project, Sentence, WordOccurrence, AgentMessage, UserProficiency, PanelState, AnnotationContext, LexiconItem, VocabularyStat } from './types';
import { MOCK_PROJECT } from './constants';
import ReaderToken from './components/ReaderToken';
import MarginSidebar from './components/MarginSidebar';
import ProjectContext from './components/ProjectContext';
import LayoutShell from './components/LayoutShell';
import ProficiencyModal from './components/ProficiencyModal';
import LexisDeck from './components/LexisDeck';
import { streamAnnotation, streamProjectAdvice, generateWordDefinition } from './services/geminiService';

const App: React.FC = () => {
  // --- Global Config ---
  const [leftPanelState, setLeftPanelState] = useState<PanelState>('default');
  const [rightPanelState, setRightPanelState] = useState<PanelState>('default');
  
  // Zen Mode Calculation: Both panels are collapsed
  const isZenMode = leftPanelState === 'collapsed' && rightPanelState === 'collapsed';

  // Left Panel Mode: 'library' (Books) or 'lexis' (Vocabulary)
  const [leftPanelMode, setLeftPanelMode] = useState<'library' | 'lexis'>('library');

  const [userProficiency, setUserProficiency] = useState<UserProficiency | null>(null);

  // --- Data State ---
  const [activeProject, setActiveProject] = useState<Project>(MOCK_PROJECT);
  const [activeBook, setActiveBook] = useState<Book | undefined>(MOCK_PROJECT.books[0]);
  const [projectAdvice, setProjectAdvice] = useState<string>("");
  const [isGeneratingAdvice, setIsGeneratingAdvice] = useState(false);
  
  // --- Reading State ---
  const [focusedSentenceId, setFocusedSentenceId] = useState<string | null>(null);
  const [activeToken, setActiveToken] = useState<WordOccurrence | null>(null);

  // --- Margin (AI) State ---
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // --- Refs ---
  const sentenceRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const streamingMsgIdRef = useRef<string | null>(null);

  // --- Lexicon Aggregation Engine ---
  // Transforms the project books into a frequency-mapped vocabulary list, merging with Persisted Stats
  const projectLexicon = useMemo(() => {
    const map = new Map<string, LexiconItem>();
    const stats = activeProject.vocabularyStats;

    activeProject.books.forEach(book => {
      book.content.forEach(sentence => {
        sentence.tokens.forEach(token => {
          if (token.text.match(/[a-zA-Z]/) && token.text.length > 1) {
             const key = token.lemma;
             
             // Ensure stat entry exists (if not, use token defaults)
             const stat = stats[key] || { 
               lemma: key, 
               familiarity: token.familiarity, 
               reviewCount: 0, 
               definition: undefined 
             };

             if (!map.has(key)) {
               map.set(key, {
                 lemma: key,
                 count: 0,
                 familiarity: stat.familiarity, // Use source of truth
                 reviewCount: stat.reviewCount,
                 definition: stat.definition,
                 occurrences: []
               });
             }
             const item = map.get(key)!;
             item.count++;
             if (item.occurrences.length < 3) {
               item.occurrences.push({
                 sentenceText: sentence.text,
                 bookTitle: book.title,
                 wordText: token.text,
                 wordId: token.id
               });
             }
          }
        });
      });
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [activeProject]);


  // 1. Proficiency
  const handleAssessmentComplete = (level: UserProficiency) => {
    setUserProficiency(level);
  };

  // 2. Centralized Vocabulary Update Logic
  // Handles both familiarity updates and persisting definitions/counts
  const handleUpdateLexicon = (lemma: string, updates: Partial<VocabularyStat>) => {
    
    // 1. Update Vocabulary Stats (Metadata)
    const currentStats = activeProject.vocabularyStats[lemma] || { 
      lemma, 
      familiarity: Familiarity.Unknown, 
      reviewCount: 0 
    };
    
    const newStat = { ...currentStats, ...updates };
    
    const newStatsMap = { 
      ...activeProject.vocabularyStats,
      [lemma]: newStat 
    };

    // 2. Sync Books (If familiarity changed, update visual tokens)
    let newBooks = activeProject.books;
    if (updates.familiarity !== undefined) {
      newBooks = activeProject.books.map(book => ({
        ...book,
        content: book.content.map(sentence => ({
          ...sentence,
          tokens: sentence.tokens.map(t => {
            if (t.lemma === lemma) {
              return { ...t, familiarity: updates.familiarity! };
            }
            return t;
          })
        }))
      }));
    }

    // 3. Update Project State
    const newProject = { 
      ...activeProject, 
      books: newBooks,
      vocabularyStats: newStatsMap 
    };
    
    setActiveProject(newProject);

    // Sync active book
    if (activeBook) {
      const updatedActiveBook = newBooks.find(b => b.id === activeBook.id);
      if (updatedActiveBook) setActiveBook(updatedActiveBook);
    }
  };

  // 3. AI Request
  const handleAiRequest = async (targetText: string, prompt: string, sentenceIndex: number) => {
    if (rightPanelState === 'collapsed') {
        setRightPanelState('default'); 
    }
    
    setIsAiLoading(true);

    const msgId = Date.now().toString();
    streamingMsgIdRef.current = msgId;

    const initialMsg: AgentMessage = {
      id: msgId,
      role: 'agent',
      content: '',
      type: 'annotation'
    };
    setMessages(prev => [initialMsg, ...prev]);

    // Micro Context
    let surroundingContext = "";
    if (activeBook && activeBook.content) {
      const start = Math.max(0, sentenceIndex - 2);
      const end = Math.min(activeBook.content.length, sentenceIndex + 3);
      surroundingContext = activeBook.content
        .slice(start, end)
        .map(s => s.text)
        .join(" ");
    }

    const contextData: AnnotationContext = {
      targetSentence: targetText,
      surroundingContext: surroundingContext,
      bookTitle: activeBook?.title || '',
      author: activeBook?.author || '',
      projectName: activeProject.name,
      projectDescription: activeProject.description,
      proficiency: userProficiency || UserProficiency.Intermediate
    };

    await streamAnnotation(contextData, prompt, (updatedText) => {
      setMessages(currentMsgs => 
        currentMsgs.map(msg => 
          msg.id === msgId ? { ...msg, content: updatedText } : msg
        )
      );
    });

    setIsAiLoading(false);
    streamingMsgIdRef.current = null;
  };

  const handleProjectAdviceRequest = async () => {
    setIsGeneratingAdvice(true);
    await streamProjectAdvice(activeProject, (text) => {
      setProjectAdvice(text);
    });
    setIsGeneratingAdvice(false);
  };

  const handleSentenceClick = (sentence: Sentence, index: number) => {
    if (isZenMode) return;
    if (focusedSentenceId === sentence.id) return;
    setFocusedSentenceId(sentence.id);
    setActiveToken(null);
    handleAiRequest(sentence.text, "请分析这句话的句法逻辑和深层含义。", index);
  };

  const handleTokenClick = (token: WordOccurrence, sentence: Sentence, index: number) => {
    if (isZenMode) return;
    setActiveToken(token);
    setFocusedSentenceId(sentence.id); 
    handleAiRequest(sentence.text, `深度解析单词 "${token.text}" 在此特定语境下的含义。`, index);
  };

  const handleBookSelect = (book: Book) => {
    setActiveBook(book);
    setFocusedSentenceId(null);
    setMessages([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!activeBook) return <div className="p-10">Loading...</div>;

  // New "Focus" Icon (Target/Concentric Circles)
  const FocusIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );

  const AgentIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
       <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 00-1.423 1.423z" />
    </svg>
  );

  const lexisCount = projectLexicon.length;

  // Header Content for Panels
  const LeftPanelHeader = (
    <div className="flex items-center gap-4">
      <button 
        onClick={() => setLeftPanelMode('library')} 
        className={`text-xs font-bold uppercase tracking-[0.2em] transition-colors ${leftPanelMode === 'library' ? 'text-ink' : 'text-gray-400 hover:text-gray-600'}`}
      >
        Library
      </button>
      <span className="text-gray-300">/</span>
      <button 
        onClick={() => setLeftPanelMode('lexis')} 
        className={`text-xs font-bold uppercase tracking-[0.2em] transition-colors ${leftPanelMode === 'lexis' ? 'text-ink' : 'text-gray-400 hover:text-gray-600'}`}
      >
        Lexis
      </button>
    </div>
  );

  const RightPanelHeader = (
    <div className="flex items-baseline gap-3">
      <span className="font-bold text-xs uppercase tracking-[0.2em] text-ink">Margin Notes</span>
      <span className="text-[10px] text-gray-400 uppercase tracking-wider hidden md:inline-block">
        {userProficiency === UserProficiency.Advanced ? 'Deep Read' : 'Analysis'}
      </span>
    </div>
  );

  return (
    <div className="h-screen bg-paper text-ink font-sans flex flex-col md:flex-row overflow-hidden relative">
      
      <ProficiencyModal 
        isOpen={userProficiency === null} 
        onComplete={handleAssessmentComplete} 
      />

      {/* --- ZEN MODE FLOATING BAR --- */}
      {isZenMode && (
        <div className="fixed top-6 right-8 z-[60] flex items-center gap-3 animate-fade-in">
          <div className={`
             flex items-center p-1.5 rounded-full 
             bg-white/10 backdrop-blur-md border border-white/10 shadow-sm
             transition-all duration-500 ease-out hover:bg-white/40
          `}>
             <button
               onClick={() => setLeftPanelState('default')}
               className="w-10 h-10 flex items-center justify-center rounded-full text-ink/80 hover:text-ink hover:bg-white/40 transition-all"
               title="Focus Module"
             >
                {FocusIcon}
             </button>
             <div className="w-px h-4 bg-black/10 mx-1"></div>
             <button
               onClick={() => setRightPanelState('default')}
               className="w-10 h-10 flex items-center justify-center rounded-full text-ink/80 hover:text-ink hover:bg-white/40 transition-all"
               title="Agent Module"
             >
               {AgentIcon}
             </button>
          </div>
        </div>
      )}


      {/* LEFT COLUMN: Focus Module (Project & Lexis) */}
      <LayoutShell
        side="left"
        state={leftPanelState}
        onStateChange={setLeftPanelState}
        title="Focus Module"
        headerContent={LeftPanelHeader}
        collapsedPeerTrigger={rightPanelState === 'collapsed' && !isZenMode ? {
          label: "Open Agent",
          icon: AgentIcon,
          onClick: () => setRightPanelState('default')
        } : null}
        expandedContent={
          <div className="animate-fade-in-up h-full flex flex-col">
            <h1 className="text-4xl md:text-5xl font-serif font-bold text-ink mb-8 flex-shrink-0">{activeProject.name}</h1>
            
            {/* Split Grid for Expanded View */}
            <div className="grid md:grid-cols-12 gap-12 flex-1 min-h-0">
               {/* Left Col: Project Info (4 cols) */}
               <div className="md:col-span-4 flex flex-col overflow-y-auto no-scrollbar pr-4">
                 <p className="text-xl text-gray-500 leading-relaxed mb-12">
                   {activeProject.description}
                 </p>
                 <ProjectContext 
                    project={activeProject}
                    activeBookId={activeBook.id}
                    onBookSelect={(b) => { handleBookSelect(b); setLeftPanelState('default'); }}
                    adviceContent={projectAdvice}
                    onGenerateAdvice={handleProjectAdviceRequest}
                    isGeneratingAdvice={isGeneratingAdvice}
                 />
               </div>

               {/* Right Col: Lexis Data Matrix (8 cols) */}
               <div className="md:col-span-8 bg-white rounded-lg shadow-sm border border-gray-100 flex flex-col overflow-hidden h-full">
                  {/* Reuse LexisDeck in expanded mode */}
                  <div className="flex-1 overflow-hidden p-6">
                    <LexisDeck 
                      lexicon={projectLexicon}
                      onUpdateLexicon={handleUpdateLexicon}
                      onGenerateDefinition={generateWordDefinition}
                      isExpanded={true}
                    />
                  </div>
               </div>
            </div>
          </div>
        }
      >
        <div className="flex flex-col h-full pt-4">
           {leftPanelMode === 'library' ? (
              <ProjectContext 
                project={activeProject} 
                activeBookId={activeBook.id}
                onBookSelect={handleBookSelect}
                adviceContent={undefined}
                onGenerateAdvice={() => {}}
                isGeneratingAdvice={false}
              />
           ) : (
              <LexisDeck 
                lexicon={projectLexicon}
                onUpdateLexicon={handleUpdateLexicon}
                onGenerateDefinition={generateWordDefinition}
                isExpanded={false}
              />
           )}
        </div>
      </LayoutShell>

      {/* CENTER COLUMN: Reading Stage */}
      <main 
        className={`
          h-full overflow-y-auto scroll-smooth no-scrollbar bg-paper transition-all duration-700 ease-in-out flex-1 relative
          ${leftPanelState === 'expanded' || rightPanelState === 'expanded' ? 'opacity-0 overflow-hidden pointer-events-none' : 'opacity-100'}
        `}
      >
        <div className={`
           mx-auto px-8 md:px-16 lg:px-24 py-16 md:py-24 transition-all duration-700 ease-out
           ${isZenMode ? 'max-w-4xl' : 'max-w-3xl'} 
        `}>
          <div className="space-y-10">
            {activeBook.content.map((sentence, index) => {
              const isFocused = focusedSentenceId === sentence.id;
              
              return (
                <div 
                  key={sentence.id}
                  ref={(el) => {
                    if (el) sentenceRefs.current.set(sentence.id, el);
                    else sentenceRefs.current.delete(sentence.id);
                  }}
                  onClick={() => handleSentenceClick(sentence, index)}
                  className={`
                    transition-all duration-500 ease-out
                    ${isZenMode ? '' : 'cursor-pointer'}
                    ${!isZenMode && isFocused ? 'transform translate-x-0' : ''} 
                    ${!isZenMode && !isFocused && focusedSentenceId !== null ? '' : ''}
                  `}
                >
                  <p className="text-lg md:text-xl lg:text-2xl leading-[2.2] font-serif text-left tracking-wide text-ink/90">
                    {sentence.tokens.map((token, idx) => (
                      <React.Fragment key={token.id}>
                        <ReaderToken
                          token={token}
                          isActive={activeToken?.id === token.id}
                          isSentenceFocused={isFocused}
                          onClick={(t) => handleTokenClick(t, sentence, index)}
                          isZenMode={isZenMode}
                        />
                        {/* Punctuation spacing logic */}
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

      {/* RIGHT COLUMN: Margin Agent */}
      <LayoutShell
        side="right"
        state={rightPanelState}
        onStateChange={setRightPanelState}
        title="Agent"
        headerContent={RightPanelHeader}
        collapsedPeerTrigger={leftPanelState === 'collapsed' && !isZenMode ? {
          label: "Open Focus",
          icon: FocusIcon,
          onClick: () => setLeftPanelState('default')
        } : null}
        expandedContent={
          <div className="max-w-4xl mx-auto py-12">
            <h1 className="text-4xl font-serif font-bold text-ink mb-8">Deep Dive Conversation</h1>
            <div className="grid grid-cols-1 gap-8">
               <MarginSidebar 
                 messages={messages} 
                 isLoading={isAiLoading} 
                 proficiency={userProficiency || UserProficiency.Intermediate}
               />
               <div className="mt-8 pt-8 border-t border-gray-100">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-4">Extended Context</h3>
                  <p className="text-gray-500">
                     (Visualizations of concept maps and historical timelines would appear here.)
                  </p>
               </div>
            </div>
          </div>
        }
      >
        <MarginSidebar 
          messages={messages} 
          isLoading={isAiLoading} 
          proficiency={userProficiency || UserProficiency.Intermediate}
        />
      </LayoutShell>

    </div>
  );
};

export default App;