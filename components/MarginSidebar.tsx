
import React from 'react';
import ReactMarkdown from 'react-markdown';
import { AgentMessage, UserProficiency } from '../types';
import SkeletonLoader from './SkeletonLoader';

interface MarginSidebarProps {
  messages: AgentMessage[];
  isLoading: boolean;
  proficiency: UserProficiency;
}

const MarginSidebar: React.FC<MarginSidebarProps> = ({ 
  messages, 
  isLoading, 
  proficiency,
}) => {
  
  return (
    <div className="h-full flex flex-col font-sans">
      
      {/* Content Area */}
      <div className="flex-1 space-y-12 pb-12">
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-96 text-gray-300 text-center px-6">
            <span className="text-4xl font-display italic opacity-10 mb-6">Margin</span>
            <p className="text-sm font-serif italic text-gray-400">
              Annotating your cognitive terrain...
            </p>
          </div>
        )}

        {messages.map((msg, index) => (
          <div key={msg.id} className="animate-fade-in-up group relative pl-5 border-l border-transparent hover:border-accent/10 transition-colors">
            {/* Role Indicator */}
            {msg.role === 'agent' && (
               <div className="absolute -left-[1px] top-1.5 w-[2px] h-[10px] bg-accent rounded-full" />
            )}

            <div className="mb-3 flex items-baseline justify-between">
              <span className={`text-[9px] font-bold uppercase tracking-[0.2em] ${msg.role === 'agent' ? 'text-accent' : 'text-faded'}`}>
                {msg.role === 'agent' ? 'Synthesis' : 'Inquiry'}
              </span>
            </div>

            <div className={`
              prose prose-sm max-w-none 
              ${msg.role === 'agent' 
                ? 'font-serif text-ink/80 text-[15px] leading-relaxed' 
                : 'font-sans text-faded italic text-[13px]'}
            `}>
              {msg.role === 'agent' ? (
                msg.content ? (
                   <ReactMarkdown>{msg.content}</ReactMarkdown>
                ) : (
                   <SkeletonLoader className="mt-2" />
                )
              ) : (
                msg.content
              )}
            </div>
            
            {index < messages.length - 1 && messages[index+1].role === 'user' && (
              <div className="w-6 h-px bg-black/5 mt-10 mb-2" />
            )}
          </div>
        ))}

        {isLoading && messages.length > 0 && messages[messages.length-1].role === 'user' && (
           <div className="pl-5 mt-6">
             <div className="text-[9px] text-faded animate-pulse uppercase tracking-[0.3em]">Processing...</div>
           </div>
        )}
      </div>
    </div>
  );
};

export default MarginSidebar;
