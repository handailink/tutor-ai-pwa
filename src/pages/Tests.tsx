import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { TestResultRepository } from '../repositories';
import { ProjectService } from '../services';
import { TestResult, Project, Attachment } from '../types';
import { generateId } from '../utils/id';
import './Tests.css';

export const Tests: React.FC = () => {
  const { user } = useAuth();
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [selectedTest, setSelectedTest] = useState<TestResult | null>(null);
  const [activeTab, setActiveTab] = useState<'list' | 'detail'>('list');

  const testRepository = useMemo(() => new TestResultRepository(), []);
  const projectService = useMemo(() => new ProjectService(), []);

  const loadTestResults = useCallback(async () => {
    if (!user) return;
    let results = await testRepository.findByUserId(user.id);
    if (selectedProject !== 'all') {
      results = results.filter((t) => t.projectId === selectedProject);
    }
    setTestResults(results);
  }, [user, selectedProject, testRepository]);

  const loadProjects = useCallback(async () => {
    if (!user) return;
    const projs = await projectService.getProjectsByUserId(user.id);
    setProjects(projs);
  }, [user, projectService]);

  useEffect(() => {
    if (user) {
      loadTestResults();
      loadProjects();
    }
  }, [user, selectedProject, loadTestResults, loadProjects]);

  const handleCreate = () => {
    setSelectedTest(null);
    setShowModal(true);
  };

  const handleView = (test: TestResult) => {
    setSelectedTest(test);
    setActiveTab('detail');
  };

  const handleSave = async (testResult: Omit<TestResult, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!user) return;
    if (selectedTest) {
      await testRepository.updateTestResult(selectedTest.id, testResult as Partial<TestResult>);
    } else {
      await testRepository.createTestResult(testResult);
    }
    setShowModal(false);
    loadTestResults();
  };

  const filteredResults = testResults;

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
          {filteredResults.length === 0 ? (
            <div className="tests-empty">テスト結果がありません</div>
          ) : (
            filteredResults.map((test) => {
              const project = projects.find((p) => p.id === test.projectId);
              const percentage = test.maxScore
                ? Math.round((test.score / test.maxScore) * 100)
                : null;
              return (
                <div
                  key={test.id}
                  className="tests-item"
                  onClick={() => handleView(test)}
                >
                  <div className="tests-item-header">
                    <div>
                      <h3 className="tests-item-title">{project?.name || '不明'}</h3>
                      <div className="tests-item-meta">
                        {test.takenAt}
                        {test.tags && <span className="tests-tags">{test.tags}</span>}
                      </div>
                    </div>
                    <div className="tests-score">
                      <span className="tests-score-value">{test.score}</span>
                      {test.maxScore && (
                        <span className="tests-score-max">/{test.maxScore}</span>
                      )}
                      {percentage !== null && (
                        <span className="tests-score-percent">({percentage}%)</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {activeTab === 'detail' && selectedTest && (
        <div className="tests-detail">
          <button
            className="tests-back-button"
            onClick={() => setActiveTab('list')}
          >
            ← 戻る
          </button>
          <div className="tests-detail-content">
            <h2 className="tests-detail-title">
              {projects.find((p) => p.id === selectedTest.projectId)?.name || '不明'}
            </h2>
            <div className="tests-detail-meta">
              <p>実施日: {selectedTest.takenAt}</p>
              <p>
                点数: {selectedTest.score}
                {selectedTest.maxScore && ` / ${selectedTest.maxScore}`}
              </p>
              {selectedTest.tags && <p>タグ: {selectedTest.tags}</p>}
            </div>
            {selectedTest.attachments && selectedTest.attachments.length > 0 && (
              <div className="tests-detail-attachments">
                {selectedTest.attachments.map((att) => (
                  <img key={att.id} src={att.urlOrData} alt={att.name} />
                ))}
              </div>
            )}
            <div className="tests-analysis">
              <h3>分析（モック）</h3>
              <p>弱点候補: 基礎計算、文章題</p>
              <p>次回アクション: 練習問題を解いて復習する</p>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <TestModal
          test={selectedTest}
          projects={projects}
          userId={user?.id || ''}
          onSave={handleSave}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
};

interface TestModalProps {
  test: TestResult | null;
  projects: Project[];
  userId: string;
  onSave: (testResult: Omit<TestResult, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onClose: () => void;
}

const TestModal: React.FC<TestModalProps> = ({ test, projects, userId, onSave, onClose }) => {
  const [projectId, setProjectId] = useState(test?.projectId || projects[0]?.id || '');
  const [takenAt, setTakenAt] = useState(test?.takenAt || '');
  const [score, setScore] = useState(test?.score.toString() || '');
  const [maxScore, setMaxScore] = useState(test?.maxScore?.toString() || '');
  const [tags, setTags] = useState(test?.tags || '');
  const [attachments, setAttachments] = useState<Attachment[]>(test?.attachments || []);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const cameraInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach((file) => {
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const attachment: Attachment = {
              id: generateId(),
              type: 'image',
              urlOrData: event.target?.result as string,
              name: file.name,
            };
            setAttachments((prev) => [...prev, attachment]);
          };
          reader.readAsDataURL(file);
        }
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !takenAt || !score) {
      alert('教科、実施日、点数を入力してください');
      return;
    }
    onSave({
      userId,
      projectId,
      takenAt,
      score: parseInt(score),
      maxScore: maxScore ? parseInt(maxScore) : undefined,
      tags: tags || undefined,
      attachments: attachments.length > 0 ? attachments : undefined,
    } as Omit<TestResult, 'id' | 'createdAt' | 'updatedAt'>);
  };

  return (
    <div className="tests-modal-overlay" onClick={onClose}>
      <div className="tests-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="tests-modal-title">
          {test ? 'テスト結果を編集' : '新しいテスト結果'}
        </h2>
        <form onSubmit={handleSubmit} className="tests-modal-form">
          <div className="tests-form-group">
            <label>教科</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              required
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="tests-form-group">
            <label>実施日（例: 2025-12-25）</label>
            <input
              type="text"
              value={takenAt}
              onChange={(e) => setTakenAt(e.target.value)}
              placeholder="2025-12-25"
              required
            />
          </div>
          <div className="tests-form-group">
            <label>点数</label>
            <input
              type="number"
              value={score}
              onChange={(e) => setScore(e.target.value)}
              required
              min="0"
            />
          </div>
          <div className="tests-form-group">
            <label>満点（任意）</label>
            <input
              type="number"
              value={maxScore}
              onChange={(e) => setMaxScore(e.target.value)}
              min="0"
            />
          </div>
          <div className="tests-form-group">
            <label>タグ（任意）</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="例: 一次関数、二次関数"
            />
          </div>
          <div className="tests-form-group">
            <label>スキャン画像</label>
            <div className="tests-attachment-buttons">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
              >
                📷 アップロード
              </button>
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
              >
                📸 カメラ
              </button>
            </div>
            {attachments.length > 0 && (
              <div className="tests-attachments">
                {attachments.map((att) => (
                  <img key={att.id} src={att.urlOrData} alt={att.name} />
                ))}
              </div>
            )}
          </div>
          <div className="tests-modal-actions">
            <button type="button" onClick={onClose}>
              キャンセル
            </button>
            <button type="submit">保存</button>
          </div>
        </form>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
      </div>
    </div>
  );
};
