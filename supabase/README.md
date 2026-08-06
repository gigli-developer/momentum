# Base de datos de Momentum

Esquema para Supabase. **Supabase es la fuente única de verdad**: la app deja de usar
localStorage y pasa a leer y escribir contra la base, con login obligatorio.

## Qué hay acá

| Archivo | Qué hace |
| --- | --- |
| `20260804120000_initial_schema.sql` | Las 16 tablas, constraints, índices y triggers |
| `20260804120100_rls.sql` | RLS en todas las tablas, una política por usuario |
| `20260804120200_storage.sql` | Bucket privado `journal-audio` y sus políticas |
| `20260804120300_defaults_on_signup.sql` | Secciones y áreas por defecto + guardas de mínimos |
| `20260804130000_sleep.sql` | Noches de sueño y tokens de ingesta para el Atajo de iOS |

Se aplican **en ese orden**.

## Tablas

```
profiles              perfil (nombre, fecha de nacimiento, expectativa de vida)
habits                hábitos
habit_logs            un día marcado por hábito — PK (habit_id, day)
pillars               pilares del ritual
projects              proyectos del ritual
rituals               ritual de un día — PK (user_id, day)
ritual_projects       proyectos elegidos ese día
tasks                 tareas, con note / starred / parent_id
week_rewards          premio de la semana — PK (user_id, week_start)
journal_entries       día de journal, con closed_at — PK (user_id, day)
journal_recordings    metadatos del audio; el archivo vive en Storage
goal_categories       secciones de objetivos
goals                 objetivos por año y trimestre
life_areas            áreas de la rueda
wheel_scores          puntaje por área y mes — PK (user_id, month, area_id)
orphaned_audio        archivos de Storage a limpiar (ver más abajo)
sleep_nights          una noche por fila — PK (user_id, night)
ingest_tokens         tokens del Atajo de iOS, guardados hasheados
```

## Edge Function `ingest-sleep`

Recibe el sueño del Atajo de iOS. Se despliega con:

```bash
supabase functions deploy ingest-sleep --no-verify-jwt
```

`--no-verify-jwt` es necesario **y correcto** acá: un Atajo no puede renovar un JWT de Supabase, así
que la función hace su propia validación con un token largo (`x-ingest-token`) que se guarda
hasheado con sha256. Sin ese flag, Supabase rechazaría el request antes de que el código lo vea.

El token sólo sirve para escribir noches de sueño. Si se filtra, se revoca desde Ajustes sin tocar
el resto de la cuenta. La guía del Atajo está en [`docs/atajo-sueno-ios.md`](../docs/atajo-sueno-ios.md).

## Invariantes que sostiene la base

No alcanza con que la UI los respete: la base los hace cumplir por su cuenta.

- **Una tarea tiene un solo nivel de subtareas**, y la subtarea vive el mismo día y pertenece al
  mismo usuario que su padre (trigger `tasks_enforce_shape`).
- **Siempre queda al menos 1 sección** de objetivos y **entre 3 y 10 áreas** en la rueda
  (triggers `*_enforce_min` / `_enforce_max`).
- `week_rewards.week_start` **siempre es lunes**.
- `wheel_scores.month` **siempre es el día 1** del mes.
- `energy` entre 1 y 5, `score` entre 0 y 10, `quarter` entre 1 y 4, `color_index` entre 0 y 7.
- Borrar un pilar **no borra** los rituales que lo usaban: quedan sin pilar.
- Borrar una sección **sí borra** sus objetivos (en cascada). La app lo confirma antes.

## Seguridad

- RLS activo en **todas** las tablas, con la misma regla: `auth.uid() = user_id`.
- El bucket de audio es **privado**. Nada de URLs públicas: el cliente pide signed URLs.
- Las rutas de Storage son `{user_id}/{YYYY-MM-DD}/{recording_id}.{ext}` y las políticas se apoyan
  en que la primera carpeta sea el user_id.
- El perfil se crea solo con un trigger sobre `auth.users`; la app nunca lo inserta.

> Después de crear tu cuenta, **desactivá el registro público** en Authentication → Providers →
> Email → "Allow new users to sign up". Es una app de una sola persona; dejar el alta abierta
> permite que cualquiera se cree usuarios en tu proyecto.

## El audio y sus huérfanos

La base y Storage son dos sistemas distintos: borrar la fila de `journal_recordings` **no** borra
el archivo. El trigger `journal_recordings_track_orphans` anota la ruta en `orphaned_audio` para
que el cliente la borre y limpie la fila.

Si esa limpieza falla, el archivo sigue ocupando cuota pero **queda registrado**, que es el punto:
el caso malo de verdad es un archivo sin nada que lo apunte.

Cuota del plan free: 1 GB. Una lectura de 3 minutos en opus pesa ~600 KB, así que entran unos dos
años de journal diario.

## Cómo aplicarlas

Desde el SQL Editor del panel de Supabase, pegando cada archivo en orden. O con la CLI:

```bash
supabase link --project-ref TU_PROJECT_REF
```

```bash
supabase db push
```

## Configuración del cliente

Copiá `.env.example` a `.env.local` y completá:

```
VITE_SUPABASE_URL=https://TU_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=...
```

La anon key es pública por diseño: lo que protege los datos es RLS, no la clave. La
`service_role` key **nunca** va al cliente ni al repo.

## Lo que falta del lado de la app

Estas migraciones dejan la base lista. El trabajo de cliente todavía no está hecho:

1. Pantalla de login (Supabase Auth con email).
2. Reemplazar `src/lib/storage.ts` por un cliente de Supabase.
3. Reescribir `src/lib/store.ts` para leer y escribir contra la base en vez de localStorage.
4. Subir el audio a Storage en vez de IndexedDB en `src/lib/media.ts`.
5. Estados de carga y de error en cada módulo — hoy no existen porque todo era instantáneo.
6. Migrar a la base los datos que hoy tenés en el navegador.
