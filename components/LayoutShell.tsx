
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
}

const LayoutShell: React.FC<LayoutShellProps> = ({
  side,
  state,
  onStateChange,
  title,
  children,
  expandedContent,
  headerContent
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
      if (side === 'left') newWidth = e.clientX; 
      else newWidth = window.innerWidth - e.clientX;
      if (newWidth < 280) newWidth = 280;
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

  // 全屏视图逻辑：即 Focus 模式
  if (state === 'expanded') {
    return (
      <aside className="fixed inset-0 z-[100] bg-paper animate-fade-in flex flex-col overflow-hidden">
        <div className="h-24 border-b border-black/5 flex items-center justify-between px-12 bg-white/50 backdrop-blur-md">
           <div className="font-display text-3xl italic text-ink flex items-center gap-4">
             <span className="text-accent">Focus</span> Workspace
             <span className="h-4 w-px bg-black/5" />
             <span className="text-xs font-sans font-bold uppercase tracking-widest text-faded">Synthesis View</span>
           </div>
           <button 
              onClick={() => onStateChange('default')} 
              className="p-3 hover:bg-black/5 rounded-full text-faded hover:text-ink transition-all flex items-center gap-2 group"
           >
              <span className="text-[10px] uppercase font-bold tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Return</span>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
           </button>
        </div>
        <div className="flex-1 overflow-hidden px-10 md:px-20 py-10">
           <div className="max-w-[1400px] mx-auto h-full flex flex-col relative">
              {expandedContent || children}
           </div>
        </div>
      </aside>
    );
  }

  if (state === 'collapsed') {
    return (
      <aside className="relative transition-all duration-700 ease-[cubic-bezier(0.25,0.8,0.25,1)] overflow-hidden opacity-0 w-0 h-full pointer-events-none" />
    );
  }

  return (
    <aside 
      ref={sidebarRef}
      style={{ width: window.innerWidth >= 768 ? width : '100%' }}
      className={`
        flex-shrink-0 flex flex-col 
        bg-surface relative overflow-hidden z-50
        ${side === 'left' ? 'border-r' : 'border-l'} border-black/5
        w-full h-full
        ${isResizing ? 'transition-none' : 'transition-all duration-700 ease-[cubic-bezier(0.25,0.8,0.25,1)]'}
      `}
    >
      <div onMouseDown={startResizing} className={`hidden md:block absolute top-0 bottom-0 z-20 w-1 cursor-col-resize group hover:bg-accent/20 transition-colors ${side === 'left' ? 'right-0' : 'left-0'}`}>
        <div className={`absolute top-1/2 -translate-y-1/2 w-[3px] h-8 bg-gray-300 rounded-full opacity-0 group-hover:opacity-100 transition-opacity ${side === 'left' ? 'right-0.5' : 'left-0.5'}`} />
      </div>

      <div className="flex flex-col h-full w-full animate-fade-in relative overflow-hidden">
        {/* Sidebar Header - 平铺对齐 */}
        <div className="flex justify-between items-center px-7 h-24 flex-shrink-0 bg-transparent">
          <div className="flex items-center min-w-0 flex-1">
             {headerContent}
          </div>
          <div className="flex items-center ml-4">
            <button 
              onClick={() => onStateChange('collapsed')}
              className="p-2.5 text-faded hover:text-accent transition-colors rounded-lg hover:bg-black/5"
              title="Close Panel"
            >
               <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
        
        {/* 内容区域：确保独立滚动 */}
        <div className="flex-1 relative overflow-y-auto no-scrollbar scroll-smooth flex flex-col">
           {children}
        </div>
      </div>
    </aside>
  );
};

export default LayoutShell;
