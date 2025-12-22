import { SupabaseBaseRepository } from './supabase-base.repository';
import { Project } from '../types';

export class ProjectRepository extends SupabaseBaseRepository<Project> {
  protected getTableName(): string {
    return 'projects';
  }

  protected getStorageKey(): string {
    return 'tutor_ai_projects';
  }

  protected mapSingleFromSupabase(data: any): Project {
    return {
      id: data.id,
      userId: data.user_id,
      name: data.name,
      createdAt: data.created_at,
    };
  }

  protected mapToSupabase(item: Partial<Project>): any {
    const result: any = {};
    if (item.id !== undefined) result.id = item.id;
    if (item.userId !== undefined) result.user_id = item.userId;
    if (item.name !== undefined) result.name = item.name;
    if (item.createdAt !== undefined) result.created_at = item.createdAt;
    return result;
  }

  async findByUserId(userId: string): Promise<Project[]> {
    return this.findAll(userId);
  }

  async createProject(userId: string, name: string): Promise<Project> {
    return this.create({
      userId,
      name,
    });
  }
}
