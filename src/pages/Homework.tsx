import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { HomeworkRepository } from '../repositories';
import { ProjectService } from '../services';
import { Homework as HomeworkType, Project, Attachment } from '../types';
import { generateId } from '../utils/id';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
} from 'date-fns';
import ja from 'date-fns/locale/ja';
import './Homework.css';

export const Homework: React.FC = () => {
  const { user } = useAuth();
  const [homeworks, setHomeworks] = useState<HomeworkType[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedHomework, setSelectedHomework] = useState<HomeworkType | null>(null);

  const homeworkRepository = useMemo(() => new HomeworkRepository(), []);
  const projectService = useMemo(() => new ProjectService(), []);

  const loadHomeworks = useCallback(async () => {
    if (!user) return;
    const allHomeworks = await homeworkRepository.findByUserId(user.id);
    setHomeworks(allHomeworks);
  }, [user, homeworkRepository]);

  const loadProjects = useCallback(async () => {
    if (!user) return;
    const projs = await projectService.getProjectsByUserId(user.id);
    setProjects(projs);
  }, [user, projectService]);

  useEffect(() => {
    if (user) {
      loadHomeworks();
      loadProjects();
    }
  }, [user, loadHomeworks, loadProjects]);

  // 特定の日付に指導日がある宿題を取得（完了含む）
  const getHomeworksForDate = (date: Date) => {
    return homeworks.filter(h => {
      if (!h.assignedAt) return false;
      const assignedDate = new Date(h.assignedAt);
      return isSameDay(assignedDate, date);
    });
  };

  // 日付に宿題があるかどうか（指導日で判定）
  const hasHomeworkOnDate = (date: Date) => {
    return homeworks.some(h => {
      if (!h.assignedAt) return false;
      const assignedDate = new Date(h.assignedAt);
      return isSameDay(assignedDate, date);
    });
  };

  // 選択された日付の宿題（指導日で表示、完了含む）
  const selectedDateHomeworks = useMemo(() => {
    if (!selectedDate) return [];
    return getHomeworksForDate(selectedDate);
  }, [selectedDate, homeworks]);

  const handleToggleStatus = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    await homeworkRepository.toggleStatus(id);
    loadHomeworks();
  };

  const handleCreate = () => {
    setSelectedHomework(null);
    setShowModal(true);
  };

  const handleView = (homework: HomeworkType) => {
    setSelectedHomework(homework);
    setShowModal(true);
  };

  const handleSave = async (homework: Omit<HomeworkType, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!user) return;
    if (selectedHomework) {
      await homeworkRepository.updateHomework(selectedHomework.id, homework as Partial<HomeworkType>);
    } else {
      await homeworkRepository.createHomework(homework);
    }
    setShowModal(false);
    loadHomeworks();
  };

  const handleDelete = async () => {
    if (!selectedHomework) return;
    if (!confirm('この宿題を削除しますか？')) return;
    await homeworkRepository.delete(selectedHomework.id);
    setShowModal(false);
    setSelectedHomework(null);
    loadHomeworks();
  };

  // カレンダーの日付を生成
  const renderCalendar = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { locale: ja });
    const endDate = endOfWeek(monthEnd, { locale: ja });

    const rows = [];
    let days = [];
    let day = startDate;

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        const currentDay = day;
        const hasHomework = hasHomeworkOnDate(currentDay);
        const isSelected = selectedDate && isSameDay(currentDay, selectedDate);
        const isCurrentMonth = isSameMonth(currentDay, monthStart);
        const isTodayDate = isToday(currentDay);

        days.push(
          <div
            key={day.toString()}
            className={`calendar-day ${!isCurrentMonth ? 'other-month' : ''} ${isSelected ? 'selected' : ''} ${isTodayDate ? 'today' : ''} ${hasHomework ? 'has-homework' : ''}`}
            onClick={() => setSelectedDate(currentDay)}
          >
            <span className="calendar-day-number">{format(currentDay, 'd')}</span>
          </div>
        );
        day = addDays(day, 1);
      }
      rows.push(
        <div className="calendar-row" key={day.toString()}>
          {days}
        </div>
      );
      days = [];
    }

    return rows;
  };

  return (
    <div className="homework-page">
      <header className="homework-header">
        <h1 className="homework-title">宿題</h1>
      </header>

      {/* カレンダー */}
      <div className="calendar-container">
            <div className="calendar-header">
              <button className="calendar-nav" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                ‹
              </button>
              <h2 className="calendar-month">
                {format(currentMonth, 'yyyy年M月', { locale: ja })}
              </h2>
              <button className="calendar-nav" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                ›
              </button>
            </div>

            <div className="calendar-weekdays">
              {['日', '月', '火', '水', '木', '金', '土'].map(day => (
                <div key={day} className="calendar-weekday">{day}</div>
              ))}
            </div>

            <div className="calendar-grid">
              {renderCalendar()}
            </div>
          </div>

      {/* 選択した日付の宿題 */}
      {selectedDate && (
        <div className="homework-date-section">
          <h3 className="homework-date-title">
            {format(selectedDate, 'M月d日（E）', { locale: ja })}
          </h3>
          {selectedDateHomeworks.length === 0 ? (
            <p className="homework-empty-small">この日の宿題はありません</p>
          ) : (
            <div className="homework-list-compact">
              {selectedDateHomeworks.map(homework => {
                const project = projects.find(p => p.id === homework.projectId);
                const isDone = homework.status === 'done';
                return (
                  <div 
                    key={homework.id} 
                    className={`homework-item-compact ${isDone ? 'done' : ''}`}
                    onClick={() => handleView(homework)}
                  >
                    <div className="homework-item-info">
                      <span className="homework-project-tag">{project?.name}</span>
                      <span className="homework-item-title">{homework.title}</span>
                      {homework.dueAt && (
                        <span className="homework-item-due">期限: {homework.dueAt}</span>
                      )}
                    </div>
                    <button
                      className={`homework-check-button ${isDone ? 'checked' : ''}`}
                      onClick={(e) => handleToggleStatus(homework.id, e)}
                    >
                      {isDone ? '✓' : '○'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 追加ボタン（フローティング） */}
      <button className="homework-fab" onClick={handleCreate}>
        + 宿題を追加
      </button>

      {showModal && (
        <HomeworkModal
          homework={selectedHomework}
          projects={projects}
          userId={user?.id || ''}
          initialAssignedAt={selectedDate ? format(selectedDate, 'yyyy-MM-dd') : ''}
          onSave={handleSave}
          onDelete={selectedHomework ? handleDelete : undefined}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
};

interface HomeworkModalProps {
  homework: HomeworkType | null;
  projects: Project[];
  userId: string;
  initialAssignedAt?: string;
  onSave: (homework: Omit<HomeworkType, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onDelete?: () => void;
  onClose: () => void;
}

const HomeworkModal: React.FC<HomeworkModalProps> = ({ homework, projects, userId, initialAssignedAt, onSave, onDelete, onClose }) => {
  const [title, setTitle] = useState(homework?.title || '');
  const [projectId, setProjectId] = useState(homework?.projectId || projects[0]?.id || '');
  const [detail, setDetail] = useState(homework?.detail || '');
  const [assignedAt, setAssignedAt] = useState(homework?.assignedAt || initialAssignedAt || '');
  const [dueAt, setDueAt] = useState(homework?.dueAt || '');
  const [attachments, setAttachments] = useState<Attachment[]>(homework?.attachments || []);
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
    if (!title || !projectId || !assignedAt || !dueAt) {
      alert('タイトル、教科、指導日、期限を入力してください');
      return;
    }
    onSave({
      userId,
      projectId,
      title,
      detail,
      assignedAt,
      dueAt,
      status: homework?.status || 'todo',
      attachments: attachments.length > 0 ? attachments : undefined,
    } as Omit<HomeworkType, 'id' | 'createdAt' | 'updatedAt'>);
  };

  return (
    <div className="homework-modal-overlay" onClick={onClose}>
      <div className="homework-modal" onClick={(e) => e.stopPropagation()}>
        <div className="homework-modal-header">
          <h2 className="homework-modal-title">
            {homework ? '宿題を編集' : '新しい宿題'}
          </h2>
          {onDelete && (
            <button className="homework-delete-button" onClick={onDelete}>
              🗑️
            </button>
          )}
        </div>
        <form onSubmit={handleSubmit} className="homework-modal-form">
          <div className="homework-form-group">
            <label>タイトル *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例: ワークP.45-50"
              lang="ja"
              inputMode="text"
              autoCapitalize="none"
              spellCheck={false}
              required
            />
          </div>
          <div className="homework-form-group">
            <label>教科 *</label>
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
          <div className="homework-form-group">
            <label>指導日 *（宿題を出した日）</label>
            <input
              type="text"
              value={assignedAt}
              onChange={(e) => setAssignedAt(e.target.value)}
              placeholder="2025-12-20"
              lang="ja"
              inputMode="text"
              autoCapitalize="none"
              spellCheck={false}
              required
            />
          </div>
          <div className="homework-form-group">
            <label>期限 *（提出日）</label>
            <input
              type="text"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              placeholder="2025-12-25"
              lang="ja"
              inputMode="text"
              autoCapitalize="none"
              spellCheck={false}
              required
            />
          </div>
          <div className="homework-form-group">
            <label>詳細（任意）</label>
            <textarea
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              rows={3}
              placeholder="メモがあれば入力"
              lang="ja"
              inputMode="text"
              autoCapitalize="none"
              spellCheck={false}
            />
          </div>
          <div className="homework-form-group">
            <label>画像（任意）</label>
            <div className="homework-attachment-buttons">
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
              <div className="homework-attachments">
                {attachments.map((att) => (
                  <img key={att.id} src={att.urlOrData} alt={att.name} />
                ))}
              </div>
            )}
          </div>
          <div className="homework-modal-actions">
            <button type="button" onClick={onClose}>
              キャンセル
            </button>
            <button type="submit" className="primary">保存</button>
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
