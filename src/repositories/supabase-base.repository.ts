import { generateId } from '../utils/id';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

/**
 * Supabase対応の非同期ベースリポジトリ
 * Supabase優先で保存し、失敗時はLocalStorageにフォールバック
 */
type BaseEntity = {
  id: string;
  createdAt?: string;
  updatedAt?: string;
};

export abstract class SupabaseBaseRepository<T extends BaseEntity> {
  protected abstract getTableName(): string;
  protected abstract getStorageKey(): string;

  private async hasSupabaseSession(): Promise<boolean> {
    if (!isSupabaseConfigured() || !supabase) return false;
    const { data } = await supabase.auth.getSession();
    return !!data.session?.user;
  }

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
    if (isSupabaseConfigured() && supabase && (await this.hasSupabaseSession())) {
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
  }

  async findById(id: string): Promise<T | null> {
    if (isSupabaseConfigured() && supabase && (await this.hasSupabaseSession())) {
      const { data, error } = await supabase
        .from(this.getTableName())
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
        return this.getFromLocalStorage().find((item: any) => item.id === id) || null;
      }
      return this.mapSingleFromSupabase(data);
    }
    const local = this.getFromLocalStorage().find((item: any) => item.id === id);
    return local || null;
  }

  async create(
    item: Omit<T, 'id' | 'createdAt' | 'updatedAt'> &
      Partial<Pick<T, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<T> {
    const now = new Date().toISOString();

    if (isSupabaseConfigured() && supabase && (await this.hasSupabaseSession())) {
      const payload = this.mapToSupabase({
        ...item,
        createdAt: item.createdAt || now,
        updatedAt: item.updatedAt || now,
      } as Partial<T>);

      if (!payload.id) {
        delete payload.id;
      }

      const { data, error } = await supabase
        .from(this.getTableName())
        .insert(payload)
        .select('*')
        .single();

      if (!error && data) {
        const mapped = this.mapSingleFromSupabase(data);
        const items = this.getFromLocalStorage();
        items.push(mapped);
        this.saveToLocalStorage(items);
        return mapped;
      }

      console.error(`Error creating ${this.getTableName()}:`, error);
    }

    const items = this.getFromLocalStorage();
    const newItem = {
      ...item,
      id: item.id || generateId(),
      createdAt: item.createdAt || now,
      updatedAt: item.updatedAt || now,
    } as unknown as T;
    items.push(newItem);
    this.saveToLocalStorage(items);
    return newItem;
  }

  async update(id: string, updates: Partial<T>): Promise<T | null> {
    const now = new Date().toISOString();

    if (isSupabaseConfigured() && supabase && (await this.hasSupabaseSession())) {
      const payload = this.mapToSupabase({
        ...updates,
        updatedAt: now,
      } as Partial<T>);

      const { data, error } = await supabase
        .from(this.getTableName())
        .update(payload)
        .eq('id', id)
        .select('*')
        .single();

      if (!error && data) {
        const mapped = this.mapSingleFromSupabase(data);
        const items = this.getFromLocalStorage();
        const index = items.findIndex((item: any) => item.id === id);
        if (index !== -1) {
          items[index] = mapped;
        } else {
          items.push(mapped);
        }
        this.saveToLocalStorage(items);
        return mapped;
      }

      console.error(`Error updating ${this.getTableName()}:`, error);
    }

    const items = this.getFromLocalStorage();
    const index = items.findIndex((item: any) => item.id === id);
    if (index === -1) return null;
    items[index] = { ...items[index], ...updates, updatedAt: now } as T;
    this.saveToLocalStorage(items);
    return items[index];
  }

  async delete(id: string): Promise<boolean> {
    if (isSupabaseConfigured() && supabase && (await this.hasSupabaseSession())) {
      const { error } = await supabase
        .from(this.getTableName())
        .delete()
        .eq('id', id);

      if (!error) {
        const items = this.getFromLocalStorage();
        const filtered = items.filter((item: any) => item.id !== id);
        this.saveToLocalStorage(filtered);
        return true;
      }

      console.error(`Error deleting ${this.getTableName()}:`, error);
    }

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
