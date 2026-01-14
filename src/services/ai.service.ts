import { supabase } from '../lib/supabase';

type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export class AIService {
  /**
   * AI応答を生成（Supabase Edge Function /functions/v1/chat を呼び出す）
   * @param userMessage ユーザーのメッセージ
   * @param projectName 任意：プロジェクト名（プロンプトに渡す用途）
   * @returns AI応答テキスト
   */
  async generateResponse(userMessage: string, projectName: string = 'Link'): Promise<string> {
    const messages: ChatMessage[] = [{ role: 'user', content: userMessage }];
    return this.generateResponseFromMessages(messages, projectName);
  }

  /**
   * 既存の会話メッセージ配列からAI応答を生成
   * @param messages Chat Completions形式のmessages
   * @param projectName 任意：プロジェクト名
   */
  async generateResponseFromMessages(messages: ChatMessage[], projectName: string = 'Link'): Promise<string> {
    // 簡易バリデーション
    const trimmed = (messages ?? [])
      .filter((m) => m && typeof m.content === 'string' && m.content.trim().length > 0)
      .slice(-20) // 念のため上限
      .map((m) => ({ role: m.role, content: m.content.trim() }));

    if (trimmed.length === 0) {
      throw new Error('メッセージが空です');
    }

    if (!supabase) {
      throw new Error('Supabase is not configured. Check VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in your env.');
    }

    const { data, error } = await supabase.functions.invoke('chat', {
      body: {
        messages: trimmed,
        projectName,
      },
    });

    if (error) {
      // supabase-js の FunctionsError は message を持つ
      throw new Error(error.message || 'AIの呼び出しに失敗しました');
    }

    const message = (data as any)?.message;
    if (!message || typeof message !== 'string') {
      throw new Error('AIの応答形式が不正です');
    }

    return message;
  }

  /**
   * チャットのタイトルを生成
   * @param firstMessage 最初のメッセージ
   * @returns タイトル
   */
  async generateThreadTitle(firstMessage: string): Promise<string> {
    // 先頭20文字をタイトルにする
    const title = firstMessage.slice(0, 20).trim();
    return title || '新しいチャット';
  }
}
