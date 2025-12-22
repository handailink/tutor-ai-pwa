import React, { useState, useRef } from 'react';
import { Attachment } from '../../types';
import { generateId } from '../../utils/id';
import { uploadAttachment, createSignedUrl, removeAttachment as removeStorageAttachment } from '../../services/storage.service';
import { isSupabaseConfigured } from '../../lib/supabase';
import './Composer.css';

interface ComposerProps {
  onSend: (content: string, attachments: Attachment[]) => void;
  disabled?: boolean;
  threadId?: string | null;
  userId?: string;
}

export const Composer: React.FC<ComposerProps> = ({ onSend, disabled, threadId, userId }) => {
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  const handleSend = () => {
    if ((content.trim() || attachments.length > 0) && !disabled && !isUploading) {
      onSend(content, attachments);
      setContent('');
      setAttachments([]);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('[Composer] handleFileSelect called');
    const fileList = e.target.files;
    console.log('[Composer] files:', fileList);
    if (!fileList || fileList.length === 0) {
      console.log('[Composer] No files selected');
      return;
    }

    // FileListをコピーしてから input をリセット
    // （e.target.value = '' するとFileListの参照が失われるため）
    const files = Array.from(fileList);
    console.log('[Composer] files copied:', files.length);

    // input をリセット（同じファイルを再選択できるように）
    e.target.value = '';

    for (const file of files) {
      console.log('[Composer] Processing file:', file.name, file.type, file.size);
      if (!file.type.startsWith('image/')) {
        console.log('[Composer] Skipping non-image file:', file.type);
        continue;
      }

      // まずローカルプレビュー用にBase64を読み込む
      console.log('[Composer] Starting FileReader for:', file.name);
          const reader = new FileReader();
      reader.onload = async (event) => {
        console.log('[Composer] FileReader onload fired');
        const localDataUrl = event.target?.result as string;
        console.log('[Composer] localDataUrl length:', localDataUrl?.length);
        const tempId = generateId();

        // 仮の添付として追加（ローカルプレビュー）
        const tempAttachment: Attachment = {
          id: tempId,
              type: 'image',
          urlOrData: localDataUrl,
              name: file.name,
          mime: file.type,
          size: file.size,
            };
        setAttachments((prev) => [...prev, tempAttachment]);

        // Supabase が設定されていればアップロード（threadIdがなければ 'pending' を使用）
        if (isSupabaseConfigured()) {
          const uploadThreadId = threadId || 'pending';
          console.log('[Composer] Uploading to Supabase, threadId:', uploadThreadId);
          setIsUploading(true);
          try {
            const result = await uploadAttachment(file, uploadThreadId, userId);
            const signedUrl = await createSignedUrl(result.path);

            // アップロード成功したら、pathと署名URLで更新
            setAttachments((prev) =>
              prev.map((att) =>
                att.id === tempId
                  ? {
                      ...att,
                      path: result.path,
                      urlOrData: signedUrl,
                      mime: result.mime,
                      size: result.size,
                    }
                  : att
              )
            );
          } catch (error) {
            console.error('[Composer] アップロードエラー:', error);
            // アップロード失敗してもローカルプレビューは維持
            // ユーザーに通知
            alert('画像のアップロードに失敗しました。ローカルデータで送信します。');
          } finally {
            setIsUploading(false);
          }
        }
          };
          reader.readAsDataURL(file);
    }
  };

  const handleCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFileSelect(e);
  };

  const startVoiceRecognition = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('お使いのブラウザは音声認識に対応していません');
      return;
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'ja-JP';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsRecording(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setContent((prev) => prev + transcript);
      setIsRecording(false);
    };

    recognition.onerror = () => {
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.start();
    recognitionRef.current = recognition;
  };

  const stopVoiceRecognition = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }
  };

  const removeAttachment = async (id: string) => {
    const att = attachments.find((a) => a.id === id);
    
    // Storageにアップロード済みの場合は削除を試みる
    if (att?.path && isSupabaseConfigured()) {
      try {
        await removeStorageAttachment(att.path);
      } catch (error) {
        console.error('[Composer] Storage削除エラー:', error);
        // 削除失敗してもUIからは除去する
      }
    }
    
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <div className="composer">
      {attachments.length > 0 && (
        <div className="composer-attachments">
          {attachments.map((att) => (
            <div key={att.id} className="composer-attachment">
              <img src={att.urlOrData} alt={att.name} />
              <button
                type="button"
                className="composer-remove-attachment"
                onClick={() => removeAttachment(att.id)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="composer-input-container">
        <div className="composer-buttons">
          <button
            type="button"
            className="composer-button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            title="画像をアップロード"
          >
            📷
          </button>
          <button
            type="button"
            className="composer-button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={disabled}
            title="カメラで撮影"
          >
            📸
          </button>
          <button
            type="button"
            className={`composer-button ${isRecording ? 'recording' : ''}`}
            onClick={isRecording ? stopVoiceRecognition : startVoiceRecognition}
            disabled={disabled}
            title="音声入力"
          >
            {isRecording ? '⏹' : '🎤'}
          </button>
        </div>

        <textarea
          className="composer-textarea"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder="メッセージを入力..."
          rows={1}
          disabled={disabled}
          lang="ja"
          inputMode="text"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />

        <button
          type="button"
          className="composer-send"
          onClick={handleSend}
          disabled={disabled || isUploading || (!content.trim() && attachments.length === 0)}
        >
          {isUploading ? '⏳' : '送信'}
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleCameraCapture}
        style={{ display: 'none' }}
      />
    </div>
  );
};

