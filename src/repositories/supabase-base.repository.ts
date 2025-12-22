// import { supabase, isSupabaseConfigured } from '../lib/supabase';

/**
 * Supabase対応の非同期ベースリポジトリ
 * 一時的にLocalStorageのみ使用（Supabaseテーブル未作成のため）
 */
export abstract class SupabaseBaseRepository<T extends { id: string }> {
  protected abstract getTableName(): string;
  protected abstract getStorageKey(): string;

  // LocalStorage フォールバック用
  protected getFromLocalStorage(): T[] {
    const data = localStorage.getItem(this.getStorageKey());
    return data ? JSON.parse(data) : [];
  }

  protected saveToLocalStorage(items: T[]): void {
    localStorage.setItem(this.getStorageKey(), JSON.stringify(items));
  }

  // Supabase対応メソッド
  async findAll(userId: string): Promise<T[]> {
    // 一時的にLocalStorageのみ使用（Supabaseテーブル未作成のため）
    console.log(`[${this.getTableName()}] findAll - LocalStorage使用`);
    return this.getFromLocalStorage().filter((item: any) => item.userId === userId);
    
    /* Supabase版（テーブル作成後に有効化）
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from(this.getTableName())
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error(`Error fetching ${this.getTableName()}:`, error);
        // フォールバック
        return this.getFromLocalStorage().filter((item: any) => item.userId === userId);
      }
      return this.mapFromSupabase(data || []);
    }
    return this.getFromLocalStorage().filter((item: any) => item.userId === userId);
    */
  }

  async findById(id: string): Promise<T | null> {
    // 一時的にLocalStorageのみ使用
    console.log(`[${this.getTableName()}] findById - LocalStorage使用`);
    const local = this.getFromLocalStorage().find((item: any) => item.id === id);
    return local || null;
  }

  async create(item: Omit<T, 'id' | 'createdAt'> & { id?: string; createdAt?: string; updatedAt?: string }): Promise<T> {
    const now = new Date().toISOString();
    
    // 一時的にLocalStorageのみ使用
    console.log(`[${this.getTableName()}] create - LocalStorage使用`);
    const items = this.getFromLocalStorage();
    const newItem = {
      ...item,
      id: item.id || crypto.randomUUID?.() || Math.random().toString(36).slice(2),
      createdAt: item.createdAt || now,
    } as unknown as T;
    items.push(newItem);
    this.saveToLocalStorage(items);
    return newItem;
  }

  async update(id: string, updates: Partial<T>): Promise<T | null> {
    const now = new Date().toISOString();

    // 一時的にLocalStorageのみ使用
    console.log(`[${this.getTableName()}] update - LocalStorage使用`);
    const items = this.getFromLocalStorage();
    const index = items.findIndex((item: any) => item.id === id);
    if (index === -1) return null;
    items[index] = { ...items[index], ...updates, updatedAt: now } as T;
    this.saveToLocalStorage(items);
    return items[index];
  }

  async delete(id: string): Promise<boolean> {
    // 一時的にLocalStorageのみ使用
    console.log(`[${this.getTableName()}] delete - LocalStorage使用`);
    const items = this.getFromLocalStorage();
    const filtered = items.filter((item: any) => item.id !== id);
    if (filtered.length === items.length) return false;
    this.saveToLocalStorage(filtered);
    return true;
  }

  // Supabaseのsnake_case ⇔ フロントのcamelCase 変換
  // サブクラスでオーバーライド可能
  protected mapFromSupabase(data: any[]): T[] {
    return data.map((item) => this.mapSingleFromSupabase(item));
  }

  protected abstract mapSingleFromSupabase(data: any): T;
  protected abstract mapToSupabase(item: Partial<T>): any;
}

