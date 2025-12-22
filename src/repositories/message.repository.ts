import { SupabaseBaseRepository } from './supabase-base.repository';
import { Message, Attachment } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export class MessageRepository extends SupabaseBaseRepository<Message> {
  protected getTableName(): string {
    return 'messages';
  }

  protected getStorageKey(): string {
    return 'tutor_ai_messages';
  }

  protected mapSingleFromSupabase(data: any): Message {
    // attachmentsはJSONBカラムなのでそのまま使える
    let attachments: Attachment[] | undefined;
    if (data.attachments && Array.isArray(data.attachments)) {
      attachments = data.attachments;
    }

    return {
      id: data.id,
      userId: data.user_id || '', // messagesテーブルにはuser_idがないかも
      threadId: data.thread_id,
      role: data.role,
      content: data.content,
      createdAt: data.created_at,
      tags: data.tags,
      attachments,
      meta: data.meta,
    };
  }

  protected mapToSupabase(item: Partial<Message>): any {
    const result: any = {};
    if (item.id !== undefined) result.id = item.id;
    if (item.threadId !== undefined) result.thread_id = item.threadId;
    if (item.role !== undefined) result.role = item.role;
    if (item.content !== undefined) result.content = item.content;
    if (item.createdAt !== undefined) result.created_at = item.createdAt;
    if (item.attachments !== undefined) result.attachments = item.attachments;
    if (item.tags !== undefined) result.tags = item.tags;
    if (item.meta !== undefined) result.meta = item.meta;
    // user_idは直接messagesに保存しない（threadから取得可能）
    return result;
  }

  async findByThreadId(threadId: string): Promise<Message[]> {
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from(this.getTableName())
        .select('*')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching messages:', error);
        return this.getFromLocalStorage()
          .filter((m) => m.threadId === threadId)
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      }
      return this.mapFromSupabase(data || []);
    }
    return this.getFromLocalStorage()
      .filter((m) => m.threadId === threadId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  async createMessage(message: Message | Omit<Message, 'id' | 'createdAt'>): Promise<Message> {
    return this.create(message);
  }

  async findByUserId(userId: string): Promise<Message[]> {
    return this.findAll(userId);
  }

  async searchByContent(userId: string, query: string): Promise<Message[]> {
    const lowerQuery = query.toLowerCase();
    
    if (isSupabaseConfigured() && supabase) {
      // Supabaseでの検索（ilike使用）
      const { data, error } = await supabase
        .from(this.getTableName())
        .select(`
          *,
          threads!inner(user_id)
        `)
        .eq('threads.user_id', userId)
        .or(`content.ilike.%${query}%,tags.ilike.%${query}%`);

      if (error) {
        console.error('Error searching messages:', error);
        // フォールバック
        return this.getFromLocalStorage().filter(
          (m) =>
            m.userId === userId &&
            (m.content.toLowerCase().includes(lowerQuery) ||
              m.tags?.toLowerCase().includes(lowerQuery))
        );
      }
      return this.mapFromSupabase(data || []);
    }

    return this.getFromLocalStorage().filter(
      (m) =>
        m.userId === userId &&
        (m.content.toLowerCase().includes(lowerQuery) ||
          m.tags?.toLowerCase().includes(lowerQuery))
    );
  }
}
