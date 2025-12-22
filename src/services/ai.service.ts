export class AIService {
  /**
   * AI応答を生成（モック実装）
   * @param userMessage ユーザーのメッセージ
   * @returns AI応答テキスト
   */
  async generateResponse(userMessage: string): Promise<string> {
    // モック応答：0.5-1秒後に固定テンプレートを返す
    await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 500));

    const responses = [
      `なるほど、「${userMessage}」について理解しました。\n\nこの問題を解くには、まず基本的な概念を確認しましょう。一緒に考えていきましょう！`,
      `良い質問ですね！「${userMessage}」に関して、以下のポイントを押さえることが重要です：\n\n1. 基礎をしっかり理解する\n2. 練習問題を解く\n3. 間違いを振り返る\n\n一歩ずつ進めていきましょう。`,
      `了解しました。「${userMessage}」について説明しますね。\n\nこの内容は重要なポイントなので、一緒に確認していきましょう。まずは基本から始めます。`,
      `その通りです！「${userMessage}」を理解するために、具体例を見てみましょう。\n\n例えば、日常生活の中でも同じような考え方が使えますよ。`,
    ];

    return responses[Math.floor(Math.random() * responses.length)];
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

