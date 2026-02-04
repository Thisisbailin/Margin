import React from 'react';
import { Token } from '../types';

interface ReaderTokenProps {
  token: Token;
  masteryScore: number;
  onClick: (token: Token) => void;
  isActive: boolean;
  isSentenceFocused: boolean;
  isZenMode: boolean;
}

const ReaderToken: React.FC<ReaderTokenProps> = ({
  token,
  masteryScore,
  onClick,
  isActive,
  isSentenceFocused,
  isZenMode
}) => {
  const mastery = masteryScore || 0;

  const getTokenStyle = () => {
    if (isZenMode) return 'text-ink/90';

    if (!isSentenceFocused) {
      const opacity = Math.max(0.15, 0.4 - mastery * 0.25);
      return `text-ink/40 transition-all duration-700`;
    }

    if (mastery < 0.3) {
      return 'text-ink border-b border-accent/30 border-dotted';
    }
    if (mastery > 0.8) {
      return 'text-ink/60';
    }
    return 'text-ink';
  };

  const interactionStyle = isActive
    ? 'bg-secondary/20 text-ink rounded-sm -mx-0.5 px-0.5'
    : isSentenceFocused
    ? 'hover:bg-black/5 rounded-sm transition-colors'
    : '';

  return (
    <span
      onClick={(e) => {
        if (isZenMode) return;
        e.stopPropagation();
        onClick(token);
      }}
      className={`
        inline-block transition-all duration-500 font-serif
        cursor-pointer
        ${getTokenStyle()}
        ${interactionStyle}
      `}
      style={{
        opacity: isSentenceFocused ? 1 : Math.max(0.2, 0.5 - mastery * 0.3)
      }}
    >
      {token.surface}
    </span>
  );
};

export default ReaderToken;
