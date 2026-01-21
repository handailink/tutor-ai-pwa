import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo, ReactNode } from 'react';
import { AuthService, ProjectService } from '../services';
import { User } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const authServiceRef = useRef<AuthService>(new AuthService());
  const projectServiceRef = useRef<ProjectService>(new ProjectService());
  const projectsInitializedRef = useRef<Set<string>>(new Set());

  // ユーザーのデフォルトプロジェクトを一度だけ初期化
  const initializeProjectsOnce = useCallback(async (userId: string) => {
    if (projectsInitializedRef.current.has(userId)) {
      return;
    }
    projectsInitializedRef.current.add(userId);
    try {
      await projectServiceRef.current.initializeDefaultProjects(userId);
    } catch (error) {
      console.error('[Auth] プロジェクト初期化エラー:', error);
    }
  }, []);

  useEffect(() => {
    console.log('[AuthContext] 初期化開始');
    console.log('[AuthContext] Supabase設定状態:', isSupabaseConfigured());
    
    let isMounted = true;
    let loadingResolved = false;
    
    // loading解除を一度だけ行うヘルパー
    const resolveLoading = () => {
      if (!loadingResolved && isMounted) {
        loadingResolved = true;
        setLoading(false);
      }
    };
    
    // タイムアウト保護：5秒後に強制的にloading解除
    const timeoutId = setTimeout(() => {
      if (!loadingResolved) {
        console.warn('[AuthContext] タイムアウト: loading を強制解除');
        // タイムアウト時はLocalStorageからユーザーを復元
        const storedUser = localStorage.getItem('tutor_ai_current_user');
        if (storedUser && isMounted) {
          try {
            const parsed = JSON.parse(storedUser);
            console.log('[AuthContext] タイムアウト時のユーザー復元:', parsed.email);
            setUser(parsed);
          } catch (e) {
            console.error('[AuthContext] ユーザー復元エラー:', e);
          }
        }
        resolveLoading();
      }
    }, 5000);
    
    // Supabase Auth セッションを監視
    if (isSupabaseConfigured() && supabase) {
      console.log('[AuthContext] Supabase認証を使用します');
      // 初期セッションを取得
      supabase.auth.getSession().then(async ({ data: { session } }) => {
        console.log('[AuthContext] セッション取得:', session ? 'あり' : 'なし');
        if (session?.user) {
          // Supabase Auth の UID を使ってユーザーを作成/更新
          const localUser: User = {
            id: session.user.id,
            email: session.user.email || '',
            createdAt: new Date().toISOString(),
          };
          console.log('[AuthContext] ユーザー設定:', localUser.email, 'ID:', localUser.id);
          if (isMounted) {
            setUser(localUser);
          }
          localStorage.setItem('tutor_ai_current_user', JSON.stringify(localUser));
          // 先にloading解除してからプロジェクト初期化（UIをブロックしない）
          clearTimeout(timeoutId);
          resolveLoading();
          // デフォルトプロジェクトを初期化（バックグラウンドで）
          initializeProjectsOnce(localUser.id).catch(console.error);
        } else {
          // Supabase運用時はセッションが無い場合ログインを要求
          console.log('[AuthContext] Supabaseセッションなし: ログインが必要です');
          if (isMounted) {
            setUser(null);
          }
          localStorage.removeItem('tutor_ai_current_user');
          clearTimeout(timeoutId);
          resolveLoading();
        }
      }).catch((error) => {
        console.error('[AuthContext] セッション取得エラー:', error);
        clearTimeout(timeoutId);
        resolveLoading();
      });

      // セッション変更を監視
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          console.log('[Auth] onAuthStateChange:', event, session?.user?.email);
          
          if (event === 'SIGNED_IN' && session?.user) {
            // Supabase Auth の UID を使ってユーザーを設定
            const localUser: User = {
              id: session.user.id,
              email: session.user.email || '',
              createdAt: new Date().toISOString(),
            };
            if (isMounted) {
              setUser(localUser);
            }
            localStorage.setItem('tutor_ai_current_user', JSON.stringify(localUser));
            // タイムアウトをクリアして loading を解除
            clearTimeout(timeoutId);
            resolveLoading();
            // デフォルトプロジェクトを初期化（バックグラウンドで）
            initializeProjectsOnce(localUser.id).catch(console.error);
          } else if (event === 'SIGNED_OUT') {
            console.log('[Auth] ログアウト完了');
            if (isMounted) {
              setUser(null);
            }
            localStorage.removeItem('tutor_ai_current_user');
          }
        }
      );

      return () => {
        isMounted = false;
        clearTimeout(timeoutId);
        subscription.unsubscribe();
      };
    } else {
      console.log('[AuthContext] ローカルストレージ認証を使用します');
      // Supabase未設定の場合はローカルストレージのみ
      const initAuth = async () => {
        try {
          const currentUser = await authServiceRef.current.restoreSession();
          console.log('[AuthContext] セッション復元:', currentUser?.email || 'なし');
          if (isMounted) {
            setUser(currentUser);
          }
          if (currentUser) {
            initializeProjectsOnce(currentUser.id).catch(console.error);
          }
        } catch (error) {
          console.error('[Auth] セッション復元エラー:', error);
          if (isMounted) {
            setUser(null);
          }
        } finally {
          clearTimeout(timeoutId);
          resolveLoading();
        }
      };
      initAuth();
      
      return () => {
        isMounted = false;
        clearTimeout(timeoutId);
      };
    }
  }, [initializeProjectsOnce]);

  const login = useCallback(async (email: string, password: string) => {
    const loggedInUser = await authServiceRef.current.login(email, password);
    setUser(loggedInUser);
    // デフォルトプロジェクトを初期化
    await initializeProjectsOnce(loggedInUser.id);
  }, [initializeProjectsOnce]);

  const register = useCallback(async (email: string, password: string) => {
    const newUser = await authServiceRef.current.register(email, password);
    setUser(newUser);
  }, []);

  const logout = useCallback(async () => {
    await authServiceRef.current.logout();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      login,
      register,
      logout,
      loading,
    }),
    [user, login, register, logout, loading]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
