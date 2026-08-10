/**
 * Edge Function `google-oauth-callback`
 *
 * Recibe el redirect de Google, canjea el código por un refresh token y lo
 * guarda. Después manda al usuario de vuelta a la app.
 *
 * Se despliega con --no-verify-jwt: quien llega acá es el navegador viniendo
 * de Google, sin la sesión de Supabase en los headers. La identidad se
 * resuelve por el nonce del `state`, no por JWT.
 *
 * Deploy: supabase functions deploy google-oauth-callback --no-verify-jwt
 */

import { TOKEN_ENDPOINT, getSecret, serviceClient } from '../_shared/google.ts'

const DEFAULT_APP_URL = 'http://localhost:5173'

function backToApp(appUrl: string, params: Record<string, string>): Response {
  const url = new URL(appUrl)
  // HashRouter: los parámetros van dentro del hash para que la app los lea.
  url.hash = `/ajustes?${new URLSearchParams(params).toString()}`
  return new Response(null, { status: 302, headers: { Location: url.toString() } })
}

Deno.serve(async (request) => {
  const supabase = serviceClient()
  const appUrl = (await getSecret(supabase, 'APP_URL').catch(() => DEFAULT_APP_URL)) ?? DEFAULT_APP_URL

  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const denied = url.searchParams.get('error')

  if (denied) return backToApp(appUrl, { google: 'error', motivo: denied })
  if (!code || !state) return backToApp(appUrl, { google: 'error', motivo: 'faltan_parametros' })

  // El nonce se consume: un `state` sólo sirve una vez.
  const { data: stateRow, error: stateError } = await supabase
    .from('google_oauth_states')
    .delete()
    .eq('state', state)
    .select('user_id')
    .maybeSingle()

  if (stateError || !stateRow) {
    return backToApp(appUrl, { google: 'error', motivo: 'state_invalido' })
  }

  try {
    const clientId = await getSecret(supabase, 'GOOGLE_CLIENT_ID')
    const clientSecret = await getSecret(supabase, 'GOOGLE_CLIENT_SECRET')
    const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/google-oauth-callback`

    const response = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })

    const payload = await response.json()
    if (!response.ok || !payload.refresh_token) {
      // Sin refresh token no se puede sincronizar en segundo plano: pasa si el
      // usuario ya había consentido y Google no lo reenvía.
      return backToApp(appUrl, {
        google: 'error',
        motivo: payload.error ?? 'sin_refresh_token',
      })
    }

    const { error } = await supabase.from('google_accounts').upsert({
      user_id: stateRow.user_id,
      refresh_token: payload.refresh_token,
      connected_at: new Date().toISOString(),
      last_error: null,
    })
    if (error) return backToApp(appUrl, { google: 'error', motivo: 'no_pude_guardar' })

    return backToApp(appUrl, { google: 'ok' })
  } catch (cause) {
    return backToApp(appUrl, {
      google: 'error',
      motivo: cause instanceof Error ? cause.message : 'desconocido',
    })
  }
})
