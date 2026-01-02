
import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { AgentMessage, UserProficiency } from '../types';
import SkeletonLoader from './SkeletonLoader';
import { speakText, stopSpeech } from '../services/ttsService';

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
  const [activeVoiceId, setActiveVoiceId] = useState<string | null>(null);

  const handleToggleAudio = async (msg: AgentMessage) => {
    if (activeVoiceId === msg.id) {
      stopSpeech();
      setActiveVoiceId(null);
      return;
    }

    setActiveVoiceId(msg.id);
    // 调用原生多模态流式朗读
    try {
      await speakText(msg.content, msg.role === 'agent' ? 'Puck' : 'Kore');
    } catch (e) {
      console.error("Audio playback failed", e);
      setActiveVoiceId(null);
    }
  };
  
  return (
    <div className="h-full flex flex-col font-sans">
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
            {msg.role === 'agent' && (
               <div className="absolute -left-[1px] top-1.5 w-[2px] h-[10px] bg-accent rounded-full" />
            )}

            <div className="mb-3 flex items-baseline justify-between">
              <span className={`text-[9px] font-bold uppercase tracking-[0.2em] ${msg.role === 'agent' ? 'text-accent' : 'text-faded'}`}>
                {msg.role === 'agent' ? 'Synthesis' : 'Inquiry'}
              </span>
              
              {msg.content && (
                <button 
                  onClick={() => handleToggleAudio(msg)}
                  className={`flex items-center gap-2 p-1.5 rounded-full transition-all hover:bg-accent/10 ${activeVoiceId === msg.id ? 'text-accent' : 'text-faded hover:text-accent'}`}
                >
                  {activeVoiceId === msg.id && (
                    <span className="flex gap-0.5 items-center px-1">
                      <span className="w-0.5 h-2 bg-accent animate-[bounce_1s_infinite_0ms]"></span>
                      <span className="w-0.5 h-3 bg-accent animate-[bounce_1s_infinite_200ms]"></span>
                      <span className="w-0.5 h-2 bg-accent animate-[bounce_1s_infinite_400ms]"></span>
                    </span>
                  )}
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    {activeVoiceId === msg.id ? (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM9 9.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 .5.5v5a.5.5 0 0 1-.5.5h-5a.5.5 0 0 1-.5-.5v-5z" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
                    )}
                  </svg>
                </button>
              )}
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
