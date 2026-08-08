-- ============================================================================
-- Momentum — endurecimiento posterior al primer despliegue
--
-- Estas correcciones salieron del linter de seguridad de Supabase después de
-- aplicar el esquema. Se dejan como migración propia para que el repo refleje
-- exactamente lo que hay en la base.
-- ============================================================================

-- Todas estas funciones referencian sus tablas con el schema explícito, así que
-- vaciar el search_path es seguro y cierra la puerta a que alguien cree un
-- objeto homónimo en un schema que se resuelva antes.
alter function public.set_updated_at() set search_path = '';
alter function public.enforce_task_shape() set search_path = '';
alter function public.track_orphaned_audio() set search_path = '';
alter function public.enforce_min_goal_categories() set search_path = '';
alter function public.enforce_min_life_areas() set search_path = '';
alter function public.enforce_max_life_areas() set search_path = '';
alter function public.queue_google_push() set search_path = '';

-- `handle_new_user` es SECURITY DEFINER y quedaba expuesta como RPC público en
-- /rest/v1/rpc/handle_new_user. Es una función de trigger: nadie debería poder
-- invocarla a mano.
--
-- Revocar EXECUTE después de crear el trigger NO lo rompe: Postgres verifica el
-- permiso al crear el trigger, no cada vez que dispara.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

/**
 * Genera un token de ingesta para el usuario logueado y devuelve el token EN
 * CLARO una sola vez. En la tabla sólo queda el sha256.
 *
 * Existe como función y no como INSERT a mano para que el usuario no tenga que
 * saber en qué schema vive `digest()`, que es un detalle de cómo Supabase
 * instala pgcrypto y no algo que deba importarle.
 */
create or replace function public.create_ingest_token(token_label text default 'Atajo de iOS')
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  raw_token text;
begin
  if auth.uid() is null then
    raise exception 'Hay que estar logueado para generar un token';
  end if;

  raw_token := encode(gen_random_bytes(32), 'hex');

  insert into public.ingest_tokens (user_id, token_hash, label)
  values (auth.uid(), encode(digest(raw_token, 'sha256'), 'hex'), token_label);

  return raw_token;
end;
$$;

revoke execute on function public.create_ingest_token(text) from public, anon;
grant execute on function public.create_ingest_token(text) to authenticated;
