import React, { useState, useMemo } from 'react';
import { Project, WordOccurrence, Familiarity, Sentence } from '../types';

interface LexisDeckProps {
  project: Project;
  onUpdateFamiliarity: (wordLemma: string, newFam: Familiarity) => void;
}

interface Flashcard {
  lemma: string;
  contextSentence: string;
  wordOccurrence: WordOccurrence;
  translation?: string;
  bookTitle: string;
}

const LexisDeck: React.FC<LexisDeckProps> = ({ project, onUpdateFamiliarity }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);

  // Logic remains same, mostly styling update
  const cards = useMemo(() => {
    const learningCards: Flashcard[] = [];
    const seenLemmas = new Set<string>();

    project.books.forEach(book => {
      book.content.forEach(sentence => {
        sentence.tokens.forEach(token => {
          if (
            token.familiarity !== Familiarity.Mastered && 
            !seenLemmas.has(token.lemma) &&
            token.text.length > 3 
          ) {
            seenLemmas.add(token.lemma);
            learningCards.push({
              lemma: token.lemma,
              contextSentence: sentence.text,
              wordOccurrence: token,
              translation: token.translation || "Meaning inferred from context...",
              bookTitle: book.title
            });
          }
        });
      });
    });
    return learningCards.sort(() => Math.random() - 0.5).slice(0, 15);
  }, [project]);

  const handleRate = (success: boolean) => {
    const currentCard = cards[currentIndex];
    let newFam = currentCard.wordOccurrence.familiarity;
    if (success) {
      if (newFam === Familiarity.Unknown) newFam = Familiarity.Seen;
      else if (newFam === Familiarity.Seen) newFam = Familiarity.Familiar;
      else if (newFam === Familiarity.Familiar) newFam = Familiarity.Mastered;
    } else {
      if (newFam === Familiarity.Familiar) newFam = Familiarity.Seen;
    }
    onUpdateFamiliarity(currentCard.lemma, newFam);
    if (currentIndex < cards.length - 1) {
      setIsFlipped(false);
      setCurrentIndex(prev => prev + 1);
    } else {
      setSessionComplete(true);
    }
  };

  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6">
        <p className="font-serif italic text-gray-400">The Lexis deck is empty.</p>
        <p className="text-[10px] uppercase tracking-widest text-gray-300 mt-4">Read to collect words</p>
      </div>
    );
  }

  if (sessionComplete) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center animate-fade-in">
        <div className="text-4xl mb-4">✦</div>
        <h3 className="text-2xl font-display text-ink">Session Complete</h3>
        <p className="text-sm font-serif text-gray-500 mt-2 italic">Refining memory through context.</p>
        <button 
          onClick={() => { setSessionComplete(false); setCurrentIndex(0); }}
          className="mt-8 px-6 py-2 border border-ink text-ink text-xs uppercase tracking-widest hover:bg-ink hover:text-white transition-colors"
        >
          Review Again
        </button>
      </div>
    );
  }

  const card = cards[currentIndex];

  const renderContext = () => {
    const parts = card.contextSentence.split(new RegExp(`(${card.wordOccurrence.text})`, 'gi'));
    return (
      <p className="font-serif text-lg leading-relaxed text-gray-700">
        {parts.map((part, i) => 
          part.toLowerCase() === card.wordOccurrence.text.toLowerCase() 
            ? <span key={i} className="font-medium text-ink border-b border-accent/50">{part}</span> 
            : part
        )}
      </p>
    );
  };

  return (
    <div className="h-full flex flex-col font-sans pt-4">
      <div className="flex justify-between items-baseline border-b border-gray-200 pb-2 mb-8">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">
          Lexis
        </span>
        <span className="text-[10px] text-gray-400">
          {currentIndex + 1} / {cards.length}
        </span>
      </div>

      <div className="flex-1 flex flex-col relative perspective-1000 group">
        <div 
          onClick={() => setIsFlipped(!isFlipped)}
          className={`
            relative flex-1 w-full bg-white transition-all duration-700 transform-style-3d cursor-pointer shadow-soft hover:shadow-lg rounded-sm
            ${isFlipped ? 'rotate-y-180' : ''}
          `}
        >
           {/* FRONT: Context Centric */}
           <div className={`absolute inset-0 flex flex-col justify-center items-center p-10 backface-hidden transition-all duration-300 ${isFlipped ? 'opacity-0' : 'opacity-100'}`}>
              <div className="flex-1 flex flex-col justify-center">
                 <h2 className="text-5xl font-display font-medium text-ink mb-12 text-center">{card.lemma}</h2>
                 <div className="text-center opacity-80">{renderContext()}</div>
              </div>
              <div className="mt-auto text-[10px] text-gray-300 uppercase tracking-widest pt-8">
                 From: {card.bookTitle}
              </div>
           </div>

           {/* BACK: Definition & POS */}
           <div className={`absolute inset-0 flex flex-col justify-center items-center p-10 backface-hidden rotate-y-180 bg-paper transition-all duration-300 ${isFlipped ? 'opacity-100' : 'opacity-0'}`}>
              <div className="text-[10px] font-bold text-accent uppercase tracking-[0.2em] mb-4">Definition</div>
              <h2 className="text-3xl font-serif text-ink mb-8 text-center">{card.lemma}</h2>
              <p className="text-lg text-gray-600 italic font-serif text-center max-w-xs">{card.translation}</p>
              <div className="w-8 h-px bg-gray-200 my-8"></div>
              <div className="text-xs text-gray-400 font-sans uppercase tracking-widest">{card.wordOccurrence.pos}</div>
           </div>
        </div>
      </div>

      {/* Elegant Controls */}
      <div className="h-24 flex items-center justify-center gap-6 mt-6">
        {isFlipped ? (
          <>
            <button 
              onClick={() => handleRate(false)}
              className="w-12 h-12 rounded-full border border-gray-200 text-gray-400 hover:border-gray-400 hover:text-ink transition-all flex items-center justify-center"
              title="Still learning"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <button 
              onClick={() => handleRate(true)}
              className="w-16 h-16 rounded-full bg-ink text-white shadow-lg hover:scale-105 transition-all flex items-center justify-center"
              title="Mastered"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </button>
          </>
        ) : (
          <button 
            onClick={() => setIsFlipped(true)}
            className="text-xs text-gray-400 hover:text-ink uppercase tracking-[0.2em] transition-colors py-4"
          >
            Reveal
          </button>
        )}
      </div>
    </div>
  );
};

export default LexisDeck;