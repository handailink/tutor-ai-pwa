import { SupabaseBaseRepository } from './supabase-base.repository';
import { TestResult } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export class TestResultRepository extends SupabaseBaseRepository<TestResult> {
  protected getTableName(): string {
    return 'test_results';
  }

  protected getStorageKey(): string {
    return 'tutor_ai_test_results';
  }

  protected mapSingleFromSupabase(data: any): TestResult {
    return {
      id: data.id,
      userId: data.user_id,
      projectId: data.project_id,
      takenAt: data.taken_at || '',
      score: data.score || 0,
      maxScore: data.max_score,
      tags: data.notes || data.tags,
      attachments: data.attachments,
      createdAt: data.created_at,
      updatedAt: data.updated_at || data.created_at,
    };
  }

  protected mapToSupabase(item: Partial<TestResult>): any {
    const result: any = {};
    if (item.id !== undefined) result.id = item.id;
    if (item.userId !== undefined) result.user_id = item.userId;
    if (item.projectId !== undefined) result.project_id = item.projectId;
    if (item.takenAt !== undefined) result.taken_at = item.takenAt;
    if (item.score !== undefined) result.score = item.score;
    if (item.maxScore !== undefined) result.max_score = item.maxScore;
    if (item.tags !== undefined) result.notes = item.tags;
    if (item.attachments !== undefined) result.attachments = item.attachments;
    if (item.createdAt !== undefined) result.created_at = item.createdAt;
    if (item.updatedAt !== undefined) result.updated_at = item.updatedAt;
    return result;
  }

  async findByUserId(userId: string): Promise<TestResult[]> {
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from(this.getTableName())
        .select('*')
        .eq('user_id', userId)
        .order('taken_at', { ascending: false });

      if (error) {
        console.error('Error fetching test results:', error);
        return this.getFromLocalStorage()
          .filter((t) => t.userId === userId)
          .sort((a, b) => new Date(b.takenAt).getTime() - new Date(a.takenAt).getTime());
      }
      return this.mapFromSupabase(data || []);
    }
    return this.getFromLocalStorage()
      .filter((t) => t.userId === userId)
      .sort((a, b) => new Date(b.takenAt).getTime() - new Date(a.takenAt).getTime());
  }

  async findByProjectId(userId: string, projectId: string): Promise<TestResult[]> {
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from(this.getTableName())
        .select('*')
        .eq('user_id', userId)
        .eq('project_id', projectId)
        .order('taken_at', { ascending: false });

      if (error) {
        console.error('Error fetching test results by project:', error);
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

  async createTestResult(testResult: Omit<TestResult, 'id' | 'createdAt' | 'updatedAt'>): Promise<TestResult> {
    return this.create({
      ...testResult,
      updatedAt: new Date().toISOString(),
    });
  }

  async updateTestResult(id: string, updates: Partial<TestResult>): Promise<TestResult | null> {
    return this.update(id, updates);
  }
}
