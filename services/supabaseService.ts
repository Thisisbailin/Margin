
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * 辅助函数：从多源获取环境变量
 */
const getEnv = (key: string): string => {
  try { if (process.env[key]) return process.env[key] as string; } catch {}
  try { 
    const metaEnv = (import.meta as any).env;
    if (metaEnv && metaEnv[key]) return metaEnv[key]; 
  } catch {}
  try { if ((globalThis as any).process?.env?.[key]) return (globalThis as any).process.env[key]; } catch {}
  return '';
};

// 适配多种命名习惯
const supabaseUrl = getEnv('VITE_SUPABASE_URL') || getEnv('SUPABASE_URL');
const supabaseKey = getEnv('VITE_SUPABASE_ANON_KEY') || getEnv('SUPABASE_ANON_KEY');

let supabase: SupabaseClient | null = null;

if (supabaseUrl && supabaseKey) {
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
