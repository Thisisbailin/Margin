import React, { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { LexiconItem, Familiarity, StudyFilter, FrequencyBand, VocabularyStat } from '../types';
import SkeletonLoader from './SkeletonLoader';

interface LexisDeckProps {
  lexicon: LexiconItem[]; // Aggregated project vocabulary
  onUpdateLexicon: (lemma: string, updates: Partial<VocabularyStat>) => void;
  onGenerateDefinition: (word: string) => Promise<string>;
  onNavigateToContext: (bookId: string, sentenceId: string, wordId: string) => void;
  isExpanded?: boolean; 
  bookCount?: number;
}

type Mode = 'dashboard' | 'study';

const LexisDeck: React.FC<LexisDeckProps> = ({ 
  lexicon, 
  onUpdateLexicon, 
  onGenerateDefinition,
  onNavigateToContext,
  isExpanded = false,
  bookCount = 0
}) => {
  const [mode, setMode] = useState<Mode>('dashboard');
  const [studyFilter, setStudyFilter] = useState<StudyFilter>({ band: 'core', status: 'new' });
  
  // Flashcard State
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [sessionQueue, setSessionQueue] = useState<LexiconItem[]>([]);
  const [isDefLoading, setIsDefLoading] = useState(false);
  const [tempDefinition, setTempDefinition] = useState<string | null>(null);

  // --- 1. Compute Stats ---
  const stats = useMemo(() => {
    const total = lexicon.length;
    if (total === 0) return { core: 0, essential: 0, niche: 0, known: 0, total: 0, processed: [] };

    const coreLimit = Math.ceil(total * 0.15);
    const essentialLimit = Math.ceil(total * 0.6);

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

    return { total, known, processed, counts };
  }, [lexicon]);

  // --- 2. Session Controls ---
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
    setTempDefinition(null);

    if (!currentItem.definition) {
      setIsDefLoading(true);
      try {
        const def = await onGenerateDefinition(currentItem.lemma);
        setTempDefinition(def);
        onUpdateLexicon(currentItem.lemma, { definition: def });
      } catch (e) {
        setTempDefinition("**Error**: Failed to generate definition.");
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

    onUpdateLexicon(currentItem.lemma, { familiarity: newFam, reviewCount: currentItem.reviewCount + 1 });

    if (currentIndex < sessionQueue.length - 1) {
      setIsFlipped(false);
      setTempDefinition(null);
      setCurrentIndex(prev => prev + 1);
    } else {
      setMode('dashboard');
    }
  };

  // --- Dashboard Components ---
  if (mode === 'dashboard') {
    const coverage = stats.total > 0 ? Math.round((stats.known / stats.total) * 100) : 0;
    
    if (isExpanded) {
      return (
        <div className="h-full flex flex-col md:flex-row gap-20 animate-fade-in no-scrollbar overflow-hidden">
          {/* LEFT: Project Overview & Stats */}
          <div className="w-full md:w-[350px] flex-shrink-0 flex flex-col pt-4">
             <div className="mb-16">
                <div className="text-[10px] font-bold uppercase tracking-[0.4em] text-gray-300 mb-6">Aggregate Mastery</div>
                <div className="flex items-baseline gap-4 mb-8">
                   <span className="text-7xl font-display text-ink tracking-tighter">{coverage}%</span>
                   <span className="text-sm font-serif italic text-gray-400">Project Coverage</span>
                </div>
                <div className="relative h-1 w-full bg-gray-100 rounded-full overflow-hidden mb-12">
                   <div className="absolute top-0 left-0 h-full bg-accent transition-all duration-1000" style={{ width: `${coverage}%` }} />
                </div>
                <p className="text-base text-gray-500 font-serif leading-relaxed italic pr-4">
                  "Linguistic mapping across {bookCount} texts. Focus shifts to high-frequency core lexicon."
                </p>
             </div>

             <div className="space-y-12">
                <div>
                   <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-400 mb-6 block">Band Selector</label>
                   <div className="flex flex-wrap gap-3">
                      {(['core', 'essential', 'niche'] as FrequencyBand[]).map(band => (
                        <button 
                          key={band} 
                          onClick={() => setStudyFilter(prev => ({ ...prev, band }))}
                          className={`
                            px-5 py-2 text-[10px] uppercase tracking-[0.2em] font-bold rounded-full transition-all border-2
                            ${studyFilter.band === band ? 'bg-ink border-ink text-white' : 'bg-transparent border-gray-100 text-gray-400 hover:border-gray-300'}
                          `}
                        >
                          {band}
                        </button>
                      ))}
                   </div>
                </div>

                <div>
                   <label className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-400 mb-6 block">Filter Queue</label>
                   <div className="flex flex-wrap gap-3">
                      {(['new', 'review', 'mastered'] as const).map(s => (
                        <button 
                          key={s} 
                          onClick={() => setStudyFilter(prev => ({ ...prev, status: s }))}
                          className={`
                            px-5 py-2 text-[10px] uppercase tracking-[0.2em] font-bold rounded-full transition-all border-2
                            ${studyFilter.status === s ? 'bg-secondary border-secondary text-ink' : 'bg-transparent border-gray-100 text-gray-400 hover:border-gray-300'}
                          `}
                        >
                          {s}
                        </button>
                      ))}
                   </div>
                </div>

                <div className="pt-8">
                   <button 
                    onClick={startSession} 
                    className="w-full py-5 bg-ink hover:bg-black text-white text-[11px] font-bold uppercase tracking-[0.4em] transition-all transform hover:-translate-y-1 rounded shadow-float flex items-center justify-center gap-4"
                   >
                     Initiate Session
                     <span className="opacity-40 tracking-normal text-xs font-mono">→</span>
                   </button>
                </div>
             </div>
          </div>

          {/* RIGHT: Large Vocabulary Matrix */}
          <div className="flex-1 flex flex-col min-h-0 pt-4">
             <div className="flex justify-between items-baseline mb-12 border-b border-black/5 pb-4">
                <h3 className="text-xs font-bold uppercase tracking-[0.5em] text-gray-900">Vocabulary Matrix</h3>
                <span className="text-[10px] text-gray-300 italic font-serif">Project-wide distribution index</span>
             </div>
             
             <div className="flex-1 overflow-y-auto pr-6 no-scrollbar pb-20">
               <table className="w-full text-left">
                 <thead>
                   <tr className="text-[10px] uppercase tracking-[0.3em] text-gray-300">
                     <th className="pb-8 font-bold w-1/3">Lemma</th>
                     <th className="pb-8 font-bold">Encounters</th>
                     <th className="pb-8 font-bold">Context Band</th>
                     <th className="pb-8 font-bold text-right">Progress</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-50">
                   {stats.processed.map((item) => (
                     <tr key={item.lemma} className="group hover:bg-surface/30 transition-colors">
                       <td className="py-10">
                          <div className="font-serif text-3xl text-ink font-medium tracking-tight group-hover:text-accent transition-colors">{item.lemma}</div>
                          <div className="text-[10px] text-gray-300 uppercase tracking-widest mt-2">{item.reviewCount} manual synthesis attempts</div>
                       </td>
                       <td className="py-10 text-gray-400 font-mono text-base">{item.count}</td>
                       <td className="py-10">
                          <span className={`text-[10px] font-bold uppercase tracking-widest px-4 py-1.5 rounded-full border-2 ${item.band === 'core' ? 'bg-ink text-white border-ink' : item.band === 'essential' ? 'bg-transparent text-gray-400 border-gray-100' : 'bg-transparent text-gray-300 border-gray-50'}`}>
                            {item.band}
                          </span>
                       </td>
                       <td className="py-10 text-right">
                          <div className="flex justify-end gap-3">
                             {[1,2,3].map(lvl => (
                                <div key={lvl} className={`w-3.5 h-3.5 rounded-full transition-all duration-700 ${item.familiarity >= lvl ? 'bg-secondary' : 'bg-gray-100'}`} />
                             ))}
                          </div>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
          </div>
        </div>
      );
    }

    // Default Sidebar View
    return (
      <div className="h-full flex flex-col font-sans animate-fade-in">
        <div className="bg-surface rounded-lg p-6 mb-8 text-center border border-black/5">
           <div className="text-4xl font-display text-ink mb-2">{coverage}%</div>
           <div className="text-[9px] uppercase tracking-[0.2em] text-gray-400">Synthesis Score</div>
        </div>
        <div className="mt-auto mb-10">
           <button onClick={startSession} className="w-full py-4 bg-accent text-white text-[10px] font-bold uppercase tracking-[0.2em] rounded shadow-soft">
             Launch Session
           </button>
        </div>
      </div>
    );
  }

  // --- FLASHCARD SESSION VIEW ---
  const currentItem = sessionQueue[currentIndex];
  
  return (
    <div className="h-full flex flex-col font-sans pt-0 animate-fade-in overflow-hidden max-w-4xl mx-auto w-full">
      <div className="flex justify-between items-baseline border-b border-black/5 pb-6 mb-12 flex-shrink-0">
        <button onClick={() => setMode('dashboard')} className="group flex items-center gap-4 text-[11px] font-bold text-gray-400 hover:text-ink uppercase tracking-[0.3em] transition-colors">
          <span className="group-hover:-translate-x-1 transition-transform">←</span>
          Exit Terminal
        </button>
        <div className="text-[11px] text-gray-400 font-mono tracking-[0.2em]">{currentIndex + 1} / {sessionQueue.length} Queue</div>
      </div>

      <div className="flex-1 flex flex-col relative perspective-2000">
        <div 
          onClick={() => !isFlipped && handleReveal()}
          className={`relative flex-1 w-full bg-white transition-all duration-1000 transform-style-3d cursor-pointer shadow-float rounded-2xl border border-black/5 ${isFlipped ? 'rotate-y-180' : ''}`}
        >
           {/* Front: Encounter Context */}
           <div className={`absolute inset-0 flex flex-col justify-center items-center p-16 backface-hidden transition-all duration-500 ${isFlipped ? 'opacity-0' : 'opacity-100'}`}>
              <div className="text-[11px] text-accent uppercase tracking-[0.5em] mb-12 font-bold">{currentItem.reviewCount > 0 ? `Recurring Encounter (${currentItem.reviewCount})` : 'New Recognition'}</div>
              <h2 className="text-7xl md:text-8xl font-display font-medium text-ink mb-20 text-center tracking-tight leading-none">{currentItem.lemma}</h2>
              <div className="text-center italic font-serif text-2xl text-gray-500 leading-[1.8] max-w-2xl px-8 opacity-90">
                 "{currentItem.occurrences[0]?.sentenceText}"
              </div>
              <div className="mt-20 text-[10px] text-gray-300 uppercase tracking-[0.6em] border-t border-black/5 pt-10 w-full text-center animate-pulse">凝视以解构 (Gaze to decode)</div>
           </div>

           {/* Back: Deep Interpretation */}
           <div className={`absolute inset-0 flex flex-col p-16 backface-hidden rotate-y-180 bg-paper transition-all duration-500 ${isFlipped ? 'opacity-100' : 'opacity-0'} overflow-hidden rounded-2xl`}>
              <div className="flex-1 flex flex-col min-h-0">
                 <div className="text-center mb-16">
                    <h2 className="text-5xl font-display font-medium text-ink">{currentItem.lemma}</h2>
                    <div className="h-0.5 w-20 bg-accent/30 mx-auto mt-8"></div>
                 </div>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-20 flex-1 min-h-0">
                    <div className="flex flex-col overflow-y-auto no-scrollbar">
                       <h4 className="text-[11px] font-bold uppercase tracking-[0.4em] text-gray-400 mb-10 border-b border-black/5 pb-3">AI Synthesis</h4>
                       <div className="prose prose-sm font-serif text-gray-800 text-xl leading-[1.7]">
                          {tempDefinition || currentItem.definition ? (
                             <ReactMarkdown>{tempDefinition || currentItem.definition || ''}</ReactMarkdown>
                          ) : isDefLoading ? (
                             <SkeletonLoader lines={10} className="opacity-40" />
                          ) : (
                             <p className="text-lg italic text-gray-400">Seeking linguistic root...</p>
                          )}
                       </div>
                    </div>

                    <div className="flex flex-col overflow-y-auto no-scrollbar border-l border-black/5 pl-16">
                       <h4 className="text-[11px] font-bold uppercase tracking-[0.4em] text-gray-400 mb-10 border-b border-black/5 pb-3">Project Trace</h4>
                       <div className="space-y-10">
                          {currentItem.occurrences.map((occ, idx) => (
                             <div key={idx} className="group/occ">
                                <p className="text-xl font-serif leading-relaxed text-gray-400 line-clamp-3 italic group-hover:text-gray-600 transition-colors">
                                   "{occ.sentenceText}"
                                </p>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onNavigateToContext(occ.bookId, occ.sentenceId, occ.wordId);
                                  }}
                                  className="mt-4 text-[11px] text-accent hover:text-ink font-bold uppercase tracking-[0.3em] opacity-0 group-hover/occ:opacity-100 transition-all flex items-center gap-2"
                                >
                                   Return to Context <span>→</span>
                                </button>
                             </div>
                          ))}
                       </div>
                    </div>
                 </div>
              </div>

              <div className="mt-12 pt-10 border-t border-black/5 flex justify-center gap-4 flex-shrink-0">
                  {[1,2,3].map(lvl => (
                      <div key={lvl} className={`w-3.5 h-3.5 rounded-full transition-all duration-700 ${currentItem.familiarity >= lvl ? 'bg-secondary' : 'bg-gray-100'}`} />
                  ))}
              </div>
           </div>
        </div>
      </div>

      <div className="h-32 flex items-center justify-center gap-16 mt-12 flex-shrink-0">
        {isFlipped ? (
          <>
            <button onClick={() => handleRate(false)} className="group w-20 h-20 rounded-full border border-gray-100 text-gray-300 hover:border-accent hover:text-accent transition-all flex items-center justify-center bg-white shadow-soft">
               <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 group-hover:scale-90 transition-transform"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <button onClick={() => handleRate(true)} className="group w-24 h-24 rounded-full bg-ink text-white shadow-float hover:bg-black hover:scale-110 transition-all flex items-center justify-center">
               <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-12 h-12 group-hover:scale-110 transition-transform"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
            </button>
          </>
        ) : (
          <div className="text-[11px] text-gray-300 uppercase tracking-[0.6em] animate-pulse">Intent required to deconstruct</div>
        )}
      </div>
    </div>
  );
};

export default LexisDeck;