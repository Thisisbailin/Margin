import React from 'react';
import ReactMarkdown from 'react-markdown';
import { AgentMessage, Document, Project } from '../../types';
import ProjectContext from '../ProjectContext';

interface HomeProjectProps {
  activeProject: Project;
  activeDocument: Document | undefined;
  onDocumentSelect: (document: Document) => void;
  projectMessages: AgentMessage[];
  projectInput: string;
  setProjectInput: (val: string) => void;
  onProjectChat: () => void;
  isProjectChatLoading: boolean;
  onImportClick: () => void;
}

const HomeProject: React.FC<HomeProjectProps> = ({
  activeProject,
  activeDocument,
  onDocumentSelect,
  projectMessages,
  projectInput,
  setProjectInput,
  onProjectChat,
  isProjectChatLoading,
  onImportClick
}) => {
  const handleNewProject = () => {
    alert('当前版本只支持单项目');
  };

  const materialCount = activeProject.documents.length;

  return (
    <div className="flex-1 flex gap-12 overflow-hidden animate-fade-in mb-4">
      <div className="w-80 flex flex-col gap-8">
        <div className="bg-surface p-8 rounded-[2rem] border border-black/5 shadow-soft flex flex-col gap-6">
          <div>
            <div className="text-[9px] uppercase tracking-[0.3em] text-accent font-bold mb-3">Active Project</div>
            <h3 className="font-display text-2xl text-ink mb-2">{activeProject.name}</h3>
            <p className="text-xs font-serif text-gray-400 leading-relaxed italic">{activeProject.description}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={onImportClick}
              className="py-3 rounded-2xl bg-ink text-white text-[10px] font-bold uppercase tracking-widest hover:bg-black transition-all shadow-sm"
            >
              Import EPUB
            </button>
            <button
              onClick={handleNewProject}
              className="py-3 rounded-2xl border border-black/10 text-ink text-[10px] font-bold uppercase tracking-widest hover:border-accent/40 hover:text-accent transition-all"
            >
              New Project
            </button>
          </div>
          <div className="pt-2 border-t border-black/5">
            <div className="text-[9px] uppercase tracking-[0.3em] text-gray-400 font-bold">Materials</div>
            <div className="text-xs font-serif text-gray-400 italic mt-1">{materialCount} items in this project</div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-gray-300 font-bold mt-4">
              Supports Book / Article
            </div>
            <div className="text-[11px] font-serif italic text-gray-400 mt-1">Current import: EPUB only</div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto no-scrollbar">
          <ProjectContext
            project={activeProject}
            activeDocumentId={activeDocument?.id}
            onDocumentSelect={onDocumentSelect}
            showImport={false}
            showHeader={false}
          />
        </div>
      </div>

      <div className="flex-1 bg-white/50 rounded-[2.5rem] flex flex-col overflow-hidden border border-black/5 shadow-soft">
        <div className="flex-1 p-10 overflow-y-auto space-y-10 no-scrollbar">
          {projectMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center opacity-10">
              <span className="text-[120px] font-display mb-4">Ω</span>
              <p className="font-serif italic text-xl">Project Synthesis Workspace</p>
            </div>
          ) : (
            projectMessages.map((m) => (
              <div key={m.id} className={`max-w-2xl ${m.role === 'user' ? 'ml-auto' : 'mr-auto'}`}>
                <div
                  className={`text-[9px] uppercase tracking-widest text-gray-400 mb-3 ${
                    m.role === 'user' ? 'text-right' : ''
                  }`}
                >
                  {m.role === 'agent' ? 'Project Mentor' : 'Researcher'}
                </div>
                <div className={`prose prose-sm font-serif ${m.role === 'user' ? 'bg-accent/5 p-6 rounded-3xl italic' : 'text-ink'}`}>
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-8 bg-paper/80 border-t border-black/5">
          <div className="flex gap-4 items-center bg-white px-6 py-4 rounded-2xl shadow-sm border border-black/5">
            <input
              value={projectInput}
              onChange={(e) => setProjectInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onProjectChat()}
              placeholder="探索跨文本关联..."
              className="flex-1 bg-transparent border-none focus:ring-0 font-serif italic text-lg outline-none"
            />
            <button
              onClick={onProjectChat}
              disabled={isProjectChatLoading}
              className="text-accent hover:text-accent-hover transition-colors disabled:opacity-30"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomeProject;
