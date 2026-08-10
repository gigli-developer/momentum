import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'

/**
 * Piezas compartidas por las funciones de Google (OAuth y sincronización).
 */

export function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )
}

/**
 * Lee un secreto. Primero de las variables de entorno —que es donde deberían
 * vivir— y si no está, de `app_secrets`. Ese fallback existe porque los
 * secretos de Supabase sólo se pueden cargar desde el panel o la CLI.
 */
export async function getSecret(supabase: SupabaseClient, key: string): Promise<string> {
  const fromEnv = Deno.env.get(key)
  if (fromEnv) return fromEnv

  const { data, error } = await supabase
    .from('app_secrets')
    .select('value')
    .eq('key', key)
    .maybeSingle()

  if (error) throw new Error(`No pude leer el secreto ${key}: ${error.message}`)
  if (!data?.value) throw new Error(`Falta el secreto ${key}`)
  return data.value
}

/**
 * Permisos que se le piden a Google.
 *
 * `tasks` para leer y tildar tareas. `calendar.events` cubre leer y crear
 * eventos: pedir sólo lectura ahorraría permisos hoy, pero obligaría a
 * reconsentir el día que quieras que la app cree algo en el calendario.
 */
export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/tasks',
  'https://www.googleapis.com/auth/calendar.events',
].join(' ')

export const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'

/**
 * Cambia el refresh token por un access token de corta duración.
 * Los access token duran una hora, así que se pide uno nuevo en cada sync en
 * vez de guardarlo.
 */
export async function accessTokenFor(
  supabase: SupabaseClient,
  refreshToken: string,
): Promise<string> {
  const clientId = await getSecret(supabase, 'GOOGLE_CLIENT_ID')
  const clientSecret = await getSecret(supabase, 'GOOGLE_CLIENT_SECRET')

  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  const payload = await response.json()
  if (!response.ok || !payload.access_token) {
    // `invalid_grant` significa que el usuario revocó el acceso o que el token
    // venció por tener la app en modo "Prueba" en Google Cloud.
    throw new Error(payload.error_description ?? payload.error ?? 'No pude renovar el token')
  }
  return payload.access_token as string
}

/**
 * Cabeceras CORS.
 *
 * Sin esto el navegador ni siquiera manda el request: el preflight OPTIONS
 * falla y todo lo demás es invisible. Hace falta en cualquier función que se
 * llame desde el cliente.
 *
 * `apikey` y `x-client-info` van en la lista porque el SDK de Supabase las
 * agrega solo; si no están permitidas, el preflight se rechaza igual.
 */
export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-ingest-token',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

export const JSON_HEADERS = { ...CORS_HEADERS, 'content-type': 'application/json' }

/** Responde el preflight. Devuelve `null` si el request no es OPTIONS. */
export function preflight(request: Request): Response | null {
  if (request.method !== 'OPTIONS') return null
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })
}
