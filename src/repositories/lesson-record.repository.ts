import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { LessonRecord } from '../types';
import { generateId } from '../utils/id';

const STORAGE_KEY = 'tutor_ai_lesson_records';

export class LessonRecordRepository {
  // Supabaseセッションが有効かチェック
  private async hasValidSession(): Promise<boolean> {
    if (!isSupabaseConfigured() || !supabase) return false;
    try {
      const { data } = await supabase.auth.getSession();
      return !!data.session?.user;
    } catch {
      return false;
    }
  }

  async findByUserId(userId: string): Promise<LessonRecord[]> {
    const localRecords = this.getLocal().filter(r => r.userId === userId)
      .sort((a, b) => b.date.localeCompare(a.date));

    if (await this.hasValidSession()) {
      const { data, error } = await supabase!
        .from('lesson_records')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false });

      if (error) {
        console.error('[LessonRecordRepository] findByUserId error:', error.message, error.code);
        return localRecords;
      }

      console.log('[LessonRecordRepository] findByUserId success:', data?.length || 0, '件');
      return (data || []).map(this.mapFromSupabase);
    }

    // LocalStorageフォールバック
    console.log('[LessonRecordRepository] LocalStorageフォールバック使用');
    return localRecords;
  }

  async findById(id: string): Promise<LessonRecord | null> {
    if (await this.hasValidSession()) {
      const { data, error } = await supabase!
        .from('lesson_records')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) return null;
      return this.mapFromSupabase(data);
    }

    // LocalStorageフォールバック
    return this.getLocal().find(r => r.id === id) || null;
  }

  async findByDate(userId: string, date: string): Promise<LessonRecord | null> {
    if (await this.hasValidSession()) {
      const { data, error } = await supabase!
        .from('lesson_records')
        .select('*')
        .eq('user_id', userId)
        .eq('date', date)
        .single();

      if (error || !data) return null;
      return this.mapFromSupabase(data);
    }

    // LocalStorageフォールバック
    return this.getLocal().find(r => r.userId === userId && r.date === date) || null;
  }

  async create(
    userId: string,
    data: {
      date: string;
      duration: number;
      content: string;
      memo?: string;
    }
  ): Promise<LessonRecord> {
    const now = new Date().toISOString();

    if (await this.hasValidSession()) {
      const { data: record, error } = await supabase!
        .from('lesson_records')
        .insert({
          user_id: userId,
          date: data.date,
          duration: data.duration,
          content: data.content,
          memo: data.memo,
        })
        .select()
        .single();

      if (!error && record) {
        console.log('[LessonRecordRepository] create success:', record.id);
        return this.mapFromSupabase(record);
      }
      console.error('[LessonRecordRepository] create error:', error?.message, error?.code);
      // エラーをスローして呼び出し元に通知
      throw new Error(error?.message || '保存に失敗しました');
    }

    // LocalStorageフォールバック
    console.log('[LessonRecordRepository] createLocal フォールバック');
    return this.createLocal(userId, data, now);
  }

  async update(
    id: string,
    data: {
      date: string;
      duration: number;
      content: string;
      memo?: string;
    }
  ): Promise<LessonRecord | null> {
    const now = new Date().toISOString();

    if (await this.hasValidSession()) {
      const { data: record, error } = await supabase!
        .from('lesson_records')
        .update({
          date: data.date,
          duration: data.duration,
          content: data.content,
          memo: data.memo,
          updated_at: now,
        })
        .eq('id', id)
        .select()
        .single();

      if (!error && record) {
        console.log('[LessonRecordRepository] update success:', id);
        return this.mapFromSupabase(record);
      }
      console.error('[LessonRecordRepository] update error:', error?.message, error?.code);
      throw new Error(error?.message || '更新に失敗しました');
    }

    // LocalStorageフォールバック
    console.log('[LessonRecordRepository] updateLocal フォールバック');
    return this.updateLocal(id, data, now);
  }

  async delete(id: string): Promise<void> {
    if (await this.hasValidSession()) {
      const { error } = await supabase!
        .from('lesson_records')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('[LessonRecordRepository] delete error:', error.message, error.code);
        throw new Error(error.message || '削除に失敗しました');
      }
      console.log('[LessonRecordRepository] delete success:', id);
      return;
    }

    // LocalStorageフォールバック
    console.log('[LessonRecordRepository] deleteLocal フォールバック');
    this.deleteLocal(id);
  }

  // ========== Mapping Helpers ==========

  private mapFromSupabase(data: any): LessonRecord {
    return {
      id: data.id,
      userId: data.user_id,
      date: data.date,
      duration: data.duration,
      content: data.content,
      memo: data.memo,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  // ========== LocalStorage Helpers ==========

  private getLocal(): LessonRecord[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private saveLocal(records: LessonRecord[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }

  private createLocal(
    userId: string,
    data: { date: string; duration: number; content: string; memo?: string },
    now: string
  ): LessonRecord {
    const newRecord: LessonRecord = {
      id: generateId(),
      userId,
      date: data.date,
      duration: data.duration,
      content: data.content,
      memo: data.memo,
      createdAt: now,
    };

    const records = this.getLocal();
    records.push(newRecord);
    this.saveLocal(records);

    return newRecord;
  }

  private updateLocal(
    id: string,
    data: { date: string; duration: number; content: string; memo?: string },
    now: string
  ): LessonRecord | null {
    const records = this.getLocal();
    const index = records.findIndex(r => r.id === id);
    if (index === -1) return null;

    records[index] = {
      ...records[index],
      date: data.date,
      duration: data.duration,
      content: data.content,
      memo: data.memo,
      updatedAt: now,
    };
    this.saveLocal(records);

    return records[index];
  }

  private deleteLocal(id: string): void {
    const records = this.getLocal().filter(r => r.id !== id);
    this.saveLocal(records);
  }
}





