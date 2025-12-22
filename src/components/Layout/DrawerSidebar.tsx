import React, { useState, useEffect, useCallback } from 'react';
import { Project, Thread } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import './DrawerSidebar.css';

interface DrawerSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  threads: Thread[];
  selectedProjectId: string | null;
  selectedThreadId: string | null;
  onSelectProject: (projectId: string) => void;
  onSelectThread: (threadId: string) => void;
  onCreateProject: () => void;
  onCreateThread: () => void;
  onSearch: (query: string) => void;
}

export const DrawerSidebar: React.FC<DrawerSidebarProps> = ({
  isOpen,
  onClose,
  projects,
  threads,
  selectedProjectId,
  selectedThreadId,
  onSelectProject,
  onSelectThread,
  onCreateProject,
  onCreateThread,
  onSearch,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const { user, logout } = useAuth();

  // ESCキーで閉じる
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && isOpen) {
      onClose();
    }
  }, [isOpen, onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    onSearch(query);
  };

  const handleLogout = async () => {
    if (confirm('ログアウトしますか？')) {
      await logout();
      window.location.href = '/login';
    }
  };

  const filteredThreads = threads.filter(
    (t) =>
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      searchQuery === ''
  );

  return (
    <>
      {isOpen && <div className="drawer-overlay" onClick={onClose} />}
      <aside className={`drawer-sidebar ${isOpen ? 'open' : ''}`}>
        <div className="drawer-header">
          <h2 className="drawer-title">プロジェクト</h2>
          <button className="drawer-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="drawer-section">
          <button className="drawer-button" onClick={onCreateProject}>
            + プロジェクト追加
          </button>
        </div>

        <div className="drawer-section">
          <h3 className="drawer-section-title">教科</h3>
          {projects.map((project) => (
            <button
              key={project.id}
              className={`drawer-item ${
                selectedProjectId === project.id ? 'active' : ''
              }`}
              onClick={() => onSelectProject(project.id)}
            >
              {project.name}
            </button>
          ))}
        </div>

        <div className="drawer-section">
          <div className="drawer-section-header">
            <h3 className="drawer-section-title">スレッド</h3>
            <button className="drawer-button-small" onClick={onCreateThread}>
              + 新規
            </button>
          </div>
          <input
            type="text"
            className="drawer-search"
            placeholder="検索..."
            value={searchQuery}
            onChange={handleSearchChange}
          />
          <div className="drawer-thread-list">
            {filteredThreads.map((thread) => (
              <button
                key={thread.id}
                className={`drawer-item ${
                  selectedThreadId === thread.id ? 'active' : ''
                }`}
                onClick={() => onSelectThread(thread.id)}
              >
                {thread.title}
              </button>
            ))}
          </div>
        </div>

        {/* ログアウトセクション */}
        <div className="drawer-footer">
          <div className="drawer-user-info">
            {user?.email && <span className="drawer-user-email">{user.email}</span>}
          </div>
          <button className="drawer-logout-button" onClick={handleLogout}>
            🚪 ログアウト
          </button>
        </div>
      </aside>
    </>
  );
};
