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

### Persistencia

Todo el estado se guarda bajo la clave `momentum:v1` en `localStorage`, serializado por el
middleware `persist` de zustand. `src/lib/storage.ts` es el único archivo que toca esa API: para
migrar a Supabase, IndexedDB o lo que sea, se reimplementa ahí y ni el store ni los componentes se
enteran.

Los datos **no salen del navegador**. Desde Ajustes se puede exportar un backup JSON e importarlo.

Las grabaciones del journal son la excepción: los blobs de audio van a **IndexedDB**
(`src/lib/media.ts`), porque localStorage tiene ~5 MB de tope y base64 los infla un 33%. En el
store quedan sólo los metadatos (id, duración, tamaño, mime).

> ⚠️ **El backup JSON no incluye los audios.** Son binarios y no entran en el export. Cada
> grabación tiene su botón de descarga individual. Borrar una grabación limpia las dos capas
> (metadato y blob), y "Empezar de cero" vacía IndexedDB además del store.

### Datos de ejemplo

La app arranca con un seed determinístico (`src/lib/seed.ts`) generado relativo al día actual, para
que ninguna pantalla se vea vacía la primera vez. Desde **Ajustes → Empezar de cero** se limpia todo.

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

## Estado actual y qué sigue

Los ocho módulos están implementados y funcionan sobre datos reales y persistentes.

`src/components/tasks/` contiene `TaskRow` y `DayTaskList`, el par que comparten el planificador y
el journal para no duplicar la lógica de tareas.

Pendiente:

- Sincronización multi-dispositivo (Supabase) sobre el adaptador de `storage.ts`
- PWA / instalable y notificaciones del ritual matutino
- Reordenar hábitos y tareas con drag & drop
- Vista mobile dedicada para la grilla mensual de hábitos
