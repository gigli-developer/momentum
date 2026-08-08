-- ============================================================================
-- Momentum — origen del puntaje de cada área de la rueda
--
-- Un área puede puntuarse a mano o calcularse desde otro módulo. Lo calculado
-- NO se guarda: se deriva al vuelo de hábitos, sueño, tareas, objetivos o la
-- energía del ritual. `wheel_scores` sigue existiendo sólo para las manuales
-- y como respaldo cuando una fuente automática todavía no tiene datos.
-- ============================================================================

create type public.wheel_source_kind as enum (
  'manual',
  'habits',
  'sleep',
  'tasks',
  'goals',
  'energy'
);

alter table public.life_areas
  add column source_kind public.wheel_source_kind not null default 'manual',
  -- Sólo se usa cuando source_kind = 'habits'.
  add column source_habit_ids uuid[] not null default '{}';

-- Coherencia: si la fuente no es 'habits', la lista tiene que estar vacía; si
-- lo es, tiene que tener al menos un hábito o no habría nada que promediar.
alter table public.life_areas
  add constraint life_areas_source_coherent check (
    (source_kind = 'habits' and array_length(source_habit_ids, 1) >= 1)
    or (source_kind <> 'habits' and source_habit_ids = '{}')
  );

comment on column public.life_areas.source_kind is
  'De dónde sale el puntaje. manual = lo carga el usuario con el slider.';
comment on column public.life_areas.source_habit_ids is
  'Hábitos que promedian el área cuando source_kind = habits.';
