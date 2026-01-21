import { UserRepository } from '../repositories';
import { User } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const CURRENT_USER_KEY = 'tutor_ai_current_user';

export class AuthService {
  private userRepository: UserRepository;

  constructor() {
    this.userRepository = new UserRepository();
  }

  async login(email: string, password: string): Promise<User> {
    // Supabase Auth を使用
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // Supabase にユーザーがいない場合は登録を試みる
        if (error.message.includes('Invalid login credentials')) {
          throw new Error('メールアドレスまたはパスワードが正しくありません');
        }
        throw new Error(error.message);
      }

      if (data.user) {
        // Supabase Auth の UID を必ず使う（古いLocalStorageユーザーのIDは無視）
        const localUser: User = {
          id: data.user.id,
          email: data.user.email || email,
          createdAt: new Date().toISOString(),
        };
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(localUser));
        return localUser;
      }
    }

    // フォールバック：モック認証
    let user = this.userRepository.findByEmail(email);
    if (!user) {
      user = this.userRepository.createUser(email);
    }
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    return user;
  }

  async register(email: string, password: string): Promise<User> {
    // Supabase Auth を使用
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        if (error.message.includes('already registered')) {
          throw new Error('このメールアドレスは既に登録されています');
        }
        throw new Error(error.message);
      }

      if (data.user) {
        // ローカルのUserRepositoryにも保存
        const localUser = this.userRepository.createUserWithId(data.user.id, email);
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(localUser));
        return localUser;
      }
    }

    // フォールバック：モック認証
    const existingUser = this.userRepository.findByEmail(email);
    if (existingUser) {
      throw new Error('このメールアドレスは既に登録されています');
    }
    const user = this.userRepository.createUser(email);
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    return user;
  }

  getCurrentUser(): User | null {
    const data = localStorage.getItem(CURRENT_USER_KEY);
    return data ? JSON.parse(data) : null;
  }

  async logout(): Promise<void> {
    console.log('[AuthService] logout開始');
    if (isSupabaseConfigured() && supabase) {
      // scope: 'local' でローカルセッションのみクリア
      // サーバー側でセッションが見つからない場合のエラーを回避
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) {
        console.error('[AuthService] Supabaseログアウトエラー:', error.message);
        // ローカルスコープでもエラーの場合は無視してローカルをクリア
      }
      console.log('[AuthService] Supabaseログアウト完了');
    }
    localStorage.removeItem(CURRENT_USER_KEY);
    console.log('[AuthService] LocalStorage削除完了');
  }

  isAuthenticated(): boolean {
    return this.getCurrentUser() !== null;
  }

  // Supabase Auth のセッションを復元
  async restoreSession(): Promise<User | null> {
    if (isSupabaseConfigured() && supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        // Supabase Auth の UID を必ず使う
        const localUser: User = {
          id: session.user.id,
          email: session.user.email || '',
          createdAt: new Date().toISOString(),
        };
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(localUser));
        return localUser;
      }
    }
    return this.getCurrentUser();
  }
}

