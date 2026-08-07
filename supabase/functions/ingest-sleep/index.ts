/**
 * Edge Function `ingest-sleep`
 *
 * Recibe el sueño de una noche y lo guarda. Acepta dos formatos:
 *
 *   1. El nuestro, simple, que manda el Atajo de iOS.
 *   2. El de la app Health Auto Export (métrica `sleep_analysis`), para no
 *      tener que traducir nada del lado del teléfono.
 *
 * Autenticación: token propio, por header `x-ingest-token` o por query
 * `?token=`. Lo segundo existe porque algunas apps de exportación sólo dejan
 * configurar la URL y no las cabeceras. No usa JWT porque ni un Atajo ni esas
 * apps pueden renovar sesiones de Supabase.
 *
 * Es idempotente sobre (user_id, night): si corre dos veces el mismo día, la
 * segunda pisa a la primera en vez de duplicar.
 *
 * Deploy:
 *   supabase functions deploy ingest-sleep --no-verify-jwt
 *
 * `--no-verify-jwt` es necesario y correcto acá: la función hace su propia
 * validación. Sin ese flag, Supabase rechazaría el request antes de que
 * nuestro código lo vea.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2'

const JSON_HEADERS = { 'content-type': 'application/json' }

function bad(status: number, message: string, extra?: unknown): Response {
  return new Response(JSON.stringify({ ok: false, error: message, extra }), {
    status,
    headers: JSON_HEADERS,
  })
}

function toMinutes(value: unknown, unit: 'min' | 'hr' = 'min'): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.round(unit === 'hr' ? n * 60 : n)
}

interface NormalizedNight {
  night: string
  bedtime: Date
  wakeTime: Date
  asleepMinutes: number
  inBedMinutes: number
  awakeMinutes: number
  remMinutes: number
  coreMinutes: number
  deepMinutes: number
  unspecifiedMinutes: number
}

/** `YYYY-MM-DD` de una fecha, en la zona horaria del propio timestamp. */
function dayKey(value: string): string {
  return value.slice(0, 10)
}

/* -------------------------------------------------------------- formato simple */

function parseSimple(body: Record<string, unknown>): NormalizedNight | string {
  const night = String(body.night ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(night)) return '`night` tiene que ser YYYY-MM-DD'

  const bedtime = new Date(String(body.bedtime ?? ''))
  const wakeTime = new Date(String(body.wakeTime ?? ''))
  if (Number.isNaN(bedtime.getTime()) || Number.isNaN(wakeTime.getTime())) {
    return '`bedtime` y `wakeTime` tienen que ser fechas ISO'
  }

  const asleep = toMinutes(body.asleepMinutes)
  const inBed =
    body.inBedMinutes !== undefined
      ? toMinutes(body.inBedMinutes)
      : Math.round((wakeTime.getTime() - bedtime.getTime()) / 60_000)

  return {
    night,
    bedtime,
    wakeTime,
    asleepMinutes: asleep,
    inBedMinutes: inBed,
    awakeMinutes: toMinutes(body.awakeMinutes),
    remMinutes: toMinutes(body.remMinutes),
    coreMinutes: toMinutes(body.coreMinutes),
    deepMinutes: toMinutes(body.deepMinutes),
    unspecifiedMinutes: toMinutes(body.unspecifiedMinutes),
  }
}

/* ------------------------------------------------- formato Health Auto Export */

/**
 * La app manda algo con esta forma:
 *
 *   { "data": { "metrics": [
 *       { "name": "sleep_analysis", "units": "hr", "data": [
 *           { "sleepStart": "...", "sleepEnd": "...", "asleep": 7.1,
 *             "inBed": 7.5, "deep": 1.2, "core": 4.1, "rem": 1.8, "awake": 0.4 }
 *       ]}
 *   ]}}
 *
 * Los nombres de campo variaron entre versiones de la app, así que se aceptan
 * varios alias y se ignora lo que no se reconozca. Si algo no matchea, el error
 * devuelve el payload recibido para poder ajustarlo en una sola pasada.
 */
function parseHealthAutoExport(body: Record<string, unknown>): NormalizedNight[] | string {
  const data = body.data as Record<string, unknown> | undefined
  const metrics = data?.metrics as Array<Record<string, unknown>> | undefined
  if (!Array.isArray(metrics)) return 'No encontré `data.metrics`'

  const sleep = metrics.find((m) => String(m.name ?? '').includes('sleep'))
  if (!sleep) return 'No encontré la métrica de sueño en `data.metrics`'

  const unit = String(sleep.units ?? 'hr').toLowerCase().startsWith('h') ? 'hr' : 'min'
  const rows = sleep.data as Array<Record<string, unknown>> | undefined
  if (!Array.isArray(rows) || rows.length === 0) return 'La métrica de sueño vino vacía'

  const nights: NormalizedNight[] = []

  for (const row of rows) {
    const startRaw = String(row.sleepStart ?? row.sleep_start ?? row.startDate ?? '')
    const endRaw = String(row.sleepEnd ?? row.sleep_end ?? row.endDate ?? row.date ?? '')
    const bedtime = new Date(startRaw)
    const wakeTime = new Date(endRaw)
    if (Number.isNaN(bedtime.getTime()) || Number.isNaN(wakeTime.getTime())) continue
    if (wakeTime <= bedtime) continue

    const deep = toMinutes(row.deep, unit)
    const rem = toMinutes(row.rem, unit)
    const core = toMinutes(row.core, unit)
    const awake = toMinutes(row.awake, unit)
    const asleepReported = toMinutes(row.asleep ?? row.totalSleep, unit)
    // Si la app no manda el total, lo reconstruimos de las fases.
    const asleep = asleepReported > 0 ? asleepReported : deep + rem + core
    if (asleep === 0) continue

    const inBed =
      toMinutes(row.inBed ?? row.in_bed, unit) ||
      Math.round((wakeTime.getTime() - bedtime.getTime()) / 60_000)

    nights.push({
      // La noche pertenece al día en que te despertaste.
      night: dayKey(wakeTime.toISOString()),
      bedtime,
      wakeTime,
      asleepMinutes: asleep,
      inBedMinutes: inBed,
      awakeMinutes: awake,
      remMinutes: rem,
      coreMinutes: core,
      deepMinutes: deep,
      unspecifiedMinutes: Math.max(0, asleep - deep - rem - core),
    })
  }

  if (nights.length === 0) return 'No pude leer ninguna noche válida del payload'
  return nights
}

/* ------------------------------------------------------------------ handler */

Deno.serve(async (request) => {
  if (request.method !== 'POST') return bad(405, 'Usá POST')

  const url = new URL(request.url)
  const token = request.headers.get('x-ingest-token') ?? url.searchParams.get('token')
  if (!token) return bad(401, 'Falta el token (header x-ingest-token o ?token=)')

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    // service_role: hace falta para resolver el token y escribir a nombre del
    // usuario salteando RLS. Nunca sale de esta función.
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )

  const { data: userId, error: tokenError } = await supabase.rpc('resolve_ingest_token', {
    raw_token: token,
  })
  if (tokenError) return bad(500, 'No pude validar el token')
  if (!userId) return bad(401, 'Token inválido o revocado')

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return bad(400, 'El cuerpo no es JSON válido')
  }

  // Se elige el parser por la forma del payload, no por un flag: así la misma
  // URL sirve para el Atajo y para Health Auto Export sin configurar nada.
  const isAutoExport = typeof body.data === 'object' && body.data !== null

  let nights: NormalizedNight[]
  if (isAutoExport) {
    const parsed = parseHealthAutoExport(body)
    if (typeof parsed === 'string') return bad(400, parsed, body)
    nights = parsed
  } else {
    const parsed = parseSimple(body)
    if (typeof parsed === 'string') return bad(400, parsed)
    nights = [parsed]
  }

  const valid = nights.filter((n) => n.asleepMinutes > 0 && n.inBedMinutes <= 1440)
  if (valid.length === 0) return bad(400, 'Ninguna noche pasó las validaciones', body)

  const { error } = await supabase.from('sleep_nights').upsert(
    valid.map((n) => ({
      user_id: userId,
      night: n.night,
      bedtime: n.bedtime.toISOString(),
      wake_time: n.wakeTime.toISOString(),
      asleep_minutes: n.asleepMinutes,
      in_bed_minutes: n.inBedMinutes,
      awake_minutes: n.awakeMinutes,
      rem_minutes: n.remMinutes,
      core_minutes: n.coreMinutes,
      deep_minutes: n.deepMinutes,
      unspecified_minutes: n.unspecifiedMinutes,
      source: 'shortcut',
      updated_at: new Date().toISOString(),
    })),
    { onConflict: 'user_id,night' },
  )

  if (error) return bad(500, error.message)

  return new Response(
    JSON.stringify({
      ok: true,
      format: isAutoExport ? 'health-auto-export' : 'simple',
      nights: valid.map((n) => ({ night: n.night, asleepMinutes: n.asleepMinutes })),
    }),
    { status: 200, headers: JSON_HEADERS },
  )
})
