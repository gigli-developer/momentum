-- ============================================================================
-- Momentum — esquema inicial
--
-- Supabase es la fuente única de verdad: no hay copia local autoritativa, así
-- que los borrados son reales (no hay tombstones) y cada fila cuelga de un
-- usuario. `updated_at` queda para auditoría y para ordenar cambios, no para
-- resolver conflictos de sincronización.
--
-- Todo vive en el schema `public` y todo tiene RLS (ver la migración 0002).
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- utilidades

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ------------------------------------------------------------------- perfil

create table public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  name            text not null default '',
  -- Necesaria para Memento Mori. Nula = módulo en estado de configuración.
  birth_date      date,
  life_expectancy smallint not null default 80
                  check (life_expectancy between 20 and 120),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- El perfil se crea solo al registrarse: la app nunca tiene que insertarlo.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------------ hábitos

create table public.habits (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null check (length(btrim(name)) > 0),
  emoji       text not null default '',
  -- Índice dentro de la paleta categórica de tokens (--color-cat-1..8).
  color_index smallint not null default 0 check (color_index between 0 and 7),
  archived    boolean not null default false,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index habits_user_idx on public.habits (user_id, sort_order);

create trigger habits_set_updated_at
  before update on public.habits
  for each row execute function public.set_updated_at();

-- Una fila por día marcado. La PK evita duplicados sin lógica en el cliente.
create table public.habit_logs (
  habit_id   uuid not null references public.habits (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  day        date not null,
  created_at timestamptz not null default now(),
  primary key (habit_id, day)
);

create index habit_logs_user_day_idx on public.habit_logs (user_id, day desc);

-- ------------------------------------------------------- pilares y proyectos

create table public.pillars (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null check (length(btrim(name)) > 0),
  emoji       text not null default '',
  description text not null default '',
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index pillars_user_idx on public.pillars (user_id, sort_order);

create trigger pillars_set_updated_at
  before update on public.pillars
  for each row execute function public.set_updated_at();

create table public.projects (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null check (length(btrim(name)) > 0),
  emoji      text not null default '',
  archived   boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_user_idx on public.projects (user_id, sort_order);

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------- ritual matutino

create table public.rituals (
  user_id      uuid not null references auth.users (id) on delete cascade,
  day          date not null,
  mission      text not null default '',
  -- Si se borra el pilar, el ritual histórico sobrevive sin él.
  pillar_id    uuid references public.pillars (id) on delete set null,
  sapo         text not null default '',
  sapo_done    boolean not null default false,
  energy       smallint not null default 3 check (energy between 1 and 5),
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (user_id, day)
);

create trigger rituals_set_updated_at
  before update on public.rituals
  for each row execute function public.set_updated_at();

-- Proyectos elegidos para el ritual de un día.
create table public.ritual_projects (
  user_id    uuid not null,
  day        date not null,
  project_id uuid not null references public.projects (id) on delete cascade,
  primary key (user_id, day, project_id),
  foreign key (user_id, day)
    references public.rituals (user_id, day) on delete cascade
);

-- -------------------------------------------------------------------- tareas

create table public.tasks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  day        date not null,
  title      text not null check (length(btrim(title)) > 0),
  -- Línea secundaria opcional debajo del título.
  note       text not null default '',
  done       boolean not null default false,
  starred    boolean not null default false,
  -- Un solo nivel: lo garantiza el trigger de abajo, no el cliente.
  parent_id  uuid references public.tasks (id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_user_day_idx on public.tasks (user_id, day, sort_order);
create index tasks_parent_idx on public.tasks (parent_id) where parent_id is not null;

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- Una subtarea no puede tener subtareas, y tiene que vivir el mismo día que
-- su padre. Sin esto el tablero podría recibir árboles que no sabe dibujar.
create or replace function public.enforce_task_shape()
returns trigger
language plpgsql
as $$
declare
  parent_row public.tasks%rowtype;
begin
  if new.parent_id is null then
    return new;
  end if;

  if new.parent_id = new.id then
    raise exception 'Una tarea no puede ser su propia subtarea';
  end if;

  select * into parent_row from public.tasks where id = new.parent_id;

  if parent_row.parent_id is not null then
    raise exception 'Sólo se permite un nivel de subtareas';
  end if;

  if parent_row.day <> new.day then
    raise exception 'La subtarea tiene que estar en el mismo día que su tarea padre';
  end if;

  if parent_row.user_id <> new.user_id then
    raise exception 'La subtarea tiene que pertenecer al mismo usuario';
  end if;

  return new;
end;
$$;

create trigger tasks_enforce_shape
  before insert or update of parent_id, day on public.tasks
  for each row execute function public.enforce_task_shape();

-- ------------------------------------------------------------ premio semanal

create table public.week_rewards (
  user_id     uuid not null references auth.users (id) on delete cascade,
  -- Lunes de la semana.
  week_start  date not null,
  description text not null default '',
  claimed     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (user_id, week_start),
  constraint week_rewards_starts_monday check (extract(isodow from week_start) = 1)
);

create trigger week_rewards_set_updated_at
  before update on public.week_rewards
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------------- journal

create table public.journal_entries (
  user_id    uuid not null references auth.users (id) on delete cascade,
  day        date not null,
  -- Null = día abierto.
  closed_at  timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

create trigger journal_entries_set_updated_at
  before update on public.journal_entries
  for each row execute function public.set_updated_at();

-- El audio vive en Storage (bucket `journal-audio`); acá queda la referencia.
-- `storage_path` es `{user_id}/{day}/{id}.{ext}` — ver migración 0003.
create table public.journal_recordings (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  day          date not null,
  storage_path text not null unique,
  duration_ms  integer not null check (duration_ms >= 0),
  mime_type    text not null,
  size_bytes   bigint not null check (size_bytes > 0),
  recorded_at  timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  foreign key (user_id, day)
    references public.journal_entries (user_id, day) on delete cascade
);

create index journal_recordings_user_day_idx
  on public.journal_recordings (user_id, day desc, recorded_at);

-- ----------------------------------------------------------------- objetivos

create table public.goal_categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  label      text not null check (length(btrim(label)) > 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index goal_categories_user_idx on public.goal_categories (user_id, sort_order);

create trigger goal_categories_set_updated_at
  before update on public.goal_categories
  for each row execute function public.set_updated_at();

create table public.goals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  -- Borrar una sección borra sus objetivos: la app lo confirma antes.
  category_id uuid not null references public.goal_categories (id) on delete cascade,
  title       text not null check (length(btrim(title)) > 0),
  year        smallint not null check (year between 1900 and 2200),
  quarter     smallint not null check (quarter between 1 and 4),
  done        boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index goals_user_year_idx on public.goals (user_id, year, quarter);
create index goals_category_idx on public.goals (category_id);

create trigger goals_set_updated_at
  before update on public.goals
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------ rueda de vida

create table public.life_areas (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  label      text not null check (length(btrim(label)) > 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Sin unique sobre (user_id, label) a propósito: renombrar dos secciones al
-- mismo texto es raro pero no rompe nada, y un error de constraint en pleno
-- tipeo sería peor que el duplicado.
create index life_areas_user_idx on public.life_areas (user_id, sort_order);

create trigger life_areas_set_updated_at
  before update on public.life_areas
  for each row execute function public.set_updated_at();

-- Un puntaje por área y por mes. `month` siempre es el día 1.
create table public.wheel_scores (
  user_id    uuid not null references auth.users (id) on delete cascade,
  month      date not null,
  area_id    uuid not null references public.life_areas (id) on delete cascade,
  score      smallint not null check (score between 0 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, month, area_id),
  -- El cast explícito a timestamp evita resolver a la variante timestamptz de
  -- date_trunc, que es STABLE y no sirve dentro de un CHECK.
  constraint wheel_scores_month_is_first_day
    check (month = date_trunc('month', month::timestamp)::date)
);

create trigger wheel_scores_set_updated_at
  before update on public.wheel_scores
  for each row execute function public.set_updated_at();
