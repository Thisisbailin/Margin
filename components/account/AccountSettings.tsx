import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { UserProficiency } from '../../types';
import { DEFAULT_AGENT_MODEL, loadDefaultAgentModel, saveDefaultAgentModel } from '../../services/agentConfig';
import { fetchClerkToken } from '../../services/clerkToken';

interface AccountSettingsProps {
  proficiency: UserProficiency;
  onProficiencyChange: (p: UserProficiency) => void;
  isActive?: boolean;
  className?: string;
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

const AccountSettings: React.FC<AccountSettingsProps> = ({ proficiency, onProficiencyChange, isActive = true, className }) => {
  const { getToken } = useAuth();
  const [defaultModel, setDefaultModel] = useState(loadDefaultAgentModel());
  const [availableModels, setAvailableModels] = useState<QwenModel[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelFetchMessage, setModelFetchMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const handleKeySelection = async () => {
    try {
      if (window.aistudio && window.aistudio.openSelectKey) {
        await window.aistudio.openSelectKey();
      }
    } catch (err) {
      console.error('Failed to open key selector', err);
    }
  };

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

  const handleFetchModels = async () => {
    setIsLoadingModels(true);
    setModelFetchMessage(null);
    try {
      const token = await fetchClerkToken(getToken);
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const response = await fetch('/api/llm/models', { method: 'GET', headers });
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
      if (models.length && !models.find((m) => m.id === defaultModel)) {
        const fallback = models.find((m) => m.id.includes(DEFAULT_AGENT_MODEL))?.id || models[0].id;
        setDefaultModel(fallback);
      }
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
    const isDefault = defaultModel === model.id;

    return (
      <button
        key={model.id}
        type="button"
        onClick={() => setDefaultModel(model.id)}
        className={`text-left rounded-2xl border p-4 bg-surface transition ${
          isDefault ? 'border-accent shadow-[0_0_0_1px_rgba(230,90,60,0.25)]' : 'border-black/5 hover:border-accent/30'
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="text-[11px] font-bold text-ink break-all">{model.id}</div>
          <span className={`text-[9px] px-2 py-0.5 rounded-full border ${category.tone}`}>{category.label}</span>
        </div>
        {description && (
          <div className="text-[10px] text-gray-500 mt-2 line-clamp-2">{description}</div>
        )}
        {(tags.length > 0 || isDefault) && (
          <div className="mt-2 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span key={tag} className="text-[9px] px-2 py-0.5 rounded-full border border-black/5 text-gray-400">
                {tag}
              </span>
            ))}
            {isDefault && (
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-accent/10 text-accent">
                DEFAULT
              </span>
            )}
          </div>
        )}
      </button>
    );
  };

  useEffect(() => {
    saveDefaultAgentModel(defaultModel);
  }, [defaultModel]);

  useEffect(() => {
    if (isActive && !availableModels.length) {
      handleFetchModels();
    }
  }, [isActive]);

  if (!isActive) return null;

  return (
    <div className={className || ''}>
      <h2 className="font-display text-2xl text-ink italic">Settings</h2>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 mt-6">
        <div className="space-y-6">
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-accent"></div>
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">Intelligence Source</h3>
            </div>
            <div className="bg-surface p-6 rounded-3xl border border-black/5">
              <div className="flex justify-between items-center mb-4">
                <span className="text-xs font-serif italic text-ink/70">Agent Orchestration</span>
                <span className="text-[9px] font-bold text-accent uppercase tracking-widest">Active</span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-gray-400 mb-3">
                <span className="uppercase tracking-[0.2em] font-bold">Default Model</span>
                <span className="text-ink font-serif italic">{defaultModel || DEFAULT_AGENT_MODEL}</span>
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
        </div>

        <div className="space-y-6">
          <section className="space-y-4">
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
            <div className="text-[10px] text-gray-400">
              Default: <span className="text-ink">{defaultModel || DEFAULT_AGENT_MODEL}</span>
            </div>
            {availableModels.length === 0 ? (
              <div className="text-[10px] text-gray-400 bg-surface rounded-2xl border border-black/5 p-4">
                暂无模型，请先点击“拉取模型”。默认使用 {DEFAULT_AGENT_MODEL}。
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
          </section>
        </div>
      </div>

      <p className="text-center text-[9px] text-gray-300 font-serif italic mt-8">
        v2.5 Hybrid Intelligence Architecture
      </p>
    </div>
  );
};

export default AccountSettings;
