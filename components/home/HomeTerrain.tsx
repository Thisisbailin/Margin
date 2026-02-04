import React from 'react';
import { LexemeEntry, LexemeStat } from '../../types';
import TerrainMap from '../TerrainMap';

interface HomeTerrainProps {
  projectLexicon: LexemeEntry[];
  readingProgress: number;
  recordInteraction: (lemma: string, type: 'implicit' | 'explicit', weight: number, occurrenceId?: string) => void;
  updateLexeme: (lemma: string, updates: Partial<LexemeStat>) => void;
}

const HomeTerrain: React.FC<HomeTerrainProps> = ({
  projectLexicon,
  readingProgress,
  recordInteraction,
  updateLexeme
}) => {
  return (
    <div className="flex-1 flex flex-col mb-4 overflow-hidden animate-fade-in">
      <TerrainMap
        lexicon={projectLexicon}
        bookProgress={readingProgress}
        onUpdateLexicon={updateLexeme}
        onReviewLemma={(lemma) => recordInteraction(lemma, 'explicit', 0.5)}
        onNavigateToContext={() => {}}
        isExpanded={true}
      />
    </div>
  );
};

export default HomeTerrain;
