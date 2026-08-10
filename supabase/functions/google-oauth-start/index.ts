/**
 * Edge Function `google-oauth-start`
 *
 * Devuelve la URL de consentimiento de Google para el usuario logueado.
 *
 * La arma el servidor y no el cliente porque el `state` tiene que ser un nonce
 * guardado de este lado: si el user_id viajara en claro, cualquiera podría
 * fabricar un callback y colgar su cuenta de Google a otro usuario.
 *
 * Deploy: supabase functions deploy google-oauth-start
 */

import { GOOGLE_SCOPES, getSecret, jsonResponse, serviceClient } from '../_shared/google.ts'

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'

Deno.serve(async (request) => {
  if (request.method !== 'POST') return jsonResponse({ error: 'Usá POST' }, 405)

  const authHeader = request.headers.get('Authorization')
  if (!authHeader) return jsonResponse({ error: 'Falta la sesión' }, 401)

  const supabase = serviceClient()

  const jwt = authHeader.replace(/^Bearer\s+/i, '')
  const { data: userData, error: userError } = await supabase.auth.getUser(jwt)
  if (userError || !userData.user) return jsonResponse({ error: 'Sesión inválida' }, 401)

  const userId = userData.user.id

  try {
    const clientId = await getSecret(supabase, 'GOOGLE_CLIENT_ID')
    const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/google-oauth-callback`

    await supabase.rpc('purge_stale_oauth_states')

    const state = crypto.randomUUID()
    const { error } = await supabase
      .from('google_oauth_states')
      .insert({ state, user_id: userId })
    if (error) return jsonResponse({ error: error.message }, 500)

    const url = new URL(AUTH_ENDPOINT)
    url.searchParams.set('client_id', clientId)
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('scope', GOOGLE_SCOPES)
    // `offline` es lo que hace que Google mande un refresh token; sin esto sólo
    // llega un access token de una hora y la sincronización moriría enseguida.
    url.searchParams.set('access_type', 'offline')
    // Google sólo devuelve el refresh token la PRIMERA vez que consentís.
    // `consent` fuerza la pantalla siempre, así reconectar vuelve a darlo.
    url.searchParams.set('prompt', 'consent')
    url.searchParams.set('state', state)

    return jsonResponse({ url: url.toString() })
  } catch (cause) {
    return jsonResponse({ error: cause instanceof Error ? cause.message : 'Error' }, 500)
  }
})
