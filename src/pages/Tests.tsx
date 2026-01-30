import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { format } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { TestSetRepository } from '../repositories';
import { ProjectService } from '../services';
import { TestSetWithScores, Project, Attachment } from '../types';
import { generateId } from '../utils/id';
import { uploadTestImage, createSignedUrl } from '../services/storage.service';
import { isSupabaseConfigured } from '../lib/supabase';
import './Tests.css';

// 画像表示用コンポーネント（署名付きURL対応）
const TestImage: React.FC<{ 
  attachment: Attachment; 
  alt: string;
  onClick?: (url: string) => void;
}> = ({ attachment, alt, onClick }) => {
  const [imageUrl, setImageUrl] = useState<string>(attachment.urlOrData || '');
  const [loading, setLoading] = useState<boolean>(!attachment.urlOrData && !!attachment.path);

  useEffect(() => {
    // pathがある場合は署名付きURLを取得
    if (attachment.path && !attachment.urlOrData) {
      setLoading(true);
      createSignedUrl(attachment.path)
        .then((url) => {
          setImageUrl(url);
          setLoading(false);
        })
        .catch((err) => {
          console.error('署名URL取得エラー:', err);
          setLoading(false);
        });
    } else if (attachment.urlOrData) {
      setImageUrl(attachment.urlOrData);
    }
  }, [attachment.path, attachment.urlOrData]);

  if (loading) {
    return <div className="tests-image-loading">読込中...</div>;
  }

  if (!imageUrl) {
    return <div className="tests-image-error">画像を読み込めません</div>;
  }

  return (
    <img 
      src={imageUrl} 
      alt={alt} 
      onClick={() => onClick?.(imageUrl)}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    />
  );
};

// 画像拡大モーダル
const ImageViewerModal: React.FC<{
  imageUrl: string;
  onClose: () => void;
}> = ({ imageUrl, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="tests-image-viewer-overlay" onClick={onClose}>
      <button className="tests-image-viewer-close" onClick={onClose} aria-label="閉じる">
        ×
      </button>
      <div className="tests-image-viewer-content" onClick={(e) => e.stopPropagation()}>
        <img src={imageUrl} alt="拡大画像" />
      </div>
    </div>
  );
};

export const Tests: React.FC = () => {
  const { user } = useAuth();
  const [testSets, setTestSets] = useState<TestSetWithScores[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [selectedSet, setSelectedSet] = useState<TestSetWithScores | null>(null);
  const [activeTab, setActiveTab] = useState<'list' | 'detail'>('list');
  const [viewerImage, setViewerImage] = useState<string | null>(null);

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

  const handleEdit = (testSet: TestSetWithScores) => {
    setSelectedSet(testSet);
    setShowModal(true);
  };

  const handleDelete = async (testSet: TestSetWithScores) => {
    if (!window.confirm('このテスト結果を削除しますか？')) return;
    const optimistic = testSets.filter((set) => set.id !== testSet.id);
    setTestSets(optimistic);
    if (selectedSet?.id === testSet.id) {
      setSelectedSet(null);
      setActiveTab('list');
    }
    try {
      await testRepository.deleteTestSet(testSet.id);
    } catch (error) {
      alert('削除に失敗しました。');
      loadTestSets();
    }
  };

  const handleSave = async (
    data: { date: string; name: string; grade?: string; memo?: string },
    scores: Array<{
      subject: string;
      score: number;
      average?: number;
      maxScore?: number;
      problemImages?: Attachment[];
      answerImages?: Attachment[];
    }>
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
  const isSubjectFiltered = selectedProject !== 'all';
  const filteredSets = isSubjectFiltered
    ? testSets.filter((set) =>
        set.scores.some(
          (score) =>
            score.subject === selectedProjectName || score.subject === selectedProject
        )
      )
    : testSets;
  const getFilteredScores = (scores: TestSetWithScores['scores']) =>
    isSubjectFiltered
      ? scores.filter(
          (score) =>
            score.subject === selectedProjectName || score.subject === selectedProject
        )
      : scores;

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
                    <div className="tests-item-actions">
                      <div className="tests-set-count">
                        {getFilteredScores(testSet.scores).length}教科
                      </div>
                      {!isSubjectFiltered && (
                        <>
                          <button
                            type="button"
                            className="tests-edit-button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(testSet);
                            }}
                          >
                            編集
                          </button>
                          <button
                            type="button"
                            className="tests-delete-button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(testSet);
                            }}
                          >
                            削除
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {getFilteredScores(testSet.scores).length > 0 && (
                    <div className="tests-set-scores">
                      {getFilteredScores(testSet.scores).map((score) => (
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
            <div className="tests-detail-header">
              <h2 className="tests-detail-title">
                {selectedSet.name}
              </h2>
              {!isSubjectFiltered && (
                <div className="tests-detail-actions">
                  <button
                    type="button"
                    className="tests-edit-button"
                    onClick={() => handleEdit(selectedSet)}
                  >
                    編集
                  </button>
                  <button
                    type="button"
                    className="tests-delete-button"
                    onClick={() => handleDelete(selectedSet)}
                  >
                    削除
                  </button>
                </div>
              )}
            </div>
            <div className="tests-detail-meta">
              <p>実施日: {selectedSet.date}</p>
              {selectedSet.grade && <p>学年: {selectedSet.grade}</p>}
              {selectedSet.memo && <p>メモ: {selectedSet.memo}</p>}
            </div>
            <div className="tests-detail-scores">
              <h3>教科ごとの結果</h3>
              {getFilteredScores(selectedSet.scores).length === 0 ? (
                <p className="tests-detail-empty">まだ教科の結果がありません</p>
              ) : (
                <div className="tests-detail-score-list">
                  {getFilteredScores(selectedSet.scores).map((score) => (
                    <div key={score.id} className="tests-detail-score-card">
                      <div className="tests-detail-score-header">
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
                      
                      {/* 問題の写真 */}
                      {score.problemImages && score.problemImages.length > 0 && (
                        <div className="tests-detail-images">
                          <h4>問題</h4>
                          <div className="tests-detail-image-grid">
                            {score.problemImages.map((img) => (
                              <div key={img.id} className="tests-detail-image-link">
                                <TestImage 
                                  attachment={img} 
                                  alt={img.name || '問題'} 
                                  onClick={(url) => setViewerImage(url)}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* 解答の写真 */}
                      {score.answerImages && score.answerImages.length > 0 && (
                        <div className="tests-detail-images">
                          <h4>解答</h4>
                          <div className="tests-detail-image-grid">
                            {score.answerImages.map((img) => (
                              <div key={img.id} className="tests-detail-image-link">
                                <TestImage 
                                  attachment={img} 
                                  alt={img.name || '解答'} 
                                  onClick={(url) => setViewerImage(url)}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
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

      {viewerImage && (
        <ImageViewerModal
          imageUrl={viewerImage}
          onClose={() => setViewerImage(null)}
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
    scores: Array<{
      subject: string;
      score: number;
      average?: number;
      maxScore?: number;
      problemImages?: Attachment[];
      answerImages?: Attachment[];
    }>
  ) => void;
  onClose: () => void;
}

type ScoreInput = {
  id: string;
  subject: string;
  score: string;
  maxScore: string;
  average: string;
  problemImages: Attachment[];
  answerImages: Attachment[];
};

const TestModal: React.FC<TestModalProps> = ({ testSet, projects, onSave, onClose }) => {
  const { user } = useAuth();
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
      problemImages: score.problemImages || [],
      answerImages: score.answerImages || [],
    })) || []
  );
  const [uploading, setUploading] = useState(false);
  const [viewerImage, setViewerImage] = useState<string | null>(null);
  const problemInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const answerInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  
  // テストセットID（新規作成時は仮ID）
  const testSetId = testSet?.id || 'new-test';

  useEffect(() => {
    if (date || testSet) return;
    setDate(format(new Date(), 'yyyy-MM-dd'));
  }, [date, testSet]);

  useEffect(() => {
    if (scores.length > 0) return;
    setScores([{ id: generateId(), subject: '', score: '', maxScore: '', average: '', problemImages: [], answerImages: [] }]);
  }, [scores.length]);

  const handleAddScore = () => {
    setScores((prev) => [
      ...prev,
      { id: generateId(), subject: '', score: '', maxScore: '', average: '', problemImages: [], answerImages: [] },
    ]);
  };

  // FileをDataURLに変換するヘルパー
  const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // 画像アップロード処理（Supabase Storage使用）
  const handleImageUpload = async (
    scoreId: string,
    type: 'problem' | 'answer',
    files: FileList | null
  ) => {
    if (!files || files.length === 0) return;
    
    setUploading(true);
    
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      
      // まずBase64でプレビュー用のURLを取得（即座に表示用）
      const dataUrl = await fileToDataUrl(file);
      
      try {
        let newAttachment: Attachment;
        
        // Supabase Storageが設定されている場合はStorageにアップロード
        if (isSupabaseConfigured()) {
          const result = await uploadTestImage(file, testSetId, user?.id);
          newAttachment = {
            id: generateId(),
            type: 'image',
            urlOrData: dataUrl, // プレビュー用にBase64を使用
            path: result.path,  // 保存用にpathを記録
            name: result.name,
            mime: result.mime,
            size: result.size,
          };
        } else {
          // Supabase未設定時はBase64で保存（LocalStorage用）
          newAttachment = {
            id: generateId(),
            type: 'image',
            urlOrData: dataUrl,
            name: file.name,
            mime: file.type,
            size: file.size,
          };
        }
        
        setScores((prev) =>
          prev.map((score) => {
            if (score.id !== scoreId) return score;
            if (type === 'problem') {
              return { ...score, problemImages: [...score.problemImages, newAttachment] };
            } else {
              return { ...score, answerImages: [...score.answerImages, newAttachment] };
            }
          })
        );
      } catch (error) {
        console.error('画像アップロードエラー:', error);
        alert('画像のアップロードに失敗しました');
      }
    }
    
    setUploading(false);
  };

  // 画像削除処理
  const handleRemoveImage = (scoreId: string, type: 'problem' | 'answer', attachmentId: string) => {
    setScores((prev) =>
      prev.map((score) => {
        if (score.id !== scoreId) return score;
        if (type === 'problem') {
          return { ...score, problemImages: score.problemImages.filter((img) => img.id !== attachmentId) };
        } else {
          return { ...score, answerImages: score.answerImages.filter((img) => img.id !== attachmentId) };
        }
      })
    );
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
        problemImages: score.problemImages,
        answerImages: score.answerImages,
      }))
      .filter((score) => score.subject && score.score);

    if (sanitizedScores.length === 0) {
      alert('教科ごとの点数を入力してください');
      return;
    }

    // 保存用に画像データを整理（Storageの場合はpathのみ、LocalStorageの場合はurlOrData）
    const cleanAttachments = (attachments: Attachment[]): Attachment[] => {
      return attachments.map((att) => {
        if (att.path) {
          // Storageに保存済み：pathのみ保持、urlOrDataは空に
          return { ...att, urlOrData: '' };
        }
        // LocalStorage用：Base64をそのまま保持
        return att;
      });
    };

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
        problemImages: cleanAttachments(score.problemImages),
        answerImages: cleanAttachments(score.answerImages),
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
            <label>実施日</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              lang="ja"
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

                  {/* 問題の写真 */}
                  <div className="tests-form-group">
                    <label>問題の写真（任意）</label>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      ref={(el) => { problemInputRefs.current[score.id] = el; }}
                      onChange={(e) => handleImageUpload(score.id, 'problem', e.target.files)}
                      style={{ display: 'none' }}
                    />
                    <button
                      type="button"
                      className="tests-image-upload-button"
                      onClick={() => problemInputRefs.current[score.id]?.click()}
                    >
                      📷 問題を追加
                    </button>
                    {score.problemImages.length > 0 && (
                      <div className="tests-image-preview-list">
                        {score.problemImages.map((img) => (
                          <div key={img.id} className="tests-image-preview">
                            <TestImage 
                              attachment={img} 
                              alt={img.name || '問題'} 
                              onClick={(url) => setViewerImage(url)}
                            />
                            <button
                              type="button"
                              className="tests-image-remove"
                              onClick={() => handleRemoveImage(score.id, 'problem', img.id)}
                              aria-label="削除"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 解答の写真 */}
                  <div className="tests-form-group">
                    <label>解答の写真（任意）</label>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      ref={(el) => { answerInputRefs.current[score.id] = el; }}
                      onChange={(e) => handleImageUpload(score.id, 'answer', e.target.files)}
                      style={{ display: 'none' }}
                    />
                    <button
                      type="button"
                      className="tests-image-upload-button"
                      onClick={() => answerInputRefs.current[score.id]?.click()}
                    >
                      📷 解答を追加
                    </button>
                    {score.answerImages.length > 0 && (
                      <div className="tests-image-preview-list">
                        {score.answerImages.map((img) => (
                          <div key={img.id} className="tests-image-preview">
                            <TestImage 
                              attachment={img} 
                              alt={img.name || '解答'} 
                              onClick={(url) => setViewerImage(url)}
                            />
                            <button
                              type="button"
                              className="tests-image-remove"
                              onClick={() => handleRemoveImage(score.id, 'answer', img.id)}
                              aria-label="削除"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <button type="button" className="tests-score-add" onClick={handleAddScore}>
                ＋教科を追加
              </button>
            </div>
          </div>
          <div className="tests-modal-actions">
            <button type="button" onClick={onClose} disabled={uploading}>
              キャンセル
            </button>
            <button type="submit" disabled={uploading}>
              {uploading ? 'アップロード中...' : '保存'}
            </button>
          </div>
        </form>

        {viewerImage && (
          <ImageViewerModal
            imageUrl={viewerImage}
            onClose={() => setViewerImage(null)}
          />
        )}
      </div>
    </div>
  );
};
