import React, { useState, useRef, useEffect } from 'react';
import { Book, Familiarity, Project, Sentence, WordOccurrence, AgentMessage, UserProficiency, PanelState } from './types';
import { MOCK_PROJECT } from './constants';
import ReaderToken from './components/ReaderToken';
import MarginSidebar from './components/MarginSidebar';
import ProjectContext from './components/ProjectContext';
import LayoutShell from './components/LayoutShell';
import ProficiencyModal from './components/ProficiencyModal';
import LexisDeck from './components/LexisDeck';
import { streamAnnotation, streamProjectAdvice } from './services/geminiService';

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

  // 1. Proficiency
  const handleAssessmentComplete = (level: UserProficiency) => {
    setUserProficiency(level);
  };

  // 2. Implicit Memory & Flashcard Update
  const updateFamiliarity = (tokenLemma: string, newFam: Familiarity) => {
    // We need to update this word across the entire project content to reflect learning
    const newBooks = activeProject.books.map(book => ({
      ...book,
      content: book.content.map(sentence => ({
        ...sentence,
        tokens: sentence.tokens.map(t => {
          if (t.lemma === tokenLemma) {
            return { ...t, familiarity: newFam };
          }
          return t;
        })
      }))
    }));
    
    // Update Project State
    const newProject = { ...activeProject, books: newBooks };
    setActiveProject(newProject);

    // Sync active book if it's part of the update
    if (activeBook) {
      const updatedActiveBook = newBooks.find(b => b.id === activeBook.id);
      if (updatedActiveBook) setActiveBook(updatedActiveBook);
    }
  };

  // 3. AI Request
  const handleAiRequest = async (text: string, prompt: string) => {
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

    await streamAnnotation(text, activeBook?.title || '', prompt, userProficiency || UserProficiency.Intermediate, (updatedText) => {
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

  const handleSentenceClick = (sentence: Sentence) => {
    // Zen Mode Guard: If reading immersively, ignore clicks
    if (isZenMode) return;

    if (focusedSentenceId === sentence.id) return;
    setFocusedSentenceId(sentence.id);
    setActiveToken(null);
    handleAiRequest(sentence.text, "请分析这句话的句法逻辑和深层含义。");
  };

  const handleTokenClick = (token: WordOccurrence, sentence: Sentence) => {
    if (isZenMode) return;
    setActiveToken(token);
    setFocusedSentenceId(sentence.id); 
    handleAiRequest(sentence.text, `深度解析单词 "${token.text}" 在此特定语境下的含义。`);
  };

  const handleBookSelect = (book: Book) => {
    setActiveBook(book);
    setFocusedSentenceId(null);
    setMessages([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!activeBook) return <div className="p-10">Loading...</div>;

  // Icons for Triggers
  const ProjectIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
       <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
  );

  const AgentIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
       <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
    </svg>
  );

  return (
    <div className="h-screen bg-paper text-ink font-sans flex flex-col md:flex-row overflow-hidden relative">
      
      <ProficiencyModal 
        isOpen={userProficiency === null} 
        onComplete={handleAssessmentComplete} 
      />

      {/* --- LIQUID GLASS BAR (Zen Mode Only) --- */}
      {/* Visible ONLY when BOTH are collapsed */}
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
               title="Open Project"
             >
                {ProjectIcon}
             </button>
             <div className="w-px h-4 bg-black/10 mx-1"></div>
             <button
               onClick={() => setRightPanelState('default')}
               className="w-10 h-10 flex items-center justify-center rounded-full text-ink/80 hover:text-ink hover:bg-white/40 transition-all"
               title="Open Agent"
             >
               {AgentIcon}
             </button>
          </div>
        </div>
      )}


      {/* LEFT COLUMN: Project & Lexis */}
      <LayoutShell
        side="left"
        state={leftPanelState}
        onStateChange={setLeftPanelState}
        title="Project"
        collapsedPeerTrigger={rightPanelState === 'collapsed' && !isZenMode ? {
          label: "Open Agent",
          icon: AgentIcon,
          onClick: () => setRightPanelState('default')
        } : null}
        expandedContent={
          <div className="animate-fade-in-up">
            <h1 className="text-5xl font-serif font-bold text-ink mb-6">{activeProject.name}</h1>
            <p className="text-xl text-gray-500 leading-relaxed max-w-3xl mb-12">
              {activeProject.description}
            </p>
             <div className="grid md:grid-cols-2 gap-12">
               <div>
                 <ProjectContext 
                    project={activeProject}
                    activeBookId={activeBook.id}
                    onBookSelect={(b) => { handleBookSelect(b); setLeftPanelState('default'); }}
                    adviceContent={projectAdvice}
                    onGenerateAdvice={handleProjectAdviceRequest}
                    isGeneratingAdvice={isGeneratingAdvice}
                 />
               </div>
               {/* Lexis Stats in Expanded View */}
               <div className="bg-gray-50 p-8 rounded-lg">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-6">Lexis Overview</h3>
                  <div className="text-center py-8">
                     <div className="text-5xl font-serif font-bold text-ink mb-2">142</div>
                     <div className="text-gray-400">Words Collected</div>
                     <button 
                       onClick={() => { setLeftPanelState('default'); setLeftPanelMode('lexis'); }}
                       className="mt-6 px-6 py-2 border border-black rounded-full hover:bg-black hover:text-white transition-colors"
                     >
                       Start Review Session
                     </button>
                  </div>
               </div>
            </div>
          </div>
        }
      >
        {/* Toggle between Project and Lexis in Default Sidebar */}
        <div className="flex flex-col h-full">
           <div className="flex space-x-6 border-b border-gray-100 pb-4 mb-6">
              <button 
                onClick={() => setLeftPanelMode('library')}
                className={`text-xs font-bold uppercase tracking-widest transition-colors ${leftPanelMode === 'library' ? 'text-ink' : 'text-gray-300 hover:text-gray-500'}`}
              >
                Library
              </button>
              <button 
                onClick={() => setLeftPanelMode('lexis')}
                className={`text-xs font-bold uppercase tracking-widest transition-colors ${leftPanelMode === 'lexis' ? 'text-ink' : 'text-gray-300 hover:text-gray-500'}`}
              >
                Lexis Deck
              </button>
           </div>

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
                project={activeProject}
                onUpdateFamiliarity={updateFamiliarity}
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
            {activeBook.content.map((sentence) => {
              const isFocused = focusedSentenceId === sentence.id;
              
              return (
                <div 
                  key={sentence.id}
                  ref={(el) => {
                    if (el) sentenceRefs.current.set(sentence.id, el);
                    else sentenceRefs.current.delete(sentence.id);
                  }}
                  onClick={() => handleSentenceClick(sentence)}
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
                          onClick={(t) => handleTokenClick(t, sentence)}
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
        collapsedPeerTrigger={leftPanelState === 'collapsed' && !isZenMode ? {
          label: "Open Project",
          icon: ProjectIcon,
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