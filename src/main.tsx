import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { isSupabaseConfigured, getSupabaseConfigError, logSupabaseConfig } from './lib/supabase'

// 開発環境でSupabase設定状態をログ出力
logSupabaseConfig();

// Supabase設定チェック（未設定でも動作するが警告を表示）
if (!isSupabaseConfigured()) {
  const errorMessage = getSupabaseConfigError();
  if (errorMessage) {
    console.warn('[Supabase]', errorMessage);
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

