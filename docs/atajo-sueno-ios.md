# Atajo de iOS para mandar el sueño a Momentum

Cada mañana, este Atajo lee el sueño de la noche anterior del Apple Watch y lo manda a la app. Se
configura una sola vez y después corre solo.

> **Por qué un Atajo y no una integración.** Apple no deja que una app web lea HealthKit: esos datos
> sólo son accesibles desde apps nativas firmadas corriendo en el dispositivo. Shortcuts es la única
> vía oficial que no requiere publicar una app en la App Store.

## Antes de empezar

Necesitás tres cosas del proyecto de Supabase:

1. La URL de la función: `https://TU_PROJECT_REF.supabase.co/functions/v1/ingest-sleep`
2. Un **token de ingesta**, que se genera desde Ajustes en Momentum. Se muestra una sola vez.
3. Tener dormido con el Watch al menos una noche, con Seguimiento del Sueño activado.

## Armar el Atajo

Abrí **Atajos → + → Nuevo atajo** y agregá estas acciones en orden.

### 1. Buscar las muestras de sueño

- Acción: **Buscar muestras de salud**
- Tipo: **Análisis del sueño**
- Filtro: `Fecha de inicio` — `es hoy` (o `está en los últimos` → `1` → `días`)
- Ordenar por: `Fecha de inicio`, ascendente
- Límite: desactivado

### 2. Repetir sobre cada muestra

- Acción: **Repetir con cada elemento** sobre el resultado anterior.

Adentro del repetir, vas a ir sumando duración por fase. La forma más simple que no requiere
variables complejas:

- **Obtener detalles de la muestra de salud** → `Valor` (te da la fase: Profundo, REM, Central,
  Despierto)
- **Obtener detalles de la muestra de salud** → `Duración`
- Un **Si** por cada fase que sume a una variable distinta (`deep`, `rem`, `core`, `awake`).

> Si te resulta pesado, hay un atajo más corto: sumá sólo la duración total dormida (todo lo que no
> sea `Despierto`) y mandá eso. Las fases son lindas pero no imprescindibles — el módulo las muestra
> como "Sin fase" y el resto de las métricas funciona igual.

### 3. Calcular la noche

- **Fecha** → `Hoy`, formateada como `yyyy-MM-dd`. Esa es la clave `night`.
- La **primera** muestra te da `bedtime`; la **última**, `wakeTime`. Formatealas ISO 8601.

### 4. Mandarlo

- Acción: **Obtener contenido de la URL**
- URL: `https://TU_PROJECT_REF.supabase.co/functions/v1/ingest-sleep`
- Método: **POST**
- Cabeceras:
  - `x-ingest-token` → tu token
  - `Content-Type` → `application/json`
- Cuerpo de la solicitud: **JSON**

```json
{
  "night": "2026-08-04",
  "bedtime": "2026-08-03T23:41:00-03:00",
  "wakeTime": "2026-08-04T07:12:00-03:00",
  "asleepMinutes": 428,
  "awakeMinutes": 23,
  "remMinutes": 96,
  "coreMinutes": 259,
  "deepMinutes": 73
}
```

Sólo `night`, `bedtime`, `wakeTime` y `asleepMinutes` son obligatorios. Si no mandás las fases, se
guardan en cero y el minutaje dormido cae en "sin fase".

## Automatizarlo

**Atajos → Automatización → + → Hora del día**

- Hora: **10:00** (dale margen: el Watch tarda un rato en sincronizar el sueño al iPhone)
- Repetir: **Diariamente**
- Acción: ejecutar el atajo que armaste
- **Ejecutar inmediatamente**, y desactivá "Preguntar antes de ejecutar"

## Probarlo

Corré el Atajo a mano. Si todo salió bien, la respuesta es:

```json
{ "ok": true, "night": "2026-08-04", "asleepMinutes": 428 }
```

| Respuesta | Qué pasó |
| --- | --- |
| `401 Falta el header x-ingest-token` | La cabecera no se guardó en la acción de URL |
| `401 Token inválido o revocado` | El token está mal copiado, o lo revocaste desde Ajustes |
| `400 night tiene que ser YYYY-MM-DD` | La fecha se está mandando con otro formato |
| `400 Te levantaste antes de acostarte` | `bedtime` y `wakeTime` están invertidos |
| `400 La noche dura más de 24 horas` | El filtro está tomando muestras de varios días |

## Seguridad

El token es **la única credencial** que viaja en el Atajo, y sólo sirve para escribir noches de
sueño: no da acceso a nada más de tu cuenta. Se guarda hasheado en la base, así que ni leyendo la
tabla se puede recuperar.

Si perdés el teléfono, revocá el token desde Ajustes y generá uno nuevo.
