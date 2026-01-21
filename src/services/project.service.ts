import { ProjectRepository } from '../repositories';
import { Project } from '../types';

export class ProjectService {
  private projectRepository: ProjectRepository;

  constructor() {
    this.projectRepository = new ProjectRepository();
  }

  private normalizeProjects(projects: Project[]): { unique: Project[]; duplicates: Project[] } {
    const map = new Map<string, Project>();
    const duplicates: Project[] = [];

    projects.forEach((project) => {
      const existing = map.get(project.name);
      if (!existing) {
        map.set(project.name, project);
        return;
      }
      const keepExisting = existing.createdAt.localeCompare(project.createdAt) <= 0;
      if (keepExisting) {
        duplicates.push(project);
      } else {
        duplicates.push(existing);
        map.set(project.name, project);
      }
    });

    return { unique: Array.from(map.values()), duplicates };
  }

  async initializeDefaultProjects(userId: string): Promise<Project[]> {
    console.log('[ProjectService] デフォルトプロジェクト初期化開始:', userId);
    const existingProjects = await this.projectRepository.findByUserId(userId);
    const { unique: normalizedProjects, duplicates } = this.normalizeProjects(existingProjects);
    console.log('[ProjectService] 既存プロジェクト数:', normalizedProjects.length, normalizedProjects);

    if (duplicates.length > 0) {
      await Promise.all(duplicates.map((project) => this.projectRepository.delete(project.id)));
    }

    const defaultProjects = ['国語', '数学', '英語', '理科', '社会'];

    // 足りない教科を追加
    const existingNames = normalizedProjects.map((p) => p.name);
    console.log('[ProjectService] 既存プロジェクト名:', existingNames);

    const nextProjects = [...normalizedProjects];
    for (const name of defaultProjects) {
      if (!existingNames.includes(name)) {
        console.log('[ProjectService] プロジェクト作成:', name);
        const project = await this.projectRepository.createProject(userId, name);
        nextProjects.push(project);
      }
    }

    console.log('[ProjectService] 最終プロジェクト数:', nextProjects.length);
    return nextProjects;
  }

  async getProjectsByUserId(userId: string): Promise<Project[]> {
    const projects = await this.projectRepository.findByUserId(userId);
    const { unique, duplicates } = this.normalizeProjects(projects);
    if (duplicates.length > 0) {
      await Promise.all(duplicates.map((project) => this.projectRepository.delete(project.id)));
    }
    return unique;
  }

  async createProject(userId: string, name: string): Promise<Project> {
    return this.projectRepository.createProject(userId, name);
  }
}
