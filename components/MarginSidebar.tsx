import React from 'react';
import ReactMarkdown from 'react-markdown';
import { AgentMessage, UserProficiency } from '../types';

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
    <div className="h-full flex flex-col font-sans pt-4">
      
      {/* Header */}
      <div className="mb-8 flex items-baseline justify-between border-b border-gray-200 pb-2">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">
          Margin Notes
        </span>
        <span className="text-[10px] text-gray-400 uppercase tracking-widest">
           {proficiency === UserProficiency.Advanced ? 'Deep Read' : 'Analysis'}
        </span>
      </div>

      {/* Content Area */}
      <div className="flex-1 space-y-10 pb-10">
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-64 text-gray-300 text-center px-6">
            <span className="text-4xl font-display italic opacity-20 mb-4">M</span>
            <p className="text-sm font-serif italic text-gray-400">
              Select any text to begin the dialogue.
            </p>
          </div>
        )}

        {messages.map((msg, index) => (
          <div key={msg.id} className="animate-fade-in-up group relative pl-4 border-l-2 border-transparent hover:border-gray-200 transition-colors">
            {/* Role Indicator */}
            {msg.role === 'agent' && (
               <div className="absolute -left-[3px] top-1 w-[4px] h-[4px] bg-accent rounded-full" />
            )}

            <div className="mb-2 flex items-baseline justify-between">
              <span className={`text-[10px] font-bold uppercase tracking-wider ${msg.role === 'agent' ? 'text-accent' : 'text-gray-400'}`}>
                {msg.role === 'agent' ? 'Margin' : 'Inquiry'}
              </span>
            </div>

            <div className={`
              prose prose-sm max-w-none 
              ${msg.role === 'agent' 
                ? 'font-serif text-gray-800 text-[15px]' 
                : 'font-sans text-gray-500 italic text-xs'}
            `}>
              {msg.role === 'agent' ? (
                msg.content ? (
                   /* Rich Text Rendering */
                   <ReactMarkdown>{msg.content}</ReactMarkdown>
                ) : (
                   /* Skeleton Loader State for Smooth Streaming Start */
                   <div className="space-y-3 mt-2 animate-pulse-slow">
                      <div className="h-2 bg-gray-200 rounded-full w-3/4"></div>
                      <div className="h-2 bg-gray-200 rounded-full w-full"></div>
                      <div className="h-2 bg-gray-200 rounded-full w-5/6"></div>
                   </div>
                )
              ) : (
                msg.content
              )}
            </div>
            
            {/* Elegant Divider between distinct conversation chunks */}
            {index < messages.length - 1 && messages[index+1].role === 'user' && (
              <div className="w-8 h-px bg-gray-200 mt-8 mb-2" />
            )}
          </div>
        ))}

        {/* Global Loading Indicator (fallback, usually handled by skeleton above) */}
        {isLoading && messages.length > 0 && messages[0].role !== 'agent' && (
           <div className="pl-4 mt-4">
             <div className="text-[10px] text-gray-300 animate-pulse uppercase tracking-widest">Thinking...</div>
           </div>
        )}
      </div>
    </div>
  );
};

export default MarginSidebar;