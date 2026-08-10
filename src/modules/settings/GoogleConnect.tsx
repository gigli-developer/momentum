import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarCheck, ListChecks, Unplug } from 'lucide-react'
import { Panel, SectionTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'
import { useSession } from '@/lib/session'

interface GoogleAccount {
  connectedAt: string
  lastSyncedAt: string | null
  lastError: string | null
}

/** Motivos que devuelve el callback, traducidos a algo accionable. */
const REASONS: Record<string, string> = {
  access_denied: 'Cancelaste el permiso en la pantalla de Google.',
  faltan_parametros: 'Google no mandó el código de autorización.',
  state_invalido: 'El pedido venció o ya se usó. Probá conectar de nuevo.',
  sin_refresh_token:
    'Google no devolvió el token de larga duración. Revocá el acceso a la app desde tu cuenta de Google y volvé a conectar.',
  no_pude_guardar: 'No pude guardar la conexión en la base.',
}

export function GoogleConnect() {
  const session = useSession()
  const [params, setParams] = useSearchParams()
  const [account, setAccount] = useState<GoogleAccount | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from('google_accounts')
      .select('connected_at, last_synced_at, last_error')
      .maybeSingle()

    setAccount(
      data
        ? {
            connectedAt: String(data.connected_at),
            lastSyncedAt: data.last_synced_at ? String(data.last_synced_at) : null,
            lastError: data.last_error ? String(data.last_error) : null,
          }
        : null,
    )
  }, [])

  useEffect(() => {
    if (session.status === 'signed-in') void refresh()
  }, [session.status, refresh])

  // El callback de Google vuelve a /ajustes con el resultado en la query.
  useEffect(() => {
    const result = params.get('google')
    if (!result) return

    if (result === 'ok') {
      setNotice('Cuenta de Google conectada.')
      void refresh()
    } else {
      const motivo = params.get('motivo') ?? ''
      setError(REASONS[motivo] ?? `No se pudo conectar (${motivo}).`)
    }

    // Se limpian los parámetros para que recargar no repita el mensaje.
    const next = new URLSearchParams(params)
    next.delete('google')
    next.delete('motivo')
    setParams(next, { replace: true })
  }, [params, setParams, refresh])

  async function connect() {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const { data, error: fnError } = await supabase.functions.invoke('google-oauth-start', {
        method: 'POST',
      })
      if (fnError) throw new Error(fnError.message)
      if (!data?.url) throw new Error(data?.error ?? 'No recibí la URL de Google')
      window.location.href = data.url as string
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pude iniciar la conexión')
      setBusy(false)
    }
  }

  async function disconnect() {
    setBusy(true)
    setError(null)
    // Sólo borra el vínculo de este lado: las tareas y eventos en Google
    // quedan intactos.
    const { error: delError } = await supabase.from('google_accounts').delete().neq('user_id', '')
    if (delError) setError(delError.message)
    else {
      setAccount(null)
      setNotice('Cuenta desconectada. Tus tareas y eventos en Google quedaron intactos.')
    }
    setBusy(false)
  }

  return (
    <>
      <SectionTitle>Google</SectionTitle>
      <p className="mt-1 text-xs text-ink-faint">
        Traer tus tareas de Google Tasks y tus eventos de Calendar.
      </p>

      {account ? (
        <Panel className="mt-3">
          <p className="text-sm text-ink">Conectada ✓</p>
          <p className="mt-0.5 text-xs text-ink-faint">
            Desde el {new Date(account.connectedAt).toLocaleDateString('es-AR')}
            {account.lastSyncedAt
              ? ` · última sincronización ${new Date(account.lastSyncedAt).toLocaleString('es-AR')}`
              : ' · todavía sin sincronizar'}
          </p>
          {account.lastError ? (
            <p className="mt-2 text-xs text-negative">{account.lastError}</p>
          ) : null}
          <Button className="mt-3" variant="danger" disabled={busy} onClick={() => void disconnect()}>
            <Unplug className="size-4" /> Desconectar
          </Button>
        </Panel>
      ) : (
        <>
          <ul className="mt-3 flex flex-col gap-1.5">
            <li className="flex items-center gap-2 text-xs text-ink-muted">
              <ListChecks className="size-3.5 shrink-0 text-accent" />
              Tus tareas con fecha aparecen en el planificador
            </li>
            <li className="flex items-center gap-2 text-xs text-ink-muted">
              <CalendarCheck className="size-3.5 shrink-0 text-accent" />
              Tus eventos del día, junto a tus tareas
            </li>
          </ul>
          <Button
            className="mt-3"
            variant="primary"
            disabled={busy}
            onClick={() => void connect()}
          >
            {busy ? 'Abriendo Google…' : 'Conectar Google'}
          </Button>
          <p className="mt-2 text-[11px] leading-snug text-ink-faint">
            Google va a avisarte que la app no está verificada. Es tuya y corre en tu cuenta: tocá
            <strong className="text-ink-muted"> Configuración avanzada → Ir a Momentum</strong>.
          </p>
        </>
      )}

      {notice ? <p className="mt-3 text-sm text-positive">{notice}</p> : null}
      {error ? <p className="mt-3 text-sm text-negative">{error}</p> : null}
    </>
  )
}
