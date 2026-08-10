import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { DashboardPage } from '@/modules/dashboard/DashboardPage'
import { HabitsPage } from '@/modules/habits/HabitsPage'
import { RitualPage } from '@/modules/ritual/RitualPage'
import { PlannerPage } from '@/modules/planner/PlannerPage'
import { JournalPage } from '@/modules/journal/JournalPage'
import { SleepPage } from '@/modules/sleep/SleepPage'
import { GoalsPage } from '@/modules/goals/GoalsPage'
import { WheelPage } from '@/modules/wheel/WheelPage'
import { StatsPage } from '@/modules/stats/StatsPage'
import { MementoPage } from '@/modules/memento/MementoPage'
import { SettingsPage } from '@/modules/settings/SettingsPage'
import { LoginPage } from '@/modules/auth/LoginPage'
import { useSession } from '@/lib/session'
import { clearStore, connectStore } from '@/lib/remote/connect'

function Routed() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/habitos" element={<HabitsPage />} />
        <Route path="/ritual" element={<RitualPage />} />
        <Route path="/semana" element={<PlannerPage />} />
        <Route path="/journal" element={<JournalPage />} />
        <Route path="/sueno" element={<SleepPage />} />
        <Route path="/objetivos" element={<GoalsPage />} />
        <Route path="/rueda" element={<WheelPage />} />
        <Route path="/estadisticas" element={<StatsPage />} />
        <Route path="/memento" element={<MementoPage />} />
        <Route path="/ajustes" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  )
}

function Splash({ message }: { message: string }) {
  return (
    <div className="grid min-h-screen place-items-center px-4 text-center">
      <div>
        <div className="mx-auto mb-4 size-8 animate-spin rounded-full border-2 border-line border-t-accent" />
        <p className="text-sm text-ink-muted">{message}</p>
      </div>
    </div>
  )
}

export default function App() {
  const session = useSession()
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const userId = session.status === 'signed-in' ? session.userId : null

  useEffect(() => {
    if (!userId) {
      clearStore()
      return
    }

    let disconnect: (() => void) | null = null
    let cancelled = false

    setLoading(true)
    setLoadError(null)

    connectStore(userId)
      .then((stop) => {
        // Si el usuario cerró sesión mientras cargaba, se desconecta enseguida.
        if (cancelled) stop()
        else disconnect = stop
      })
      .catch((cause) => {
        if (!cancelled) {
          setLoadError(cause instanceof Error ? cause.message : 'No pude traer tus datos.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
      disconnect?.()
    }
  }, [userId])

  if (session.status === 'loading') return <Splash message="Buscando tu sesión…" />

  // Sin credenciales de Supabase la app corre igual, contra el navegador.
  if (session.status === 'unconfigured') return <Routed />

  if (session.status === 'signed-out') return <LoginPage />

  if (loadError) {
    return (
      <div className="grid min-h-screen place-items-center px-4 text-center">
        <div className="max-w-sm">
          <p className="text-sm font-medium text-negative">No pude traer tus datos</p>
          <p className="mt-1 text-sm text-ink-muted">{loadError}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded-tile bg-accent px-4 py-2 text-sm font-semibold text-accent-ink"
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  if (loading) return <Splash message="Trayendo tus datos…" />

  return <Routed />
}
