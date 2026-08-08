# Google Tasks → Momentum

Las tareas se cargan en Google Tasks (desde el celular, como ya hacés) y aparecen en Momentum. El
tildado va en las dos direcciones.

> **Estado: preparado, no probado.** El esquema y la función están escritos, pero no se pueden
> ejecutar hasta que exista el proyecto de Supabase y el cliente de OAuth en Google Cloud.

## Cómo funciona la sincronización

```
Google Tasks                          Momentum
────────────────────────────────────────────────────────
Creás una tarea      ──────────────►  Aparece en su día
Le ponés fecha       ──────────────►  Va a esa columna
Subtarea             ──────────────►  Subtarea
Notas                ──────────────►  Nota
La borrás            ──────────────►  Se borra

La tildás            ◄────────────►   La tildás
```

**Google manda sobre el contenido** (título, nota, fecha, subtareas, borrados) y **el tildado viaja
en las dos direcciones**, resolviendo por timestamp más reciente.

Esa asimetría es deliberada. Si todo fuera de Google hacia acá, cada vez que tildaras algo en el
Journal se perdería en la próxima sincronización. Y una sincronización totalmente bidireccional
exige tombstones, mapeo de IDs y resolución de conflictos de contenido — mucha complejidad para una
app de una persona. El tildado es un solo booleano: eso sí se puede hacer en dos vías sin drama.

## El mapeo

| Momentum | Google Tasks |
| --- | --- |
| día de la tarea | `due` |
| título | `title` |
| nota | `notes` |
| subtarea (1 nivel) | `parent` (también 1 nivel) |
| completada | `status` |
| **estrella** | no existe en la API — se queda sólo en Momentum |

**Lo que se pierde:** Google organiza por **listas** (Emprendimiento, Trabajo, Desarrollo Personal…)
y Momentum por **días**. Al importar, todas las listas colapsan en el día de su `due`. Si una tarea
no tiene fecha en Google, no se importa: no habría dónde ponerla.

## Configuración

### 1. Crear el cliente de OAuth

1. Entrá a [Google Cloud Console](https://console.cloud.google.com) y creá un proyecto.
2. **APIs y servicios → Biblioteca** → buscá **Google Tasks API** → **Habilitar**.
3. **Pantalla de consentimiento de OAuth** → tipo **Externo** → completá lo mínimo.
4. **Credenciales → Crear credenciales → ID de cliente de OAuth**
   - Tipo: **Aplicación web**
   - URI de redireccionamiento autorizado:
     `https://TU_PROJECT_REF.supabase.co/functions/v1/google-oauth-callback`
5. Guardá el **Client ID** y el **Client Secret**.

### 2. Publicar la app (importante)

En la pantalla de consentimiento, pasá el estado de **"Prueba"** a **"En producción"**.

> **Por qué importa:** en modo Prueba, Google **vence el refresh token cada 7 días** y tendrías que
> reconectar todas las semanas. En producción no vence.
>
> Como no vas a verificar la app (es un trámite que no tiene sentido para uso personal), Google te
> va a mostrar una pantalla de **"app no verificada"** la primera vez. Tocás *Configuración
> avanzada → Ir a la app*. Es tu propia app y tu propia cuenta: no hay riesgo.

### 3. Cargar los secretos en Supabase

```bash
supabase secrets set GOOGLE_CLIENT_ID=xxx GOOGLE_CLIENT_SECRET=yyy
```

### 4. Desplegar las funciones

```bash
supabase functions deploy google-oauth-callback google-tasks-sync
```

### 5. Conectar

Desde Ajustes en Momentum, botón **Conectar Google Tasks**. Elegís tu cuenta, aceptás los permisos
y listo.

## Cada cuánto sincroniza

La función `google-tasks-sync` se puede llamar de dos formas:

- **Al abrir la app**, desde el cliente. Es lo que hace que se sienta inmediato.
- **Por cron**, cada 15 minutos, para que el tildado que hacés en el celular llegue aunque no abras
  Momentum:

```sql
select cron.schedule(
  'google-tasks-sync',
  '*/15 * * * *',
  $$select net.http_post(
      url := 'https://TU_PROJECT_REF.supabase.co/functions/v1/google-tasks-sync',
      headers := '{"Authorization": "Bearer SERVICE_ROLE_KEY"}'::jsonb
  )$$
);
```

Requiere las extensiones `pg_cron` y `pg_net`, que se habilitan desde el panel de Supabase.

## Permisos que se piden

Un solo scope: `https://www.googleapis.com/auth/tasks`. Da acceso a tus tareas y a nada más — ni
mail, ni calendario, ni contactos.

Para desconectar: botón en Ajustes. Borra el refresh token y los vínculos, pero **no toca tus tareas
en Google**.

## Lo que falta

- [ ] La función `google-oauth-callback` (intercambio de código por refresh token)
- [ ] La función `google-tasks-sync` (pull de contenido + push de tildado)
- [ ] El botón de conectar/desconectar en Ajustes
- [ ] Elegir qué listas sincronizar
