import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * `false` cuando falta la configuración. La app arranca igual, en modo local:
 * sin esto, clonar el repo sin `.env.local` daría una pantalla en blanco en vez
 * de un mensaje que explique qué falta.
 */
export const isRemoteConfigured = Boolean(url && anonKey)

export const supabase = createClient(url ?? 'http://localhost', anonKey ?? 'missing', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
