import React, { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { LexiconItem, Familiarity, StudyFilter, FrequencyBand, VocabularyStat } from '../types';
import SkeletonLoader from './SkeletonLoader';

interface LexisDeckProps {
  lexicon: LexiconItem[]; // Aggregated project vocabulary
  onUpdateLexicon: (lemma: string, updates: Partial<VocabularyStat>) => void;
  onGenerateDefinition: (word: string) => Promise<string>;
  isExpanded?: boolean; // New prop to control layout density
}

type Mode = 'dashboard' | 'study';

const LexisDeck: React.FC<LexisDeckProps> = ({ 
  lexicon, 
  onUpdateLexicon, 
  onGenerateDefinition,
  isExpanded = false
}) => {
  const [mode, setMode] = useState<Mode>('dashboard');
  const [studyFilter, setStudyFilter] = useState<StudyFilter>({ band: 'core', status: 'new' });
  
  // Flashcard State
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [sessionQueue, setSessionQueue] = useState<LexiconItem[]>([]);
  const [isDefLoading, setIsDefLoading] = useState(false);
  // Temporary state to hold definition immediately after fetch to prevent flickering
  const [tempDefinition, setTempDefinition] = useState<string | null>(null);

  // --- 1. Compute Distribution & Bands ---
  const stats = useMemo(() => {
    const total = lexicon.length;
    if (total === 0) return { core: 0, essential: 0, niche: 0, known: 0, total: 0, processed: [] };

    // Heuristic: Top 15% Core, Next 45% Essential, Bottom 40% Niche
    const coreLimit = Math.ceil(total * 0.15);
    const essentialLimit = Math.ceil(total * 0.6); // Cumulative

    let known = 0;
    let counts = { core: 0, essential: 0, niche: 0 };
    
    const processed = lexicon.map((item, idx) => {
      let band: FrequencyBand = 'niche';
      if (idx < coreLimit) band = 'core';
      else if (idx < essentialLimit) band = 'essential';

      counts[band]++;
      if (item.familiarity >= Familiarity.Familiar) known++;
      
      return { ...item, band };
    });

    return {
      total,
      known,
      processed,
      counts
    };
  }, [lexicon]);

  // --- 2. Session Logic ---
  const startSession = () => {
    const filtered = stats.processed.filter(item => {
      if (studyFilter.band !== 'all' && item.band !== studyFilter.band) return false;
      if (studyFilter.status === 'new') return item.reviewCount === 0 && item.familiarity <= Familiarity.Seen;
      if (studyFilter.status === 'review') return item.reviewCount > 0 && item.familiarity < Familiarity.Mastered;
      if (studyFilter.status === 'mastered') return item.familiarity === Familiarity.Mastered;
      return true;
    });

    const queue = filtered.sort(() => Math.random() - 0.5).slice(0, 10);
    setSessionQueue(queue);
    setCurrentIndex(0);
    setIsFlipped(false);
    setTempDefinition(null);
    setMode('study');
  };

  const handleReveal = async () => {
    setIsFlipped(true);
    const currentItem = sessionQueue[currentIndex];
    
    // Reset temp definition
    setTempDefinition(null);

    // If no definition exists in data, generate one
    if (!currentItem.definition) {
      setIsDefLoading(true);
      try {
        const def = await onGenerateDefinition(currentItem.lemma);
        setTempDefinition(def); // Show immediately
        onUpdateLexicon(currentItem.lemma, { definition: def }); // Persist
      } catch (e) {
        setTempDefinition("**Error**: Could not generate definition.");
      } finally {
        setIsDefLoading(false);
      }
    }
  };

  const handleRate = (success: boolean) => {
    const currentItem = sessionQueue[currentIndex];
    let newFam = currentItem.familiarity;
    
    if (success) {
      if (newFam === Familiarity.Unknown) newFam = Familiarity.Seen;
      else if (newFam === Familiarity.Seen) newFam = Familiarity.Familiar;
      else if (newFam === Familiarity.Familiar) newFam = Familiarity.Mastered;
    } else {
      if (newFam > Familiarity.Seen) newFam = Familiarity.Seen;
    }

    onUpdateLexicon(currentItem.lemma, { 
      familiarity: newFam,
      reviewCount: currentItem.reviewCount + 1 
    });

    if (currentIndex < sessionQueue.length - 1) {
      setIsFlipped(false);
      setTempDefinition(null);
      setCurrentIndex(prev => prev + 1);
    } else {
      setMode('dashboard');
    }
  };

  // --- Render: Dashboard ---
  if (mode === 'dashboard') {
    const coverage = stats.total > 0 ? Math.round((stats.known / stats.total) * 100) : 0;
    
    return (
      <div className={`h-full flex flex-col font-sans animate-fade-in ${isExpanded ? 'pr-4' : ''}`}>
        
        {/* TOP SECTION: Stats & Controls */}
        <div className="flex-shrink-0">
            {/* Global Progress Bar */}
            <div className={`bg-gray-50 rounded-lg p-6 mb-8 text-center mt-2 ${isExpanded ? 'flex items-center justify-between text-left px-10 py-8' : ''}`}>
              <div className={isExpanded ? 'flex-1' : ''}>
                 <div className="flex items-baseline gap-2 justify-center lg:justify-start">
                    <span className="text-4xl font-display text-ink">{coverage}%</span>
                    <span className="text-xs text-gray-400 uppercase tracking-widest">Mastery</span>
                 </div>
                 {isExpanded && <p className="text-sm text-gray-500 mt-1 max-w-md">You have encountered {stats.total} unique words across this project.</p>}
              </div>

              <div className={`mt-4 lg:mt-0 ${isExpanded ? 'w-1/2' : 'w-full'}`}>
                 <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden flex">
                    <div className="h-full bg-ink transition-all duration-1000" style={{ width: `${coverage}%` }} />
                 </div>
                 
                 {/* Visual Distribution Bar (Core/Essential/Niche) */}
                 <div className="flex justify-between text-[9px] uppercase tracking-widest text-gray-400 mt-3">
                    <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-black/80"></div> Core ({stats.counts.core})</span>
                    <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-black/40"></div> Essential ({stats.counts.essential})</span>
                    <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-black/10"></div> Niche ({stats.counts.niche})</span>
                 </div>
              </div>
            </div>

            {/* Study Filters */}
            <div className={`space-y-6 ${isExpanded ? 'grid grid-cols-2 gap-8 space-y-0 mb-8' : ''}`}>
              {/* Frequency Band Selector */}
              <div>
                <label className="text-xs text-gray-500 mb-2 block">Difficulty (Band)</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['core', 'essential', 'niche'] as FrequencyBand[]).map(band => (
                    <button
                      key={band}
                      onClick={() => setStudyFilter(prev => ({ ...prev, band }))}
                      className={`
                        py-2 text-xs uppercase tracking-wider rounded border transition-all
                        ${studyFilter.band === band 
                          ? 'border-ink bg-ink text-white' 
                          : 'border-gray-200 text-gray-400 hover:border-gray-400'}
                      `}
                    >
                      {band}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status Selector */}
              <div>
                <label className="text-xs text-gray-500 mb-2 block">Queue Status</label>
                <div className="grid grid-cols-3 gap-2">
                   {(['new', 'review', 'mastered'] as const).map(s => (
                     <button
                        key={s}
                        onClick={() => setStudyFilter(prev => ({ ...prev, status: s }))}
                        className={`
                          py-2 text-xs uppercase tracking-wider rounded transition-colors
                          ${studyFilter.status === s 
                            ? 'bg-accent/10 text-accent font-bold border border-accent/20' 
                            : 'bg-gray-50 text-gray-400 hover:bg-gray-100 border border-transparent'}
                        `}
                     >
                       {s === 'review' ? 'Reviewing' : s}
                     </button>
                   ))}
                </div>
              </div>
            </div>

            {/* Start Button */}
            <div className="mt-6 mb-8">
               <button 
                 onClick={startSession}
                 className="w-full py-3 bg-accent hover:bg-accent-hover text-white text-sm font-medium uppercase tracking-widest transition-colors rounded shadow-soft flex items-center justify-center gap-2"
               >
                 <span>Start Session</span>
                 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                 </svg>
               </button>
            </div>
        </div>

        {/* BOTTOM SECTION: Word List (Scrollable) */}
        {isExpanded && (
          <div className="flex-1 overflow-hidden flex flex-col border-t border-gray-100 pt-6">
             <h3 className="text-sm font-bold uppercase tracking-widest text-gray-900 mb-4">Vocabulary Matrix</h3>
             <div className="flex-1 overflow-y-auto pr-2 no-scrollbar">
               <table className="w-full text-left border-collapse">
                 <thead className="sticky top-0 bg-paper z-10 text-[10px] uppercase tracking-widest text-gray-400">
                   <tr>
                     <th className="pb-3 font-normal">Lemma</th>
                     <th className="pb-3 font-normal">Freq</th>
                     <th className="pb-3 font-normal">Band</th>
                     <th className="pb-3 font-normal text-right">Status</th>
                   </tr>
                 </thead>
                 <tbody className="text-sm">
                   {stats.processed.map((item) => (
                     <tr key={item.lemma} className="border-b border-gray-50 hover:bg-gray-50 transition-colors group">
                       <td className="py-3 font-serif text-ink font-medium">{item.lemma}</td>
                       <td className="py-3 text-gray-400">{item.count}</td>
                       <td className="py-3">
                          <span className={`
                             text-[9px] uppercase tracking-wider px-2 py-1 rounded-full
                             ${item.band === 'core' ? 'bg-gray-100 text-gray-500' : 
                               item.band === 'essential' ? 'bg-accent/10 text-accent' : 'bg-orange-50 text-orange-400'}
                          `}>
                            {item.band}
                          </span>
                       </td>
                       <td className="py-3 text-right">
                          <div className="flex justify-end gap-1">
                             {[1,2,3].map(lvl => (
                                <div key={lvl} className={`w-1.5 h-1.5 rounded-full ${item.familiarity >= lvl ? 'bg-secondary' : 'bg-gray-200'}`} />
                             ))}
                          </div>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
          </div>
        )}
      </div>
    );
  }

  // --- Render: Study Session (Flashcard) ---
  if (sessionQueue.length === 0) {
     return (
        <div className="h-full flex flex-col items-center justify-center text-center">
           <p className="text-gray-400 font-serif italic mb-4">No words found for this filter.</p>
           <button onClick={() => setMode('dashboard')} className="text-xs uppercase tracking-widest text-ink border-b border-ink">Back to Dashboard</button>
        </div>
     );
  }

  const currentItem = sessionQueue[currentIndex];
  const occurrence = currentItem.occurrences[0] || { 
    sentenceText: "Context unavailable", 
    bookTitle: "Unknown", 
    wordText: currentItem.lemma,
    wordId: 'unknown'
  };

  const renderContext = () => {
    const parts = occurrence.sentenceText.split(new RegExp(`(${occurrence.wordText})`, 'gi'));
    return (
      <p className="font-serif text-lg leading-relaxed text-gray-700">
        {parts.map((part, i) => 
          part.toLowerCase() === occurrence.wordText.toLowerCase() 
            ? <span key={i} className="font-medium text-ink bg-secondary/20 px-1 rounded-sm">{part}</span> 
            : part
        )}
      </p>
    );
  };

  // Determine what definition to show: Temp (freshly fetched) or Persisted
  const displayDefinition = tempDefinition || currentItem.definition;

  return (
    <div className="h-full flex flex-col font-sans pt-4 animate-fade-in">
      <div className="flex justify-between items-baseline border-b border-gray-200 pb-2 mb-8">
        <button onClick={() => setMode('dashboard')} className="text-[10px] font-bold text-gray-400 hover:text-ink uppercase tracking-[0.2em] transition-colors">
          ← End Session
        </button>
        <span className="text-[10px] text-gray-400">
          {currentIndex + 1} / {sessionQueue.length}
        </span>
      </div>

      <div className="flex-1 flex flex-col relative perspective-1000 group">
        <div 
          onClick={() => !isFlipped && handleReveal()}
          className={`
            relative flex-1 w-full bg-white transition-all duration-700 transform-style-3d cursor-pointer shadow-soft hover:shadow-float rounded-sm border border-gray-50
            ${isFlipped ? 'rotate-y-180' : ''}
          `}
        >
           {/* FRONT: Context */}
           <div className={`absolute inset-0 flex flex-col justify-center items-center p-8 backface-hidden transition-all duration-300 ${isFlipped ? 'opacity-0' : 'opacity-100'}`}>
              <div className="flex-1 flex flex-col justify-center w-full">
                 <div className="text-[10px] text-accent uppercase tracking-widest mb-6 text-center">
                    {currentItem.reviewCount > 0 ? `Review #${currentItem.reviewCount}` : 'New Word'}
                 </div>
                 <h2 className="text-4xl md:text-5xl font-display font-medium text-ink mb-10 text-center">{currentItem.lemma}</h2>
                 <div className="text-center opacity-90 w-full">{renderContext()}</div>
              </div>
              <div className="mt-auto text-[10px] text-gray-300 uppercase tracking-widest pt-8">
                 Source: {occurrence.bookTitle}
              </div>
              <div className="absolute bottom-4 text-[10px] text-gray-300">Tap to reveal</div>
           </div>

           {/* BACK: Meaning (AI Native) */}
           <div className={`absolute inset-0 flex flex-col p-8 backface-hidden rotate-y-180 bg-paper transition-all duration-300 ${isFlipped ? 'opacity-100' : 'opacity-0'}`}>
              <div className="text-[10px] font-bold text-gray-300 uppercase tracking-[0.2em] mb-4 text-center">AI Definition</div>
              
              <div className="flex-1 flex flex-col items-center justify-center w-full max-w-md mx-auto">
                 <h2 className="text-3xl font-serif text-ink mb-6 text-center">{currentItem.lemma}</h2>
                 
                 <div className="text-base text-gray-600 font-serif leading-relaxed w-full overflow-y-auto max-h-[250px] text-center">
                    {displayDefinition ? (
                       <ReactMarkdown>{displayDefinition}</ReactMarkdown>
                    ) : (
                       isDefLoading ? (
                          /* AI Skeleton Loader */
                          <div className="w-full max-w-xs mx-auto">
                             <SkeletonLoader lines={4} />
                             <p className="text-[10px] text-accent uppercase tracking-widest mt-4 animate-pulse text-center">Generating...</p>
                          </div>
                       ) : (
                          <span className="text-gray-400 text-sm">Definition not available</span>
                       )
                    )}
                 </div>
              </div>

              <div className="w-8 h-px bg-gray-200 my-6 mx-auto"></div>
              <div className="flex flex-col gap-2 items-center pb-4">
                  <div className="flex gap-1">
                      {[1,2,3].map(lvl => (
                          <div key={lvl} className={`w-2 h-2 rounded-full ${currentItem.familiarity >= lvl ? 'bg-secondary' : 'bg-gray-200'}`} />
                      ))}
                  </div>
              </div>
           </div>
        </div>
      </div>

      <div className="h-24 flex items-center justify-center gap-6 mt-6">
        {isFlipped ? (
          <>
            <button 
              onClick={() => handleRate(false)}
              className="w-12 h-12 rounded-full border border-gray-200 text-gray-400 hover:border-accent hover:text-accent transition-all flex items-center justify-center bg-white"
              title="Still learning"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <button 
              onClick={() => handleRate(true)}
              className="w-16 h-16 rounded-full bg-ink text-white shadow-lg hover:bg-black hover:scale-105 transition-all flex items-center justify-center"
              title="I know this"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </button>
          </>
        ) : (
          <button 
            onClick={handleReveal}
            className="text-xs text-gray-400 hover:text-ink uppercase tracking-[0.2em] transition-colors py-4 px-8 border border-transparent hover:border-gray-200 rounded"
          >
            Reveal Definition
          </button>
        )}
      </div>
    </div>
  );
};

export default LexisDeck;