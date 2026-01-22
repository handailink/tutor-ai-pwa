import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { TestSet, TestScore, TestSetWithScores, Attachment } from '../types';
import { generateId } from '../utils/id';

const STORAGE_KEY_SETS = 'tutor_ai_test_sets';
const STORAGE_KEY_SCORES = 'tutor_ai_test_scores';

export class TestSetRepository {
  // ========== TestSet CRUD ==========

  async findByUserId(userId: string): Promise<TestSetWithScores[]> {
    const localSets = this.getLocalSets().filter(s => s.userId === userId);
    const localScores = this.getLocalScores();
    const localResult = localSets
      .sort((a, b) => b.date.localeCompare(a.date))
      .map(set => ({
        ...set,
        scores: localScores.filter(s => s.testSetId === set.id),
      }));

    if (isSupabaseConfigured() && supabase) {
      const { data: sets, error } = await supabase
        .from('test_sets')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false });

      if (error) {
        console.error('Error fetching test_sets:', error);
        return localResult;
      }

      if (!sets || sets.length === 0) {
        return localResult;
      }

      // 各セットのスコアを取得
      const result: TestSetWithScores[] = [];
      for (const set of sets || []) {
        const { data: scores } = await supabase
          .from('test_scores')
          .select('*')
          .eq('test_set_id', set.id);

        result.push({
          id: set.id,
          userId: set.user_id,
          date: set.date,
          name: set.name,
          grade: set.grade,
          memo: set.memo,
          createdAt: set.created_at,
          updatedAt: set.updated_at,
          scores: (scores || []).map(s => ({
            id: s.id,
            testSetId: s.test_set_id,
            subject: s.subject,
            score: s.score,
            average: s.average,
            maxScore: s.max_score,
            rank: s.rank,
            deviation: s.deviation,
            problemImages: s.problem_images || [],
            answerImages: s.answer_images || [],
            createdAt: s.created_at,
          })),
        });
      }

      return result;
    }

    // LocalStorageフォールバック
    return localResult;
  }

  async findById(id: string): Promise<TestSetWithScores | null> {
    if (isSupabaseConfigured() && supabase) {
      const { data: set, error } = await supabase
        .from('test_sets')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !set) return null;

      const { data: scores } = await supabase
        .from('test_scores')
        .select('*')
        .eq('test_set_id', id);

      return {
        id: set.id,
        userId: set.user_id,
        date: set.date,
        name: set.name,
        grade: set.grade,
        memo: set.memo,
        createdAt: set.created_at,
        updatedAt: set.updated_at,
        scores: (scores || []).map(s => ({
          id: s.id,
          testSetId: s.test_set_id,
          subject: s.subject,
          score: s.score,
          average: s.average,
          maxScore: s.max_score,
          rank: s.rank,
          deviation: s.deviation,
          problemImages: s.problem_images || [],
          answerImages: s.answer_images || [],
          createdAt: s.created_at,
        })),
      };
    }

    // LocalStorageフォールバック
    const sets = this.getLocalSets();
    const set = sets.find(s => s.id === id);
    if (!set) return null;

    const scores = this.getLocalScores().filter(s => s.testSetId === id);
    return { ...set, scores };
  }

  async createTestSet(
    userId: string,
    data: {
      date: string;
      name: string;
      grade?: string;
      memo?: string;
    },
    scores: Array<{
      subject: string;
      score: number;
      average?: number;
      maxScore?: number;
      problemImages?: Attachment[];
      answerImages?: Attachment[];
    }>
  ): Promise<TestSetWithScores> {
    const now = new Date().toISOString();

    if (isSupabaseConfigured() && supabase) {
      try {
        // テストセット作成
        const { data: set, error: setError } = await supabase
          .from('test_sets')
          .insert({
            user_id: userId,
            date: data.date,
            name: data.name,
            grade: data.grade,
            memo: data.memo,
          })
          .select()
          .single();

        if (setError || !set) {
          throw new Error(`テストセットの保存に失敗しました: ${setError?.message}`);
        }

        // スコア作成
        const scoreInserts = scores.map(s => ({
          test_set_id: set.id,
          subject: s.subject,
          score: s.score,
          average: s.average,
          max_score: s.maxScore ?? 100,
          problem_images: s.problemImages || [],
          answer_images: s.answerImages || [],
        }));

        const { data: insertedScores, error: scoresError } = await supabase
          .from('test_scores')
          .insert(scoreInserts)
          .select();

        if (scoresError) {
          throw new Error(`テストの点数保存に失敗しました: ${scoresError.message}`);
        }

        return {
          id: set.id,
          userId: set.user_id,
          date: set.date,
          name: set.name,
          grade: set.grade,
          memo: set.memo,
          createdAt: set.created_at,
          updatedAt: set.updated_at,
          scores: (insertedScores || []).map(s => ({
            id: s.id,
            testSetId: s.test_set_id,
            subject: s.subject,
            score: s.score,
            average: s.average,
            maxScore: s.max_score,
            rank: s.rank,
            deviation: s.deviation,
            problemImages: s.problem_images || [],
            answerImages: s.answer_images || [],
            createdAt: s.created_at,
          })),
        };
      } catch (error) {
        console.error('Error creating test_sets:', error);
        // フォールバック
        return this.createTestSetLocal(userId, data, scores, now);
      }
    }

    // LocalStorageフォールバック
    return this.createTestSetLocal(userId, data, scores, now);
  }

  async updateTestSet(
    id: string,
    data: {
      date: string;
      name: string;
      grade?: string;
      memo?: string;
    },
    scores: Array<{
      subject: string;
      score: number;
      average?: number;
      maxScore?: number;
      problemImages?: Attachment[];
      answerImages?: Attachment[];
    }>
  ): Promise<TestSetWithScores | null> {
    const now = new Date().toISOString();

    if (isSupabaseConfigured() && supabase) {
      try {
        // テストセット更新
        const { data: set, error: setError } = await supabase
          .from('test_sets')
          .update({
            date: data.date,
            name: data.name,
            grade: data.grade,
            memo: data.memo,
            updated_at: now,
          })
          .eq('id', id)
          .select()
          .single();

        if (setError || !set) {
          throw new Error(`テストセットの更新に失敗しました: ${setError?.message}`);
        }

        // 既存スコアを削除して再作成
        const { error: deleteError } = await supabase
          .from('test_scores')
          .delete()
          .eq('test_set_id', id);

        if (deleteError) {
          throw new Error(`既存点数の削除に失敗しました: ${deleteError.message}`);
        }

        const scoreInserts = scores.map(s => ({
          test_set_id: id,
          subject: s.subject,
          score: s.score,
          average: s.average,
          max_score: s.maxScore ?? 100,
          problem_images: s.problemImages || [],
          answer_images: s.answerImages || [],
        }));

        const { data: insertedScores, error: scoresError } = await supabase
          .from('test_scores')
          .insert(scoreInserts)
          .select();

        if (scoresError) {
          throw new Error(`点数の更新に失敗しました: ${scoresError.message}`);
        }

        return {
          id: set.id,
          userId: set.user_id,
          date: set.date,
          name: set.name,
          grade: set.grade,
          memo: set.memo,
          createdAt: set.created_at,
          updatedAt: set.updated_at,
          scores: (insertedScores || []).map(s => ({
            id: s.id,
            testSetId: s.test_set_id,
            subject: s.subject,
            score: s.score,
            average: s.average,
            maxScore: s.max_score,
            rank: s.rank,
            deviation: s.deviation,
            problemImages: s.problem_images || [],
            answerImages: s.answer_images || [],
            createdAt: s.created_at,
          })),
        };
      } catch (error) {
        console.error('Error updating test_sets:', error);
        // フォールバック
        return this.updateTestSetLocal(id, data, scores, now);
      }
    }

    // LocalStorageフォールバック
    return this.updateTestSetLocal(id, data, scores, now);
  }

  async deleteTestSet(id: string): Promise<void> {
    if (isSupabaseConfigured() && supabase) {
      // スコアはCASCADEで自動削除される
      const { error } = await supabase
        .from('test_sets')
        .delete()
        .eq('id', id);

      if (error) {
        throw new Error(`削除に失敗しました: ${error.message}`);
      }
      // Supabaseが成功した場合もLocalStorageを同期しておく
      const sets = this.getLocalSets().filter(s => s.id !== id);
      this.saveLocalSets(sets);
      const scores = this.getLocalScores().filter(s => s.testSetId !== id);
      this.saveLocalScores(scores);
      return;
    }

    // LocalStorageフォールバック
    const sets = this.getLocalSets().filter(s => s.id !== id);
    this.saveLocalSets(sets);

    const scores = this.getLocalScores().filter(s => s.testSetId !== id);
    this.saveLocalScores(scores);
  }

  // ========== LocalStorage Helpers ==========
  private createTestSetLocal(
    userId: string,
    data: {
      date: string;
      name: string;
      grade?: string;
      memo?: string;
    },
    scores: Array<{
      subject: string;
      score: number;
      average?: number;
      maxScore?: number;
      problemImages?: Attachment[];
      answerImages?: Attachment[];
    }>,
    now: string
  ): TestSetWithScores {
    const setId = generateId();
    const newSet: TestSet = {
      id: setId,
      userId,
      date: data.date,
      name: data.name,
      grade: data.grade,
      memo: data.memo,
      createdAt: now,
    };

    const newScores: TestScore[] = scores.map(s => ({
      id: generateId(),
      testSetId: setId,
      subject: s.subject,
      score: s.score,
      average: s.average,
      maxScore: s.maxScore ?? 100,
      problemImages: s.problemImages || [],
      answerImages: s.answerImages || [],
      createdAt: now,
    }));

    const sets = this.getLocalSets();
    sets.push(newSet);
    this.saveLocalSets(sets);

    const allScores = this.getLocalScores();
    allScores.push(...newScores);
    this.saveLocalScores(allScores);

    return { ...newSet, scores: newScores };
  }

  private updateTestSetLocal(
    id: string,
    data: {
      date: string;
      name: string;
      grade?: string;
      memo?: string;
    },
    scores: Array<{
      subject: string;
      score: number;
      average?: number;
      maxScore?: number;
      problemImages?: Attachment[];
      answerImages?: Attachment[];
    }>,
    now: string
  ): TestSetWithScores | null {
    const sets = this.getLocalSets();
    const index = sets.findIndex(s => s.id === id);
    if (index === -1) return null;

    sets[index] = {
      ...sets[index],
      date: data.date,
      name: data.name,
      grade: data.grade,
      memo: data.memo,
      updatedAt: now,
    };
    this.saveLocalSets(sets);

    // スコアを更新
    let allScores = this.getLocalScores().filter(s => s.testSetId !== id);
    const newScores: TestScore[] = scores.map(s => ({
      id: generateId(),
      testSetId: id,
      subject: s.subject,
      score: s.score,
      average: s.average,
      maxScore: s.maxScore ?? 100,
      problemImages: s.problemImages || [],
      answerImages: s.answerImages || [],
      createdAt: now,
    }));
    allScores.push(...newScores);
    this.saveLocalScores(allScores);

    return { ...sets[index], scores: newScores };
  }

  private getLocalSets(): TestSet[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY_SETS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private saveLocalSets(sets: TestSet[]): void {
    localStorage.setItem(STORAGE_KEY_SETS, JSON.stringify(sets));
  }

  private getLocalScores(): TestScore[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY_SCORES);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private saveLocalScores(scores: TestScore[]): void {
    localStorage.setItem(STORAGE_KEY_SCORES, JSON.stringify(scores));
  }
}

