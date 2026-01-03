
import { createClient } from '@supabase/supabase-js';

// 适配可能存在的环境变量命名差异
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.warn("Supabase configuration is missing. Storage features will be disabled.");
}

const supabase = createClient(supabaseUrl, supabaseKey);

const BUCKET_NAME = 'margin_books';

/**
 * 上传 EPUB 到 Supabase Storage (按用户隔离)
 */
export const uploadEpubToSupabase = async (file: File, bookId: string, userId: string): Promise<string> => {
  if (!supabaseUrl) throw new Error("Supabase is not configured.");

  // 路径结构：users/{userId}/books/{bookId}/{filename}
  const filePath = `users/${userId}/books/${bookId}/${file.name}`;
  
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, file, {
      upsert: true
    });

  if (error) {
    console.error('Supabase Upload Error:', error);
    throw new Error('Failed to store book file.');
  }

  return data.path;
};

/**
 * 获取文件链接
 */
export const getEpubUrl = async (path: string): Promise<string> => {
  if (!supabaseUrl) return '';
  const { data } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(path, 60 * 60);
  return data?.signedUrl || '';
};
