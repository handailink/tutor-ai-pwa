-- 講師マスタ
create table if not exists public.tutors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  hourly_yen integer not null check (hourly_yen >= 0),
  created_at timestamptz not null default now()
);

-- プロジェクトと講師の紐付け（時給履歴対応）
create table if not exists public.project_tutors (
  project_id uuid not null references public.projects (id) on delete cascade,
  tutor_id uuid not null references public.tutors (id) on delete cascade,
  hourly_yen integer not null check (hourly_yen >= 0),
  effective_from date not null,
  created_at timestamptz not null default now(),
  primary key (project_id, tutor_id, effective_from)
);

create index if not exists project_tutors_project_id_idx
  on public.project_tutors (project_id, effective_from desc);

create index if not exists project_tutors_tutor_id_idx
  on public.project_tutors (tutor_id, effective_from desc);

-- 月次集計関数
create or replace function public.calculate_monthly_tutor_payroll(
  start_date date,
  end_date date
)
returns table (
  tutor_id uuid,
  tutor_name text,
  total_lessons integer,
  total_minutes integer,
  hourly_yen integer,
  total_pay_yen integer
)
language sql
stable
as $$
  with lesson_base as (
    select
      lr.project_id,
      lr.duration,
      (lr.date::date) as lesson_date
    from public.lesson_records lr
    where (lr.date::date) between start_date and end_date
  ),
  resolved as (
    select
      pt.tutor_id,
      t.name as tutor_name,
      pt.hourly_yen,
      lb.duration
    from lesson_base lb
    join lateral (
      select
        ptt.tutor_id,
        ptt.hourly_yen
      from public.project_tutors ptt
      where ptt.project_id = lb.project_id
        and ptt.effective_from <= lb.lesson_date
      order by ptt.effective_from desc
      limit 1
    ) pt on true
    join public.tutors t on t.id = pt.tutor_id
  )
  select
    tutor_id,
    tutor_name,
    count(*)::int as total_lessons,
    sum(duration)::int as total_minutes,
    max(hourly_yen)::int as hourly_yen,
    floor(sum(duration * hourly_yen)::numeric / 60)::int as total_pay_yen
  from resolved
  group by tutor_id, tutor_name
  order by tutor_name, tutor_id;
$$;
