import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { LessonRecord } from '../types';
import { generateId } from '../utils/id';

const STORAGE_KEY = 'tutor_ai_lesson_records';

export class LessonRecordRepository {
  async findByUserId(userId: string): Promise<LessonRecord[]> {
    const localRecords = this.getLocal().filter(r => r.userId === userId)
      .sort((a, b) => b.date.localeCompare(a.date));

    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from('lesson_records')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false });

      if (error) {
        console.error('Error fetching lesson_records:', error);
        return localRecords;
      }

      if (!data || data.length === 0) {
        return localRecords;
      }

      return (data || []).map(this.mapFromSupabase);
    }

    // LocalStorageフォールバック
    return localRecords;
  }

  async findById(id: string): Promise<LessonRecord | null> {
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
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
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
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

    if (isSupabaseConfigured() && supabase) {
      const { data: record, error } = await supabase
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
        return this.mapFromSupabase(record);
      }
      console.error('Error creating lesson_records:', error);
      // フォールバック
      return this.createLocal(userId, data, now);

    }

    // LocalStorageフォールバック
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

    if (isSupabaseConfigured() && supabase) {
      const { data: record, error } = await supabase
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
        return this.mapFromSupabase(record);
      }
      console.error('Error updating lesson_records:', error);
      // フォールバック
      return this.updateLocal(id, data, now);
    }

    // LocalStorageフォールバック
    return this.updateLocal(id, data, now);
  }

  async delete(id: string): Promise<void> {
    if (isSupabaseConfigured() && supabase) {
      const { error } = await supabase
        .from('lesson_records')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting lesson_records:', error);
        // フォールバック
        this.deleteLocal(id);
        return;
      }
      // Supabaseが成功した場合もLocalStorageを同期しておく
      this.deleteLocal(id);
      return;
    }

    // LocalStorageフォールバック
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





