-- lesson_records テーブルに開始時刻・終了時刻カラムを追加
-- 既存の duration カラムは給与集計で使用されているため残す

ALTER TABLE public.lesson_records
  ADD COLUMN IF NOT EXISTS start_time time,
  ADD COLUMN IF NOT EXISTS end_time time;

-- コメント追加
COMMENT ON COLUMN public.lesson_records.start_time IS '授業開始時刻（例: 18:00:00）';
COMMENT ON COLUMN public.lesson_records.end_time IS '授業終了時刻（例: 20:00:00）';

-- 既存データは start_time/end_time が NULL のまま残る
-- フロントエンドで NULL の場合は従来通り duration のみ表示
