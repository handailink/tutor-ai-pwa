import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './BottomTabs.css';

export const BottomTabs: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const tabs = [
    { path: '/app/chat', label: 'チャット', icon: '💬' },
    { path: '/app/homework', label: '宿題', icon: '📝' },
    { path: '/app/parent', label: '授業記録', icon: '📖' },
  ];

  return (
    <nav className="bottom-tabs" aria-label="メインナビゲーション">
      {tabs.map((tab) => {
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

