import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import './Auth.css';

export const Login: React.FC = () => {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // ユーザーIDに@tutor.localを付けてメールアドレス形式にする
      const email = userId.includes('@') ? userId : `${userId}@tutor.local`;
      await login(email, password);
      navigate('/app/chat');
    } catch (err: any) {
      setError('IDまたはパスワードが違います');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className="auth-title">Link学習管理</h1>
        <p className="auth-subtitle">ログイン</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-input-group">
            <label htmlFor="userId">ユーザーID</label>
            <input
              id="userId"
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              required
              autoComplete="username"
              lang="ja"
              autoCapitalize="none"
              spellCheck={false}
            />
          </div>

          <div className="auth-input-group">
            <label htmlFor="password">パスワード</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button
            type="submit"
            className="auth-button"
            disabled={loading}
          >
            {loading ? '処理中...' : 'ログイン'}
          </button>
        </form>
      </div>
    </div>
  );
};

