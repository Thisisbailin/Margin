
import React, { ReactNode, useState, useEffect, useRef } from 'react';
import { PanelState } from '../types';

interface LayoutShellProps {
  side: 'left' | 'right';
  state: PanelState;
  onStateChange: (newState: PanelState) => void;
  title: string;
  children: ReactNode;
  expandedContent?: ReactNode;
  headerContent?: ReactNode; 
  collapsedPeerTrigger?: {
    label: string;
    icon: ReactNode;
    onClick: () => void;
  } | null;
}

const LayoutShell: React.FC<LayoutShellProps> = ({
  side,
  state,
  onStateChange,
  title,
  children,
  expandedContent,
  headerContent,
  collapsedPeerTrigger
}) => {
  const [width, setWidth] = useState(380);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      let newWidth = width;
      if (side === 'left') {
        newWidth = e.clientX; 
      } else {
        newWidth = window.innerWidth - e.clientX;
      }
      if (newWidth < 260) newWidth = 260;
      if (newWidth > 750) newWidth = 750;
      setWidth(newWidth);
    };

    const handleMouseUp = () => setIsResizing(false);

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };
  }, [isResizing, side]);

  if (state === 'collapsed') {
    return (
      <aside className="relative transition-all duration-700 ease-[cubic-bezier(0.25,0.8,0.25,1)] overflow-hidden opacity-0 w-full md:w-0 h-0 md:h-full"></aside>
    );
  }

  if (state === 'expanded') {
    return (
      <aside className="fixed inset-0 z-50 bg-paper animate-fade-in flex flex-col overflow-hidden">
        {/* Increased top padding for safe area in expanded mode */}
        <div className="flex-1 overflow-hidden px-6 md:px-12 lg:px-20 pt-20 md:pt-28 pb-8">
           <div className="max-w-[1400px] mx-auto h-full flex flex-col relative">
              {expandedContent || children}
           </div>
        </div>
      </aside>
    );
  }

  return (
    <aside 
      ref={sidebarRef}
      style={{ width: window.innerWidth >= 768 ? width : '100%' }}
      className={`
        flex-shrink-0 flex flex-col 
        bg-surface/80 backdrop-blur-md 
        relative overflow-hidden 
        border-b md:border-b-0
        ${side === 'left' ? 'md:border-r border-black/5' : 'md:border-l border-black/5'}
        w-full h-[45vh] md:h-full
        ${isResizing ? 'transition-none' : 'transition-all duration-700 ease-[cubic-bezier(0.25,0.8,0.25,1)]'}
      `}
    >
      <div onMouseDown={startResizing} className={`hidden md:block absolute top-0 bottom-0 z-20 w-1 cursor-col-resize group hover:bg-accent/20 transition-colors ${side === 'left' ? 'right-0' : 'left-0'}`}>
        <div className={`absolute top-1/2 -translate-y-1/2 w-[3px] h-8 bg-gray-300 rounded-full opacity-0 group-hover:opacity-100 transition-opacity ${side === 'left' ? 'right-0.5' : 'left-0.5'}`} />
      </div>

      <div className="flex flex-col h-full w-full animate-fade-in relative overflow-hidden">
        <div className="flex justify-between items-center px-6 h-12 border-b border-black/5 flex-shrink-0 bg-paper/50 backdrop-blur-sm sticky top-0 z-20">
          <div className="flex-1 flex items-center min-w-0 mr-4">
             {headerContent}
          </div>
          <div className="flex items-center gap-2 text-gray-400">
            {collapsedPeerTrigger && (
              <>
                <button onClick={collapsedPeerTrigger.onClick} className="text-gray-400 hover:text-accent transition-colors p-1.5 rounded hover:bg-accent/10" title={collapsedPeerTrigger.label}>
                  <span className="w-4 h-4">{collapsedPeerTrigger.icon}</span>
                </button>
                <div className="h-3 w-px bg-gray-200 mx-1"></div>
              </>
            )}
            <button onClick={() => onStateChange('expanded')} className="p-1.5 hover:text-ink transition-colors rounded hover:bg-black/5" title="Maximize">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" /></svg>
            </button>
            <button onClick={() => onStateChange('collapsed')} className="p-1.5 hover:text-ink transition-colors rounded hover:bg-black/5" title="Collapse">
               <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d={side === 'left' ? "M15.75 19.5L8.25 12l7.5-7.5" : "M8.25 4.5l7.5 7.5-7.5 7.5"} /></svg>
            </button>
          </div>
        </div>
        <div className="flex-1 relative overflow-hidden flex flex-col">
           {children}
        </div>
      </div>
    </aside>
  );
};

export default LayoutShell;
