import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { DrawerSidebar } from '../components/Layout/DrawerSidebar';
import { ChatWindow } from '../components/Chat/ChatWindow';
import { Composer } from '../components/Chat/Composer';
import { ProjectRepository, ThreadRepository, MessageRepository } from '../repositories';
import { ProjectService, AIService } from '../services';
import { Project, Thread, Message, Attachment } from '../types';
import { generateId } from '../utils/id';
import './Chat.css';

export const Chat: React.FC = () => {
  const { user, logout } = useAuth();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Repositoryをメモ化して再生成を防ぐ
  const projectRepository = useMemo(() => new ProjectRepository(), []);
  const threadRepository = useMemo(() => new ThreadRepository(), []);
  const messageRepository = useMemo(() => new MessageRepository(), []);
  const projectService = useMemo(() => new ProjectService(), []);
  const aiService = useMemo(() => new AIService(), []);

  const handleLogout = useCallback(async () => {
    if (confirm('ログアウトしますか？')) {
      await logout();
    }
  }, [logout]);

  const loadProjects = useCallback(async () => {
    if (!user) return;
    const userProjects = await projectService.getProjectsByUserId(user.id);
    setProjects(userProjects);
    if (userProjects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(userProjects[0].id);
    }
  }, [user, projectService, selectedProjectId]);

  const loadThreads = useCallback(async () => {
    if (!user || !selectedProjectId) return;
    const projectThreads = await threadRepository.findByUserIdAndProjectId(user.id, selectedProjectId);
    setThreads(projectThreads);
  }, [user, selectedProjectId, threadRepository]);

  const loadMessages = useCallback(async () => {
    if (!selectedThreadId) return;
    const threadMessages = await messageRepository.findByThreadId(selectedThreadId);
    setMessages(threadMessages);
  }, [selectedThreadId, messageRepository]);

  useEffect(() => {
    if (user) {
      loadProjects();
    }
  }, [user, loadProjects]);

  useEffect(() => {
    if (selectedProjectId) {
      loadThreads();
    }
  }, [selectedProjectId, loadThreads]);

  useEffect(() => {
    if (selectedThreadId) {
      loadMessages();
    } else {
      setMessages([]);
    }
  }, [selectedThreadId, loadMessages]);

  const handleCreateProject = async () => {
    const name = prompt('プロジェクト名を入力してください');
    if (name && user) {
      const newProject = await projectRepository.createProject(user.id, name);
      setProjects([...projects, newProject]);
      setSelectedProjectId(newProject.id);
    }
  };

  const handleCreateThread = async () => {
    if (!user || !selectedProjectId) {
      alert('プロジェクトを選択してください');
      return;
    }
    const title = '新しいチャット';
    const newThread = await threadRepository.createThread(user.id, selectedProjectId, title);
    setThreads([newThread, ...threads]);
    setSelectedThreadId(newThread.id);
  };

  const handleSelectProject = (projectId: string) => {
    setSelectedProjectId(projectId);
    setSelectedThreadId(null);
    setMessages([]);
  };

  const handleSelectThread = (threadId: string) => {
    setSelectedThreadId(threadId);
    setIsDrawerOpen(false);
  };

  const handleSearch = (_query: string) => {
    // 検索はDrawerSidebar内でフィルタリング済み
  };

  const handleSendMessage = async (content: string, attachments: Attachment[]) => {
    console.log('[Chat] handleSendMessage called');
    console.log('[Chat] content:', content);
    console.log('[Chat] user:', user);
    console.log('[Chat] selectedProjectId:', selectedProjectId);
    
    if (!user || !selectedProjectId) {
      console.log('[Chat] ユーザーまたはプロジェクトが未選択');
      return;
    }

    try {
      let threadId = selectedThreadId;
      if (!threadId) {
        console.log('[Chat] 新しいスレッドを作成します');
        const title = await aiService.generateThreadTitle(content);
        const newThread = await threadRepository.createThread(user.id, selectedProjectId, title);
        setThreads([newThread, ...threads]);
        threadId = newThread.id;
        setSelectedThreadId(threadId);
      }

      // 添付ファイルからBase64データを除去（Storageパスのみ保存）
      const sanitizedAttachments = attachments.map((att) => ({
        ...att,
        // pathがある場合は、urlOrDataをpathに置き換える（Base64を保存しない）
        urlOrData: att.path || att.urlOrData,
      }));

      const userMessage: Message = {
        id: generateId(),
        userId: user.id,
        threadId,
        role: 'user',
        content,
        createdAt: new Date().toISOString(),
        attachments: sanitizedAttachments.length > 0 ? sanitizedAttachments : undefined,
        meta: {
          source: attachments.length > 0 && attachments[0].type === 'image' ? 'camera' : 'text',
        },
      };

      await messageRepository.createMessage(userMessage);
      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      console.log('[Chat] AI応答を生成します（モック）');
      
      // AI応答を生成（モック実装）
      const aiResponse = await aiService.generateResponse(content);
      console.log('[Chat] AI応答を受信:', aiResponse);
      
      const assistantMessage: Message = {
        id: generateId(),
        userId: user.id,
        threadId,
        role: 'assistant',
        content: aiResponse,
        createdAt: new Date().toISOString(),
      };

      await messageRepository.createMessage(assistantMessage);
      setMessages((prev) => [...prev, assistantMessage]);

      // スレッドの更新日時を更新
      await threadRepository.updateThread(threadId, {
        updatedAt: new Date().toISOString(),
      } as Partial<Thread>);
    } catch (error: any) {
      console.error('[Chat] メッセージ送信エラー:', error);
      console.error('[Chat] エラー詳細:', error.message, error.stack);
      alert('メッセージの送信に失敗しました。もう一度試してみてください。\nエラー: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="chat-page">
      <header className="chat-header">
        <button
          className="chat-menu-button"
          onClick={() => setIsDrawerOpen(true)}
          aria-label="メニューを開く"
        >
          ☰
        </button>
        <h1 className="chat-header-title">
          {selectedProjectId
            ? projects.find((p) => p.id === selectedProjectId)?.name || 'Chat'
            : 'Chat'}
        </h1>
        <button
          className="chat-logout-button"
          onClick={handleLogout}
          aria-label="ログアウト"
          title="ログアウト"
        >
          ログアウト
        </button>
      </header>

      <div className="chat-content">
        <DrawerSidebar
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          projects={projects}
          threads={threads}
          selectedProjectId={selectedProjectId}
          selectedThreadId={selectedThreadId}
          onSelectProject={handleSelectProject}
          onSelectThread={handleSelectThread}
          onCreateProject={handleCreateProject}
          onCreateThread={handleCreateThread}
          onSearch={handleSearch}
        />

        <div className="chat-main">
          <ChatWindow messages={messages} />
          <Composer
            onSend={handleSendMessage}
            disabled={isLoading}
            threadId={selectedThreadId}
            userId={user?.id}
          />
        </div>
      </div>
    </div>
  );
};
