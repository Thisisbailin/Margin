import React, { useEffect, useMemo, useState } from 'react';
import { UserProficiency } from '../../types';
import { DEFAULT_MODEL_SELECTION, loadModelSelection, saveModelSelection, type LLMModelTier } from '../../services/llmConfig';

interface HomeSettingsProps {
  proficiency: UserProficiency;
  onProficiencyChange: (p: UserProficiency) => void;
  isActive?: boolean;
  showClose?: boolean;
  onClose?: () => void;
  className?: string;
  panelClassName?: string;
}

type QwenModel = {
  id: string;
  description?: string;
  owned_by?: string;
  name?: string;
  summary?: string;
  display_name?: string;
  modalities?: string[];
  capabilities?: Record<string, any>;
  context_length?: number;
  contextLength?: number;
  max_context_length?: number;
  maxTokens?: number;
} & Record<string, any>;

const normalizeModalities = (value: any): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((v) => String(v).toLowerCase());
  if (typeof value === 'string') return value.split(/[,/ ]+/).map((v) => v.trim().toLowerCase()).filter(Boolean);
  return [];
};

const getModalities = (model: QwenModel) => {
  const input =
    normalizeModalities(model.modalities) ||
    normalizeModalities(model.capabilities?.modalities) ||
    normalizeModalities((model as any).input_modalities) ||
    normalizeModalities((model as any).architecture?.input_modalities);
  const output =
    normalizeModalities((model as any).output_modalities) ||
    normalizeModalities((model as any).architecture?.output_modalities);
  return { input, output };
};

const getQwenCategory = (model: QwenModel) => {
  const id = model.id.toLowerCase();
  if (id.includes('video') || id.includes('t2v') || id.includes('i2v') || id.includes('v2v')) {
    return { key: 'video', label: 'Video', tone: 'text-cyan-600 bg-cyan-500/10 border-cyan-500/30' };
  }
  if (id.includes('image') || id.includes('z-image')) {
    return { key: 'image', label: 'Image', tone: 'text-sky-600 bg-sky-500/10 border-sky-500/30' };
  }
  if (id.includes('vl')) {
    return { key: 'vision', label: 'Vision', tone: 'text-sky-600 bg-sky-500/10 border-sky-500/30' };
  }
  if (id.includes('tts') || id.includes('audio') || id.includes('speech')) {
    return { key: 'audio', label: 'Audio', tone: 'text-pink-600 bg-pink-500/10 border-pink-500/30' };
  }
  if (id.includes('coder') || id.includes('code')) {
    return { key: 'code', label: 'Code', tone: 'text-amber-600 bg-amber-500/10 border-amber-500/30' };
  }
  if (id.includes('embed')) {
    return { key: 'embedding', label: 'Embedding', tone: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/30' };
  }
  if (id.includes('rerank')) {
    return { key: 'rerank', label: 'Rerank', tone: 'text-indigo-600 bg-indigo-500/10 border-indigo-500/30' };
  }
  return { key: 'chat', label: 'Chat', tone: 'text-accent bg-accent/10 border-accent/30' };
};

const getQwenTags = (model: QwenModel) => {
  const tags: string[] = [];
  const { input, output } = getModalities(model);
  if (input.length) tags.push(`in:${input.join('/')}`);
  if (output.length) tags.push(`out:${output.join('/')}`);
  const contextLength = model.context_length || model.contextLength || model.max_context_length || model.maxTokens;
  if (typeof contextLength === 'number') {
    tags.push(`ctx:${contextLength}`);
  }
  const tools = model.capabilities?.tools || (model as any).supports_tools || (model as any).tool_calls;
  if (tools) tags.push('tools');
  const reasoning = model.capabilities?.reasoning || (model as any).supports_reasoning || (model as any).reasoning;
  if (reasoning) tags.push('reasoning');
  return tags.slice(0, 4);
};

const HomeSettings: React.FC<HomeSettingsProps> = ({
  proficiency,
  onProficiencyChange,
  isActive = true,
  showClose = false,
  onClose,
  className,
  panelClassName
}) => {
  const [activeTier, setActiveTier] = useState<LLMModelTier>('L2');
  const [modelSelection, setModelSelection] = useState(loadModelSelection());
  const [availableModels, setAvailableModels] = useState<QwenModel[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelFetchMessage, setModelFetchMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const handleKeySelection = async () => {
    try {
      if (window.aistudio && window.aistudio.openSelectKey) {
        await window.aistudio.openSelectKey();
        if (onClose) onClose();
      }
    } catch (err) {
      console.error('Failed to open key selector', err);
    }
  };

  const tiers = [
    { level: 'L1' as const, name: 'Lexical Base', model: modelSelection.L1 || DEFAULT_MODEL_SELECTION.L1 || 'qwen-plus', usage: 'Terrain 词义查询', color: 'bg-green-500/10 text-green-600' },
    { level: 'L2' as const, name: 'Contextual Margin', model: modelSelection.L2 || DEFAULT_MODEL_SELECTION.L2 || 'qwen-plus', usage: '阅读实时解析', color: 'bg-accent/10 text-accent' },
    { level: 'L3' as const, name: 'Synthesis Engine', model: modelSelection.L3 || DEFAULT_MODEL_SELECTION.L3 || 'qwen-max', usage: '项目深度研究', color: 'bg-blue-500/10 text-blue-600' },
  ];

  const qwenGroups = useMemo(() => {
    const groups = new Map<string, { key: string; label: string; tone: string; items: QwenModel[] }>();
    availableModels.forEach((model) => {
      const category = getQwenCategory(model);
      if (!groups.has(category.key)) {
        groups.set(category.key, { ...category, items: [] });
      }
      groups.get(category.key)!.items.push(model);
    });
    const order = ['chat', 'code', 'image', 'video', 'vision', 'audio', 'embedding', 'rerank'];
    return Array.from(groups.values()).sort((a, b) => {
      const ai = order.indexOf(a.key);
      const bi = order.indexOf(b.key);
      if (ai === -1 && bi === -1) return a.label.localeCompare(b.label);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }, [availableModels]);

  const applyDefaultSelection = (prev: typeof modelSelection, models: QwenModel[]) => {
    if (!models.length) return prev;
    const ids = new Set(models.map((m) => m.id));
    const findByHints = (hints: string[]) => {
      const lowerHints = hints.map((h) => h.toLowerCase());
      const found = models.find((m) => lowerHints.some((h) => m.id.toLowerCase().includes(h)));
      return found?.id;
    };

    const pick = (tier: LLMModelTier, hints: string[], fallback?: string) => {
      const current = prev[tier];
      if (current && ids.has(current)) return current;
      const hinted = findByHints(hints);
      if (hinted) return hinted;
      if (fallback && ids.has(fallback)) return fallback;
      return models[0]?.id || fallback || '';
    };

    return {
      L1: pick('L1', ['qwen-plus', 'plus', 'turbo'], DEFAULT_MODEL_SELECTION.L1),
      L2: pick('L2', ['qwen-plus', 'plus', 'turbo'], DEFAULT_MODEL_SELECTION.L2),
      L3: pick('L3', ['qwen-max', 'max', 'pro'], DEFAULT_MODEL_SELECTION.L3),
    };
  };

  const handleFetchModels = async () => {
    setIsLoadingModels(true);
    setModelFetchMessage(null);
    try {
      const response = await fetch('/api/llm/models', { method: 'GET' });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || `模型拉取失败 (${response.status})`);
      }
      const data = await response.json();
      const models: QwenModel[] = Array.isArray(data?.models) ? data.models : [];
      setAvailableModels(models);
      const groupKeys: Record<string, boolean> = {};
      models.forEach((m) => {
        groupKeys[getQwenCategory(m).key] = true;
      });
      setCollapsedGroups(groupKeys);
      setModelFetchMessage({
        type: 'success',
        text: models.length ? `获取成功，${models.length} 个模型` : '获取成功，但返回为空',
      });
      setModelSelection((prev) => applyDefaultSelection(prev, models));
    } catch (err: any) {
      setModelFetchMessage({ type: 'error', text: err?.message || '拉取失败' });
    } finally {
      setIsLoadingModels(false);
    }
  };

  const renderModelCard = (model: QwenModel) => {
    const category = getQwenCategory(model);
    const tags = getQwenTags(model);
    const description = model.description || model.summary || model.display_name || model.name || '';
    const activeForTier = modelSelection[activeTier] === model.id;
    const tierTags = (['L1', 'L2', 'L3'] as LLMModelTier[])
      .filter((tier) => modelSelection[tier] === model.id);

    return (
      <button
        key={model.id}
        type="button"
        onClick={() => setModelSelection((prev) => ({ ...prev, [activeTier]: model.id }))}
        className={`text-left rounded-2xl border p-4 bg-surface transition ${
          activeForTier ? 'border-accent shadow-[0_0_0_1px_rgba(230,90,60,0.25)]' : 'border-black/5 hover:border-accent/30'
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="text-[11px] font-bold text-ink break-all">{model.id}</div>
          <span className={`text-[9px] px-2 py-0.5 rounded-full border ${category.tone}`}>{category.label}</span>
        </div>
        {description && (
          <div className="text-[10px] text-gray-500 mt-2 line-clamp-2">{description}</div>
        )}
        {(tags.length > 0 || tierTags.length > 0) && (
          <div className="mt-2 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span key={tag} className="text-[9px] px-2 py-0.5 rounded-full border border-black/5 text-gray-400">
                {tag}
              </span>
            ))}
            {tierTags.map((tier) => (
              <span key={tier} className="text-[9px] px-2 py-0.5 rounded-full bg-accent/10 text-accent">
                {tier}
              </span>
            ))}
          </div>
        )}
      </button>
    );
  };

  useEffect(() => {
    saveModelSelection(modelSelection);
  }, [modelSelection]);

  useEffect(() => {
    if (isActive && !availableModels.length) {
      handleFetchModels();
    }
  }, [isActive]);

  if (!isActive) return null;

  return (
    <div className={`flex-1 flex flex-col overflow-hidden animate-fade-in ${className || ''}`.trim()}>
      <div className={`flex-1 h-full w-full rounded-[3rem] border border-black/5 bg-white/60 shadow-soft overflow-y-auto no-scrollbar ${panelClassName || ''}`.trim()}>
        <div className="h-full w-full p-8 md:p-12 flex flex-col gap-10">
          <div className="flex justify-between items-center">
            <h2 className="font-display text-3xl text-ink italic">Settings</h2>
            {showClose && (
              <button onClick={onClose} className="p-2 hover:bg-black/5 rounded-full transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>

          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-accent"></div>
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">Intelligence Source</h3>
            </div>
            <div className="bg-surface p-6 rounded-3xl border border-black/5">
              <div className="flex justify-between items-center mb-4">
                <span className="text-xs font-serif italic text-ink/70">API Protocol</span>
                <span className="text-[9px] font-bold text-accent uppercase tracking-widest">Active via Cloudflare</span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-gray-400 mb-3">
                <span className="uppercase tracking-[0.2em] font-bold">Provider</span>
                <span className="text-ink font-serif italic">Qwen (DashScope)</span>
              </div>
              <button
                onClick={handleKeySelection}
                className="w-full py-3 bg-ink text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-black transition-all"
              >
                Switch to Private Key
              </button>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-secondary"></div>
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">Intelligence Tiers</h3>
            </div>
            <div className="space-y-3">
              {tiers.map((tier) => (
                <div key={tier.level} className="flex items-center gap-5 p-4 bg-surface rounded-2xl border border-black/5 group hover:border-accent/30 transition-all">
                  <div className={`w-10 h-10 rounded-xl ${tier.color} flex items-center justify-center font-bold text-xs`}>{tier.level}</div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-ink">{tier.name}</span>
                      <span className="text-[9px] text-gray-400">{tier.model}</span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5">{tier.usage}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="pt-2 space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">Model Selection</div>
                <button
                  onClick={handleFetchModels}
                  className="px-3 py-1.5 rounded-full border border-black/5 text-[10px] font-bold uppercase tracking-widest text-ink hover:border-accent/30 transition-all"
                >
                  {isLoadingModels ? 'Loading...' : '拉取模型'}
                </button>
              </div>
              {modelFetchMessage && (
                <div className={`text-[10px] ${modelFetchMessage.type === 'error' ? 'text-red-500' : 'text-emerald-500'}`}>
                  {modelFetchMessage.text}
                </div>
              )}
              <div className="flex items-center gap-2">
                {(['L1', 'L2', 'L3'] as LLMModelTier[]).map((tier) => (
                  <button
                    key={tier}
                    onClick={() => setActiveTier(tier)}
                    className={`px-3 py-2 rounded-xl border text-[10px] font-bold uppercase tracking-widest transition-all ${
                      activeTier === tier ? 'bg-ink text-white border-ink' : 'bg-surface border-transparent text-gray-500 hover:border-black/10'
                    }`}
                  >
                    {tier}
                  </button>
                ))}
                <div className="text-[10px] text-gray-400 ml-auto hidden md:block">
                  L1: {modelSelection.L1 || '未设置'} · L2: {modelSelection.L2 || '未设置'} · L3: {modelSelection.L3 || '未设置'}
                </div>
              </div>
              {availableModels.length === 0 ? (
                <div className="text-[10px] text-gray-400 bg-surface rounded-2xl border border-black/5 p-4">
                  暂无模型，请先点击“拉取模型”。默认会使用 Qwen Plus / Qwen Max 组合。
                </div>
              ) : (
                <div className="space-y-5">
                  {qwenGroups.map((group) => {
                    const isCollapsed = collapsedGroups[group.key] ?? true;
                    return (
                      <div key={group.key} className="space-y-2">
                        <button
                          type="button"
                          onClick={() => setCollapsedGroups((prev) => ({ ...prev, [group.key]: !prev[group.key] }))}
                          className="w-full flex items-center justify-between text-left"
                          aria-expanded={!isCollapsed}
                        >
                          <div className="flex items-center gap-3">
                            <svg className={`w-3 h-3 transition-transform ${isCollapsed ? '' : 'rotate-90'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                              <path d="M9 18l6-6-6-6" />
                            </svg>
                            <div className="text-[10px] uppercase tracking-[0.2em] text-gray-400">{group.label}</div>
                          </div>
                          <span className="text-[9px] text-gray-400">{group.items.length} models</span>
                        </button>
                        {!isCollapsed && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {group.items.map((model) => renderModelCard(model))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-accent/30"></div>
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">Analysis Depth</h3>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {(Object.values(UserProficiency) as UserProficiency[]).map((p) => (
                <button
                  key={p}
                  onClick={() => onProficiencyChange(p)}
                  className={`py-4 rounded-2xl border text-[10px] font-bold uppercase tracking-widest transition-all ${
                    proficiency === p ? 'bg-white border-accent text-accent shadow-sm scale-105' : 'bg-surface border-transparent text-gray-400 hover:border-black/10'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </section>

          <p className="text-center text-[9px] text-gray-300 font-serif italic">
            v2.5 Hybrid Intelligence Architecture
          </p>
        </div>
      </div>
    </div>
  );
};

export default HomeSettings;
