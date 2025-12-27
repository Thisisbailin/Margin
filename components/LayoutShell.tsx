import React, { ReactNode, useState, useEffect, useRef } from 'react';
import { PanelState } from '../types';

interface LayoutShellProps {
  side: 'left' | 'right';
  state: PanelState;
  onStateChange: (newState: PanelState) => void;
  title: string;
  children: ReactNode;
  expandedContent?: ReactNode;
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
  collapsedPeerTrigger
}) => {
  // --- Resizing Logic ---
  // Default width 380px, clamped between 280px and 600px
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
      // Calculate new width based on mouse position relative to sidebar side
      let newWidth = width;
      if (side === 'left') {
        // For left sidebar, moving right increases width
        newWidth = e.clientX; 
      } else {
        // For right sidebar, moving left increases width (width = windowWidth - mouseX)
        newWidth = window.innerWidth - e.clientX;
      }

      // Constraints
      if (newWidth < 280) newWidth = 280;
      if (newWidth > 800) newWidth = 800;
      
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

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


  // 1. COLLAPSED STATE: 
  // Desktop: Width becomes 0. Mobile: Height becomes 0.
  if (state === 'collapsed') {
    return (
      <aside className={`
        relative transition-all duration-700 ease-[cubic-bezier(0.25,0.8,0.25,1)] overflow-hidden opacity-0
        w-full md:w-0 h-0 md:h-full
      `}>
        {/* Placeholder */}
      </aside>
    );
  }

  // 2. EXPANDED (FULLSCREEN) STATE
  if (state === 'expanded') {
    return (
      <aside className="fixed inset-0 z-50 bg-paper animate-fade-in flex flex-col">
        <div className="max-w-5xl mx-auto w-full p-6 md:p-12 flex justify-between items-start">
          <div className="flex items-center gap-6">
             <button 
               onClick={() => onStateChange('default')}
               className="p-2 -ml-2 text-gray-400 hover:text-ink transition-colors rounded-full hover:bg-gray-100"
             >
               <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-8 h-8">
                 <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
               </svg>
             </button>
             <h2 className="text-3xl font-display font-medium text-ink">{title}</h2>
          </div>
          <button 
             onClick={() => onStateChange('collapsed')}
             className="text-xs text-gray-400 hover:text-ink uppercase tracking-[0.2em] font-medium transition-colors border-b border-transparent hover:border-ink pb-0.5"
           >
             Close
           </button>
        </div>
        
        <div className="flex-1 overflow-y-auto px-6 md:px-12 pb-12">
           <div className="max-w-5xl mx-auto h-full">
              {expandedContent || children}
           </div>
        </div>
      </aside>
    );
  }

  // 3. DEFAULT (SIDEBAR) STATE
  // We use inline styles for width to allow dragging, but only on desktop (md+)
  return (
    <aside 
      ref={sidebarRef}
      style={{ width: window.innerWidth >= 768 ? width : '100%' }}
      className={`
        flex-shrink-0 flex flex-col 
        bg-surface/60 backdrop-blur-sm 
        relative overflow-hidden 
        border-b md:border-b-0
        ${side === 'left' ? 'md:border-r border-black/5' : 'md:border-l border-black/5'}
        w-full h-[40vh] md:h-full
        /* Disable transition during resize for instant feedback */
        ${isResizing ? 'transition-none' : 'transition-all duration-700 ease-[cubic-bezier(0.25,0.8,0.25,1)]'}
      `}
    >
      {/* Resize Handle (Desktop Only) */}
      <div 
        onMouseDown={startResizing}
        className={`
          hidden md:block absolute top-0 bottom-0 z-20 w-1 cursor-col-resize group
          hover:bg-accent/20 transition-colors
          ${side === 'left' ? 'right-0' : 'left-0'}
        `}
      >
        {/* Visual indicator on hover */}
        <div className={`
          absolute top-1/2 -translate-y-1/2 w-[3px] h-8 bg-gray-300 rounded-full opacity-0 group-hover:opacity-100 transition-opacity
          ${side === 'left' ? 'right-0.5' : 'left-0.5'}
        `} />
      </div>

      <div className="flex flex-col h-full w-full animate-fade-in">
        {/* Sidebar Toolbar */}
        <div className="flex justify-between items-center px-6 py-4 md:py-6 group border-b border-transparent hover:border-black/5 transition-colors flex-shrink-0">
          
          {/* Collapse Button */}
          <button 
            onClick={() => onStateChange('collapsed')}
            className="text-gray-300 hover:text-ink transition-colors p-2 -ml-2 rounded-full hover:bg-black/5"
            title={`Collapse ${title}`}
          >
             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d={side === 'left' ? "M15.75 19.5L8.25 12l7.5-7.5" : "M8.25 4.5l7.5 7.5-7.5 7.5"} />
            </svg>
          </button>

          {/* Right Side Actions */}
          <div className="flex items-center gap-1">
            {collapsedPeerTrigger && (
              <>
                <button
                  onClick={collapsedPeerTrigger.onClick}
                  className="text-gray-400 hover:text-accent transition-colors p-2 rounded-full hover:bg-accent/5 flex items-center gap-2"
                  title={collapsedPeerTrigger.label}
                >
                  <span className="w-4 h-4">{collapsedPeerTrigger.icon}</span>
                </button>
                <div className="h-3 w-px bg-gray-200 mx-1"></div>
              </>
            )}

            <button 
              onClick={() => onStateChange('expanded')}
              className="text-gray-300 hover:text-ink transition-colors p-2 -mr-2 rounded-full hover:bg-black/5"
              title="Maximize"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content with internal padding */}
        <div className="flex-1 overflow-y-auto px-6 md:px-8 pb-10 scroll-smooth no-scrollbar">
           {children}
        </div>
      </div>
    </aside>
  );
};

export default LayoutShell;