import { ProjectRepository } from '../repositories';
import { Project } from '../types';

export class ProjectService {
  private projectRepository: ProjectRepository;

  constructor() {
    this.projectRepository = new ProjectRepository();
  }

  async initializeDefaultProjects(userId: string): Promise<Project[]> {
    console.log('[ProjectService] デフォルトプロジェクト初期化開始:', userId);
    const existingProjects = await this.projectRepository.findByUserId(userId);
    console.log('[ProjectService] 既存プロジェクト数:', existingProjects.length, existingProjects);
    
    const defaultProjects = ['国語', '数学', '英語', '理科', '社会'];
    
    // 足りない教科を追加
    const existingNames = existingProjects.map(p => p.name);
    console.log('[ProjectService] 既存プロジェクト名:', existingNames);
    
    for (const name of defaultProjects) {
      if (!existingNames.includes(name)) {
        console.log('[ProjectService] プロジェクト作成:', name);
        const project = await this.projectRepository.createProject(userId, name);
        existingProjects.push(project);
      }
    }
    
    console.log('[ProjectService] 最終プロジェクト数:', existingProjects.length);
    return existingProjects;
  }

  async getProjectsByUserId(userId: string): Promise<Project[]> {
    return this.projectRepository.findByUserId(userId);
  }

  async createProject(userId: string, name: string): Promise<Project> {
    return this.projectRepository.createProject(userId, name);
  }
}
