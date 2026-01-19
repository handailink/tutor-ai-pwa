import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { format } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { TestSetRepository } from '../repositories';
import { ProjectService } from '../services';
import { TestSetWithScores, Project } from '../types';
import { generateId } from '../utils/id';
import './Tests.css';

export const Tests: React.FC = () => {
  const { user } = useAuth();
  const [testSets, setTestSets] = useState<TestSetWithScores[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [selectedSet, setSelectedSet] = useState<TestSetWithScores | null>(null);
  const [activeTab, setActiveTab] = useState<'list' | 'detail'>('list');

  const testRepository = useMemo(() => new TestSetRepository(), []);
  const projectService = useMemo(() => new ProjectService(), []);

  const loadTestSets = useCallback(async () => {
    if (!user) return;
    const results = await testRepository.findByUserId(user.id);
    setTestSets(results);
  }, [user, testRepository]);

  const loadProjects = useCallback(async () => {
    if (!user) return;
    const projs = await projectService.getProjectsByUserId(user.id);
    setProjects(projs);
  }, [user, projectService]);

  useEffect(() => {
    if (user) {
      loadTestSets();
      loadProjects();
    }
  }, [user, loadTestSets, loadProjects]);

  const handleCreate = () => {
    setSelectedSet(null);
    setShowModal(true);
  };

  const handleView = (testSet: TestSetWithScores) => {
    setSelectedSet(testSet);
    setActiveTab('detail');
  };

  const handleSave = async (
    data: { date: string; name: string; grade?: string; memo?: string },
    scores: Array<{ subject: string; score: number; average?: number; maxScore?: number }>
  ) => {
    if (!user) return;
    if (selectedSet) {
      await testRepository.updateTestSet(selectedSet.id, data, scores);
    } else {
      await testRepository.createTestSet(user.id, data, scores);
    }
    setShowModal(false);
    setSelectedSet(null);
    setActiveTab('list');
    loadTestSets();
  };

  const selectedProjectName =
    selectedProject === 'all'
      ? null
      : projects.find((p) => p.id === selectedProject)?.name || null;
  const filteredSets =
    selectedProjectName === null
      ? testSets
      : testSets.filter((set) => set.scores.some((score) => score.subject === selectedProjectName));

  return (
    <div className="tests-page">
      <header className="tests-header">
        <h1 className="tests-title">テスト結果</h1>
        <button className="tests-add-button" onClick={handleCreate}>
          + 追加
        </button>
      </header>

      <div className="tests-filters">
        <select
          className="tests-project-filter"
          value={selectedProject}
          onChange={(e) => setSelectedProject(e.target.value)}
        >
          <option value="all">すべての教科</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {activeTab === 'list' && (
        <div className="tests-list">
          {filteredSets.length === 0 ? (
            <div className="tests-empty">テスト結果がありません</div>
          ) : (
            filteredSets.map((testSet) => {
              return (
                <div
                  key={testSet.id}
                  className="tests-set-item"
                  onClick={() => handleView(testSet)}
                >
                  <div className="tests-item-header">
                    <div>
                      <h3 className="tests-item-title">{testSet.name}</h3>
                      <div className="tests-item-meta">
                        {testSet.date}
                        {testSet.grade && <span className="tests-tags">{testSet.grade}</span>}
                      </div>
                    </div>
                    <div className="tests-set-count">{testSet.scores.length}教科</div>
                  </div>
                  {testSet.scores.length > 0 && (
                    <div className="tests-set-scores">
                      {testSet.scores.map((score) => (
                        <div key={score.id} className="tests-set-score">
                          <span>{score.subject}</span>
                          <span>
                            {score.score}
                            {score.maxScore ? `/${score.maxScore}` : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {activeTab === 'detail' && selectedSet && (
        <div className="tests-detail">
          <button
            className="tests-back-button"
            onClick={() => setActiveTab('list')}
          >
            ← 戻る
          </button>
          <div className="tests-detail-content">
            <h2 className="tests-detail-title">
              {selectedSet.name}
            </h2>
            <div className="tests-detail-meta">
              <p>実施日: {selectedSet.date}</p>
              {selectedSet.grade && <p>学年: {selectedSet.grade}</p>}
              {selectedSet.memo && <p>メモ: {selectedSet.memo}</p>}
            </div>
            <div className="tests-detail-scores">
              <h3>教科ごとの結果</h3>
              {selectedSet.scores.length === 0 ? (
                <p className="tests-detail-empty">まだ教科の結果がありません</p>
              ) : (
                <div className="tests-detail-score-list">
                  {selectedSet.scores.map((score) => (
                    <div key={score.id} className="tests-detail-score">
                      <div className="tests-detail-score-subject">{score.subject}</div>
                      <div className="tests-detail-score-values">
                        <span>
                          {score.score}
                          {score.maxScore ? `/${score.maxScore}` : ''}
                        </span>
                        {score.average !== undefined && (
                          <span className="tests-detail-score-average">
                            平均: {score.average}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <TestModal
          testSet={selectedSet}
          projects={projects}
          onSave={handleSave}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
};

interface TestModalProps {
  testSet: TestSetWithScores | null;
  projects: Project[];
  onSave: (
    data: { date: string; name: string; grade?: string; memo?: string },
    scores: Array<{ subject: string; score: number; average?: number; maxScore?: number }>
  ) => void;
  onClose: () => void;
}

type ScoreInput = {
  id: string;
  subject: string;
  score: string;
  maxScore: string;
  average: string;
};

const TestModal: React.FC<TestModalProps> = ({ testSet, projects, onSave, onClose }) => {
  const [name, setName] = useState(testSet?.name || '');
  const [date, setDate] = useState(testSet?.date || '');
  const [grade, setGrade] = useState(testSet?.grade || '');
  const [memo, setMemo] = useState(testSet?.memo || '');
  const [scores, setScores] = useState<ScoreInput[]>(
    testSet?.scores.map((score) => ({
      id: generateId(),
      subject: score.subject,
      score: score.score.toString(),
      maxScore: score.maxScore ? score.maxScore.toString() : '',
      average: score.average !== undefined ? score.average.toString() : '',
    })) || []
  );

  useEffect(() => {
    if (date || testSet) return;
    setDate(format(new Date(), 'yyyy-MM-dd'));
  }, [date, testSet]);

  useEffect(() => {
    if (scores.length > 0) return;
    setScores([{ id: generateId(), subject: '', score: '', maxScore: '', average: '' }]);
  }, [scores.length]);

  const handleAddScore = () => {
    setScores((prev) => [
      ...prev,
      { id: generateId(), subject: '', score: '', maxScore: '', average: '' },
    ]);
  };

  const handleRemoveScore = (id: string) => {
    setScores((prev) => prev.filter((score) => score.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !date.trim()) {
      alert('テスト名と実施日を入力してください');
      return;
    }
    const sanitizedScores = scores
      .map((score) => ({
        subject: score.subject.trim(),
        score: score.score.trim(),
        maxScore: score.maxScore.trim(),
        average: score.average.trim(),
      }))
      .filter((score) => score.subject && score.score);

    if (sanitizedScores.length === 0) {
      alert('教科ごとの点数を入力してください');
      return;
    }

    onSave(
      {
        date: date.trim(),
        name: name.trim(),
        grade: grade.trim() || undefined,
        memo: memo.trim() || undefined,
      },
      sanitizedScores.map((score) => ({
        subject: score.subject,
        score: parseInt(score.score, 10),
        maxScore: score.maxScore ? parseInt(score.maxScore, 10) : undefined,
        average: score.average ? parseInt(score.average, 10) : undefined,
      }))
    );
  };

  return (
    <div className="tests-modal-overlay" onClick={onClose}>
      <div className="tests-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="tests-modal-title">
          {testSet ? 'テスト結果を編集' : '新しいテスト結果'}
        </h2>
        <form onSubmit={handleSubmit} className="tests-modal-form">
          <div className="tests-form-group">
            <label>テスト名</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: 中間テスト（2学期）"
              required
              lang="ja"
              inputMode="text"
              autoCapitalize="none"
              spellCheck={false}
            />
          </div>
          <div className="tests-form-group">
            <label>実施日（例: 2025-12-25）</label>
            <input
              type="text"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              placeholder="2025-12-25"
              required
              lang="ja"
              inputMode="text"
              autoCapitalize="none"
              spellCheck={false}
            />
          </div>
          <div className="tests-form-group">
            <label>学年（任意）</label>
            <input
              type="text"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              placeholder="例: 中1"
              lang="ja"
              inputMode="text"
              autoCapitalize="none"
              spellCheck={false}
            />
          </div>
          <div className="tests-form-group">
            <label>メモ（任意）</label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="補足メモ"
              rows={3}
              lang="ja"
              inputMode="text"
              autoCapitalize="none"
              spellCheck={false}
            />
          </div>
          <div className="tests-form-group">
            <label>教科別の点数</label>
            <div className="tests-score-blocks">
              {scores.map((score, index) => (
                <div key={score.id} className="tests-score-block">
                  <div className="tests-score-block-header">
                    <div className="tests-score-block-title">教科 {index + 1}</div>
                    {scores.length > 1 && (
                      <button
                        type="button"
                        className="tests-score-remove"
                        onClick={() => handleRemoveScore(score.id)}
                        aria-label={`教科${index + 1}を削除`}
                      >
                        ×
                      </button>
                    )}
                  </div>
                  <div className="tests-score-row">
                    <div className="tests-form-group">
                      <label>教科</label>
                      <select
                        value={score.subject}
                        onChange={(e) =>
                          setScores((prev) =>
                            prev.map((item) =>
                              item.id === score.id ? { ...item, subject: e.target.value } : item
                            )
                          )
                        }
                      >
                        <option value="">選択してください</option>
                        {projects.map((p) => (
                          <option key={p.id} value={p.name}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="tests-form-group">
                      <label>点数</label>
                      <input
                        type="number"
                        value={score.score}
                        onChange={(e) =>
                          setScores((prev) =>
                            prev.map((item) =>
                              item.id === score.id ? { ...item, score: e.target.value } : item
                            )
                          )
                        }
                        min="0"
                      />
                    </div>
                  </div>
                  <div className="tests-score-row">
                    <div className="tests-form-group">
                      <label>満点（任意）</label>
                      <input
                        type="number"
                        value={score.maxScore}
                        onChange={(e) =>
                          setScores((prev) =>
                            prev.map((item) =>
                              item.id === score.id ? { ...item, maxScore: e.target.value } : item
                            )
                          )
                        }
                        min="0"
                      />
                    </div>
                    <div className="tests-form-group">
                      <label>平均点（任意）</label>
                      <input
                        type="number"
                        value={score.average}
                        onChange={(e) =>
                          setScores((prev) =>
                            prev.map((item) =>
                              item.id === score.id ? { ...item, average: e.target.value } : item
                            )
                          )
                        }
                        min="0"
                      />
                    </div>
                  </div>
                </div>
              ))}
              <button type="button" className="tests-score-add" onClick={handleAddScore}>
                ＋教科を追加
              </button>
            </div>
          </div>
          <div className="tests-modal-actions">
            <button type="button" onClick={onClose}>
              キャンセル
            </button>
            <button type="submit">保存</button>
          </div>
        </form>
      </div>
    </div>
  );
};
