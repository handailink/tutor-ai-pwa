import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { format } from 'date-fns';
import ja from 'date-fns/locale/ja';
import { useAuth } from '../contexts/AuthContext';
import { LessonRecordRepository } from '../repositories';
import { LessonRecord } from '../types';
import './Parent.css';

export const Parent: React.FC = () => {
  const { user } = useAuth();
  const [lessonRecords, setLessonRecords] = useState<LessonRecord[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [date, setDate] = useState('');
  const [duration, setDuration] = useState('60');
  const [content, setContent] = useState('');
  const [memo, setMemo] = useState('');

  const lessonRecordRepository = useMemo(() => new LessonRecordRepository(), []);

  const loadLessonRecords = useCallback(async () => {
    if (!user) return;
    const records = await lessonRecordRepository.findByUserId(user.id);
    setLessonRecords(records);
  }, [user, lessonRecordRepository]);

  useEffect(() => {
    if (user) {
      loadLessonRecords();
    }
  }, [user, loadLessonRecords]);

  const groupedLessons = useMemo(() => {
    const map = new Map<string, LessonRecord[]>();
    lessonRecords.forEach((record) => {
      const key = record.date || '未設定';
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)?.push(record);
    });
    return Array.from(map.entries())
      .map(([dateKey, items]) => ({
        date: dateKey,
        items: items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [lessonRecords]);

  const resetForm = () => {
    setDate(format(new Date(), 'yyyy-MM-dd'));
    setDuration('60');
    setContent('');
    setMemo('');
    setEditingId(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsFormOpen(true);
  };

  const handleEdit = (lesson: LessonRecord) => {
    setDate(lesson.date || format(new Date(), 'yyyy-MM-dd'));
    setDuration(String(lesson.duration || 60));
    setContent(lesson.content || '');
    setMemo(lesson.memo || '');
    setEditingId(lesson.id);
    setIsFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!date.trim() || !duration.trim() || !content.trim()) {
      alert('日付、授業時間、授業内容を入力してください');
      return;
    }

    const payload = {
      date: date.trim(),
      duration: parseInt(duration, 10),
      content: content.trim(),
      memo: memo.trim() ? memo.trim() : undefined,
    };

    try {
      if (editingId) {
        await lessonRecordRepository.update(editingId, payload);
      } else {
        await lessonRecordRepository.create(user.id, payload);
      }
    } catch (error) {
      alert('保存に失敗しました。');
      return;
    }

    setIsFormOpen(false);
    resetForm();
    loadLessonRecords();
  };

  const handleDelete = async (lesson: LessonRecord) => {
    if (!window.confirm('この授業記録を削除しますか？')) return;
    const optimistic = lessonRecords.filter((record) => record.id !== lesson.id);
    setLessonRecords(optimistic);
    try {
      await lessonRecordRepository.delete(lesson.id);
    } catch (error) {
      alert('削除に失敗しました。');
      loadLessonRecords();
    }
  };

  return (
    <div className="parent-page">
      <header className="parent-header">
        <div className="parent-header-row">
          <h1 className="parent-title">授業管理</h1>
          <button className="parent-add-button" onClick={handleOpenCreate}>
            ＋授業を追加
          </button>
        </div>
      </header>

      {isFormOpen && (
        <section className="parent-form-card">
          <h2 className="parent-form-title">
            {editingId ? '授業記録を編集' : '授業記録を追加'}
          </h2>
          <form className="parent-form" onSubmit={handleSave}>
            <div className="parent-form-row">
              <div className="parent-form-group">
                <label>授業日</label>
                <input
                  type="text"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  placeholder="2025-12-20"
                  lang="ja"
                  inputMode="text"
                  autoCapitalize="none"
                  spellCheck={false}
                />
              </div>
              <div className="parent-form-group">
                <label>授業時間（分）</label>
                <input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  min="1"
                />
              </div>
            </div>
            <div className="parent-form-group">
              <label>授業内容</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="今日の授業内容を入力"
                rows={4}
                lang="ja"
                inputMode="text"
                autoCapitalize="none"
                spellCheck={false}
              />
            </div>
            <div className="parent-form-group">
              <label>メモ（任意）</label>
              <textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="補足メモ"
                rows={2}
                lang="ja"
                inputMode="text"
                autoCapitalize="none"
                spellCheck={false}
              />
            </div>
            <div className="parent-form-actions">
              <button type="button" onClick={() => setIsFormOpen(false)}>
                キャンセル
              </button>
              <button type="submit" className="primary">
                保存
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="parent-timeline">
        {groupedLessons.length === 0 ? (
          <div className="parent-empty">授業記録がまだ登録されていません</div>
        ) : (
          groupedLessons.map((group) => (
            <div key={group.date} className="parent-date-block">
              <div className="parent-date-header">
                <h2>
                  {group.date === '未設定'
                    ? '日付未設定'
                    : format(new Date(group.date), 'M月d日（E）', { locale: ja })}
                </h2>
              </div>
              <div className="parent-card-list">
                {group.items.map((lesson) => (
                  <div key={lesson.id} className="parent-card">
                    <div className="parent-card-header">
                      <div>
                        <span className="parent-card-label">授業時間</span>
                        <div className="parent-card-value">{lesson.duration}分</div>
                      </div>
                      <div className="parent-card-actions">
                        <button className="parent-edit-button" onClick={() => handleEdit(lesson)}>
                          編集
                        </button>
                        <button
                          className="parent-delete-button"
                          onClick={() => handleDelete(lesson)}
                        >
                          削除
                        </button>
                      </div>
                    </div>
                    <div className="parent-card-content">
                      <h3>授業内容</h3>
                      <p>{lesson.content}</p>
                    </div>
                    {lesson.memo && (
                      <div className="parent-card-content">
                        <h3>メモ</h3>
                        <p>{lesson.memo}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
};
