-- ============================================================================
-- Momentum — arreglo: no se podía borrar una cuenta
--
-- Los guardas de mínimos (al menos 1 sección, al menos 3 áreas) también se
-- disparaban durante el borrado en cascada de un usuario: al eliminar la fila
-- de `auth.users`, el cascade intentaba vaciar `goal_categories` y
-- `life_areas`, y el trigger lo rechazaba. Resultado: `delete from auth.users`
-- fallaba siempre y la cuenta era indestructible.
--
-- Apareció probando el alta y baja de una cuenta de prueba de punta a punta.
--
-- Arreglo: si la fila de `auth.users` ya no existe, el borrado viene del
-- cascade y el mínimo deja de tener sentido — no queda usuario a quien
-- proteger de quedarse sin secciones.
-- ============================================================================

create or replace function public.enforce_min_goal_categories()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from auth.users where id = old.user_id) then
    return old;
  end if;

  if (select count(*) from public.goal_categories where user_id = old.user_id) <= 1 then
    raise exception 'Tiene que quedar al menos una seccion de objetivos';
  end if;
  return old;
end;
$$;

create or replace function public.enforce_min_life_areas()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from auth.users where id = old.user_id) then
    return old;
  end if;

  if (select count(*) from public.life_areas where user_id = old.user_id) <= 3 then
    raise exception 'Tienen que quedar al menos 3 areas en la rueda de la vida';
  end if;
  return old;
end;
$$;

-- SECURITY DEFINER para poder leer auth.users; se cierra el acceso directo.
revoke execute on function public.enforce_min_goal_categories() from public, anon, authenticated;
revoke execute on function public.enforce_min_life_areas() from public, anon, authenticated;
