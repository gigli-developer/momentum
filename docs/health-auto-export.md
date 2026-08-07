# Health Auto Export → Momentum

La forma más simple de que el sueño del Apple Watch llegue a Momentum sin armar nada.

**Health Auto Export** es una app de la App Store que lee la app Salud y manda los datos a donde le
digas, en automático. Se configura con formularios: no hay que armar un Atajo ni programar nada.

> **Por qué hace falta una app en el teléfono.** Apple no tiene ninguna API de nube para Health: los
> datos nunca salen del dispositivo. Cualquier cosa que los saque tiene que correr **en el iPhone**.
> La única elección es si eso lo armás vos (un Atajo) o si usás una app que ya está hecha.

## Configuración

1. Instalá **Health Auto Export** desde la App Store. Las automatizaciones están en el plan pago.
2. Abrí la app → **Automations** → **+**
3. Configurala así:

| Campo | Valor |
| --- | --- |
| Automation Type | **REST API** |
| URL | `https://TU_PROJECT_REF.supabase.co/functions/v1/ingest-sleep?token=TU_TOKEN` |
| Export Format | **JSON** |
| Data Type | **Health Metrics** |
| Metrics | sólo **Sleep Analysis** |
| Aggregation / Period | **Daily** |
| Schedule | diario, alrededor de las **10:00** |

4. Dale a **Test** o **Run Now**.

### Sobre el token en la URL

Si la app te deja configurar **cabeceras**, es mejor mandarlo así:

```
x-ingest-token: TU_TOKEN
```

y dejar la URL limpia. Si no te deja (que es lo común), va como `?token=` en la URL. La función
acepta las dos formas.

Un token en la URL es algo peor que en una cabecera: puede quedar en logs. Como sólo sirve para
escribir noches de sueño y no da acceso a nada más de la cuenta, es un riesgo aceptable — pero si
alguna vez lo exponés, revocalo y generá otro.

## Qué esperar

La función detecta sola el formato: la **misma URL** sirve para Health Auto Export y para el Atajo,
sin configurar nada distinto. Si funciona, la respuesta es:

```json
{
  "ok": true,
  "format": "health-auto-export",
  "nights": [{ "night": "2026-08-05", "asleepMinutes": 428 }]
}
```

## Si falla

Los nombres de los campos de esta app cambiaron entre versiones, así que **si el formato no coincide
la función devuelve el payload que recibió** dentro de `extra`. Con eso se ajusta el parser en una
sola pasada.

| Respuesta | Qué pasó |
| --- | --- |
| `401 Falta el token` | La URL quedó sin `?token=` |
| `401 Token inválido o revocado` | Está mal copiado |
| `400 No encontré data.metrics` | El "Data Type" no quedó en Health Metrics |
| `400 No encontré la métrica de sueño` | No está tildado Sleep Analysis |
| `400 No pude leer ninguna noche válida` | Cambió el formato: mirá `extra` y avisá |

Copiá y pegá la respuesta completa y lo corrijo.

## Alternativas

- **Atajo de iOS** — gratis, pero lo armás vos. Ver [atajo-sueno-ios.md](atajo-sueno-ios.md).
- **Importar `export.xml`** — gratis y manual, desde el módulo de Sueño. Sirve para traer el
  histórico completo de una y para tapar agujeros.
