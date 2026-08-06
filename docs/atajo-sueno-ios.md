# Atajo de iOS para mandar el sueño a Momentum

Cada mañana, este Atajo lee el sueño de la noche anterior del Apple Watch y lo manda a Momentum. Se
configura una sola vez y después corre solo.

> **Por qué un Atajo y no una integración.** Apple no deja que una app web lea HealthKit: esos datos
> sólo son accesibles desde apps nativas firmadas corriendo en el dispositivo. Shortcuts es la única
> vía oficial que no requiere publicar una app en la App Store.

> **Advertencia honesta:** esta receta no está probada en un dispositivo real. La estructura es
> correcta, pero los nombres exactos de las acciones cambian un poco entre versiones de iOS. Si algo
> no coincide, avisá qué ves en pantalla y lo ajustamos.

---

## Antes de empezar

Necesitás dos cosas:

1. **La URL de la función**, que va a ser
   `https://TU_PROJECT_REF.supabase.co/functions/v1/ingest-sleep`
2. **Un token de ingesta.** Todavía no existe la pantalla para generarlo en Momentum, así que por
   ahora se crea a mano desde el SQL Editor de Supabase:

```sql
-- Cambiá 'un-token-largo-y-random' por algo tuyo, largo e impredecible.
insert into public.ingest_tokens (user_id, token_hash, label)
values (
  auth.uid(),
  encode(digest('un-token-largo-y-random', 'sha256'), 'hex'),
  'Atajo de iOS'
);
```

Guardá el token en claro en tu gestor de contraseñas: en la base sólo queda el hash y no se puede
recuperar.

Y obviamente: tenés que haber dormido con el Watch, con **Seguimiento del Sueño** activado.

---

## La idea de la receta

En vez de recorrer las muestras una por una con un bucle y sumar a mano (que es lo tedioso en
Shortcuts), hacemos **una consulta por fase** y dejamos que Salud sume. Queda todo lineal, sin
variables ni condicionales.

---

## Paso a paso

Abrí **Atajos → + (arriba a la derecha)**. Vas a agregar estas acciones en orden, buscándolas en el
buscador de abajo.

### 1. La fecha de la noche

- Buscá **Fecha** y agregala. Dejala en `Fecha actual`.
- Buscá **Formatear fecha**. Tocá el formato y elegí **Personalizado**, con el patrón:

  ```
  yyyy-MM-dd
  ```

- Tocá el resultado y renombrá la variable a **`noche`** (mantené apretado → Renombrar variable).

### 2. Minutos de sueño profundo

- Buscá **Buscar muestras de salud**. Configurala así:
  - Tipo de muestra: **Análisis del sueño**
  - Tocá **Agregar filtro** → `Valor` → **es** → **Profundo**
  - Tocá **Agregar filtro** → `Fecha de inicio` → **está en los últimos** → `1` `día`
- Buscá **Calcular estadísticas**. Elegí **Suma** de **Duración** sobre el resultado anterior.
- Buscá **Calcular** y dividí el resultado **÷ 60** (la duración viene en segundos).
- Buscá **Redondear** → al número entero más cercano.
- Renombrá esa variable a **`profundo`**.

### 3, 4 y 5. Repetir para las otras fases

Exactamente los mismos cinco pasos, cambiando sólo el filtro de `Valor` y el nombre de la variable:

| Filtro de valor | Variable |
| --- | --- |
| **REM** | `rem` |
| **Central** (o *Core*) | `ligero` |
| **Despierto** | `despierto` |

> Truco: seleccioná las 5 acciones del bloque anterior, copiá y pegá tres veces. Después cambiás
> sólo el filtro y el nombre. Es mucho más rápido que armarlas de cero.

### 6. Total dormido

- Buscá **Calcular** y sumá: `profundo` + `rem` + `ligero`.
- Renombrá el resultado a **`dormido`**.

### 7. Hora de acostarse y de levantarse

- Buscá **Buscar muestras de salud** otra vez:
  - Tipo: **Análisis del sueño**
  - Filtro: `Fecha de inicio` → **está en los últimos** → `1` `día`
  - **Ordenar por**: `Fecha de inicio`, **Ascendente**
  - **Límite**: activado, `1` muestra
- Buscá **Obtener detalles de la muestra de salud** → **Fecha de inicio**.
- Renombrá a **`acostada`**.

Ahora lo mismo pero al revés, para la hora de levantarse:

- Otra **Buscar muestras de salud**, igual pero **Descendente**, límite `1`.
- **Obtener detalles de la muestra de salud** → **Fecha de término**.
- Renombrá a **`levantada`**.

### 8. Mandarlo

- Buscá **Obtener contenido de la URL**.
- URL: `https://TU_PROJECT_REF.supabase.co/functions/v1/ingest-sleep`
- Tocá la flechita para desplegar las opciones:
  - **Método**: `POST`
  - **Cabeceras**: agregá dos
    - `x-ingest-token` → tu token
    - `Content-Type` → `application/json`
  - **Cuerpo de la solicitud**: **JSON**, y agregá estos campos (el ícono de cada uno tiene que
    quedar en **Número** donde corresponde, no en Texto):

| Campo | Tipo | Valor |
| --- | --- | --- |
| `night` | Texto | `noche` |
| `bedtime` | Texto | `acostada` |
| `wakeTime` | Texto | `levantada` |
| `asleepMinutes` | Número | `dormido` |
| `awakeMinutes` | Número | `despierto` |
| `remMinutes` | Número | `rem` |
| `coreMinutes` | Número | `ligero` |
| `deepMinutes` | Número | `profundo` |

Sólo los primeros cuatro son obligatorios.

### 9. Ver si funcionó

- Buscá **Mostrar resultado** y ponelo al final, con el resultado de la URL. Cuando confirmes que
  anda, borralo.

Ponele nombre al atajo arriba: **Sueño → Momentum**.

---

## Probarlo

Ejecutá el atajo a mano con el botón de play. La primera vez iOS te va a pedir **permiso para leer
datos de Salud** y **permiso para enviar datos a ese servidor**: aceptá los dos.

Si salió bien vas a ver:

```json
{ "ok": true, "night": "2026-08-05", "asleepMinutes": 428 }
```

| Respuesta | Qué pasó |
| --- | --- |
| `401 Falta el header x-ingest-token` | La cabecera no se guardó en la acción de URL |
| `401 Token inválido o revocado` | El token está mal copiado, o lo revocaste |
| `400 night tiene que ser YYYY-MM-DD` | El patrón de Formatear fecha quedó mal |
| `400 Te levantaste antes de acostarte` | `acostada` y `levantada` están invertidas |
| `400 La noche dura más de 24 horas` | El filtro está tomando muestras de más de un día |
| `400 asleepMinutes tiene que ser mayor a 0` | Los campos numéricos quedaron como Texto en el JSON |

---

## Automatizarlo

**Atajos → pestaña Automatización → + → Hora del día**

- Hora: **10:00**. Dale margen: el Watch tarda un rato en pasarle el sueño al iPhone.
- Repetir: **Diariamente**
- Acción: **Ejecutar atajo** → `Sueño → Momentum`
- Importante: activá **Ejecutar inmediatamente** y desactivá **Preguntar antes de ejecutar**

---

## Si un día falla

La receta manda **sólo la noche de hoy**. Si el teléfono estuvo apagado o la automatización no
corrió, esa noche no llega.

Dos formas de taparlo:

1. **Correr el atajo a mano** ese mismo día. Es idempotente: mandar dos veces la misma noche la
   pisa, no la duplica.
2. **Reimportar el `export.xml`** de Salud cada tanto desde el módulo de Sueño. Trae todo el
   histórico y rellena cualquier agujero.

---

## Seguridad

El token es la única credencial que viaja en el Atajo y **sólo sirve para escribir noches de
sueño**: no da acceso a nada más de tu cuenta. Se guarda hasheado con sha256, así que ni leyendo la
tabla se puede recuperar.

Si perdés el teléfono, revocalo:

```sql
update public.ingest_tokens set revoked_at = now() where label = 'Atajo de iOS';
```
