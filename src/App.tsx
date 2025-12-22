import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login } from './components/Auth/Login';
import { Chat } from './pages/Chat';
import { Homework } from './pages/Homework';
import { Parent } from './pages/Parent';
import { BottomTabs } from './components/Layout/BottomTabs';
import './styles/global.css';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        padding: '20px',
        textAlign: 'center',
        color: 'var(--text-secondary)',
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          border: '4px solid var(--bg-secondary)',
          borderTop: '4px solid var(--primary)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          marginBottom: '16px',
        }}></div>
        <p>読み込み中...</p>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const AppRoutes: React.FC = () => {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/app/chat" replace /> : <Login />} />
      <Route
        path="/app/chat"
        element={
          <ProtectedRoute>
            <Chat />
            <BottomTabs />
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/homework"
        element={
          <ProtectedRoute>
            <Homework />
            <BottomTabs />
          </ProtectedRoute>
        }
      />
      <Route path="/app/tests" element={<Navigate to="/app/parent" replace />} />
      <Route
        path="/app/parent"
        element={
          <ProtectedRoute>
            <Parent />
            <BottomTabs />
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Navigate to="/app/chat" replace />} />
      <Route path="*" element={<Navigate to="/app/chat" replace />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

