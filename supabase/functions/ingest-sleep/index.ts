/**
 * Edge Function `ingest-sleep`
 *
 * Recibe el sueño de una noche desde el Atajo de iOS y lo guarda.
 *
 * Autenticación: header `x-ingest-token` con el token generado desde la app.
 * No usa JWT porque un Atajo no puede renovar sesiones de Supabase.
 *
 * Es idempotente sobre (user_id, night): si el Atajo corre dos veces el mismo
 * día, la segunda pisa a la primera en vez de duplicar.
 *
 * Deploy:
 *   supabase functions deploy ingest-sleep --no-verify-jwt
 *
 * `--no-verify-jwt` es necesario y correcto acá: la función hace su propia
 * validación con el token. Sin ese flag, Supabase rechazaría el request antes
 * de que nuestro código lo vea.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2'

interface SleepPayload {
  /** `YYYY-MM-DD` — la mañana en que te despertaste. */
  night: string
  /** ISO 8601 con offset, tal como lo manda el Atajo. */
  bedtime: string
  wakeTime: string
  asleepMinutes: number
  inBedMinutes?: number
  awakeMinutes?: number
  remMinutes?: number
  coreMinutes?: number
  deepMinutes?: number
  unspecifiedMinutes?: number
}

const JSON_HEADERS = { 'content-type': 'application/json' }

function bad(status: number, message: string): Response {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: JSON_HEADERS,
  })
}

function minutes(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.round(n)
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return bad(405, 'Usá POST')

  const token = request.headers.get('x-ingest-token')
  if (!token) return bad(401, 'Falta el header x-ingest-token')

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    // service_role: la función necesita saltear RLS para resolver el token y
    // escribir a nombre del usuario. Nunca sale de acá.
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )

  const { data: userId, error: tokenError } = await supabase.rpc('resolve_ingest_token', {
    raw_token: token,
  })

  if (tokenError) return bad(500, 'No pude validar el token')
  if (!userId) return bad(401, 'Token inválido o revocado')

  let payload: SleepPayload
  try {
    payload = await request.json()
  } catch {
    return bad(400, 'El cuerpo no es JSON válido')
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.night ?? '')) {
    return bad(400, '`night` tiene que ser YYYY-MM-DD')
  }

  const bedtime = new Date(payload.bedtime)
  const wakeTime = new Date(payload.wakeTime)
  if (Number.isNaN(bedtime.getTime()) || Number.isNaN(wakeTime.getTime())) {
    return bad(400, '`bedtime` y `wakeTime` tienen que ser fechas ISO')
  }
  if (wakeTime <= bedtime) return bad(400, 'Te levantaste antes de acostarte')

  const inBed =
    payload.inBedMinutes !== undefined
      ? minutes(payload.inBedMinutes)
      : Math.round((wakeTime.getTime() - bedtime.getTime()) / 60_000)

  if (inBed > 1440) return bad(400, 'La noche dura más de 24 horas')

  const asleep = minutes(payload.asleepMinutes)
  if (asleep === 0) return bad(400, '`asleepMinutes` tiene que ser mayor a 0')

  const { error } = await supabase.from('sleep_nights').upsert(
    {
      user_id: userId,
      night: payload.night,
      bedtime: bedtime.toISOString(),
      wake_time: wakeTime.toISOString(),
      asleep_minutes: asleep,
      in_bed_minutes: inBed,
      awake_minutes: minutes(payload.awakeMinutes),
      rem_minutes: minutes(payload.remMinutes),
      core_minutes: minutes(payload.coreMinutes),
      deep_minutes: minutes(payload.deepMinutes),
      unspecified_minutes: minutes(payload.unspecifiedMinutes),
      source: 'shortcut',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,night' },
  )

  if (error) return bad(500, error.message)

  return new Response(
    JSON.stringify({ ok: true, night: payload.night, asleepMinutes: asleep }),
    { status: 200, headers: JSON_HEADERS },
  )
})
