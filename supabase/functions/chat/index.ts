// Supabase Edge Function: chat
// OpenAI APIを使用して小学生向けAI家庭教師の応答を生成

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface RequestBody {
  messages: Message[];
  projectName?: string;
}

serve(async (req) => {
  // CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // リクエストボディを取得
    const body = await req.json();
    console.log('📥 Received request body:', JSON.stringify(body, null, 2));
    
    const { messages, projectName }: RequestBody = body;

    if (!messages || messages.length === 0) {
      console.error('❌ Messages validation failed:', { messages, hasMessages: !!messages, length: messages?.length });
      throw new Error('メッセージが空です');
    }
    
    console.log('✅ Messages validated:', messages.length, 'messages');

    // OpenAI API キーを取得
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY が設定されていません');
    }

    // システムプロンプト（小学生向け家庭教師AI）
    const systemPrompt = `あなたは小学生向けの優しい家庭教師AIです。以下のルールを守って回答してください：

1. 小学生が理解できる言葉で、わかりやすく説明する
2. 難しい言葉を使う場合は、簡単な言葉で補足する
3. 答えを直接教えるのではなく、考え方やヒントを与える
4. 励ましの言葉を入れて、学習意欲を高める
5. 具体例や図を使った説明を心がける
6. 質問には丁寧に答え、間違いを指摘する時も優しく
7. マークダウン形式で読みやすく整形する（見出し、箇条書き、太字など）
${projectName ? `\n現在の学習プロジェクト: ${projectName}` : ''}`;

    // OpenAI APIにリクエスト
    console.log('🤖 Calling OpenAI API...');
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // コスト効率の良いモデル
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    console.log('📡 OpenAI API response status:', response.status);

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ OpenAI API error:', error);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const aiMessage = data.choices[0]?.message?.content;

    if (!aiMessage) {
      console.error('❌ AI response is empty:', data);
      throw new Error('AI応答が空です');
    }
    
    console.log('✅ AI response generated successfully');

    return new Response(
      JSON.stringify({ message: aiMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('❌ Error occurred:', error);
    console.error('Error details:', {
      name: error?.name,
      message: error?.message,
      stack: error?.stack,
    });
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: error instanceof Error ? error.stack : String(error)
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});

