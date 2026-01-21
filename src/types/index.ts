export interface User {
  id: string;
  email: string;
  createdAt: string;
}

export interface Project {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
}

export interface Thread {
  id: string;
  userId: string;
  projectId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface Attachment {
  id: string;
  type: 'image';
  /** 
   * 画像データ（Base64 data URL）または Supabase Storage パス
   * - ローカルプレビュー時: data:image/...
   * - アップロード済み: Storage内のパス（例: userId/threadId/filename）
   */
  urlOrData: string;
  name?: string;
  /** Supabase Storage にアップロードされた場合のパス */
  path?: string;
  /** MIMEタイプ */
  mime?: string;
  /** ファイルサイズ（バイト） */
  size?: number;
}

export interface Message {
  id: string;
  userId: string;
  threadId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  tags?: string;
  attachments?: Attachment[];
  meta?: {
    source: 'text' | 'voice' | 'camera' | 'upload';
  };
}

export interface Homework {
  id: string;
  userId: string;
  projectId: string;
  title: string;
  detail: string;
  assignedAt: string;  // 指導日（宿題を出した日）
  dueAt: string;       // 期限日（提出日）
  status: 'todo' | 'done';
  attachments?: Attachment[];
  createdAt: string;
  updatedAt: string;
}

export interface TestResult {
  id: string;
  userId: string;
  projectId: string;
  takenAt: string;
  score: number;
  maxScore?: number;
  tags?: string;
  attachments?: Attachment[];
  createdAt: string;
  updatedAt: string;
}

// テストセット（1回のテストで5教科まとめて管理）
export interface TestSet {
  id: string;
  userId: string;
  date: string;           // テスト実施日（例: 2025-12-19）
  name: string;           // テスト名（例: 期末テスト（2学期））
  grade?: string;         // 学年（例: 中1）
  memo?: string;          // メモ
  createdAt: string;
  updatedAt?: string;
}

// 各教科のスコア
export interface TestScore {
  id: string;
  testSetId: string;      // 所属するテストセットのID
  subject: string;        // 教科名（国語/数学/英語/理科/社会）
  score: number;          // 自分の点数
  average?: number;       // 平均点
  maxScore: number;       // 満点（デフォルト100）
  rank?: number;          // 順位（任意）
  deviation?: number;     // 偏差値（任意）
  createdAt: string;
}

// テストセット + スコア一覧（表示用）
export interface TestSetWithScores extends TestSet {
  scores: TestScore[];
}

// 授業記録
export interface LessonRecord {
  id: string;
  userId: string;
  date: string;           // 授業日（例: 2025-12-20）
  duration: number;       // 授業時間（分）- 給与計算で使用
  startTime?: string;     // 開始時刻（例: "18:00"）
  endTime?: string;       // 終了時刻（例: "20:00"）
  content: string;        // 授業内容
  memo?: string;          // メモ（任意）
  createdAt: string;
  updatedAt?: string;
}

