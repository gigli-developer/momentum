/**
 * Edge Function `google-calendar`
 *
 * Dos acciones sobre el calendario principal del usuario:
 *   · `list`   — eventos entre dos fechas
 *   · `create` — bloquear tiempo para una tarea
 *
 * Los eventos NO se guardan en Supabase: se piden a Google en el momento. Un
 * calendario cambia todo el tiempo y una copia local estaría desactualizada
 * más seguido que al día; además evita duplicar datos que ya viven en Google.
 *
 * Deploy: supabase functions deploy google-calendar
 */

import { accessTokenFor, jsonResponse, preflight, serviceClient } from '../_shared/google.ts'

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'

interface CalendarEvent {
  id: string
  summary: string
  start: string
  end: string
  allDay: boolean
  location: string | null
  link: string | null
}

/** Google devuelve `date` para eventos de día completo y `dateTime` para el resto. */
function readMoment(slot: Record<string, string> | undefined): {
  value: string
  allDay: boolean
} {
  if (slot?.dateTime) return { value: slot.dateTime, allDay: false }
  if (slot?.date) return { value: slot.date, allDay: true }
  return { value: '', allDay: false }
}

Deno.serve(async (request) => {
  const options = preflight(request)
  if (options) return options

  if (request.method !== 'POST') return jsonResponse({ error: 'Usá POST' }, 405)

  const authHeader = request.headers.get('Authorization')
  if (!authHeader) return jsonResponse({ error: 'Falta la sesión' }, 401)

  const supabase = serviceClient()
  const jwt = authHeader.replace(/^Bearer\s+/i, '')
  const { data: userData, error: userError } = await supabase.auth.getUser(jwt)
  if (userError || !userData.user) return jsonResponse({ error: 'Sesión inválida' }, 401)

  const userId = userData.user.id

  const { data: account } = await supabase
    .from('google_accounts')
    .select('refresh_token')
    .eq('user_id', userId)
    .maybeSingle()

  if (!account?.refresh_token) {
    return jsonResponse({ error: 'no_conectado' }, 409)
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ error: 'El cuerpo no es JSON válido' }, 400)
  }

  let accessToken: string
  try {
    accessToken = await accessTokenFor(supabase, String(account.refresh_token))
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Error de token'
    // Se guarda para poder mostrarlo en Ajustes: si el usuario revocó el
    // acceso desde Google, la app tiene que poder decirlo en vez de fallar
    // en silencio cada vez.
    await supabase.from('google_accounts').update({ last_error: message }).eq('user_id', userId)
    return jsonResponse({ error: 'token_invalido', detalle: message }, 401)
  }

  const authorized = { Authorization: `Bearer ${accessToken}` }

  /* --------------------------------------------------------------- listar */
  if (body.action === 'list') {
    const from = String(body.from ?? '')
    const to = String(body.to ?? '')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return jsonResponse({ error: '`from` y `to` tienen que ser YYYY-MM-DD' }, 400)
    }

    const url = new URL(CALENDAR_API)
    url.searchParams.set('timeMin', `${from}T00:00:00Z`)
    // `to` es inclusivo del lado de la app, así que se pide hasta el final.
    url.searchParams.set('timeMax', `${to}T23:59:59Z`)
    // `singleEvents` expande las series repetidas en ocurrencias sueltas; sin
    // esto una reunión semanal llegaría como un solo evento con reglas RRULE.
    url.searchParams.set('singleEvents', 'true')
    url.searchParams.set('orderBy', 'startTime')
    url.searchParams.set('maxResults', '250')

    const response = await fetch(url, { headers: authorized })
    const payload = await response.json()
    if (!response.ok) {
      return jsonResponse({ error: payload.error?.message ?? 'Error de Google' }, 502)
    }

    const events: CalendarEvent[] = (payload.items ?? [])
      .filter((item: Record<string, unknown>) => item.status !== 'cancelled')
      .map((item: Record<string, never>) => {
        const start = readMoment(item.start)
        const end = readMoment(item.end)
        return {
          id: String(item.id),
          summary: String(item.summary ?? '(sin título)'),
          start: start.value,
          end: end.value,
          allDay: start.allDay,
          location: item.location ? String(item.location) : null,
          link: item.htmlLink ? String(item.htmlLink) : null,
        }
      })

    await supabase
      .from('google_accounts')
      .update({ last_synced_at: new Date().toISOString(), last_error: null })
      .eq('user_id', userId)

    return jsonResponse({ events })
  }

  /* ---------------------------------------------------------------- crear */
  if (body.action === 'create') {
    const summary = String(body.summary ?? '').trim()
    const start = String(body.start ?? '')
    const end = String(body.end ?? '')
    if (!summary) return jsonResponse({ error: 'Falta el título' }, 400)
    if (!start || !end) return jsonResponse({ error: 'Faltan las horas' }, 400)
    if (new Date(end) <= new Date(start)) {
      return jsonResponse({ error: 'El final tiene que ser posterior al inicio' }, 400)
    }

    const response = await fetch(CALENDAR_API, {
      method: 'POST',
      headers: { ...authorized, 'content-type': 'application/json' },
      body: JSON.stringify({
        summary,
        description: body.note ? String(body.note) : undefined,
        start: { dateTime: start },
        end: { dateTime: end },
        // Marca de origen, para poder reconocer después qué creó la app.
        source: { title: 'Momentum', url: 'https://github.com/gigli-developer/momentum' },
      }),
    })

    const payload = await response.json()
    if (!response.ok) {
      return jsonResponse({ error: payload.error?.message ?? 'Error de Google' }, 502)
    }

    return jsonResponse({
      event: {
        id: payload.id,
        summary: payload.summary,
        start: payload.start?.dateTime ?? payload.start?.date,
        end: payload.end?.dateTime ?? payload.end?.date,
        link: payload.htmlLink ?? null,
      },
    })
  }

  return jsonResponse({ error: 'Acción desconocida' }, 400)
})
