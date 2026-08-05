-- ============================================================================
-- Momentum — datos por defecto al crear la cuenta
--
-- La app exige al menos 1 sección de objetivos y 3 áreas de la rueda. Si el
-- usuario arranca con las tablas vacías, esas pantallas abren rotas. Sembrar
-- los defaults en el servidor evita depender de que el cliente lo haga bien.
-- ============================================================================

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

  insert into public.goal_categories (user_id, label, sort_order)
  values
    (new.id, 'Personal', 0),
    (new.id, 'Profesional', 1);

  insert into public.life_areas (user_id, label, sort_order)
  values
    (new.id, 'Salud y deporte', 0),
    (new.id, 'Familia y amor', 1),
    (new.id, 'Trabajo y finanzas', 2),
    (new.id, 'Ocio y amistad', 3),
    (new.id, 'Tiempo para mí', 4),
    (new.id, 'Emocional', 5),
    (new.id, 'Educativa y cultural', 6),
    (new.id, 'Espiritual y ética', 7);

  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- Guardas de mínimos. La UI ya impide bajar de 1 sección y de 3 áreas, pero la
-- UI se puede saltear: la base tiene que sostener sus propios invariantes.
-- ----------------------------------------------------------------------------

create or replace function public.enforce_min_goal_categories()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from public.goal_categories where user_id = old.user_id) <= 1 then
    raise exception 'Tiene que quedar al menos una sección de objetivos';
  end if;
  return old;
end;
$$;

create trigger goal_categories_enforce_min
  before delete on public.goal_categories
  for each row execute function public.enforce_min_goal_categories();

create or replace function public.enforce_min_life_areas()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from public.life_areas where user_id = old.user_id) <= 3 then
    raise exception 'Tienen que quedar al menos 3 áreas en la rueda de la vida';
  end if;
  return old;
end;
$$;

create trigger life_areas_enforce_min
  before delete on public.life_areas
  for each row execute function public.enforce_min_life_areas();

create or replace function public.enforce_max_life_areas()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from public.life_areas where user_id = new.user_id) >= 10 then
    raise exception 'No se pueden tener más de 10 áreas en la rueda de la vida';
  end if;
  return new;
end;
$$;

create trigger life_areas_enforce_max
  before insert on public.life_areas
  for each row execute function public.enforce_max_life_areas();
