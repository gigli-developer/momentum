-- El objetivo de sueño vive junto al resto del perfil. Sin esta columna sería
-- la única preferencia del usuario que no viaja entre dispositivos.
alter table public.profiles
  add column sleep_target_minutes integer not null default 480
    check (sleep_target_minutes between 240 and 720);
