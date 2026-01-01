
import React from 'react';
import { WordOccurrence } from '../types';

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
  
  const mastery = token.masteryScore || 0;

  const getTokenStyle = () => {
    if (isZenMode) return 'text-ink/90'; 

    if (!isSentenceFocused) {
      // 未聚焦时，根据掌握程度调整透明度。掌握度越高，越不显眼。
      const opacity = Math.max(0.15, 0.4 - (mastery * 0.25));
      return `text-ink/40 transition-all duration-700`;
    }

    // 聚焦时的样式
    if (mastery < 0.3) {
      // 生疏词：虚线强调
      return 'text-ink border-b border-accent/30 border-dotted';
    } else if (mastery > 0.8) {
      // 熟词：淡化显示，减少认知负荷
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
      {token.text}
    </span>
  );
};

export default ReaderToken;
