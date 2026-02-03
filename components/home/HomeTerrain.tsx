import React from 'react';
import { LexiconItem } from '../../types';
import TerrainMap from '../TerrainMap';

interface HomeTerrainProps {
  projectLexicon: LexiconItem[];
  readingProgress: number;
  recordInteraction: (lemma: string, type: 'implicit' | 'explicit', weight: number, occurrenceId: string) => void;
  generateWordDefinition: (word: string) => Promise<string>;
}

const HomeTerrain: React.FC<HomeTerrainProps> = ({
  projectLexicon,
  readingProgress,
  recordInteraction,
  generateWordDefinition
}) => {
  return (
    <div className="flex-1 flex flex-col mb-4 overflow-hidden animate-fade-in">
      <TerrainMap
        lexicon={projectLexicon}
        bookProgress={readingProgress}
        onUpdateLexicon={(lemma, _updates) => recordInteraction(lemma, 'explicit', 0.5, 'deck-review')}
        onGenerateDefinition={generateWordDefinition}
        onNavigateToContext={() => {}}
        isExpanded={true}
      />
    </div>
  );
};

export default HomeTerrain;
