import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import ja from 'date-fns/locale/ja';
import { useAuth } from '../contexts/AuthContext';
import { HomeworkRepository } from '../repositories';
import { ProjectService } from '../services';
import { Homework as HomeworkType, Project } from '../types';
import { generateId } from '../utils/id';
import './Homework.css';

type TodoItem = {
  id: string;
  text: string;
  done: boolean;
};

type SubjectBlock = {
  id: string;
  projectId: string;
  description: string;
  todos: TodoItem[];
};

type HomeworkDetailPayload = {
  type: 'todo_v1';
  description: string;
  todos: TodoItem[];
};

const parseHomeworkDetail = (detail?: string) => {
  if (!detail) {
    return { description: '', todos: [] as TodoItem[] };
  }
  try {
    const parsed = JSON.parse(detail) as HomeworkDetailPayload;
    if (parsed?.type === 'todo_v1' && Array.isArray(parsed.todos)) {
      return {
        description: parsed.description || '',
        todos: parsed.todos,
      };
    }
  } catch {
    // plain text detail
  }
  return { description: detail, todos: [] as TodoItem[] };
};

const serializeHomeworkDetail = (description: string, todos: TodoItem[]) => {
  const payload: HomeworkDetailPayload = {
    type: 'todo_v1',
    description,
    todos,
  };
  return JSON.stringify(payload);
};

export const Homework: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [homeworks, setHomeworks] = useState<HomeworkType[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [assignedAt, setAssignedAt] = useState('');
  const [subjectBlocks, setSubjectBlocks] = useState<SubjectBlock[]>([]);

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

  const groupedHomeworks = useMemo(() => {
    const map = new Map<string, HomeworkType[]>();
    homeworks.forEach((hw) => {
      const key = hw.assignedAt || '未設定';
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)?.push(hw);
    });
    return Array.from(map.entries())
      .map(([date, items]) => ({
        date,
        items: items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [homeworks]);

  const createEmptySubjectBlock = useCallback(
    (projectId: string) => ({
      id: generateId(),
      projectId,
      description: '',
      todos: [] as TodoItem[],
    }),
    []
  );

  const resetForm = useCallback(() => {
    setAssignedAt(format(new Date(), 'yyyy-MM-dd'));
    setSubjectBlocks([createEmptySubjectBlock(projects[0]?.id || '')]);
    setEditingId(null);
  }, [createEmptySubjectBlock, projects]);

  const handleOpenCreate = () => {
    resetForm();
    setIsFormOpen(true);
  };

  const handleLogout = async () => {
    if (!window.confirm('ログアウトしますか？')) return;
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch {
      alert('ログアウトに失敗しました。もう一度試してね');
    }
  };

  const handleEdit = (homework: HomeworkType) => {
    const detail = parseHomeworkDetail(homework.detail);
    setAssignedAt(homework.assignedAt || format(new Date(), 'yyyy-MM-dd'));
    setSubjectBlocks([
      {
        id: generateId(),
        projectId: homework.projectId || projects[0]?.id || '',
        description: detail.description,
        todos: detail.todos,
      },
    ]);
    setEditingId(homework.id);
    setIsFormOpen(true);
  };

  useEffect(() => {
    if (!isFormOpen || editingId) return;
    if (projects.length === 0) return;
    setSubjectBlocks((prev) =>
      prev.map((block) =>
        block.projectId ? block : { ...block, projectId: projects[0].id }
      )
    );
  }, [projects, isFormOpen, editingId]);

  const handleAddSubjectBlock = () => {
    setSubjectBlocks((prev) => [
      ...prev,
      createEmptySubjectBlock(projects[0]?.id || ''),
    ]);
  };

  const handleRemoveSubjectBlock = (id: string) => {
    setSubjectBlocks((prev) => prev.filter((block) => block.id !== id));
  };

  const handleAddTodo = (blockId: string) => {
    setSubjectBlocks((prev) =>
      prev.map((block) =>
        block.id === blockId
          ? {
              ...block,
              todos: [...block.todos, { id: generateId(), text: '', done: false }],
            }
          : block
      )
    );
  };

  const handleRemoveTodo = (blockId: string, id: string) => {
    setSubjectBlocks((prev) =>
      prev.map((block) =>
        block.id === blockId
          ? { ...block, todos: block.todos.filter((todo) => todo.id !== id) }
          : block
      )
    );
  };

  const handleToggleTodoDone = async (homework: HomeworkType, todoId: string) => {
    const detail = parseHomeworkDetail(homework.detail);
    const nextTodos = detail.todos.map((todo) =>
      todo.id === todoId ? { ...todo, done: !todo.done } : todo
    );
    const nextStatus: HomeworkType['status'] =
      nextTodos.length > 0 && nextTodos.every((todo) => todo.done) ? 'done' : 'todo';
    const nextDetail = serializeHomeworkDetail(detail.description, nextTodos);
    const optimistic = homeworks.map((hw) =>
      hw.id === homework.id ? { ...hw, detail: nextDetail, status: nextStatus } : hw
    );
    setHomeworks(optimistic);
    try {
      await homeworkRepository.updateHomework(homework.id, {
        detail: nextDetail,
        status: nextStatus,
      } as Partial<HomeworkType>);
    } catch (error) {
      alert('チェックの更新に失敗しました。');
      loadHomeworks();
    }
  };

  const handleDeleteHomework = async (homework: HomeworkType) => {
    if (!window.confirm('この宿題を削除しますか？')) return;
    const optimistic = homeworks.filter((hw) => hw.id !== homework.id);
    setHomeworks(optimistic);
    try {
      await homeworkRepository.deleteHomework(homework.id);
    } catch (error) {
      alert('削除に失敗しました。');
      loadHomeworks();
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!assignedAt.trim()) {
      alert('日付を入力してください');
      return;
    }

    if (editingId) {
      const target = subjectBlocks[0];
      if (!target?.projectId) {
        alert('教科を選択してください');
        return;
      }
      const cleanedTodos = target.todos
        .map((todo) => ({ ...todo, text: todo.text.trim() }))
        .filter((todo) => todo.text.length > 0);
      const nextStatus =
        cleanedTodos.length > 0 && cleanedTodos.every((todo) => todo.done) ? 'done' : 'todo';
      const detail = serializeHomeworkDetail(target.description.trim(), cleanedTodos);
      const resolvedTitle = cleanedTodos[0]?.text || target.description.trim() || '宿題';
      const payload: Omit<HomeworkType, 'id' | 'createdAt' | 'updatedAt'> = {
        userId: user.id,
        projectId: target.projectId,
        title: resolvedTitle,
        detail,
        assignedAt: assignedAt.trim(),
        dueAt: assignedAt.trim(),
        status: nextStatus,
      };
      await homeworkRepository.updateHomework(editingId, payload as Partial<HomeworkType>);
    } else {
      const sanitizedBlocks = subjectBlocks
        .map((block) => {
          const cleanedTodos = block.todos
            .map((todo) => ({ ...todo, text: todo.text.trim() }))
            .filter((todo) => todo.text.length > 0);
          return {
            ...block,
            description: block.description.trim(),
            todos: cleanedTodos,
          };
        })
        .filter((block) => block.projectId && (block.description || block.todos.length > 0));

      if (sanitizedBlocks.length === 0) {
        alert('教科と内容を入力してください');
        return;
      }

      for (const block of sanitizedBlocks) {
        const nextStatus =
          block.todos.length > 0 && block.todos.every((todo) => todo.done) ? 'done' : 'todo';
        const detail = serializeHomeworkDetail(block.description, block.todos);
        const resolvedTitle = block.todos[0]?.text || block.description || '宿題';
        const payload: Omit<HomeworkType, 'id' | 'createdAt' | 'updatedAt'> = {
          userId: user.id,
          projectId: block.projectId,
          title: resolvedTitle,
          detail,
          assignedAt: assignedAt.trim(),
          dueAt: assignedAt.trim(),
          status: nextStatus,
        };
        await homeworkRepository.createHomework(payload);
      }
    }

    setIsFormOpen(false);
    resetForm();
    loadHomeworks();
  };

  return (
    <div className="homework-page">
      <header className="homework-header">
        <div className="homework-header-row">
          <h1 className="homework-title">宿題管理</h1>
          <div className="homework-header-actions">
            <button className="homework-add-button" onClick={handleOpenCreate}>
              ＋宿題を追加
            </button>
            <button type="button" className="homework-logout-button" onClick={handleLogout}>
              ログアウト
            </button>
          </div>
        </div>
      </header>

      {isFormOpen && (
        <section className="homework-form-card">
          <h2 className="homework-form-title">
            {editingId ? '宿題を編集' : '宿題を追加'}
          </h2>
          <form className="homework-form" onSubmit={handleSave}>
            <div className="homework-form-row">
              <div className="homework-form-group">
                <label>日付</label>
                <input
                  type="text"
                  value={assignedAt}
                  onChange={(e) => setAssignedAt(e.target.value)}
                  placeholder="2025-12-20"
                  lang="ja"
                  inputMode="text"
                  autoCapitalize="none"
                  spellCheck={false}
                />
              </div>
            </div>
            <div className="homework-subject-blocks">
              {subjectBlocks.map((block, index) => (
                <div key={block.id} className="homework-subject-block">
                  <div className="homework-subject-header">
                    <div className="homework-form-group">
                      <label>教科</label>
                      <select
                        value={block.projectId}
                        onChange={(e) =>
                          setSubjectBlocks((prev) =>
                            prev.map((item) =>
                              item.id === block.id ? { ...item, projectId: e.target.value } : item
                            )
                          )
                        }
                      >
                        <option value="">選択してください</option>
                        {projects.map((project) => (
                          <option key={project.id} value={project.id}>
                            {project.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    {!editingId && subjectBlocks.length > 1 && (
                      <button
                        type="button"
                        className="homework-subject-remove"
                        onClick={() => handleRemoveSubjectBlock(block.id)}
                        aria-label={`教科ブロック${index + 1}を削除`}
                      >
                        ×
                      </button>
                    )}
                  </div>
                  <div className="homework-form-group">
                    <label>説明</label>
                    <textarea
                      value={block.description}
                      onChange={(e) =>
                        setSubjectBlocks((prev) =>
                          prev.map((item) =>
                            item.id === block.id ? { ...item, description: e.target.value } : item
                          )
                        )
                      }
                      placeholder="やることの補足を入力"
                      rows={3}
                      lang="ja"
                      inputMode="text"
                      autoCapitalize="none"
                      spellCheck={false}
                    />
                  </div>
                  <div className="homework-form-group">
                    <div className="homework-todo-list">
                      {block.todos.map((todo) => (
                        <div key={todo.id} className="homework-todo-row">
                          <input
                            type="text"
                            value={todo.text}
                            onChange={(e) =>
                              setSubjectBlocks((prev) =>
                                prev.map((item) =>
                                  item.id === block.id
                                    ? {
                                        ...item,
                                        todos: item.todos.map((t) =>
                                          t.id === todo.id ? { ...t, text: e.target.value } : t
                                        ),
                                      }
                                    : item
                                )
                              )
                            }
                            placeholder="ToDoを入力"
                            aria-label="項目"
                            lang="ja"
                            inputMode="text"
                            autoCapitalize="none"
                            spellCheck={false}
                          />
                          <button
                            type="button"
                            className="homework-todo-remove"
                            onClick={() => handleRemoveTodo(block.id, todo.id)}
                            aria-label="項目を削除"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        className="homework-todo-add"
                        onClick={() => handleAddTodo(block.id)}
                      >
                        ＋追加
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {!editingId && (
                <button
                  type="button"
                  className="homework-subject-add"
                  onClick={handleAddSubjectBlock}
                >
                  ＋教科ブロックを追加
                </button>
              )}
            </div>
            <div className="homework-form-actions">
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

      <section className="homework-timeline">
        {groupedHomeworks.length === 0 ? (
          <div className="homework-empty">宿題がまだ登録されていません</div>
        ) : (
          groupedHomeworks.map((group) => (
            <div key={group.date} className="homework-date-block">
              <div className="homework-date-header">
                <h2>
                  {group.date === '未設定'
                    ? '日付未設定'
                    : format(new Date(group.date), 'M月d日（E）', { locale: ja })}
                </h2>
              </div>
              <div className="homework-card-list">
                {group.items.map((homework) => {
                  const detail = parseHomeworkDetail(homework.detail);
                  const project = projects.find((p) => p.id === homework.projectId);
                  const sortedTodos = [...detail.todos].sort(
                    (a, b) => Number(a.done) - Number(b.done)
                  );
                  return (
                    <div
                      key={homework.id}
                      className={`homework-card ${homework.status === 'done' ? 'done' : ''}`}
                    >
                      <div className="homework-card-header">
                        <div>
                          <span className="homework-project-tag">{project?.name || '未設定'}</span>
                        </div>
                        <div className="homework-card-actions">
                          <button
                            className="homework-edit-button"
                            onClick={() => handleEdit(homework)}
                          >
                            編集
                          </button>
                          <button
                            className="homework-delete-button"
                            onClick={() => handleDeleteHomework(homework)}
                          >
                            削除
                          </button>
                        </div>
                      </div>
                      {detail.description && (
                        <p className="homework-card-description">{detail.description}</p>
                      )}
                      {detail.todos.length > 0 && (
                        <div className="homework-card-todos">
                          {sortedTodos.map((todo) => (
                            <label key={todo.id} className="homework-card-todo">
                              <input
                                type="checkbox"
                                checked={todo.done}
                                onChange={() => handleToggleTodoDone(homework, todo.id)}
                              />
                              <span className={todo.done ? 'done' : ''}>{todo.text}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
};
