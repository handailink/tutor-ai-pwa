import { BaseRepository } from './base.repository';
import { User } from '../types';

export class UserRepository extends BaseRepository<User> {
  protected getStorageKey(): string {
    return 'tutor_ai_users';
  }

  findByEmail(email: string): User | undefined {
    return this.getAll().find((u) => u.email === email);
  }

  createUser(email: string): User {
    return this.create({
      email,
    });
  }

  createUserWithId(id: string, email: string): User {
    // 既存のユーザーがあれば返す
    const existing = this.findByEmail(email);
    if (existing) {
      return existing;
    }
    
    // Supabase AuthのIDを使ってユーザーを作成
    const user: User = {
      id,
      email,
      createdAt: new Date().toISOString(),
    };
    
    const all = this.getAll();
    all.push(user);
    localStorage.setItem(this.getStorageKey(), JSON.stringify(all));
    
    return user;
  }
}

