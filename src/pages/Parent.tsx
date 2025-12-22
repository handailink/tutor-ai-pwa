import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { HomeworkRepository, TestSetRepository, LessonRecordRepository } from '../repositories';
import { TestSetWithScores, LessonRecord } from '../types';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameDay,
  isSameMonth,
  isToday,
} from 'date-fns';
import ja from 'date-fns/locale/ja';
import './Parent.css';

const SUBJECTS = ['国語', '数学', '英語', '理科', '社会'];

export const Parent: React.FC = () => {
  const { user } = useAuth();
  const [summary, setSummary] = useState({
    homeworkTodo: 0,
    homeworkDone: 0,
    testCount: 0,
    latestTestName: '',
  });
  const [loading, setLoading] = useState(true);

  // テストセット機能用state
  const [showTestSection, setShowTestSection] = useState(false);
  const [testSets, setTestSets] = useState<TestSetWithScores[]>([]);
  const [selectedTestSet, setSelectedTestSet] = useState<TestSetWithScores | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [testView, setTestView] = useState<'list' | 'detail'>('list');

  // 授業記録機能用state
  const [showLessonSection, setShowLessonSection] = useState(false);
  const [lessonRecords, setLessonRecords] = useState<LessonRecord[]>([]);
  const [lessonCurrentMonth, setLessonCurrentMonth] = useState(new Date());
  const [lessonSelectedDate, setLessonSelectedDate] = useState<Date | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<LessonRecord | null>(null);
  const [showLessonModal, setShowLessonModal] = useState(false);

  const homeworkRepository = useMemo(() => new HomeworkRepository(), []);
  const testSetRepository = useMemo(() => new TestSetRepository(), []);
  const lessonRecordRepository = useMemo(() => new LessonRecordRepository(), []);

  const calculateSummary = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      // 宿題
      const homeworks = await homeworkRepository.findByUserId(user.id);
      const homeworkTodo = homeworks.filter((h) => h.status === 'todo').length;
      const homeworkDone = homeworks.filter((h) => h.status === 'done').length;

      // テストセット
      const sets = await testSetRepository.findByUserId(user.id);
      const testCount = sets.length;
      const latestTestName = sets.length > 0 ? sets[0].name : '';

      setSummary({
        homeworkTodo,
        homeworkDone,
        testCount,
        latestTestName,
      });
      setTestSets(sets);
    } catch (error) {
      console.error('[Parent] データ取得エラー:', error);
    } finally {
      setLoading(false);
    }
  }, [user, homeworkRepository, testSetRepository]);

  const loadTestSets = useCallback(async () => {
    if (!user) return;
    const sets = await testSetRepository.findByUserId(user.id);
    setTestSets(sets);
  }, [user, testSetRepository]);

  const loadLessonRecords = useCallback(async () => {
    if (!user) return;
    const records = await lessonRecordRepository.findByUserId(user.id);
    setLessonRecords(records);
  }, [user, lessonRecordRepository]);

  useEffect(() => {
    if (user) {
      calculateSummary();
    }
  }, [user, calculateSummary]);

  useEffect(() => {
    if (user && showTestSection) {
      loadTestSets();
    }
  }, [user, showTestSection, loadTestSets]);

  useEffect(() => {
    if (user && showLessonSection) {
      loadLessonRecords();
    }
  }, [user, showLessonSection, loadLessonRecords]);

  const handleCreateTestSet = () => {
    setSelectedTestSet(null);
    setShowModal(true);
  };

  const handleEditTestSet = () => {
    setShowModal(true);
  };

  const handleViewTestSet = (testSet: TestSetWithScores) => {
    setSelectedTestSet(testSet);
    setTestView('detail');
  };

  const handleSaveTestSet = async (data: {
    date: string;
    name: string;
    grade?: string;
    memo?: string;
    scores: Array<{
      subject: string;
      score: number;
      average?: number;
      maxScore?: number;
    }>;
  }) => {
    if (!user) return;
    
    if (selectedTestSet) {
      // 編集モード
      await testSetRepository.updateTestSet(selectedTestSet.id, data, data.scores);
    } else {
      // 新規作成
      await testSetRepository.createTestSet(user.id, data, data.scores);
    }
    
    setShowModal(false);
    setSelectedTestSet(null);
    setTestView('list');
    loadTestSets();
    calculateSummary();
  };

  const handleDeleteTestSet = async () => {
    if (!selectedTestSet) return;
    if (!confirm('このテストセットを削除しますか？')) return;
    
    await testSetRepository.deleteTestSet(selectedTestSet.id);
    setSelectedTestSet(null);
    setTestView('list');
    loadTestSets();
    calculateSummary();
  };

  // ========== 授業記録機能 ==========
  const hasLessonOnDate = (date: Date): boolean => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return lessonRecords.some((r) => r.date === dateStr);
  };

  const getLessonForDate = (date: Date): LessonRecord | null => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return lessonRecords.find((r) => r.date === dateStr) || null;
  };

  const handleLessonDateSelect = (date: Date) => {
    setLessonSelectedDate(date);
    const lesson = getLessonForDate(date);
    setSelectedLesson(lesson);
  };

  const handleCreateLesson = () => {
    setShowLessonModal(true);
  };

  const handleEditLesson = (lesson: LessonRecord) => {
    setSelectedLesson(lesson);
    setShowLessonModal(true);
  };

  const handleSaveLesson = async (data: {
    date: string;
    duration: number;
    content: string;
    memo?: string;
  }) => {
    if (!user) return;
    
    if (selectedLesson) {
      await lessonRecordRepository.update(selectedLesson.id, data);
    } else {
      await lessonRecordRepository.create(user.id, data);
    }
    
    setShowLessonModal(false);
    setSelectedLesson(null);
    loadLessonRecords();
  };

  const handleDeleteLesson = async () => {
    if (!selectedLesson) return;
    if (!confirm('この授業記録を削除しますか？')) return;
    
    await lessonRecordRepository.delete(selectedLesson.id);
    setSelectedLesson(null);
    loadLessonRecords();
  };

  const renderLessonCalendar = () => {
    const monthStart = startOfMonth(lessonCurrentMonth);
    const monthEnd = endOfMonth(lessonCurrentMonth);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

    const days: JSX.Element[] = [];
    let day = startDate;

    while (day <= endDate) {
      const currentDay = day;
      const isCurrentMonth = isSameMonth(day, lessonCurrentMonth);
      const isSelected = lessonSelectedDate && isSameDay(day, lessonSelectedDate);
      const isTodayDate = isToday(day);
      const hasLesson = hasLessonOnDate(day);

      days.push(
        <div
          key={day.toString()}
          className={`lesson-calendar-day ${!isCurrentMonth ? 'other-month' : ''} ${isSelected ? 'selected' : ''} ${isTodayDate ? 'today' : ''} ${hasLesson ? 'has-lesson' : ''}`}
          onClick={() => handleLessonDateSelect(currentDay)}
        >
          <span className="lesson-calendar-day-number">{format(currentDay, 'd')}</span>
        </div>
      );
      day = addDays(day, 1);
    }

    return days;
  };

  if (loading) {
    return (
      <div className="parent-page">
        <header className="parent-header">
          <h1 className="parent-title">授業記録</h1>
        </header>
        <div className="parent-content">
          <p>読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="parent-page">
      <header className="parent-header">
        <h1 className="parent-title">授業記録</h1>
      </header>

      <div className="parent-content">
        {/* 記録セクション */}
        <section className="parent-section">
          <div 
            className="parent-summary-card parent-summary-card-clickable"
            onClick={() => setShowLessonSection(!showLessonSection)}
          >
            <h3 className="parent-summary-card-title">📖 記録</h3>
            <div className="parent-summary-card-content">
              <div className="parent-summary-item">
                <span className="parent-summary-label">授業記録数</span>
                <span className="parent-summary-value">{lessonRecords.length}</span>
              </div>
            </div>
            <div className="parent-summary-card-action">
              {showLessonSection ? '記録を閉じる ↑' : '記録を開く ↓'}
            </div>
          </div>
        </section>

        {/* 授業記録カレンダー（展開時） */}
        {showLessonSection && (
          <section className="parent-section lesson-section">
            <div className="lesson-calendar-header">
              <button
                className="lesson-calendar-nav"
                onClick={() => setLessonCurrentMonth(subMonths(lessonCurrentMonth, 1))}
              >
                ◀
              </button>
              <span className="lesson-calendar-title">
                {format(lessonCurrentMonth, 'yyyy年 M月', { locale: ja })}
              </span>
              <button
                className="lesson-calendar-nav"
                onClick={() => setLessonCurrentMonth(addMonths(lessonCurrentMonth, 1))}
              >
                ▶
              </button>
            </div>

            <div className="lesson-calendar-weekdays">
              {['日', '月', '火', '水', '木', '金', '土'].map((d) => (
                <div key={d} className="lesson-calendar-weekday">{d}</div>
              ))}
            </div>

            <div className="lesson-calendar-grid">
              {renderLessonCalendar()}
            </div>

            {/* 選択日の授業記録表示 */}
            {lessonSelectedDate && (
              <div className="lesson-selected-day">
                <div className="lesson-selected-day-header">
                  <h3>{format(lessonSelectedDate, 'M月d日（E）', { locale: ja })}の記録</h3>
                  {!selectedLesson && (
                    <button className="lesson-add-button" onClick={handleCreateLesson}>
                      + 記録を追加
                    </button>
                  )}
                </div>

                {selectedLesson ? (
                  <div className="lesson-detail-card">
                    <div className="lesson-detail-row">
                      <span className="lesson-detail-label">授業時間</span>
                      <span className="lesson-detail-value">{selectedLesson.duration}分</span>
                    </div>
                    <div className="lesson-detail-row">
                      <span className="lesson-detail-label">授業内容</span>
                      <p className="lesson-detail-content">{selectedLesson.content}</p>
                    </div>
                    {selectedLesson.memo && (
                      <div className="lesson-detail-row">
                        <span className="lesson-detail-label">メモ</span>
                        <p className="lesson-detail-content">{selectedLesson.memo}</p>
                      </div>
                    )}
                    <div className="lesson-detail-actions">
                      <button
                        className="lesson-edit-button"
                        onClick={() => handleEditLesson(selectedLesson)}
                      >
                        ✏️ 編集
                      </button>
                      <button
                        className="lesson-delete-button"
                        onClick={handleDeleteLesson}
                      >
                        🗑️ 削除
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="lesson-empty">この日の記録はありません</p>
                )}
              </div>
            )}

            {showLessonModal && (
              <LessonRecordModal
                lesson={selectedLesson}
                initialDate={lessonSelectedDate ? format(lessonSelectedDate, 'yyyy-MM-dd') : ''}
                onSave={handleSaveLesson}
                onClose={() => {
                  setShowLessonModal(false);
                  setSelectedLesson(null);
                }}
              />
            )}
          </section>
        )}

        <section className="parent-section">
          <div className="parent-summary-grid">
            <div className="parent-summary-card">
              <h3 className="parent-summary-card-title">宿題</h3>
              <div className="parent-summary-card-content">
                <div className="parent-summary-item">
                  <span className="parent-summary-label">未完了</span>
                  <span className="parent-summary-value">{summary.homeworkTodo}</span>
                </div>
                <div className="parent-summary-item">
                  <span className="parent-summary-label">完了</span>
                  <span className="parent-summary-value">{summary.homeworkDone}</span>
                </div>
              </div>
            </div>

            <div 
              className="parent-summary-card parent-summary-card-clickable"
              onClick={() => setShowTestSection(!showTestSection)}
            >
              <h3 className="parent-summary-card-title">テスト</h3>
              <div className="parent-summary-card-content">
                <div className="parent-summary-item">
                  <span className="parent-summary-label">登録数</span>
                  <span className="parent-summary-value">{summary.testCount}</span>
                </div>
                {summary.latestTestName && (
                  <div className="parent-summary-item">
                    <span className="parent-summary-label">最新</span>
                    <span className="parent-summary-value-small">{summary.latestTestName}</span>
                  </div>
                )}
              </div>
              <div className="parent-summary-card-action">
                {showTestSection ? 'テスト一覧を閉じる ↑' : 'テスト一覧を見る ↓'}
              </div>
            </div>
          </div>
        </section>

        {/* テストセクション（展開時） */}
        {showTestSection && (
          <section className="parent-section parent-test-section">
            <div className="tests-controls">
              <h2 className="tests-section-title">テスト一覧</h2>
              <button className="tests-add-button" onClick={handleCreateTestSet}>
                + テストセットを追加
              </button>
            </div>

            {testView === 'list' && (
              <div className="tests-list">
                {testSets.length === 0 ? (
                  <div className="tests-empty">テスト結果がありません</div>
                ) : (
                  testSets.map((testSet) => {
                    const totalScore = testSet.scores.reduce((sum, s) => sum + s.score, 0);
                    const totalMax = testSet.scores.reduce((sum, s) => sum + s.maxScore, 0);
                    return (
                      <div
                        key={testSet.id}
                        className="tests-item"
                        onClick={() => handleViewTestSet(testSet)}
                      >
                        <div className="tests-item-header">
                          <div>
                            <h3 className="tests-item-title">{testSet.name}</h3>
                            <div className="tests-item-meta">
                              {testSet.date}
                              {testSet.grade && <span className="tests-tags">{testSet.grade}</span>}
                            </div>
                          </div>
                          <div className="tests-score">
                            <span className="tests-score-value">{totalScore}</span>
                            <span className="tests-score-max">/{totalMax}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {testView === 'detail' && selectedTestSet && (
              <div className="tests-detail">
                <div className="tests-detail-header">
                  <button
                    className="tests-back-button"
                    onClick={() => setTestView('list')}
                  >
                    ← 戻る
                  </button>
                  <div className="tests-detail-actions">
                    <button
                      className="tests-edit-button"
                      onClick={handleEditTestSet}
                    >
                      ✏️ 編集
                    </button>
                    <button
                      className="tests-delete-button"
                      onClick={handleDeleteTestSet}
                    >
                      🗑️ 削除
                    </button>
                  </div>
                </div>
                <div className="tests-detail-content">
                  <h2 className="tests-detail-title">{selectedTestSet.name}</h2>
                  <div className="tests-detail-meta">
                    <p>実施日: {selectedTestSet.date}</p>
                    {selectedTestSet.grade && <p>学年: {selectedTestSet.grade}</p>}
                    {selectedTestSet.memo && <p>メモ: {selectedTestSet.memo}</p>}
                  </div>

                  <div className="tests-scores-table">
                    <table>
                      <thead>
                        <tr>
                          <th>教科</th>
                          <th>点数</th>
                          <th>平均点</th>
                          <th>差</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedTestSet.scores.map((score) => {
                          const diff = score.average ? score.score - score.average : null;
                          return (
                            <tr key={score.id}>
                              <td>{score.subject}</td>
                              <td className="score-cell">
                                {score.score}<span className="score-max">/{score.maxScore}</span>
                              </td>
                              <td>{score.average ?? '-'}</td>
                              <td className={diff !== null ? (diff >= 0 ? 'diff-positive' : 'diff-negative') : ''}>
                                {diff !== null ? (diff >= 0 ? `+${diff}` : diff) : '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td><strong>合計</strong></td>
                          <td className="score-cell">
                            <strong>{selectedTestSet.scores.reduce((sum, s) => sum + s.score, 0)}</strong>
                            <span className="score-max">/{selectedTestSet.scores.reduce((sum, s) => sum + s.maxScore, 0)}</span>
                          </td>
                          <td>
                            {selectedTestSet.scores.every(s => s.average != null)
                              ? selectedTestSet.scores.reduce((sum, s) => sum + (s.average || 0), 0)
                              : '-'}
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {showModal && (
              <TestSetModal
                testSet={selectedTestSet}
                userId={user?.id || ''}
                onSave={handleSaveTestSet}
                onClose={() => setShowModal(false)}
              />
            )}
          </section>
        )}

        <section className="parent-section">
          <h2 className="parent-section-title">コメント</h2>
          <div className="parent-comments">
            <div className="parent-comment-card">
              <h3 className="parent-comment-title">先生コメント（モック）</h3>
              <p className="parent-comment-text">
                今週は数学の基礎問題に取り組んでいます。継続的な学習ができています。
              </p>
            </div>
            <div className="parent-comment-card">
              <h3 className="parent-comment-title">AIコメント（モック）</h3>
              <p className="parent-comment-text">
                学習習慣が定着してきています。次は応用問題にもチャレンジしてみましょう。
              </p>
            </div>
          </div>
        </section>

        <section className="parent-section">
          <h2 className="parent-section-title">共有・出力</h2>
          <div className="parent-actions">
            <button className="parent-action-button">
              📤 共有リンクを生成
            </button>
            <button className="parent-action-button">
              📄 PDF出力
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

// テストセット追加モーダル
interface TestSetModalProps {
  testSet: TestSetWithScores | null;
  userId: string;
  onSave: (data: {
    date: string;
    name: string;
    grade?: string;
    memo?: string;
    scores: Array<{
      subject: string;
      score: number;
      average?: number;
      maxScore?: number;
    }>;
  }) => void;
  onClose: () => void;
}

// 授業記録モーダル
interface LessonRecordModalProps {
  lesson: LessonRecord | null;
  initialDate: string;
  onSave: (data: {
    date: string;
    duration: number;
    content: string;
    memo?: string;
  }) => void;
  onClose: () => void;
}

const LessonRecordModal: React.FC<LessonRecordModalProps> = ({ lesson, initialDate, onSave, onClose }) => {
  const isEditMode = lesson !== null;
  
  const [date, setDate] = useState(lesson?.date ?? initialDate);
  const [duration, setDuration] = useState(lesson?.duration?.toString() ?? '60');
  const [content, setContent] = useState(lesson?.content ?? '');
  const [memo, setMemo] = useState(lesson?.memo ?? '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!date || !duration || !content) {
      alert('日付、授業時間、授業内容を入力してください');
      return;
    }

    onSave({
      date,
      duration: parseInt(duration),
      content,
      memo: memo || undefined,
    });
  };

  return (
    <div className="lesson-modal-overlay" onClick={onClose}>
      <div className="lesson-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="lesson-modal-title">
          {isEditMode ? '授業記録を編集' : '授業記録を追加'}
        </h2>
        
        <form onSubmit={handleSubmit} className="lesson-modal-form">
          <div className="lesson-form-group">
            <label>授業日 *</label>
            <input
              type="text"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              placeholder="2025-12-20"
              required
            />
          </div>
          
          <div className="lesson-form-group">
            <label>授業時間（分） *</label>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="60"
              min="1"
              required
            />
          </div>
          
          <div className="lesson-form-group">
            <label>授業内容 *</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="今日の授業内容を入力..."
              rows={4}
              required
              lang="ja"
              autoCapitalize="none"
              spellCheck={false}
            />
          </div>
          
          <div className="lesson-form-group">
            <label>メモ（任意）</label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="補足メモ..."
              rows={2}
              lang="ja"
              autoCapitalize="none"
              spellCheck={false}
            />
          </div>
          
          <div className="lesson-modal-actions">
            <button type="button" onClick={onClose}>
              キャンセル
            </button>
            <button type="submit" className="primary">
              保存
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const TestSetModal: React.FC<TestSetModalProps> = ({ testSet, onSave, onClose }) => {
  const isEditMode = testSet !== null;
  
  // 編集モードの場合、既存データで初期化
  const getInitialScores = () => {
    const initial: Record<string, { score: string; average: string; maxScore: string }> = {};
    SUBJECTS.forEach(s => {
      const existing = testSet?.scores.find(sc => sc.subject === s);
      initial[s] = {
        score: existing?.score?.toString() ?? '',
        average: existing?.average?.toString() ?? '',
        maxScore: existing?.maxScore?.toString() ?? '100',
      };
    });
    return initial;
  };

  const [step, setStep] = useState<1 | 2>(1);
  const [date, setDate] = useState(testSet?.date ?? '');
  const [name, setName] = useState(testSet?.name ?? '');
  const [grade, setGrade] = useState(testSet?.grade ?? '');
  const [memo, setMemo] = useState(testSet?.memo ?? '');
  const [scores, setScores] = useState<Record<string, { score: string; average: string; maxScore: string }>>(
    getInitialScores()
  );

  const handleScoreChange = (subject: string, field: 'score' | 'average' | 'maxScore', value: string) => {
    setScores(prev => ({
      ...prev,
      [subject]: { ...prev[subject], [field]: value },
    }));
  };

  const handleNext = () => {
    if (!date || !name) {
      alert('日付とテスト名を入力してください');
      return;
    }
    setStep(2);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // 少なくとも1教科は点数を入力
    const hasScore = SUBJECTS.some(s => scores[s].score !== '');
    if (!hasScore) {
      alert('少なくとも1教科の点数を入力してください');
      return;
    }

    const scoreData = SUBJECTS
      .filter(s => scores[s].score !== '')
      .map(s => ({
        subject: s,
        score: parseInt(scores[s].score),
        average: scores[s].average ? parseInt(scores[s].average) : undefined,
        maxScore: scores[s].maxScore ? parseInt(scores[s].maxScore) : 100,
      }));

    onSave({
      date,
      name,
      grade: grade || undefined,
      memo: memo || undefined,
      scores: scoreData,
    });
  };

  return (
    <div className="tests-modal-overlay" onClick={onClose}>
      <div className="tests-modal tests-modal-wide" onClick={(e) => e.stopPropagation()}>
        <h2 className="tests-modal-title">
          {isEditMode ? 'テストセットを編集' : 'テストセットを追加'}
        </h2>
        
        {/* ステップインジケーター */}
        <div className="tests-step-indicator">
          <div className={`tests-step ${step >= 1 ? 'active' : ''}`}>1. テスト情報</div>
          <div className={`tests-step ${step >= 2 ? 'active' : ''}`}>2. 点数入力</div>
        </div>

        <form onSubmit={handleSubmit} className="tests-modal-form">
          {step === 1 && (
            <>
              <div className="tests-form-group">
                <label>日付 *</label>
                <input
                  type="text"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  placeholder="2025-12-20"
                  required
                />
              </div>
              <div className="tests-form-group">
                <label>テスト名 *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例: 2学期 期末テスト"
                  required
                />
              </div>
              <div className="tests-form-group">
                <label>学年（任意）</label>
                <input
                  type="text"
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  placeholder="例: 中1"
                />
              </div>
              <div className="tests-form-group">
                <label>メモ（任意）</label>
                <textarea
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="メモがあれば入力"
                  rows={2}
                />
              </div>
              <div className="tests-modal-actions">
                <button type="button" onClick={onClose}>
                  キャンセル
                </button>
                <button type="button" onClick={handleNext} className="primary">
                  次へ →
                </button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="tests-scores-input">
                <table>
                  <thead>
                    <tr>
                      <th>教科</th>
                      <th>点数 *</th>
                      <th>平均点</th>
                      <th>満点</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SUBJECTS.map(subject => (
                      <tr key={subject}>
                        <td className="subject-cell">{subject}</td>
                        <td>
                          <input
                            type="number"
                            value={scores[subject].score}
                            onChange={(e) => handleScoreChange(subject, 'score', e.target.value)}
                            min="0"
                            placeholder="--"
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            value={scores[subject].average}
                            onChange={(e) => handleScoreChange(subject, 'average', e.target.value)}
                            min="0"
                            placeholder="--"
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            value={scores[subject].maxScore}
                            onChange={(e) => handleScoreChange(subject, 'maxScore', e.target.value)}
                            min="1"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="tests-modal-actions">
                <button type="button" onClick={() => setStep(1)}>
                  ← 戻る
                </button>
                <button type="submit" className="primary">
                  保存
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
};
