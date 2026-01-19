import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
    </nav>
  );
};

