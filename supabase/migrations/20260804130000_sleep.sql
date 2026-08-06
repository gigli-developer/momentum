-- ============================================================================
-- Momentum — sueño del Apple Watch
--
-- Una fila por noche. `night` es la fecha de la MAÑANA en que la persona se
-- despertó: si se guardara la fecha de acostarse, toda noche que cruza
-- medianoche quedaría partida en dos.
--
-- Los datos llegan por dos vías, ambas idempotentes sobre (user_id, night):
--   · el Atajo de iOS, cada mañana, vía la Edge Function `ingest-sleep`
--   · el import del export.xml de Salud, desde la app
-- ============================================================================

create type public.sleep_source as enum ('shortcut', 'import', 'manual');

create table public.sleep_nights (
  user_id     uuid not null references auth.users (id) on delete cascade,
  night       date not null,
  bedtime     timestamptz not null,
  wake_time   timestamptz not null,
  -- Minutos efectivamente dormidos: NO incluye `awake_minutes`.
  asleep_minutes  integer not null check (asleep_minutes >= 0),
  in_bed_minutes  integer not null check (in_bed_minutes >= 0),
  awake_minutes   integer not null default 0 check (awake_minutes >= 0),
  rem_minutes     integer not null default 0 check (rem_minutes >= 0),
  core_minutes    integer not null default 0 check (core_minutes >= 0),
  deep_minutes    integer not null default 0 check (deep_minutes >= 0),
  -- Registros viejos o de iPhone sin Watch: dormido pero sin fase.
  unspecified_minutes integer not null default 0 check (unspecified_minutes >= 0),
  source      public.sleep_source not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (user_id, night),
  constraint sleep_nights_wake_after_bed check (wake_time > bedtime),
  -- Una noche de más de 24 h es un error de datos, no un domingo largo.
  constraint sleep_nights_sane_duration check (in_bed_minutes <= 1440)
);

create index sleep_nights_user_night_idx on public.sleep_nights (user_id, night desc);

create trigger sleep_nights_set_updated_at
  before update on public.sleep_nights
  for each row execute function public.set_updated_at();

alter table public.sleep_nights enable row level security;

create policy "noches propias" on public.sleep_nights
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- Token de ingesta para el Atajo de iOS.
--
-- El Atajo no puede sostener una sesión de Supabase: los JWT vencen y renovarlos
-- desde Shortcuts es inviable. Entonces usa un token largo y propio, que se
-- valida en la Edge Function. Se guarda hasheado: si alguien lee la tabla, no
-- se lleva un token usable.
-- ----------------------------------------------------------------------------

create extension if not exists pgcrypto;

create table public.ingest_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  -- sha256 del token en hexadecimal. El token en claro se muestra UNA sola vez.
  token_hash  text not null unique,
  label       text not null default 'Atajo de iOS',
  created_at  timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at  timestamptz
);

create index ingest_tokens_user_idx on public.ingest_tokens (user_id);

alter table public.ingest_tokens enable row level security;

-- El usuario puede ver y revocar sus tokens, pero nunca leer el hash de otro.
create policy "tokens propios" on public.ingest_tokens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

/**
 * Resuelve el dueño de un token. La usa la Edge Function con service_role.
 * SECURITY DEFINER para que pueda leer la tabla salteando RLS, pero sólo
 * devuelve el user_id: nunca expone el hash ni ningún otro dato.
 */
create or replace function public.resolve_ingest_token(raw_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  found_user uuid;
begin
  select user_id into found_user
  from public.ingest_tokens
  where token_hash = encode(digest(raw_token, 'sha256'), 'hex')
    and revoked_at is null;

  if found_user is null then
    return null;
  end if;

  update public.ingest_tokens
  set last_used_at = now()
  where token_hash = encode(digest(raw_token, 'sha256'), 'hex');

  return found_user;
end;
$$;

revoke all on function public.resolve_ingest_token(text) from public, anon, authenticated;
