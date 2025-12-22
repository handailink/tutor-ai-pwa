import { SupabaseBaseRepository } from './supabase-base.repository';
import { Homework } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export class HomeworkRepository extends SupabaseBaseRepository<Homework> {
  protected getTableName(): string {
    return 'homework';
  }

  protected getStorageKey(): string {
    return 'tutor_ai_homework';
  }

  protected mapSingleFromSupabase(data: any): Homework {
    return {
      id: data.id,
      userId: data.user_id,
      projectId: data.project_id,
      title: data.title,
      detail: data.detail || '',
      assignedAt: data.assigned_at || '',
      dueAt: data.due_date || data.due_at || '',
      status: data.status || 'todo',
      attachments: data.attachments,
      createdAt: data.created_at,
      updatedAt: data.updated_at || data.created_at,
    };
  }

  protected mapToSupabase(item: Partial<Homework>): any {
    const result: any = {};
    if (item.id !== undefined) result.id = item.id;
    if (item.userId !== undefined) result.user_id = item.userId;
    if (item.projectId !== undefined) result.project_id = item.projectId;
    if (item.title !== undefined) result.title = item.title;
    if (item.detail !== undefined) result.detail = item.detail;
    if (item.assignedAt !== undefined) result.assigned_at = item.assignedAt;
    if (item.dueAt !== undefined) result.due_date = item.dueAt;
    if (item.status !== undefined) result.status = item.status;
    if (item.attachments !== undefined) result.attachments = item.attachments;
    if (item.createdAt !== undefined) result.created_at = item.createdAt;
    if (item.updatedAt !== undefined) result.updated_at = item.updatedAt;
    return result;
  }

  async findByUserId(userId: string): Promise<Homework[]> {
    return this.findAll(userId);
  }

  async findByStatus(userId: string, status: 'todo' | 'done'): Promise<Homework[]> {
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from(this.getTableName())
        .select('*')
        .eq('user_id', userId)
        .eq('status', status)
        .order('due_date', { ascending: true });

      if (error) {
        console.error('Error fetching homework by status:', error);
        return this.getFromLocalStorage().filter(
          (h) => h.userId === userId && h.status === status
        );
      }
      return this.mapFromSupabase(data || []);
    }
    return this.getFromLocalStorage().filter(
      (h) => h.userId === userId && h.status === status
    );
  }

  async createHomework(homework: Omit<Homework, 'id' | 'createdAt' | 'updatedAt'>): Promise<Homework> {
    return this.create({
      ...homework,
      updatedAt: new Date().toISOString(),
    });
  }

  async toggleStatus(id: string): Promise<Homework | null> {
    const homework = await this.findById(id);
    if (!homework) return null;
    return this.update(id, {
      status: homework.status === 'todo' ? 'done' : 'todo',
    } as Partial<Homework>);
  }

  async updateHomework(id: string, updates: Partial<Homework>): Promise<Homework | null> {
    return this.update(id, updates);
  }
}
