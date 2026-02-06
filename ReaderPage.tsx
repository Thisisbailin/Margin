import React from 'react';
import { AgentMessage, Document, PanelState, Project, Token, Span, UserProficiency, Block, TocEntry } from './types';
import LayoutShell from './components/LayoutShell';
import MarginSidebar from './components/MarginSidebar';
import ProjectContext from './components/ProjectContext';
import ReaderToken from './components/ReaderToken';
import DocumentToc from './components/DocumentToc';

interface ReaderPageProps {
  leftPanelState: PanelState;
  rightPanelState: PanelState;
  onLeftPanelStateChange: (state: PanelState) => void;
  onRightPanelStateChange: (state: PanelState) => void;
  activeProject: Project;
  activeDocument: Document | undefined;
  onDocumentSelect: (document: Document) => void;
  onEnterHome: () => void;
  isZenMode: boolean;
  focusedSpanId: string | null;
  activeToken: Token | null;
  onSpanClick: (span: Span) => void;
  onTokenClick: (token: Token) => void;
  messages: AgentMessage[];
  isAiLoading: boolean;
  userProficiency: UserProficiency;
  getMasteryScore: (lemma: string) => number;
}

const ReaderPage: React.FC<ReaderPageProps> = ({
  leftPanelState,
  rightPanelState,
  onLeftPanelStateChange,
  onRightPanelStateChange,
  activeProject,
  activeDocument,
  onDocumentSelect,
  onEnterHome,
  isZenMode,
  focusedSpanId,
  activeToken,
  onSpanClick,
  onTokenClick,
  messages,
  isAiLoading,
  userProficiency,
  getMasteryScore
}) => {
  const [activeTocEntryId, setActiveTocEntryId] = React.useState<string | null>(null);
  const [isMobile, setIsMobile] = React.useState(() => (typeof window !== 'undefined' ? window.innerWidth < 768 : false));
  const [mobileTab, setMobileTab] = React.useState<'landscape' | 'margin'>('landscape');
  const [sheetOffsetY, setSheetOffsetY] = React.useState(0);
  const [isDraggingSheet, setIsDraggingSheet] = React.useState(false);
  const [isClosingSheet, setIsClosingSheet] = React.useState(false);
  const [renderSheet, setRenderSheet] = React.useState(false);
  const [sheetHeight, setSheetHeight] = React.useState(0);
  const mobileSheetRef = React.useRef<HTMLDivElement | null>(null);
  const sheetContainerRef = React.useRef<HTMLDivElement | null>(null);
  const dragStartYRef = React.useRef(0);
  const dragStartOffsetRef = React.useRef(0);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const openMobileSheet = (tab: 'landscape' | 'margin') => {
    setMobileTab(tab);
    if (tab === 'landscape') {
      onLeftPanelStateChange('default');
      onRightPanelStateChange('collapsed');
    } else {
      onRightPanelStateChange('default');
      onLeftPanelStateChange('collapsed');
    }
  };

  const closeMobileSheet = () => {
    onLeftPanelStateChange('collapsed');
    onRightPanelStateChange('collapsed');
  };

  const requestCloseSheet = () => {
    if (!renderSheet) {
      closeMobileSheet();
      return;
    }
    const height = sheetContainerRef.current?.clientHeight || sheetHeight || 360;
    setIsClosingSheet(true);
    setIsDraggingSheet(false);
    setSheetOffsetY(height);
    window.setTimeout(() => {
      closeMobileSheet();
      setIsClosingSheet(false);
      setRenderSheet(false);
      setSheetOffsetY(0);
    }, 280);
  };

  const toggleLeftPanel = () => {
    if (isMobile) {
      if (leftPanelState !== 'collapsed') {
        requestCloseSheet();
      } else {
        openMobileSheet('landscape');
      }
      return;
    }
    onLeftPanelStateChange(leftPanelState === 'collapsed' ? 'default' : 'collapsed');
  };

  const toggleRightPanel = () => {
    if (isMobile) {
      if (rightPanelState !== 'collapsed') {
        requestCloseSheet();
      } else {
        openMobileSheet('margin');
      }
      return;
    }
    onRightPanelStateChange(rightPanelState === 'collapsed' ? 'default' : 'collapsed');
  };

  const isMobileSheetOpen = isMobile && (leftPanelState !== 'collapsed' || rightPanelState !== 'collapsed');

  React.useEffect(() => {
    if (isMobileSheetOpen) {
      setRenderSheet(true);
      setIsClosingSheet(false);
      setSheetOffsetY(40);
      requestAnimationFrame(() => setSheetOffsetY(0));
    } else if (!isClosingSheet) {
      setRenderSheet(false);
    }
  }, [isMobileSheetOpen, isClosingSheet]);

  React.useEffect(() => {
    if (!renderSheet) return;
    const height = sheetContainerRef.current?.clientHeight || 0;
    if (height) setSheetHeight(height);
  }, [renderSheet, messages.length, activeDocument?.id]);

  React.useEffect(() => {
    if (!isMobileSheetOpen) return;
    const container = mobileSheetRef.current;
    if (!container) return;
    const width = container.clientWidth;
    const targetLeft = mobileTab === 'landscape' ? 0 : width;
    container.scrollTo({ left: targetLeft, behavior: 'smooth' });
  }, [mobileTab, isMobileSheetOpen]);

  const handleMobileSheetScroll = () => {
    const container = mobileSheetRef.current;
    if (!container) return;
    const width = container.clientWidth || 1;
    const nextTab = container.scrollLeft > width * 0.5 ? 'margin' : 'landscape';
    if (nextTab !== mobileTab) {
      setMobileTab(nextTab);
      if (nextTab === 'landscape') {
        onLeftPanelStateChange('default');
        onRightPanelStateChange('collapsed');
      } else {
        onRightPanelStateChange('default');
        onLeftPanelStateChange('collapsed');
      }
    }
  };

  const handleSheetDragStart = (event: React.TouchEvent) => {
    if (event.touches.length !== 1) return;
    dragStartYRef.current = event.touches[0].clientY;
    dragStartOffsetRef.current = sheetOffsetY;
    setIsDraggingSheet(true);
  };

  const handleSheetDragMove = (event: React.TouchEvent) => {
    if (!isDraggingSheet) return;
    const delta = event.touches[0].clientY - dragStartYRef.current;
    if (delta <= 0) {
      setSheetOffsetY(0);
      return;
    }
    event.preventDefault();
    setSheetOffsetY(delta + dragStartOffsetRef.current);
  };

  const handleSheetDragEnd = () => {
    if (!isDraggingSheet) return;
    setIsDraggingSheet(false);
    const height = sheetContainerRef.current?.clientHeight || sheetHeight || 360;
    const threshold = Math.min(180, height * 0.35);
    if (sheetOffsetY > threshold) {
      requestCloseSheet();
    } else {
      setSheetOffsetY(0);
    }
  };

  React.useEffect(() => {
    if (!activeDocument) return;
    setActiveTocEntryId(activeDocument.toc[0]?.id || null);
  }, [activeDocument]);

  const tocTargets = React.useMemo(() => {
    if (!activeDocument) return [];
    const targetMap = new Map<string, (typeof activeDocument.toc)[number]>();
    activeDocument.toc.forEach((entry) => {
      const targetId = entry.anchorId || entry.sectionId;
      if (!targetId || targetMap.has(targetId)) return;
      targetMap.set(targetId, entry);
    });
    return Array.from(targetMap.entries()).map(([targetId, entry]) => ({ targetId, entry }));
  }, [activeDocument]);

  React.useEffect(() => {
    if (!activeDocument) return;
    const elements = tocTargets
      .map((item) => document.getElementById(item.targetId))
      .filter((el): el is HTMLElement => Boolean(el));
    if (!elements.length) return;

    const entryByTargetId = new Map(tocTargets.map((item) => [item.targetId, item.entry]));
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length) {
          const entry = entryByTargetId.get(visible[0].target.id);
          if (entry) {
            setActiveTocEntryId(entry.id);
          }
        }
      },
      { root: null, rootMargin: '0px 0px -60% 0px', threshold: 0.1 }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [activeDocument, tocTargets]);

  const handleTocSelect = (entry: TocEntry) => {
    const targetId = entry.anchorId || entry.sectionId;
    if (!targetId) return;
    const targetEl = document.getElementById(targetId);
    setActiveTocEntryId(entry.id);
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const renderBlock = (block: Block, options?: { compact?: boolean; tone?: 'note' }) => {
    const blockStyle: React.CSSProperties = {
      ...(block.align ? { textAlign: block.align } : {}),
      ...(block.indent
        ? block.indentKind === 'margin'
          ? { marginLeft: block.indent }
          : { textIndent: block.indent }
        : {}),
      ...(block.lineHeight ? { lineHeight: block.lineHeight } : {}),
      ...(block.spacingBefore ? { marginTop: block.spacingBefore } : {}),
      ...(block.spacingAfter ? { marginBottom: block.spacingAfter } : {})
    };

    return (
      <div
        key={block.id}
        id={block.id}
        style={blockStyle}
        className={`prose max-w-none ${
          options?.compact ? 'mb-4 text-sm md:text-base leading-relaxed' : 'mb-8 prose-sm md:prose-lg'
        } ${options?.tone === 'note' ? 'text-ink/70' : 'text-ink'}`}
      >
        {block.spans.map((span) => {
          const isFocused = focusedSpanId === span.id;
          const showTokens = isFocused && !isZenMode;

          return (
            <span
              key={span.id}
              onClick={() => onSpanClick(span)}
              className={`inline transition-all duration-500 rounded-sm cursor-pointer px-1 -mx-1 py-0.5 ${
                isFocused ? 'bg-accent/5 ring-1 ring-accent/10' : 'hover:bg-black/5'
              }`}
            >
              {showTokens ? (
                span.tokens.map((token) => (
                  <React.Fragment key={token.id}>
                    <ReaderToken
                      token={token}
                      masteryScore={getMasteryScore(token.lemma)}
                      onClick={onTokenClick}
                      isActive={activeToken?.id === token.id}
                      isSentenceFocused={isFocused}
                      isZenMode={isZenMode}
                    />
                    {' '}
                  </React.Fragment>
                ))
              ) : (
                <>
                  {span.text}
                  {' '}
                </>
              )}
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <div className="h-screen w-screen bg-paper text-ink font-sans flex flex-col md:flex-row overflow-hidden relative">
      {!isMobile && (
        <LayoutShell
          side="left"
          state={leftPanelState}
          onStateChange={onLeftPanelStateChange}
          title="Landscape"
          headerContent={<div className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">Landscape</div>}
        >
          <div className="p-8 h-full flex flex-col gap-6">
            <button
              onClick={onEnterHome}
              className="w-full py-3.5 bg-surface border border-black/5 rounded-2xl text-[10px] font-bold uppercase tracking-widest text-ink hover:bg-white hover:shadow-soft transition-all flex items-center justify-center gap-2"
            >
              Back To Home
            </button>
            <div className="flex-1 overflow-y-auto no-scrollbar space-y-10 pr-2">
              {activeDocument && (
                <DocumentToc
                  toc={activeDocument.toc}
                  onSelect={handleTocSelect}
                  activeEntryId={activeTocEntryId}
                />
              )}
              <ProjectContext
                project={activeProject}
                activeDocumentId={activeDocument?.id}
                onDocumentSelect={onDocumentSelect}
                showImport={false}
              />
            </div>
          </div>
        </LayoutShell>
      )}

      <main
        className={`h-full w-full overflow-y-auto no-scrollbar flex-1 relative transition-all duration-700 ${
          leftPanelState === 'expanded' || rightPanelState === 'expanded'
            ? 'md:opacity-0 md:scale-95 md:translate-y-4'
            : 'md:opacity-100 md:scale-100 md:translate-y-0'
        }`}
      >
        <div className="mx-auto px-4 md:px-12 py-20 md:py-32 max-w-2xl">
          <header className="mb-16 md:mb-28 text-center animate-fade-in">
            <div className="text-[10px] uppercase tracking-[0.4em] text-accent font-bold mb-6">Current Reading</div>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-display text-ink mb-6 md:mb-10 tracking-tight leading-[1.1]">
              {activeDocument?.title}
            </h1>
            {activeDocument?.author && (
              <div className="text-xs md:text-sm font-serif italic text-gray-400">by {activeDocument.author}</div>
            )}
          </header>

          <div className="space-y-12 md:space-y-24">
            {activeDocument?.sections.map((section) => (
              <section key={section.id} id={section.id} className="animate-fade-in">
                <div className="mb-8 md:mb-12 border-b border-black/5 pb-4">
                  <h2 className="font-display text-lg md:text-2xl italic text-ink/40">{section.title}</h2>
                </div>
                {section.blocks.filter((block) => !block.noteType).map((block) => renderBlock(block))}
                {section.blocks.some((block) => block.noteType) && (
                  <div className="mt-10 md:mt-16 border border-black/5 bg-white/60 rounded-3xl p-6 md:p-8 shadow-soft space-y-6">
                    {section.blocks.some((block) => block.noteType === 'footnote') && (
                      <div className="space-y-3">
                        <div className="text-[9px] uppercase tracking-[0.3em] text-accent font-bold">Footnotes</div>
                        {section.blocks
                          .filter((block) => block.noteType === 'footnote')
                          .map((block) => renderBlock(block, { compact: true, tone: 'note' }))}
                      </div>
                    )}
                    {section.blocks.some((block) => block.noteType === 'endnote') && (
                      <div className="space-y-3">
                        <div className="text-[9px] uppercase tracking-[0.3em] text-accent font-bold">Endnotes</div>
                        {section.blocks
                          .filter((block) => block.noteType === 'endnote')
                          .map((block) => renderBlock(block, { compact: true, tone: 'note' }))}
                      </div>
                    )}
                  </div>
                )}
              </section>
            ))}
          </div>

          <footer className="mt-20 md:mt-40 pt-10 md:pt-20 border-t border-black/5 text-center">
            <p className="text-[10px] uppercase tracking-widest text-gray-300 font-bold">End of Loaded Material</p>
          </footer>
        </div>

      </main>

      <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] left-1/2 -translate-x-1/2 z-40">
        <div className="flex items-center gap-2 md:gap-3 px-2 py-2 md:px-3 md:py-3 rounded-full bg-white/80 backdrop-blur-sm border border-black/5 shadow-float">
          <button
            onClick={toggleLeftPanel}
            className={`flex items-center gap-2 px-3 py-2 md:px-4 md:py-2.5 rounded-full text-[10px] md:text-[11px] font-bold uppercase tracking-widest transition-all ${
              leftPanelState !== 'collapsed'
                ? 'bg-ink text-white'
                : 'bg-white text-ink hover:bg-surface'
            }`}
            aria-label="Toggle landscape panel"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
            </svg>
            <span className="md:hidden">目录</span>
            <span className="hidden md:inline">Landscape</span>
          </button>
          <button
            onClick={toggleRightPanel}
            className={`flex items-center gap-2 px-3 py-2 md:px-4 md:py-2.5 rounded-full text-[10px] md:text-[11px] font-bold uppercase tracking-widest transition-all ${
              rightPanelState !== 'collapsed'
                ? 'bg-ink text-white'
                : 'bg-white text-ink hover:bg-surface'
            }`}
            aria-label="Toggle margin panel"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 0 1-.923 1.785c-.442.496.103 1.228.718 1.025a5.503 5.503 0 0 0 2.316-1.392l.06-.06c.397-.396.944-.606 1.48-.544 1.157.133 2.344.204 3.551.204Z" />
            </svg>
            <span className="md:hidden">边注</span>
            <span className="hidden md:inline">Margin</span>
          </button>
        </div>
      </div>

      {!isMobile && (
        <LayoutShell
          side="right"
          state={rightPanelState}
          onStateChange={onRightPanelStateChange}
          title="Margin"
          headerContent={
            <div className="flex items-center justify-between w-full pr-4">
              <span className="font-display text-2xl italic text-ink">Margin</span>
            </div>
          }
        >
          <div className="flex-1 overflow-y-auto no-scrollbar px-7 pb-20">
            <MarginSidebar messages={messages} isLoading={isAiLoading} proficiency={userProficiency} />
          </div>
        </LayoutShell>
      )}

      {renderSheet && (
        <>
          <button
            className="fixed inset-0 z-[45] bg-ink/25 backdrop-blur-[1px] transition-opacity duration-300"
            style={{ opacity: Math.max(0, 1 - sheetOffsetY / Math.max(sheetHeight || 1, 1)) }}
            aria-label="Close panel"
            onClick={requestCloseSheet}
          />
          <div
            ref={sheetContainerRef}
            className="fixed left-0 right-0 bottom-0 z-50 bg-surface/95 backdrop-blur-md border-t border-black/10 rounded-t-[2rem] h-[60vh] pb-[env(safe-area-inset-bottom)] flex flex-col overflow-hidden"
            style={{
              transform: `translateY(${sheetOffsetY}px)`,
              transition: isDraggingSheet ? 'none' : 'transform 280ms cubic-bezier(0.22, 0.61, 0.36, 1)'
            }}
          >
            <div
              className="pt-3 pb-2 flex items-center justify-center"
              onTouchStart={handleSheetDragStart}
              onTouchMove={handleSheetDragMove}
              onTouchEnd={handleSheetDragEnd}
            >
              <div className="w-12 h-1.5 rounded-full bg-black/10" />
            </div>
            <div className="px-6 pb-3 flex items-center justify-between gap-3">
              <button
                onClick={() => openMobileSheet('landscape')}
                className={`flex-1 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest border transition ${
                  mobileTab === 'landscape'
                    ? 'bg-ink text-white border-ink'
                    : 'bg-white/70 text-ink border-black/5 hover:border-accent/30'
                }`}
              >
                目录 / 项目
              </button>
              <button
                onClick={() => openMobileSheet('margin')}
                className={`flex-1 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest border transition ${
                  mobileTab === 'margin'
                    ? 'bg-ink text-white border-ink'
                    : 'bg-white/70 text-ink border-black/5 hover:border-accent/30'
                }`}
              >
                边注 / 对话
              </button>
            </div>
            <div
              ref={mobileSheetRef}
              onScroll={handleMobileSheetScroll}
              className="flex-1 flex overflow-x-auto snap-x snap-mandatory scroll-smooth no-scrollbar"
            >
              <div className="snap-start shrink-0 w-full h-full overflow-y-auto no-scrollbar px-6 pb-16" style={{ WebkitOverflowScrolling: 'touch' }}>
                <div className="pt-2 flex flex-col gap-6">
                  <button
                    onClick={onEnterHome}
                    className="w-full py-3.5 bg-white/80 border border-black/5 rounded-2xl text-[10px] font-bold uppercase tracking-widest text-ink hover:bg-white hover:shadow-soft transition-all flex items-center justify-center gap-2"
                  >
                    Back To Home
                  </button>
                  {activeDocument && (
                    <DocumentToc
                      toc={activeDocument.toc}
                      onSelect={handleTocSelect}
                      activeEntryId={activeTocEntryId}
                    />
                  )}
                  <ProjectContext
                    project={activeProject}
                    activeDocumentId={activeDocument?.id}
                    onDocumentSelect={onDocumentSelect}
                    showImport={false}
                  />
                </div>
              </div>
              <div className="snap-start shrink-0 w-full h-full overflow-y-auto no-scrollbar px-6 pb-16" style={{ WebkitOverflowScrolling: 'touch' }}>
                <div className="pt-2">
                  <MarginSidebar messages={messages} isLoading={isAiLoading} proficiency={userProficiency} />
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ReaderPage;
