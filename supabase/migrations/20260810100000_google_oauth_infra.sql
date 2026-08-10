-- ============================================================================
-- Momentum — infraestructura de OAuth con Google
-- ============================================================================

/**
 * Credenciales de servicios de terceros (el cliente OAuth de Google).
 *
 * RLS activo y SIN NINGUNA POLÍTICA a propósito: eso hace la tabla inaccesible
 * para `anon` y `authenticated`. Sólo el `service_role` de las Edge Functions
 * puede leerla, que es el mismo límite de confianza que una variable de
 * entorno.
 *
 * Las funciones leen primero de `Deno.env` y sólo caen a esta tabla si no
 * encuentran el secreto, así que mover los valores a los secretos de Supabase
 * (Project Settings → Edge Functions → Secrets) no rompe nada.
 *
 * Los valores NO se versionan: se cargan con un INSERT aparte.
 */
create table public.app_secrets (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

alter table public.app_secrets enable row level security;

comment on table public.app_secrets is
  'Secretos de integraciones. Sin políticas RLS: sólo service_role entra.';

/**
 * Nonces del flujo OAuth.
 *
 * El parámetro `state` que va y vuelve de Google tiene que identificar al
 * usuario, pero no puede llevar el user_id en claro: cualquiera podría
 * fabricar un callback y colgar SU cuenta de Google a OTRO usuario. Entonces
 * viaja un nonce aleatorio y el user_id queda guardado de este lado.
 */
create table public.google_oauth_states (
  state      text primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.google_oauth_states enable row level security;

/** Los nonces vencen a los 10 minutos; se limpian al crear uno nuevo. */
create or replace function public.purge_stale_oauth_states()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.google_oauth_states where created_at < now() - interval '10 minutes';
$$;

revoke execute on function public.purge_stale_oauth_states() from public, anon, authenticated;
