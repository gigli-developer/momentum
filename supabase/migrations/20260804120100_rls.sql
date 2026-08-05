-- ============================================================================
-- Momentum — Row Level Security
--
-- Regla única: cada fila pertenece a un usuario y sólo ese usuario la ve y la
-- toca. No hay roles ni compartido: es una app de una persona.
--
-- RLS se activa en TODAS las tablas. Una tabla nueva sin RLS queda abierta a
-- cualquiera con la anon key, así que si más adelante se agrega una tabla,
-- también se le agrega su política acá.
-- ============================================================================

alter table public.profiles           enable row level security;
alter table public.habits             enable row level security;
alter table public.habit_logs         enable row level security;
alter table public.pillars            enable row level security;
alter table public.projects           enable row level security;
alter table public.rituals            enable row level security;
alter table public.ritual_projects    enable row level security;
alter table public.tasks              enable row level security;
alter table public.week_rewards       enable row level security;
alter table public.journal_entries    enable row level security;
alter table public.journal_recordings enable row level security;
alter table public.goal_categories    enable row level security;
alter table public.goals              enable row level security;
alter table public.life_areas         enable row level security;
alter table public.wheel_scores       enable row level security;

-- ------------------------------------------------------------------- perfil
-- No hay policy de INSERT ni DELETE a propósito: el perfil lo crea el trigger
-- al registrarse y se borra en cascada al borrar la cuenta.

create policy "perfil propio: ver"
  on public.profiles for select
  using (auth.uid() = id);

create policy "perfil propio: editar"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---------------------------------------------------------- tablas de datos
-- Todas siguen el mismo patrón sobre `user_id`. `with check` en insert y
-- update impide que alguien escriba filas a nombre de otro usuario.

create policy "hábitos propios" on public.habits
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "marcas propias" on public.habit_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "pilares propios" on public.pillars
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "proyectos propios" on public.projects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "rituales propios" on public.rituals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "proyectos del ritual propios" on public.ritual_projects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "tareas propias" on public.tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "premios propios" on public.week_rewards
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "journal propio" on public.journal_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "grabaciones propias" on public.journal_recordings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "secciones propias" on public.goal_categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "objetivos propios" on public.goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "áreas propias" on public.life_areas
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "puntajes propios" on public.wheel_scores
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Nota: no revocamos EXECUTE de las funciones de trigger. Llamarlas
-- directamente no sirve de nada (fuera de un trigger fallan por falta de
-- contexto), y revocar permisos sobre una función que dispara en cada INSERT
-- es un riesgo real de romper escrituras a cambio de nada.
