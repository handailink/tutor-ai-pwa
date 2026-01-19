import { SupabaseBaseRepository } from './supabase-base.repository';
import { Thread } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { isValidUuid } from '../utils/uuid';

export class ThreadRepository extends SupabaseBaseRepository<Thread> {
  protected getTableName(): string {
    return 'threads';
  }

  protected getStorageKey(): string {
    return 'tutor_ai_threads';
  }

  protected mapSingleFromSupabase(data: any): Thread {
    return {
      id: data.id,
      userId: data.user_id,
      projectId: data.project_id,
      title: data.title,
      createdAt: data.created_at,
      updatedAt: data.updated_at || data.created_at,
    };
  }

  protected mapToSupabase(item: Partial<Thread>): any {
    const result: any = {};
    if (item.id !== undefined) result.id = item.id;
    if (item.userId !== undefined) result.user_id = item.userId;
    if (item.projectId !== undefined) result.project_id = item.projectId;
    if (item.title !== undefined) result.title = item.title;
    if (item.createdAt !== undefined) result.created_at = item.createdAt;
    if (item.updatedAt !== undefined) result.updated_at = item.updatedAt;
    return result;
  }

  async findByProjectId(projectId: string): Promise<Thread[]> {
    if (!isValidUuid(projectId)) {
      return this.getFromLocalStorage().filter((t) => t.projectId === projectId);
    }
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from(this.getTableName())
        .select('*')
        .eq('project_id', projectId)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Error fetching threads by project:', error);
        return this.getFromLocalStorage().filter((t) => t.projectId === projectId);
      }
      return this.mapFromSupabase(data || []);
    }
    return this.getFromLocalStorage().filter((t) => t.projectId === projectId);
  }

  async findByUserIdAndProjectId(userId: string, projectId: string): Promise<Thread[]> {
    if (!isValidUuid(userId) || !isValidUuid(projectId)) {
      return this.getFromLocalStorage().filter(
        (t) => t.userId === userId && t.projectId === projectId
      );
    }
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from(this.getTableName())
        .select('*')
        .eq('user_id', userId)
        .eq('project_id', projectId)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Error fetching threads:', error);
        return this.getFromLocalStorage().filter(
          (t) => t.userId === userId && t.projectId === projectId
        );
      }
      return this.mapFromSupabase(data || []);
    }
    return this.getFromLocalStorage().filter(
      (t) => t.userId === userId && t.projectId === projectId
    );
  }

  async createThread(userId: string, projectId: string, title: string): Promise<Thread> {
    const now = new Date().toISOString();

    // Prefer creating the thread in Supabase when IDs are UUIDs.
    // This prevents foreign-key errors when inserting messages referencing thread_id.
    if (isValidUuid(userId) && isValidUuid(projectId) && isSupabaseConfigured() && supabase) {
      const payload = this.mapToSupabase({
        userId,
        projectId,
        title,
        createdAt: now,
        updatedAt: now,
      });

      // Let Postgres generate the primary key (uuid)
      delete (payload as any).id;

      const { data, error } = await supabase
        .from(this.getTableName())
        .insert(payload)
        .select('*')
        .single();

      if (!error && data) {
        return this.mapSingleFromSupabase(data);
      }

      console.error('Error creating thread in Supabase:', error);
      // Fall through to local create
    }

    // Fallback: local storage (or base repo logic)
    return this.create({
      userId,
      projectId,
      title,
      createdAt: now,
      updatedAt: now,
    });
  }

  async updateThread(id: string, updates: Partial<Thread>): Promise<Thread | null> {
    return this.update(id, updates);
  }
}
