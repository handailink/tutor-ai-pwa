import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import './BottomTabs.css';

type TabItem = {
  path: string;
  label: string;
  icon: string;
};

const TABS: TabItem[] = [
  { path: '/app/homework', label: '宿題管理', icon: '📝' },
  { path: '/app/lessons', label: '授業管理', icon: '📖' },
  { path: '/app/tests', label: 'テスト管理', icon: '🧪' },
];

export const BottomTabs: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();

  const handleLogout = async () => {
    if (!window.confirm('ログアウトしますか？')) return;
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch {
      alert('ログアウトに失敗しました。もう一度試してね');
    }
  };

  return (
    <nav className="bottom-tabs" aria-label="メインナビゲーション">
      {TABS.map((tab) => {
        const isActive = location.pathname === tab.path;
        return (
          <button
            key={tab.path}
            className={`bottom-tab ${isActive ? 'active' : ''}`}
            onClick={() => navigate(tab.path)}
            aria-label={tab.label}
            aria-current={isActive ? 'page' : undefined}
          >
            <span className="bottom-tab-icon" aria-hidden="true">{tab.icon}</span>
            <span className="bottom-tab-label">{tab.label}</span>
          </button>
        );
      })}
      <button
        type="button"
        className="bottom-tab bottom-tab-logout"
        onClick={handleLogout}
        aria-label="ログアウト"
      >
        <span className="bottom-tab-icon" aria-hidden="true">🚪</span>
        <span className="bottom-tab-label">ログアウト</span>
      </button>
    </nav>
  );
};

