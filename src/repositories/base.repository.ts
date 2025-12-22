import { generateId } from '../utils/id';

export abstract class BaseRepository<T> {
  protected abstract getStorageKey(): string;

  protected getAll(): T[] {
    const data = localStorage.getItem(this.getStorageKey());
    return data ? JSON.parse(data) : [];
  }

  protected saveAll(items: T[]): void {
    localStorage.setItem(this.getStorageKey(), JSON.stringify(items));
  }

  protected findById(id: string): T | undefined {
    return this.getAll().find((item: any) => item.id === id);
  }

  protected create(item: Omit<T, 'id' | 'createdAt'> & { id?: string; createdAt?: string }): T {
    const items = this.getAll();
    const newItem = {
      ...item,
      id: item.id || generateId(),
      createdAt: item.createdAt || new Date().toISOString(),
    } as T;
    items.push(newItem);
    this.saveAll(items);
    return newItem;
  }

  protected update(id: string, updates: Partial<T>): T | null {
    const items = this.getAll();
    const index = items.findIndex((item: any) => item.id === id);
    if (index === -1) return null;
    items[index] = { ...items[index], ...updates, updatedAt: new Date().toISOString() } as T;
    this.saveAll(items);
    return items[index];
  }

  protected delete(id: string): boolean {
    const items = this.getAll();
    const filtered = items.filter((item: any) => item.id !== id);
    if (filtered.length === items.length) return false;
    this.saveAll(filtered);
    return true;
  }

  protected findByUserId(userId: string): T[] {
    return this.getAll().filter((item: any) => item.userId === userId);
  }
}

