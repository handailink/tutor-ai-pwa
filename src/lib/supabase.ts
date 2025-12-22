/**
 * Supabase クライアント初期化
 * 
 * 環境変数から接続情報を読み取り、Supabaseクライアントを作成します。
 * 環境変数が未設定の場合は、分かりやすいエラーメッセージを表示します。
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// 環境変数の取得
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Supabase設定が有効かどうかをチェック
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

/**
 * Supabase設定エラーを表示
 * 環境変数が未設定の場合に呼び出される
 */
export function getSupabaseConfigError(): string | null {
  const missing: string[] = [];
  
  if (!supabaseUrl) {
    missing.push('VITE_SUPABASE_URL');
  }
  if (!supabaseAnonKey) {
    missing.push('VITE_SUPABASE_ANON_KEY');
  }
  
  if (missing.length === 0) {
    return null;
  }
  
  return `Supabase設定が未完了です。以下の環境変数を .env.local に設定してください:\n${missing.join('\n')}\n\n設定後、開発サーバーを再起動してください。`;
}

/**
 * Supabase設定をコンソールに出力（デバッグ用）
 */
export function logSupabaseConfig(): void {
  if (import.meta.env.DEV) {
    console.log('[Supabase] URL設定:', supabaseUrl ? '✓' : '✗');
    console.log('[Supabase] Anon Key設定:', supabaseAnonKey ? '✓' : '✗');
  }
}

/** Storage バケット名 */
export const SUPABASE_BUCKET =
  import.meta.env.VITE_SUPABASE_BUCKET ?? 'attachments';

/**
 * Supabase クライアント
 * 環境変数が設定されている場合のみ有効なクライアントを返す
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// 起動時にSupabase設定状態をログ出力
if (import.meta.env.DEV) {
  console.log('[Supabase] 設定状態:', isSupabaseConfigured() ? '✓設定済み' : '✗未設定（モック動作）');
  if (!isSupabaseConfigured()) {
    const error = getSupabaseConfigError();
    if (error) {
      console.warn('[Supabase]', error);
    }
  }
}

// 環境変数の値をエクスポート（他のモジュールで使用する場合）
export const config = {
  url: supabaseUrl || '',
  anonKey: supabaseAnonKey || '',
  bucket: SUPABASE_BUCKET,
};

