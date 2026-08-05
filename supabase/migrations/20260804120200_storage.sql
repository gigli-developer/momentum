-- ============================================================================
-- Momentum — Storage para el audio del journal
--
-- Bucket PRIVADO. Las grabaciones son la voz del usuario leyendo su diario
-- personal: nunca se sirven por URL pública. El cliente pide una signed URL
-- de corta duración para reproducir.
--
-- Convención de rutas: {user_id}/{YYYY-MM-DD}/{recording_id}.{ext}
-- La primera carpeta es el user_id, y sobre eso se apoyan las políticas.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'journal-audio',
  'journal-audio',
  false,
  52428800, -- 50 MB por archivo: una lectura larga en opus pesa < 5 MB
  array['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav']
)
on conflict (id) do nothing;

-- Cada usuario sólo entra a su propia carpeta.

create policy "audio propio: leer"
  on storage.objects for select
  using (
    bucket_id = 'journal-audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "audio propio: subir"
  on storage.objects for insert
  with check (
    bucket_id = 'journal-audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "audio propio: reemplazar"
  on storage.objects for update
  using (
    bucket_id = 'journal-audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'journal-audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "audio propio: borrar"
  on storage.objects for delete
  using (
    bucket_id = 'journal-audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ----------------------------------------------------------------------------
-- Borrar la fila de journal_recordings NO borra el archivo en Storage: son dos
-- sistemas distintos. Este trigger deja el archivo huérfano marcado para que
-- el cliente lo limpie, y evita el caso peor (archivo sin fila que lo apunte,
-- ocupando cuota para siempre y sin forma de encontrarlo desde la app).
-- ----------------------------------------------------------------------------

create table public.orphaned_audio (
  storage_path text primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  orphaned_at  timestamptz not null default now()
);

alter table public.orphaned_audio enable row level security;

create policy "huérfanos propios" on public.orphaned_audio
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.track_orphaned_audio()
returns trigger
language plpgsql
as $$
begin
  insert into public.orphaned_audio (storage_path, user_id)
  values (old.storage_path, old.user_id)
  on conflict (storage_path) do nothing;
  return old;
end;
$$;

create trigger journal_recordings_track_orphans
  after delete on public.journal_recordings
  for each row execute function public.track_orphaned_audio();
