# Momentum

Un *life OS* personal en una sola app: hábitos, ritual matutino, planificación semanal, objetivos,
rueda de la vida, estadísticas, memento mori, temporizador de enfoque y sueños.

Interfaz en español rioplatense (voseo), dark mode, y **local-first**: los datos viven en el
navegador, sin cuenta ni backend.

---

## Módulos

| Módulo | Ruta | Qué hace |
| --- | --- | --- |
| Panel de hábitos | `/habitos` | Grilla mensual editable, racha por hábito, % de cumplimiento |
| Ritual Matutino | `/ritual` | Misión del día, pilar, SAPO, proyectos, nivel de energía y logros |
| Planificador semanal | `/semana` | Tareas por día, navegación entre semanas y premio semanal |
| Objetivos y metas | `/objetivos` | Metas por trimestre y año, colgadas de un sueño |
| Rueda de la vida | `/rueda` | Radar de 8 áreas con comparación contra el mes anterior |
| Estadísticas y rachas | `/estadisticas` | Progreso semanal, mejores rachas y hábitos, evolución 7d vs 7d |
| Memento Mori | `/memento` | Semanas vividas sobre el total y calendario de vida completo |
| Temporizador de enfoque | `/enfoque` | Pomodoro con ciclos, registro de bloques y duraciones configurables |
| Sueños por cumplir | `/suenos` | Sueños personales y profesionales, con avance de sus objetivos |
| Ajustes | `/ajustes` | Perfil, pilares, proyectos, export/import y reset |

### Sueños vs. objetivos

Son dos cosas distintas y esa distinción es la que sostiene el modelo de datos:

- Un **sueño** es un destino sin fecha (`Dream`).
- Un **objetivo** es un compromiso con año y trimestre (`Goal`) que **cuelga de un sueño**
  vía `Goal.dreamId`.

Por eso el selector de sueño en `/objetivos` filtra y, al cargar una meta con un sueño elegido, la
asocia sola. Sin ese vínculo los dos módulos serían la misma lista con distinto nombre.

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
    stats.ts      Métricas derivadas (rachas, cumplimiento, evolución, memento).
    date.ts       Helpers de fecha y formateo en es-AR.
    seed.ts       Datos de ejemplo determinísticos, relativos a hoy.
  components/
    ui/           Card, Button, Input, Checkbox, Tabs, Progress, EmptyState, Modal.
    layout/       AppShell (sidebar + barra mobile) y PageHeader.
  modules/
    <modulo>/     Una carpeta por módulo, con su página y sus piezas propias.
    registry.tsx  Definición de los 9 módulos: ruta, título, descripción e ícono.
design-system/    Previews HTML del design system, sincronizadas con Claude Design.
```

### Persistencia

Todo el estado se guarda bajo la clave `momentum:v1` en `localStorage`, serializado por el
middleware `persist` de zustand. `src/lib/storage.ts` es el único archivo que toca esa API: para
migrar a Supabase, IndexedDB o lo que sea, se reimplementa ahí y ni el store ni los componentes se
enteran.

Los datos **no salen del navegador**. Desde Ajustes se puede exportar un backup JSON e importarlo.

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

Los nueve módulos están implementados y funcionan sobre datos reales y persistentes.

Pendiente:

- Sincronización multi-dispositivo (Supabase) sobre el adaptador de `storage.ts`
- PWA / instalable y notificaciones del ritual matutino
- Reordenar hábitos y tareas con drag & drop
- Vista mobile dedicada para la grilla mensual de hábitos
