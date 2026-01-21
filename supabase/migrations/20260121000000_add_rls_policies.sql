-- RLS ポリシーを追加（ユーザーは自分のデータのみアクセス可能）

-- projects テーブル
alter table public.projects enable row level security;

create policy "Users can view own projects"
  on public.projects for select
  using (auth.uid() = user_id);

create policy "Users can insert own projects"
  on public.projects for insert
  with check (auth.uid() = user_id);

create policy "Users can update own projects"
  on public.projects for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own projects"
  on public.projects for delete
  using (auth.uid() = user_id);

-- homeworks テーブル
alter table public.homeworks enable row level security;

create policy "Users can view own homeworks"
  on public.homeworks for select
  using (auth.uid() = user_id);

create policy "Users can insert own homeworks"
  on public.homeworks for insert
  with check (auth.uid() = user_id);

create policy "Users can update own homeworks"
  on public.homeworks for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own homeworks"
  on public.homeworks for delete
  using (auth.uid() = user_id);

-- lesson_records テーブル
alter table public.lesson_records enable row level security;

create policy "Users can view own lesson_records"
  on public.lesson_records for select
  using (auth.uid() = user_id);

create policy "Users can insert own lesson_records"
  on public.lesson_records for insert
  with check (auth.uid() = user_id);

create policy "Users can update own lesson_records"
  on public.lesson_records for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own lesson_records"
  on public.lesson_records for delete
  using (auth.uid() = user_id);

-- test_sets テーブル
alter table public.test_sets enable row level security;

create policy "Users can view own test_sets"
  on public.test_sets for select
  using (auth.uid() = user_id);

create policy "Users can insert own test_sets"
  on public.test_sets for insert
  with check (auth.uid() = user_id);

create policy "Users can update own test_sets"
  on public.test_sets for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own test_sets"
  on public.test_sets for delete
  using (auth.uid() = user_id);
