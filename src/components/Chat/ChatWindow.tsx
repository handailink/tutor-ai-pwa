import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Message, Attachment } from '../../types';
import { createSignedUrl } from '../../services/storage.service';
import { isSupabaseConfigured } from '../../lib/supabase';
import './ChatWindow.css';

interface ChatWindowProps {
  messages: Message[];
}

/**
 * 添付画像コンポーネント
 * pathがある場合は署名URLを取得して表示
 */
const AttachmentImage: React.FC<{ attachment: Attachment }> = ({ attachment }) => {
  const [imageUrl, setImageUrl] = useState<string>(attachment.urlOrData);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    // pathがあり、Supabaseが設定されている場合は署名URLを取得
    if (attachment.path && isSupabaseConfigured()) {
      setIsLoading(true);
      setError(false);
      
      createSignedUrl(attachment.path)
        .then((url) => {
          setImageUrl(url);
          setIsLoading(false);
        })
        .catch((err) => {
          console.error('[AttachmentImage] 署名URL取得エラー:', err);
          // フォールバック: urlOrDataを使用
          setImageUrl(attachment.urlOrData);
          setError(true);
          setIsLoading(false);
        });
    }
  }, [attachment.path, attachment.urlOrData]);

  if (isLoading) {
    return (
      <div className="chat-attachment-loading">
        読み込み中...
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={attachment.name || '添付画像'}
      className={`chat-attachment-image ${error ? 'error' : ''}`}
      loading="lazy"
    />
  );
};

export const ChatWindow: React.FC<ChatWindowProps> = ({ messages }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="chat-window">
      {messages.length === 0 ? (
        <div className="chat-empty">
          <p>メッセージを送信して会話を始めましょう</p>
        </div>
      ) : (
        <div className="chat-messages">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`chat-message ${message.role === 'user' ? 'user' : 'assistant'}`}
            >
              <div className="chat-message-content">
                {message.role === 'user' ? (
                  <div className="chat-message-text">{message.content}</div>
                ) : (
                  <div className="chat-message-markdown">
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  </div>
                )}
                {message.attachments && message.attachments.length > 0 && (
                  <div className="chat-attachments">
                    {message.attachments.map((att) => (
                      <AttachmentImage key={att.id} attachment={att} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      )}
    </div>
  );
};

