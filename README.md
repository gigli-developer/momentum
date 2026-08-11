# Momentum

Un *life OS* personal en una sola app: hábitos, ritual matutino, planificación semanal, objetivos,
rueda de la vida, estadísticas, memento mori y sueños.

Interfaz en español rioplatense (voseo), dark mode, y **local-first**: los datos viven en el
navegador, sin cuenta ni backend.

---

## Módulos

| Módulo | Ruta | Qué hace |
| --- | --- | --- |
| Panel de hábitos | `/habitos` | Grilla mensual editable, racha por hábito, % de cumplimiento |
| Ritual Matutino | `/ritual` | Misión del día, pilar, SAPO, proyectos, nivel de energía y logros |
| Planificador semanal | `/semana` | Tablero de columnas por día, estilo Google Tasks |
| Journal | `/journal` | Cierre diario: tareas cumplidas, audio de la lectura y armado de mañana |
| Sueño | `/sueno` | Noches del Apple Watch, fases, regularidad y cruce con la energía |
| Objetivos y metas | `/objetivos` | Metas por trimestre y año, en secciones que define el usuario |
| Rueda de la vida | `/rueda` | Radar de áreas configurables (3 a 10) con comparación contra el mes anterior |
| Estadísticas y rachas | `/estadisticas` | Progreso semanal, mejores rachas y hábitos, evolución 7d vs 7d |
| Memento Mori | `/memento` | Semanas vividas sobre el total y calendario de vida completo |
| Ajustes | `/ajustes` | Perfil, pilares, proyectos, export/import y reset |

### Tareas

Hay **una sola lista de tareas** para toda la app (`AppData.tasks`, indexadas por fecha). El
planificador es el tablero semanal y el journal es la vista diaria de esa misma lista: lo que
tildás en uno aparece tildado en el otro.

Cada tarea admite una nota (línea secundaria), una estrella de importante y **un nivel** de
subtareas (`parentId`). Reglas:

- Completar una tarea padre completa sus subtareas.
- Borrar una tarea padre borra sus subtareas.
- Una tarea pasa a "Completadas" cuando el **padre** está hecho, y arrastra sus subtareas.

### Sueño y Apple Watch

**Una app web no puede leer HealthKit.** Apple sólo expone esos datos a apps nativas firmadas
corriendo en el dispositivo, así que no hay integración directa posible. Los datos entran por tres
vías, todas convergiendo en `SleepNight`:

| Vía | Cuándo | Cómo |
| --- | --- | --- |
| Health Auto Export | Cada mañana, automático | App paga que postea sola — ver [docs/health-auto-export.md](docs/health-auto-export.md) |
| Atajo de iOS | Cada mañana, automático | Alternativa gratis — ver [docs/atajo-sueno-ios.md](docs/atajo-sueno-ios.md) |
| Export de Salud | Una vez, para el histórico | Se sube `export.xml` y se parsea en el navegador |
| Manual | Cuando falla lo demás | Formulario en el módulo, sin fases |

Las dos primeras pegan contra la **misma URL** (`ingest-sleep`): la función detecta el formato por
la forma del payload, así que no hay nada que configurar distinto según cuál uses.

Detalles que importan:

- Una noche se guarda con la fecha de la **mañana en que te despertaste**. Si se guardara la fecha
  de acostarse, toda noche que cruza medianoche quedaría partida en dos.
- El corte entre una noche y la siguiente es el **mediodía**, igual que usa el propio Watch.
- El `export.xml` pesa cientos de MB porque trae todo el historial de salud. Se lee **por chunks de
  4 MB** y se extraen sólo los registros `HKCategoryTypeIdentifierSleepAnalysis`: nunca entra
  entero en memoria, y el resto de los datos de salud ni se toca.
- Cada noche llega partida en decenas de segmentos (uno por cambio de fase); se agrupan y suman.
- Noches con menos de 30 minutos dormidos se descartan: son siestas o ruido del sensor.

### Secciones de objetivos

Las secciones **no están fijas en el código**: son datos del usuario (`AppData.goalCategories`) y
se agregan, renombran y eliminan desde el propio módulo. Arranca con Personal y Profesional.
Siempre tiene que quedar al menos una, y borrar una sección **borra sus objetivos de todos los
años** — la UI lo confirma mostrando cuántos.

### El journal se sigue escribiendo a mano

El módulo **no reemplaza el cuaderno**, lo acompaña. El ciclo diario es:

1. Tildar qué tareas del día se cumplieron (son las mismas del planificador, no hay dos listas).
2. Escribir el journal a mano, como siempre.
3. Grabarse leyendo lo escrito. El audio queda asociado a ese día.
4. Cerrar el día.
5. Anotar las tareas de mañana desde el mismo panel, y así se encadena.

Por eso no hay campo de texto para el journal: el texto vive en papel. Lo que la app guarda es el
audio de la lectura y el registro de cumplimiento.

### Rueda de la vida: manual y automática

Cada área declara **de dónde sale su puntaje** (`LifeArea.source`):

| Fuente | Cómo se calcula |
| --- | --- |
| `manual` | El slider. Es el default |
| `habits` | Marcas logradas / posibles de los hábitos elegidos, en el mes |
| `sleep` | Noches que llegaron al objetivo / noches con dato |
| `tasks` | Tareas completadas / totales del mes |
| `goals` | Objetivos cumplidos / totales del trimestre |
| `energy` | Energía promedio del ritual, estirada de 1-5 a 0-10 |

Reglas que importan:

- **Lo automático no se guarda.** Se recalcula en cada render desde los datos crudos, así que
  corregir un hábito de hace tres meses actualiza la rueda de ese mes sin migraciones.
- Si una fuente **no tiene datos**, devuelve `null` y el área cae al valor manual. Mostrar 0 sería
  mentir: no es que estés mal en salud, es que no hay con qué medirlo.
- Sólo se cuentan los **días del mes que ya pasaron**: no se penaliza por el futuro.
- Las áreas que dependen de cómo te sentís —familia, ocio, tiempo propio— **no se pueden derivar de
  ningún dato** y quedan manuales a propósito.

### Áreas de la rueda

Las áreas de la rueda de la vida **no están fijas en el código**: son datos del usuario
(`AppData.lifeAreas`) y se pueden agregar, renombrar y eliminar desde el propio módulo. El radar se
dibuja con tantos ejes como áreas haya.

- Mínimo **3** (con menos no se forma un polígono) y máximo **10** (con más el radar deja de leerse).
- Al eliminar un área se borran también sus puntajes históricos, para que no queden datos colgados
  en el export.
- Al agregar un área, arranca en 5 en todos los meses ya puntuados, así el polígono no se hunde de
  golpe hacia el centro.
- Las áreas nuevas no aparecen en la comparación con el mes anterior hasta que ese mes tenga dato.

---

## Stack

- **Vite 8** + **React 19** + **TypeScript** (strict)
- **Tailwind CSS v4** con tokens declarados en `@theme` (`src/index.css`)
- **zustand** + middleware `persist` para el estado y la persistencia
- **date-fns** con locale `es`
- **lucide-react** para iconografía
- Gráficos (radar, anillos, barras) hechos a mano en SVG — sin librería de charts

## Arranque

```bash
npm install
npm run dev
```

| Script | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo en `http://localhost:5173` |
| `npm run build` | Typecheck + build de producción a `dist/` |
| `npm run preview` | Sirve el build de producción |
| `npm run lint` | oxlint |

---

## Arquitectura

```
src/
  lib/
    types.ts      Modelo de dominio. No depende de React ni del storage.
    store.ts      Store de zustand: estado + acciones + selectores.
    storage.ts    Adaptador de persistencia. Único punto de contacto con localStorage.
    media.ts      Blobs pesados (audio) en IndexedDB. Único punto de contacto con IndexedDB.
    stats.ts      Métricas derivadas (rachas, cumplimiento, evolución, memento).
    date.ts       Helpers de fecha y formateo en es-AR.
    seed.ts       Datos de ejemplo determinísticos, relativos a hoy.
  components/
    ui/           Card, Button, Input, Checkbox, Tabs, Progress, EmptyState, Modal.
    layout/       AppShell (sidebar + barra mobile) y PageHeader.
  modules/
    <modulo>/     Una carpeta por módulo, con su página y sus piezas propias.
    registry.tsx  Definición de los módulos: ruta, título, descripción e ícono.
design-system/    Previews HTML del design system, sincronizadas con Claude Design.
supabase/         Migraciones SQL del esquema. Ver supabase/README.md.
```

### Cómo se conecta con Supabase

La app **no** hace una llamada por acción. El store de zustand sigue siendo síncrono y hace de
caché en memoria; Supabase es la fuente de verdad.

```
Iniciar sesión ──► loadAll()  ──► hydrate del store  ──► la UI pinta
Cada cambio    ──► store (instantáneo)  ──► debounce 500ms  ──► diff  ──► push
```

- **`src/lib/remote/load.ts`** trae todo de una. Los datos de una persona son chicos, así que
  paginar costaría más complejidad de la que ahorra.
- **`src/lib/remote/sync.ts`** compara el estado anterior con el nuevo y deduce qué cambió. Se hace
  por diferencias y no llamando a Supabase desde cada acción porque son ~25 acciones: **olvidarse
  una sola significaría un dato que nunca se guarda**. Si está en `AppData`, entra en el diff.
- El estado confirmado se marca **antes** del `await`: si entra otro cambio mientras se escribe, su
  diff parte de ahí y no reenvía lo que ya va en camino. Si falla, la marca vuelve atrás y el
  siguiente intento reintenta lo perdido.
- Las escrituras se encadenan, nunca en paralelo, para que dos ráfagas seguidas no se pisen.
- Las tareas padre se escriben antes que las subtareas: si no, la foreign key rechaza la subtarea.
- Al cerrar la pestaña con cambios pendientes, se fuerza el guardado.

Sin `.env.local`, la app arranca igual contra localStorage y lo dice en la barra lateral.

### Persistencia

**Supabase es la fuente de verdad.** Con `.env.local` configurado, la app exige login y todo el
estado vive en Postgres. `localStorage` queda sólo como caché del middleware `persist` de zustand:
acelera el primer pintado, pero al iniciar sesión se sobrescribe con lo que venga del servidor.

Las grabaciones del journal van a **Supabase Storage**, en un bucket privado, y se reproducen con
URLs firmadas de una hora. Los metadatos viven en `journal_recordings`.

Sin `.env.local` la app corre en **modo local**: sin login, contra `localStorage`, con los audios en
IndexedDB (`src/lib/media.ts`). Sirve para probar sin backend, y la barra lateral lo aclara.

### Datos de ejemplo

Sólo en modo local. Con Supabase configurado, la app arranca **vacía** y se hidrata al iniciar
sesión: sembrar datos de ejemplo ahí haría ver hábitos falsos por un instante, y el sincronizador
los subiría a la cuenta. El seed vive en `src/lib/seed.ts`, es determinístico y se genera relativo
al día actual.

---

## Design system

Los tokens viven en `src/index.css` dentro de `@theme` y son la única fuente de verdad. La carpeta
`design-system/` contiene las previews HTML que se publican en Claude Design (proyecto
*Momentum — Design System*) para trabajar el front con más detalle.

Decisiones que se apartan a propósito del mockup original:

1. **Una sola familia cromática.** Los checks de hábitos y las barras de estadísticas usaban rosa,
   violeta y celeste sin codificar nada. Ahora hay una rampa monocromática naranja para intensidad y
   ocho análogos para series categóricas.
2. **Texto oscuro sobre naranja.** `#1A0A02` sobre `#FF5C1A` da 6.1:1; el blanco daba 3.1:1.
3. **Serie de comparación visible.** En la rueda de la vida el mes anterior va en ámbar punteado con
   muestras de leyenda rellenas, en vez de gris casi invisible con recuadros vacíos.
4. **Total de semanas consistente.** Memento Mori usa 52 semanas exactas por año, así el número que
   se lee coincide con la cantidad de puntos dibujados.

---

## Estado actual

Los nueve módulos están implementados y andando contra Supabase.

`src/components/tasks/` contiene `TaskRow` y `DayTaskList`, el par que comparten el planificador y
el journal para no duplicar la lógica de tareas.

### Verificado de punta a punta

Con una cuenta real, siguiendo cada dato hasta Postgres:

- **Tareas** — padre y subtarea con el `parent_id` correcto, estrella y nota que persisten,
  completar el padre arrastra la subtarea, tareas de días futuros
- **Hábitos** — alta, marca del día, y borrado que se lleva sus marcas
- **Journal** — cierre del día, y audio subido, firmado, descargado y reproducido tras recargar sin
  caché local
- **Ciclo de cuenta** — alta que siembra perfil, secciones y áreas; baja que limpia todo en cascada

### Lo que NO está probado

- **Grabar audio con micrófono real.** El camino de subida y reproducción sí se verificó inyectando
  un audio, pero `MediaRecorder` nunca corrió contra un micrófono de verdad.
- **La conexión con Google.** El OAuth está desplegado y responde bien a los casos de error, pero
  nadie completó el consentimiento todavía, así que no hay refresh token y Calendar nunca devolvió
  eventos reales.
- **El Atajo de iOS / Health Auto Export.** La función `ingest-sleep` está viva y valida tokens,
  pero nunca recibió un payload real de un teléfono.

## Qué sigue

1. **Google Tasks** — el esquema, el mapeo y el modelo de sincronización están escritos
   ([docs/google-tasks.md](docs/google-tasks.md)); faltan las funciones de sync y elegir qué listas
   traer.
2. **Desplegar** — hoy corre sólo en local. Hace falta una URL fija para el Atajo de sueño, y para
   poder usarlo desde el celular. Al desplegar hay que actualizar el secreto `APP_URL` en
   `app_secrets`, o el callback de Google va a seguir redirigiendo a `localhost`.
3. **Cerrar el registro público** en Authentication → Providers → Email. Es una app de una persona.
4. PWA / instalable y notificaciones del ritual matutino.
5. Reordenar hábitos y tareas con drag & drop.
6. Vista mobile dedicada para la grilla mensual de hábitos.

## Para retomar en otra sesión

Lo que no está en el repo y hace falta saber:

| | |
| --- | --- |
| Proyecto Supabase | `bktawrshipxodfpacjoa` — esquema aplicado, 5 Edge Functions desplegadas |
| Credenciales del cliente | En `.env.local`, que está gitignoreado. Ver `.env.example` |
| Secretos de Google | En la tabla `app_secrets`, no en variables de entorno |
| Design system | Publicado en Claude Design, proyecto *Momentum — Design System* |

Trampa horaria que ya mordió dos veces: `new Date('2026-08-10')` parsea medianoche **UTC**, que en
Argentina cae el día anterior. Para fechas `YYYY-MM-DD` usar siempre `fromISO` de `src/lib/date.ts`.
