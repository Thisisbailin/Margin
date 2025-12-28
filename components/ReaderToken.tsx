
import React from 'react';
import { Familiarity, WordOccurrence } from '../types';

interface ReaderTokenProps {
  token: WordOccurrence;
  onClick: (token: WordOccurrence) => void;
  isActive: boolean;
  isSentenceFocused: boolean;
  isZenMode: boolean; 
}

const ReaderToken: React.FC<ReaderTokenProps> = ({ 
  token, 
  onClick, 
  isActive, 
  isSentenceFocused, 
  isZenMode 
}) => {
  
  const getTokenStyle = () => {
    if (isZenMode) return 'text-ink/90 cursor-text transition-colors duration-500'; 

    if (!isSentenceFocused) {
      return 'text-gray-300 blur-[0.25px] transition-all duration-700 ease-in-out cursor-pointer hover:text-gray-400';
    }

    switch (token.familiarity) {
      case Familiarity.Unknown:
        return 'text-ink decoration-1 underline-offset-4 decoration-accent/40 hover:decoration-accent decoration-dotted cursor-help';
      case Familiarity.Seen:
        return 'text-gray-800 cursor-pointer';
      case Familiarity.Familiar:
      case Familiarity.Mastered:
        return 'text-gray-600 cursor-pointer';
      default:
        return 'text-ink';
    }
  };

  const interactionStyle = (!isZenMode && isActive)
    ? 'bg-secondary/30 text-ink rounded-sm -mx-1 px-1 shadow-[0_0_0_1px_rgba(168,201,168,0.4)]' 
    : (!isZenMode && isSentenceFocused) 
      ? 'hover:text-ink hover:bg-black/5 -mx-1 px-1 rounded-sm transition-colors duration-200'
      : '';

  return (
    <span
      onClick={(e) => {
        if (isZenMode) {
          e.stopPropagation(); 
          return;
        }
        e.stopPropagation();
        onClick(token);
      }}
      className={`
        inline-block my-0.5
        font-serif text-[1.25rem] leading-[1.8] md:text-[1.35rem] md:leading-[1.9] tracking-wide
        transition-all duration-500 ease-out
        ${getTokenStyle()} 
        ${interactionStyle}
      `}
    >
      {token.text}
    </span>
  );
};

export default ReaderToken;
