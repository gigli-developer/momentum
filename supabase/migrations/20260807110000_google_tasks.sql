-- ============================================================================
-- Momentum — integración con Google Tasks
--
-- Modelo de sincronización, decidido a propósito:
--
--   · Las tareas se CREAN en Google y viajan hacia Momentum. Google manda
--     sobre título, nota, fecha, subtareas y borrados.
--   · El TILDADO viaja en las dos direcciones, con last-write-wins por
--     timestamp. Es un solo booleano: no necesita tombstones ni resolución de
--     conflictos de contenido, que es lo que hace horribles a estas
--     integraciones.
--
-- Sin esa asimetría, tildar una tarea en el Journal se perdería en la próxima
-- sincronización.
-- ============================================================================

create table public.google_accounts (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  -- Token de larga duración de Google. Nunca se expone al cliente.
  refresh_token  text not null,
  -- Listas de Google que se sincronizan. Vacío = todas.
  list_ids       text[] not null default '{}',
  connected_at   timestamptz not null default now(),
  last_synced_at timestamptz,
  last_error     text
);

alter table public.google_accounts enable row level security;

-- El usuario puede ver si está conectado y desconectarse, pero no puede leer
-- el refresh_token: eso queda para la Edge Function con service_role.
create policy "cuenta de google propia" on public.google_accounts
  for select using (auth.uid() = user_id);

create policy "desconectar google" on public.google_accounts
  for delete using (auth.uid() = user_id);

revoke select (refresh_token) on public.google_accounts from authenticated, anon;

-- ----------------------------------------------------------------------------
-- Mapeo entre una tarea de Google y una de Momentum.
--
-- Sin esta tabla, cada sincronización volvería a crear las mismas tareas: los
-- ids de Google son opacos y no hay forma de reconocer una tarea ya importada.
-- ----------------------------------------------------------------------------

create table public.google_task_links (
  user_id        uuid not null references auth.users (id) on delete cascade,
  google_task_id text not null,
  google_list_id text not null,
  task_id        uuid not null references public.tasks (id) on delete cascade,
  -- `updated` que devolvió Google la última vez. Es el lado izquierdo del
  -- last-write-wins cuando se compara con tasks.updated_at.
  google_updated timestamptz,
  synced_at      timestamptz not null default now(),
  primary key (user_id, google_task_id),
  -- Una tarea de Momentum mapea a lo sumo a una de Google.
  unique (task_id)
);

create index google_task_links_task_idx on public.google_task_links (task_id);

alter table public.google_task_links enable row level security;

create policy "vínculos propios" on public.google_task_links
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- Marca de qué tareas cambiaron su tildado desde la última sincronización, para
-- saber cuáles empujar a Google sin recorrer todo el historial.
-- ----------------------------------------------------------------------------

create table public.google_pending_pushes (
  user_id    uuid not null references auth.users (id) on delete cascade,
  task_id    uuid not null references public.tasks (id) on delete cascade,
  done       boolean not null,
  queued_at  timestamptz not null default now(),
  primary key (user_id, task_id)
);

alter table public.google_pending_pushes enable row level security;

create policy "pendientes propios" on public.google_pending_pushes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

/**
 * Cuando cambia `done` de una tarea vinculada a Google, se encola el cambio.
 * Se hace en la base y no en el cliente para que valga sin importar desde
 * dónde se tildó: el planificador, el journal o una futura app.
 */
create or replace function public.queue_google_push()
returns trigger
language plpgsql
as $$
begin
  if new.done is distinct from old.done
     and exists (select 1 from public.google_task_links where task_id = new.id) then
    insert into public.google_pending_pushes (user_id, task_id, done)
    values (new.user_id, new.id, new.done)
    on conflict (user_id, task_id) do update
      set done = excluded.done, queued_at = now();
  end if;
  return new;
end;
$$;

create trigger tasks_queue_google_push
  after update of done on public.tasks
  for each row execute function public.queue_google_push();
