
import React, { useState, useMemo } from 'react';
import { LexiconItem, VocabularyStat, TopographyView } from '../types';

interface LexisDeckProps {
  lexicon: LexiconItem[];
  bookProgress: number; 
  onUpdateLexicon: (lemma: string, updates: Partial<VocabularyStat>) => void;
  onGenerateDefinition: (word: string) => Promise<string>;
  onNavigateToContext: (bookId: string, sentenceId: string, wordId: string) => void;
  isExpanded?: boolean; 
}

const LexisDeck: React.FC<LexisDeckProps> = ({ 
  lexicon, 
  bookProgress,
  onUpdateLexicon, 
  onGenerateDefinition,
  isExpanded = false
}) => {
  const [view, setView] = useState<TopographyView>('reality');
  const [simulatedProgress, setSimulatedProgress] = useState(bookProgress);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [mode, setMode] = useState<'browse' | 'study'>('browse');
  const [sessionQueue, setSessionQueue] = useState<LexiconItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // --- 核心地形逻辑 ---
  const landscapeData = useMemo(() => {
    const total = lexicon.length;
    // 按首次发现进度排序，用于内容曲线 (X=进度, Y=累积百分比)
    const sortedByDiscovery = [...lexicon].sort((a, b) => a.firstDiscoveryProgress - b.firstDiscoveryProgress);
    // 按频次排序，用于散点图 (X=频次排行)
    const sortedByFrequency = [...lexicon].sort((a, b) => b.count - a.count);

    // 1. 生成攀登曲线路径点 (仅用于 Content View)
    const curvePoints: {x: number, y: number}[] = sortedByDiscovery.map((item, index) => ({
      x: item.firstDiscoveryProgress * 100,
      y: ((index + 1) / total) * 100
    }));

    // 2. 将单词粒子映射到对应的多维坐标
    const particles = lexicon.map((item) => {
      const isDiscovered = item.firstDiscoveryProgress <= simulatedProgress;
      const freqIndex = sortedByFrequency.findIndex(l => l.lemma === item.lemma);
      const discoveryIndex = sortedByDiscovery.findIndex(l => l.lemma === item.lemma);

      let x = 0;
      let y = 0;
      let color = 'fill-ink/20';
      let opacity = 0.2;

      if (view === 'content') {
        // 内容视角：X 为书本发现进度，Y 为累积唯一词数百分比
        x = item.firstDiscoveryProgress * 100;
        y = ((discoveryIndex + 1) / total) * 100;
        opacity = isDiscovered ? 0.9 : 0.15;
        color = 'fill-accent';
      } else {
        // 记忆或复合视角：恢复散点设计 (X 为频次排行，Y 为掌握得分)
        x = (freqIndex / total) * 100;
        y = (item.masteryScore || 0) * 100;
        
        if (view === 'memory') {
          opacity = (item.masteryScore || 0) * 0.9 + 0.1;
          color = 'fill-secondary';
        } else {
          // 复合现实视角 (Reality Map)
          opacity = isDiscovered ? 0.9 : 0.05;
          color = item.masteryScore > 0.7 ? 'fill-secondary' : isDiscovered ? 'fill-accent' : 'fill-ink/10';
        }
      }

      return {
        ...item,
        x, y, opacity, color, isDiscovered,
        size: Math.log(item.count + 1.2) * 2.5 + 1.5,
        freqRank: (freqIndex / total) * 100
      };
    });

    // 3. 统计分区 (始终基于频次分布，反映词汇表的结构化层级)
    const filterByFreq = (minR: number, maxR: number) => particles.filter(p => p.freqRank >= minR && p.freqRank < maxR);
    const zones = {
      core: filterByFreq(0, 25),
      slopes: filterByFreq(25, 70),
      canyons: filterByFreq(70, 100)
    };

    return { particles, curvePoints, zones };
  }, [lexicon, simulatedProgress, view]);

  const activeZoneWords = selectedZone ? (landscapeData.zones as any)[selectedZone] : [];

  const startStudy = (words: LexiconItem[]) => {
    if (words.length === 0) return;
    setSessionQueue(words.sort(() => Math.random() - 0.5).slice(0, 10));
    setCurrentIndex(0);
    setMode('study');
  };

  const curvePath = useMemo(() => {
    if (landscapeData.curvePoints.length === 0) return "";
    const points = landscapeData.curvePoints;
    let path = `M ${points[0].x},${100 - points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      path += ` L ${points[i].x},${100 - points[i].y}`;
    }
    return path;
  }, [landscapeData.curvePoints]);

  if (mode === 'study') {
    const current = sessionQueue[currentIndex];
    if (!current) { setMode('browse'); return null; }
    return (
      <div className="h-full flex flex-col p-12 bg-white/60 backdrop-blur-2xl rounded-[3rem] animate-fade-in border border-black/5 shadow-float">
        <div className="flex justify-between items-center mb-16">
          <button onClick={() => setMode('browse')} className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-400 hover:text-accent">← EXIT STUDY</button>
          <div className="text-[10px] text-gray-300 font-bold tracking-widest uppercase">SYNERGY {currentIndex + 1} / {sessionQueue.length}</div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="text-[10px] px-5 py-2 bg-secondary/10 text-secondary rounded-full mb-8 font-bold uppercase tracking-widest">Mastery: {Math.round(current.masteryScore * 100)}%</div>
          <h2 className="text-[10rem] font-display text-ink mb-12 tracking-tighter leading-none">{current.lemma}</h2>
          <div className="w-full max-w-sm space-y-4">
             <button onClick={() => { onUpdateLexicon(current.lemma, {}); if (currentIndex < sessionQueue.length - 1) setCurrentIndex(c => c+1); else setMode('browse'); }} className="w-full py-6 bg-ink text-white rounded-2xl font-bold uppercase tracking-widest text-xs hover:bg-black transition-all shadow-2xl active:scale-95">Mark Mastered</button>
             <button onClick={() => setMode('browse')} className="w-full py-4 text-gray-400 font-bold uppercase tracking-widest text-[10px] hover:text-ink transition-colors">Return</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex gap-12 overflow-hidden pb-8">
      {/* 1. 地形主场 */}
      <div className="flex-[3] flex flex-col min-w-0">
        <div className="flex justify-between items-end mb-12">
           <div>
              <div className="flex gap-6 mb-3">
                 {(['content', 'memory', 'reality'] as TopographyView[]).map(v => (
                   <button key={v} onClick={() => setView(v)} className={`text-[11px] font-bold uppercase tracking-[0.2em] transition-all relative ${view === v ? 'text-accent' : 'text-gray-300 hover:text-gray-400'}`}>
                      {v} map
                      {view === v && <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-accent rounded-full" />}
                   </button>
                 ))}
              </div>
              <h3 className="text-5xl font-display text-ink tracking-tight">
                {view === 'content' ? 'Climbing Trajectory' : 'Linguistic Landscape'}
              </h3>
           </div>
           
           <div className="w-72 text-right">
              <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
                 <span>Simulated Journey</span>
                 <span className="text-accent">{Math.round(simulatedProgress * 100)}%</span>
              </div>
              <div className="relative h-1 bg-gray-100 rounded-full cursor-pointer group">
                 <input type="range" min="0" max="1" step="0.005" value={simulatedProgress} onChange={(e) => setSimulatedProgress(parseFloat(e.target.value))} className="absolute inset-0 w-full opacity-0 z-10 cursor-pointer" />
                 <div className="absolute h-full bg-accent rounded-full transition-all duration-300" style={{ width: `${simulatedProgress * 100}%` }} />
                 <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-2 border-accent rounded-full shadow-md" style={{ left: `${simulatedProgress * 100}%` }} />
              </div>
           </div>
        </div>

        {/* SVG 地形场 */}
        <div className="flex-1 bg-white/40 rounded-[3.5rem] border border-black/5 relative overflow-hidden group">
           <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full p-20 overflow-visible">
              <defs>
                 <linearGradient id="curveGradient" x1="0%" y1="100%" x2="0%" y2="0%">
                    <stop offset="0%" stopColor="rgba(194,142,91,0.02)" />
                    <stop offset="100%" stopColor="rgba(194,142,91,0.15)" />
                 </linearGradient>
              </defs>

              {/* 背景网格 */}
              {[25, 50, 75].map(p => (
                <line key={p} x1={p} y1="0" x2={p} y2="100" stroke="rgba(0,0,0,0.02)" strokeWidth="0.2" />
              ))}
              {[25, 50, 75].map(p => (
                <line key={p} x1="0" y1={p} x2="100" y2={p} stroke="rgba(0,0,0,0.02)" strokeWidth="0.2" />
              ))}

              {/* 仅内容视图绘制累积路径 */}
              {view === 'content' && (
                <path d={`${curvePath} L 100,100 L 0,100 Z`} fill="url(#curveGradient)" className="transition-all duration-1000" />
              )}

              {/* 仅内容视图绘制阅读进度指示器 */}
              {view === 'content' && (
                <line x1={simulatedProgress * 100} y1="0" x2={simulatedProgress * 100} y2="100" stroke="rgba(194,142,91,0.3)" strokeWidth="0.4" strokeDasharray="1,1" />
              )}

              {/* 词汇粒子映射 */}
              {landscapeData.particles.map((d) => (
                <circle 
                  key={d.lemma} cx={d.x} cy={100 - d.y} r={d.size / 6} 
                  className={`transition-all duration-1000 cursor-pointer ${d.color} ${selectedZone && !activeZoneWords.includes(d) ? 'opacity-0 blur-xl' : ''}`}
                  style={{ opacity: d.opacity }}
                >
                  <title>{d.lemma}</title>
                </circle>
              ))}

              {/* 说明文本 */}
              <text x="0" y="105%" className="text-[1.8px] fill-gray-300 font-bold uppercase tracking-[0.2em]">
                {view === 'content' ? 'Intro' : 'Core'}
              </text>
              <text x="90" y="105%" className="text-[1.8px] fill-gray-300 font-bold uppercase tracking-[0.2em]">
                {view === 'content' ? 'Outro' : 'Long Tail'}
              </text>
              <text x="-5" y="5" transform="rotate(-90, -5, 5)" className="text-[1.8px] fill-gray-300 font-bold uppercase tracking-[0.2em]">
                {view === 'content' ? 'Accumulated Lexis' : 'Mastery'}
              </text>
           </svg>
           
           {/* 浮动统计组件 */}
           <div className="absolute top-10 right-10 bg-white/70 backdrop-blur-md p-6 rounded-2xl border border-black/5 shadow-soft pointer-events-none">
              <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                {view === 'content' ? 'Climbing Index' : 'Neural Consolidation'}
              </div>
              <div className="text-3xl font-display text-ink">
                {view === 'content' ? 'Steep' : 'Merging'}
              </div>
              <div className="mt-3 space-y-1">
                 <div className="flex justify-between text-[9px] gap-10">
                    <span className="text-gray-400">Inventory</span>
                    <span className="font-bold">{lexicon.length} tokens</span>
                 </div>
                 <div className="flex justify-between text-[9px]">
                    <span className="text-gray-400">Discovery Rate</span>
                    {/* Fixed "total" reference error by using lexicon.length directly since total was only in useMemo scope */}
                    <span className="font-bold">{Math.round((landscapeData.particles.filter(p => p.isDiscovered).length / (lexicon.length || 1)) * 100)}%</span>
                 </div>
              </div>
           </div>
        </div>
      </div>

      {/* 2. 探索注册表 */}
      <div className="flex-1 flex flex-col gap-6 w-[420px] pb-4">
         <div className="space-y-4">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1">Topographical Segments</label>
            <div className="grid grid-cols-1 gap-3">
               {[
                 { id: 'core', label: 'Basal Plains', desc: '文本基础，出现最为频繁的词簇', count: landscapeData.zones.core.length },
                 { id: 'slopes', label: 'Narrative Slopes', desc: '叙事骨架，支撑语境的核心表达', count: landscapeData.zones.slopes.length },
                 { id: 'canyons', label: 'Niche Summits', desc: '文学巅峰，体现风格的珍稀词汇', count: landscapeData.zones.canyons.length }
               ].map(r => (
                 <button 
                  key={r.id} 
                  onClick={() => setSelectedZone(selectedZone === r.id ? null : r.id)}
                  className={`p-6 rounded-[2rem] border text-left transition-all group relative overflow-hidden ${selectedZone === r.id ? 'border-accent bg-white shadow-float scale-[1.02]' : 'border-black/5 bg-surface/40 hover:bg-white'}`}
                 >
                    <div className="flex justify-between items-center relative z-10">
                       <div>
                          <span className="font-display text-2xl text-ink group-hover:text-accent transition-colors">{r.label}</span>
                          <p className="text-[9px] text-gray-400 mt-1 uppercase tracking-wider leading-relaxed">{r.desc}</p>
                       </div>
                       <div className="text-right">
                          <span className="text-lg font-display text-ink/30">{r.count}</span>
                          <div className="text-[8px] text-gray-300 font-bold uppercase">Tokens</div>
                       </div>
                    </div>
                 </button>
               ))}
            </div>
         </div>

         {selectedZone ? (
           <div className="flex-1 flex flex-col bg-white border border-black/5 rounded-[3rem] overflow-hidden animate-fade-in-up shadow-float">
              <div className="p-8 border-b border-black/5 flex justify-between items-center bg-paper/10">
                 <div>
                    <h4 className="font-display text-2xl capitalize text-ink">{selectedZone} Registry</h4>
                    <p className="text-[9px] text-gray-400 uppercase tracking-widest mt-1">Lexical Consolidation</p>
                 </div>
                 <button onClick={() => startStudy(activeZoneWords)} className="px-6 py-2.5 bg-ink text-white rounded-full font-bold uppercase tracking-widest text-[10px] hover:bg-accent transition-all shadow-lg active:scale-95">Study Segment</button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-2 no-scrollbar">
                 {activeZoneWords.sort((a:any, b:any) => b.count - a.count).map((word: any) => (
                   <div key={word.lemma} className="flex items-center justify-between p-4 hover:bg-accent/5 rounded-[1.5rem] group transition-all">
                      <div className="flex items-baseline gap-3">
                         <div className="text-lg font-serif text-ink">{word.lemma}</div>
                         <div className="text-[9px] text-gray-400 uppercase font-bold tracking-tighter">{word.count} occ.</div>
                      </div>
                      <div className="flex items-center gap-4">
                         <div className="w-16 h-1 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-secondary transition-all duration-1000" style={{ width: `${word.masteryScore * 100}%` }} />
                         </div>
                      </div>
                   </div>
                 ))}
              </div>
           </div>
         ) : (
           <div className="flex-1 bg-surface/20 p-12 rounded-[3rem] border border-black/5 border-dashed flex flex-col justify-center items-center text-center opacity-30">
              <div className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center mb-4">
                <span className="text-xs font-display">§</span>
              </div>
              <p className="text-xs font-serif text-gray-500 leading-relaxed italic max-w-[200px]">Choose a zone above to begin detailed exploration.</p>
           </div>
         )}
      </div>
    </div>
  );
};

export default LexisDeck;
