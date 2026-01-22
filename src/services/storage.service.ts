/**
 * Storage Service
 * Supabase Storage を使用した画像アップロード・取得を担当
 */

import { supabase, SUPABASE_BUCKET, isSupabaseConfigured } from '../lib/supabase';
import { generateId } from '../utils/id';

/** アップロード結果の型 */
export interface UploadResult {
  path: string;
  mime: string;
  size: number;
  name: string;
}

/** 署名URLキャッシュ */
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

/**
 * ファイル名をサニタイズ（安全なファイル名に変換）
 * 日本語などの非ASCII文字を除去し、拡張子のみ保持
 */
function sanitizeFileName(name: string): string {
  // 拡張子を取得
  const ext = name.includes('.') ? name.split('.').pop()?.toLowerCase() || 'jpg' : 'jpg';
  
  // ASCII文字のみを抽出（日本語を除去）
  const baseName = name
    .replace(/\.[^.]+$/, '')  // 拡張子を除去
    .replace(/[^\x00-\x7F]/g, '')  // 非ASCII文字を除去
    .replace(/\s+/g, '_')      // 空白をアンダースコアに
    .replace(/[\/\\:*?"<>|]/g, '') // 特殊文字を除去
    .replace(/\.+/g, '.')      // 連続するドットを1つに
    .slice(0, 50);             // 最大50文字
  
  // ベース名が空の場合は 'image' を使用
  const finalBaseName = baseName.trim() || 'image';
  
  return `${finalBaseName}.${ext}`;
}

/**
 * 現在のユーザーIDを取得
 * Supabase Auth → ローカルストレージの順でチェック
 */
async function getCurrentUserId(): Promise<string | null> {
  // Supabase Authからユーザーを取得
  if (supabase) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        return user.id;
      }
    } catch (err) {
      console.warn('[Storage] Supabase Auth取得失敗:', err);
    }
  }

  // ローカルストレージからフォールバック
  try {
    const userData = localStorage.getItem('tutor_ai_current_user');
    if (userData) {
      const user = JSON.parse(userData);
      return user.id || null;
    }
  } catch (err) {
    console.warn('[Storage] ローカルユーザー取得失敗:', err);
  }

  return null;
}

/**
 * 画像をSupabase Storageにアップロード
 * 
 * @param file アップロードするファイル
 * @param threadId スレッドID（パス構成に使用）
 * @param fallbackUserId フォールバック用のユーザーID（propsから渡される）
 * @returns アップロード結果（path, mime, size, name）
 */
export async function uploadAttachment(
  file: File,
  threadId: string,
  fallbackUserId?: string
): Promise<UploadResult> {
  if (!isSupabaseConfigured() || !supabase) {
    throw new Error('Supabase設定が未完了です。.env.local を確認してください。');
  }

  // ユーザーIDを取得（Supabase Auth → ローカル → フォールバック）
  let userId = await getCurrentUserId();
  if (!userId && fallbackUserId) {
    userId = fallbackUserId;
  }
  if (!userId) {
    throw new Error('ユーザーIDが取得できません。再ログインしてください。');
  }
  
  // パス構成: {userId}/{threadId}/{timestamp}-{uniqueId}-{sanitizedName}
  const timestamp = Date.now();
  const uniqueId = generateId();
  const sanitizedName = sanitizeFileName(file.name);
  const path = `${userId}/${threadId}/${timestamp}-${uniqueId}-${sanitizedName}`;

  const { error } = await supabase.storage
    .from(SUPABASE_BUCKET)
    .upload(path, file, {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    console.error('[Storage] アップロードエラー:', error);
    throw new Error(`画像のアップロードに失敗しました: ${error.message}`);
  }

  return {
    path,
    mime: file.type,
    size: file.size,
    name: file.name,
  };
}

/**
 * 署名付きURLを作成（キャッシュ付き）
 * 
 * @param path Storage内のファイルパス
 * @param expiresInSec 有効期限（秒）デフォルト3600秒（1時間）
 * @returns 署名付きURL
 */
export async function createSignedUrl(
  path: string,
  expiresInSec: number = 3600
): Promise<string> {
  if (!isSupabaseConfigured() || !supabase) {
    throw new Error('Supabase設定が未完了です');
  }

  // キャッシュをチェック（有効期限5分前まで有効）
  const cached = signedUrlCache.get(path);
  const now = Date.now();
  if (cached && cached.expiresAt > now + 5 * 60 * 1000) {
    return cached.url;
  }

  const { data, error } = await supabase.storage
    .from(SUPABASE_BUCKET)
    .createSignedUrl(path, expiresInSec);

  if (error || !data?.signedUrl) {
    console.error('[Storage] 署名URL作成エラー:', error);
    throw new Error('画像URLの取得に失敗しました');
  }

  // キャッシュに保存
  signedUrlCache.set(path, {
    url: data.signedUrl,
    expiresAt: now + expiresInSec * 1000,
  });

  return data.signedUrl;
}

/**
 * 添付ファイルを削除
 * 
 * @param path Storage内のファイルパス
 */
export async function removeAttachment(path: string): Promise<void> {
  if (!isSupabaseConfigured() || !supabase) {
    throw new Error('Supabase設定が未完了です');
  }

  const { error } = await supabase.storage
    .from(SUPABASE_BUCKET)
    .remove([path]);

  if (error) {
    console.error('[Storage] 削除エラー:', error);
    throw new Error('画像の削除に失敗しました');
  }

  // キャッシュからも削除
  signedUrlCache.delete(path);
}

/**
 * 署名URLキャッシュをクリア
 */
export function clearSignedUrlCache(): void {
  signedUrlCache.clear();
}

/**
 * テスト画像をSupabase Storageにアップロード
 * 
 * @param file アップロードするファイル
 * @param testSetId テストセットID（パス構成に使用）
 * @param fallbackUserId フォールバック用のユーザーID
 * @returns アップロード結果（path, mime, size, name）
 */
export async function uploadTestImage(
  file: File,
  testSetId: string,
  fallbackUserId?: string
): Promise<UploadResult> {
  if (!isSupabaseConfigured() || !supabase) {
    throw new Error('Supabase設定が未完了です。.env.local を確認してください。');
  }

  // ユーザーIDを取得
  let userId = await getCurrentUserId();
  if (!userId && fallbackUserId) {
    userId = fallbackUserId;
  }
  if (!userId) {
    throw new Error('ユーザーIDが取得できません。再ログインしてください。');
  }
  
  // パス構成: {userId}/tests/{testSetId}/{timestamp}-{uniqueId}-{sanitizedName}
  const timestamp = Date.now();
  const uniqueId = generateId();
  const sanitizedName = sanitizeFileName(file.name);
  const path = `${userId}/tests/${testSetId}/${timestamp}-${uniqueId}-${sanitizedName}`;

  const { error } = await supabase.storage
    .from(SUPABASE_BUCKET)
    .upload(path, file, {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    console.error('[Storage] テスト画像アップロードエラー:', error);
    throw new Error(`画像のアップロードに失敗しました: ${error.message}`);
  }

  return {
    path,
    mime: file.type,
    size: file.size,
    name: file.name,
  };
}
