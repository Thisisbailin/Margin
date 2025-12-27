import React, { useState } from 'react';
import { AssessmentWord, UserProficiency } from '../types';

interface ProficiencyModalProps {
  isOpen: boolean;
  onComplete: (level: UserProficiency) => void;
}

// Mock extraction from the book text (In reality, Agent would pick these)
const SAMPLE_TEST_WORDS: AssessmentWord[] = [
  { word: 'Spectator', difficulty: 'easy', context: 'In this economy, even spectators are transformed into workers.' },
  { word: 'Derivative', difficulty: 'medium', context: 'Cinema and its derivatives are factories.' },
  { word: 'Taylorist', difficulty: 'hard', context: 'Integrated the logic of Taylorist production.' },
  { word: 'Aesthetic', difficulty: 'medium', context: 'Capitalize upon the aesthetic faculties.' },
  { word: 'Drafted', difficulty: 'hard', context: 'The senses are drafted into production (conscription implication).' },
];

const ProficiencyModal: React.FC<ProficiencyModalProps> = ({ isOpen, onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [score, setScore] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  if (!isOpen) return null;

  const handleResponse = (knowsIt: boolean) => {
    let point = 0;
    if (knowsIt) {
      const difficulty = SAMPLE_TEST_WORDS[currentStep].difficulty;
      point = difficulty === 'hard' ? 3 : difficulty === 'medium' ? 2 : 1;
    }
    
    const newScore = score + point;
    setScore(newScore);

    if (currentStep < SAMPLE_TEST_WORDS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      finishTest(newScore);
    }
  };

  const finishTest = (finalScore: number) => {
    setIsAnalyzing(true);
    // Simple mock algorithm
    // Max score approx 11-12. 
    // < 4: Beginner
    // 4 - 8: Intermediate
    // > 8: Advanced
    setTimeout(() => {
      let level = UserProficiency.Beginner;
      if (finalScore > 8) level = UserProficiency.Advanced;
      else if (finalScore >= 4) level = UserProficiency.Intermediate;
      
      onComplete(level);
      setIsAnalyzing(false);
    }, 1500); // Fake analysis delay
  };

  if (isAnalyzing) {
    return (
      <div className="fixed inset-0 z-[100] bg-white/90 backdrop-blur-md flex flex-col items-center justify-center p-6 animate-fade-in">
        <div className="w-12 h-12 border-4 border-gray-200 border-t-black rounded-full animate-spin mb-4" />
        <h2 className="text-xl font-serif text-ink">Analyzing your lexicon...</h2>
        <p className="text-gray-500 mt-2">Configuring the Margin Agent to match your reading depth.</p>
      </div>
    );
  }

  const currentWord = SAMPLE_TEST_WORDS[currentStep];

  return (
    <div className="fixed inset-0 z-[100] bg-ink/10 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white w-full max-w-md p-8 rounded-lg shadow-2xl border border-gray-100">
        <div className="flex justify-between items-center mb-8">
          <span className="text-xs font-bold text-gray-300 uppercase tracking-widest">
            Calibration ({currentStep + 1}/{SAMPLE_TEST_WORDS.length})
          </span>
          <span className="text-xs text-gray-300">Margin Lexis</span>
        </div>

        <div className="text-center mb-10">
          <h2 className="text-4xl font-serif font-bold text-ink mb-4">
            {currentWord.word}
          </h2>
          <p className="text-gray-500 text-sm leading-relaxed italic">
            "{currentWord.context}"
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => handleResponse(false)}
            className="py-4 border border-gray-200 text-gray-600 rounded hover:bg-gray-50 transition-colors text-sm font-medium"
          >
            Unknown
          </button>
          <button
            onClick={() => handleResponse(true)}
            className="py-4 bg-ink text-white rounded hover:bg-gray-800 transition-colors text-sm font-medium"
          >
            I know this
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProficiencyModal;
