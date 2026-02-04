
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Document, InteractionLog, LexemeIndex, Project } from '../types';

/**
 * 辅助函数：从多源获取环境变量
 */
const getEnv = (key: string): string => {
  const normalize = (value: unknown): string => {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim();
    if (!trimmed) return '';
    const lowered = trimmed.toLowerCase();
    if (lowered === 'undefined' || lowered === 'null') return '';
    return trimmed;
  };

  try { return normalize(process.env[key]); } catch {}
  try { 
    const metaEnv = (import.meta as any).env;
    if (metaEnv && metaEnv[key]) return normalize(metaEnv[key]); 
  } catch {}
  try { return normalize((globalThis as any).process?.env?.[key]); } catch {}
  return '';
};

// 适配多种命名习惯
const supabaseUrl = getEnv('VITE_SUPABASE_URL') || getEnv('SUPABASE_URL');
const supabaseKey = getEnv('VITE_SUPABASE_ANON_KEY') || getEnv('SUPABASE_ANON_KEY');

const isLikelySupabaseUrl = (value: string): boolean => {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname.endsWith('.supabase.co');
  } catch {
    return false;
  }
};

let supabase: SupabaseClient | null = null;

if (isLikelySupabaseUrl(supabaseUrl) && supabaseKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log("Supabase initialized successfully.");
  } catch (err) {
    console.error("Failed to initialize Supabase client:", err);
  }
} else {
  console.warn("Supabase configuration is incomplete. Material storage will be disabled.");
}

const BUCKET_NAME = 'margin_books';
const AVATAR_BUCKET_NAME = 'margin_avatars';
const PROJECT_TABLE = 'margin_projects';
const DOCUMENT_TABLE = 'margin_documents';

/**
 * 上传 EPUB 到 Supabase Storage (按用户隔离)
 */
export const uploadEpubToSupabase = async (file: File, bookId: string, userId: string): Promise<string> => {
  if (!supabase) {
    console.warn("Supabase not available for upload.");
    return "";
  }

  const filePath = `users/${userId}/books/${bookId}/${file.name}`;
  
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, {
        upsert: true
      });

    if (error) throw error;
    return data.path;
  } catch (error) {
    console.error('Supabase Upload Error:', error);
    // 即使上传失败，也返回空字符串，让 App 继续运行（本地处理）
    return "";
  }
};

/**
 * 获取文件链接
 */
export const getEpubUrl = async (path: string): Promise<string> => {
  if (!supabase || !path) return '';
  
  try {
    const { data } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(path, 60 * 60);
    return data?.signedUrl || '';
  } catch (e) {
    return '';
  }
};

export const uploadAvatarToSupabase = async (
  file: File,
  userId: string
): Promise<{ path: string; publicUrl: string }> => {
  if (!supabase) {
    console.warn("Supabase not available for upload.");
    return { path: '', publicUrl: '' };
  }

  const fileExt = file.name.split('.').pop() || 'png';
  const filePath = `users/${userId}/avatar/${Date.now()}.${fileExt}`;

  try {
    const { data, error } = await supabase.storage
      .from(AVATAR_BUCKET_NAME)
      .upload(filePath, file, {
        upsert: true,
        contentType: file.type || 'image/png'
      });

    if (error) throw error;

    const { data: publicData } = supabase.storage.from(AVATAR_BUCKET_NAME).getPublicUrl(data.path);
    if (publicData?.publicUrl) {
      return { path: data.path, publicUrl: publicData.publicUrl };
    }

    const signed = await supabase.storage.from(AVATAR_BUCKET_NAME).createSignedUrl(data.path, 60 * 60 * 24 * 365);
    return { path: data.path, publicUrl: signed.data?.signedUrl || '' };
  } catch (error) {
    console.error('Supabase Avatar Upload Error:', error);
    return { path: '', publicUrl: '' };
  }
};

export type StoredProjectRow = {
  id: string;
  user_id: string;
  name: string;
  description: string;
  lexeme_index?: LexemeIndex | null;
  interaction_log?: InteractionLog | null;
  active_document_id?: string | null;
};

export type StoredDocumentRow = {
  id: string;
  user_id: string;
  project_id: string;
  data: Document;
  title?: string | null;
  author?: string | null;
  language?: string | null;
  type?: string | null;
};

export const isSupabaseReady = (): boolean => Boolean(supabase);

export const upsertProjectSnapshot = async (
  project: Project,
  userId: string,
  activeDocumentId?: string
): Promise<boolean> => {
  if (!supabase) {
    console.warn("Supabase not available for project upsert.");
    return false;
  }

  const payload: StoredProjectRow & { updated_at: string } = {
    id: project.id,
    user_id: userId,
    name: project.name,
    description: project.description,
    lexeme_index: project.lexemeIndex,
    interaction_log: project.interactionLog,
    active_document_id: activeDocumentId ?? null,
    updated_at: new Date().toISOString()
  };

  try {
    const { error } = await supabase
      .from(PROJECT_TABLE)
      .upsert(payload, { onConflict: 'id' });
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Supabase Project Upsert Error:', error);
    return false;
  }
};

export const upsertDocumentSnapshot = async (
  document: Document,
  projectId: string,
  userId: string
): Promise<boolean> => {
  if (!supabase) {
    console.warn("Supabase not available for document upsert.");
    return false;
  }

  const payload: StoredDocumentRow & { updated_at: string } = {
    id: document.id,
    user_id: userId,
    project_id: projectId,
    data: document,
    title: document.title,
    author: document.author ?? null,
    language: document.language ?? null,
    type: document.type,
    updated_at: new Date().toISOString()
  };

  try {
    const { error } = await supabase
      .from(DOCUMENT_TABLE)
      .upsert(payload, { onConflict: 'id' });
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Supabase Document Upsert Error:', error);
    return false;
  }
};

export const fetchProjectSnapshot = async (
  userId: string
): Promise<{ project: StoredProjectRow; documents: Document[] } | null> => {
  if (!supabase) {
    console.warn("Supabase not available for fetch.");
    return null;
  }

  try {
    const { data: projectRows, error: projectError } = await supabase
      .from(PROJECT_TABLE)
      .select('id,user_id,name,description,lexeme_index,interaction_log,active_document_id,updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1);

    if (projectError) throw projectError;
    const project = projectRows?.[0] as StoredProjectRow | undefined;
    if (!project) return null;

    const { data: docRows, error: docError } = await supabase
      .from(DOCUMENT_TABLE)
      .select('data')
      .eq('user_id', userId)
      .eq('project_id', project.id)
      .order('created_at', { ascending: true });

    if (docError) throw docError;
    const documents = (docRows || [])
      .map((row: { data?: Document | null }) => row.data)
      .filter(Boolean) as Document[];

    return { project, documents };
  } catch (error) {
    console.error('Supabase Fetch Project Error:', error);
    return null;
  }
};
