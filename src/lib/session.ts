import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isRemoteConfigured, supabase } from './supabase'

export type SessionState =
  | { status: 'loading' }
  | { status: 'unconfigured' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; userId: string; email: string }

/**
 * Estado de sesión de Supabase.
 *
 * `onAuthStateChange` cubre también el refresco del token y el cierre de sesión
 * desde otra pestaña: sin eso, una pestaña vieja seguiría mostrando datos con
 * una sesión que ya no existe.
 */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>(() =>
    isRemoteConfigured ? { status: 'loading' } : { status: 'unconfigured' },
  )

  useEffect(() => {
    if (!isRemoteConfigured) return

    const toState = (session: Session | null): SessionState =>
      session?.user
        ? { status: 'signed-in', userId: session.user.id, email: session.user.email ?? '' }
        : { status: 'signed-out' }

    supabase.auth.getSession().then(({ data }) => setState(toState(data.session)))

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setState(toState(session))
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  return state
}

export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error(translateAuthError(error.message))
}

export async function signUp(email: string, password: string, name: string) {
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  })
  if (error) throw new Error(translateAuthError(error.message))
}

export async function signOut() {
  await supabase.auth.signOut()
}

/** Los mensajes de Supabase vienen en inglés y son crípticos. */
function translateAuthError(message: string): string {
  const lower = message.toLowerCase()
  if (lower.includes('invalid login credentials')) return 'Email o contraseña incorrectos.'
  if (lower.includes('email not confirmed')) {
    return 'Todavía no confirmaste el email. Revisá tu casilla.'
  }
  if (lower.includes('user already registered')) return 'Ese email ya tiene una cuenta.'
  if (lower.includes('password should be at least')) {
    return 'La contraseña tiene que tener al menos 6 caracteres.'
  }
  if (lower.includes('signups not allowed')) {
    return 'El registro está cerrado en este proyecto.'
  }
  return message
}
