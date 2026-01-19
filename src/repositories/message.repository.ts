import { SupabaseBaseRepository } from './supabase-base.repository';
import { Message, Attachment } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { isValidUuid } from '../utils/uuid';

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
    if (!isValidUuid(threadId)) {
      return this.getFromLocalStorage()
        .filter((m) => m.threadId === threadId)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }
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
    // Ensure createdAt exists for both local and Supabase paths
    const msg: any = {
      ...message,
      createdAt: (message as any).createdAt ?? new Date().toISOString(),
    };

    const threadId = msg.threadId as string | undefined;

    // If we have a UUID threadId, prefer persisting to Supabase so messages don't "disappear" after refetch.
    if (threadId && isValidUuid(threadId) && isSupabaseConfigured() && supabase) {
      const payload = this.mapToSupabase(msg);

      const { data, error } = await supabase
        .from(this.getTableName())
        .insert(payload)
        // Return the inserted row so UI can render the persisted message immediately
        .select('*')
        .single();

      if (!error && data) {
        return this.mapSingleFromSupabase(data);
      }

      console.error('Error creating message in Supabase:', error);
      // Fall through to local create as a fallback
    }

    return this.create(msg);
  }

  async findByUserId(userId: string): Promise<Message[]> {
    return this.findAll(userId);
  }

  async searchByContent(userId: string, query: string): Promise<Message[]> {
    const lowerQuery = query.toLowerCase();

    if (!isValidUuid(userId)) {
      return this.getFromLocalStorage().filter(
        (m) =>
          m.userId === userId &&
          (m.content.toLowerCase().includes(lowerQuery) ||
            m.tags?.toLowerCase().includes(lowerQuery))
      );
    }

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
