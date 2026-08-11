-- ============================================================================
-- Momentum — arreglo: borrar una cuenta volvía a fallar
--
-- Mismo problema que tenían los guardas de mínimos, en otro trigger. Al
-- eliminar un usuario, el cascade borra `journal_recordings` y
-- `track_orphaned_audio` intentaba anotar cada audio como huérfano apuntando a
-- un `user_id` que ya no existía. La foreign key lo rechazaba y el borrado de
-- la cuenta fallaba entero.
--
-- Apareció al limpiar la cuenta de prueba después de verificar el journal con
-- audio: sin una grabación cargada, el trigger nunca se disparaba y el bug
-- quedaba invisible.
--
-- Si el usuario ya no está, no hay nada que rastrear.
-- ============================================================================

create or replace function public.track_orphaned_audio()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from auth.users where id = old.user_id) then
    return old;
  end if;

  insert into public.orphaned_audio (storage_path, user_id)
  values (old.storage_path, old.user_id)
  on conflict (storage_path) do nothing;
  return old;
end;
$$;

revoke execute on function public.track_orphaned_audio() from public, anon, authenticated;
