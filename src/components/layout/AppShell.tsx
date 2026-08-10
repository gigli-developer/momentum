import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Cloud, CloudOff, LogOut, Menu, X, Zap } from 'lucide-react'
import { cn } from '@/lib/cn'
import { MODULES } from '@/modules/registry'
import { IconButton } from '@/components/ui/Button'
import { useSyncStatus } from '@/lib/remote/connect'
import { signOut, useSession } from '@/lib/session'
import { isRemoteConfigured } from '@/lib/supabase'

/** Pie de la barra lateral: dónde se están guardando los datos y de quién son. */
function SyncFooter() {
  const status = useSyncStatus()
  const session = useSession()

  if (!isRemoteConfigured) {
    return (
      <p className="px-3 text-[11px] leading-relaxed text-ink-faint">
        Sin conexión a Supabase: los datos se guardan sólo en este navegador.
      </p>
    )
  }

  return (
    <div className="px-3">
      <div className="flex items-center gap-2 text-[11px]">
        {status.state === 'error' ? (
          <>
            <CloudOff className="size-3.5 shrink-0 text-negative" />
            <span className="text-negative">Sin guardar</span>
          </>
        ) : (
          <>
            <Cloud
              className={cn(
                'size-3.5 shrink-0',
                status.state === 'saving' ? 'text-accent' : 'text-ink-faint',
              )}
            />
            <span className="text-ink-faint">
              {status.state === 'saving' ? 'Guardando…' : 'Todo guardado'}
            </span>
          </>
        )}
      </div>

      {status.state === 'error' && status.message ? (
        <p className="mt-1 text-[11px] leading-snug text-negative/80">{status.message}</p>
      ) : null}

      {session.status === 'signed-in' ? (
        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-2 flex items-center gap-1.5 text-[11px] text-ink-faint transition-colors hover:text-ink"
        >
          <LogOut className="size-3" />
          <span className="truncate">{session.email}</span>
        </button>
      ) : null}
    </div>
  )
}

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-0.5">
      {MODULES.map(({ id, path, title, Icon }) => (
        <NavLink
          key={id}
          to={path}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-tile px-3 py-2 text-sm transition-colors',
              isActive
                ? 'bg-accent/12 font-medium text-accent'
                : 'text-ink-muted hover:bg-surface-2 hover:text-ink',
            )
          }
        >
          <Icon className="size-4 shrink-0" />
          <span className="truncate">{title}</span>
        </NavLink>
      ))}
    </nav>
  )
}

function Brand() {
  return (
    <NavLink to="/" className="flex items-center gap-2.5 px-3 py-1">
      <span className="grid size-8 place-items-center rounded-tile bg-accent text-accent-ink">
        <Zap className="size-4 fill-current" />
      </span>
      <span className="text-[15px] font-semibold tracking-tight">Momentum</span>
    </NavLink>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const location = useLocation()

  // Cerrar el menú móvil al cambiar de ruta.
  useEffect(() => setOpen(false), [location.pathname])

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      {/* Sidebar de escritorio */}
      <aside className="sticky top-0 hidden h-screen flex-col gap-6 border-r border-line bg-surface/50 px-3 py-5 lg:flex">
        <Brand />
        <div className="min-h-0 flex-1 overflow-y-auto">
          <NavItems />
        </div>
        <SyncFooter />
      </aside>

      {/* Barra superior en mobile */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-bg/90 px-3 py-2.5 backdrop-blur lg:hidden">
        <Brand />
        <IconButton label={open ? 'Cerrar menú' : 'Abrir menú'} onClick={() => setOpen((v) => !v)}>
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </IconButton>
      </header>

      {open ? (
        <div className="fixed inset-0 top-[57px] z-20 overflow-y-auto bg-bg px-3 py-4 lg:hidden">
          <NavItems onNavigate={() => setOpen(false)} />
        </div>
      ) : null}

      <main className="min-w-0 px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto w-full max-w-5xl">{children}</div>
      </main>
    </div>
  )
}

interface PageHeaderProps {
  title: string
  description?: string
  icon?: React.ReactNode
  action?: React.ReactNode
}

export function PageHeader({ title, description, icon, action }: PageHeaderProps) {
  return (
    <header className="mb-6 flex items-start gap-4">
      {icon ? (
        <span className="inline-grid size-12 shrink-0 place-items-center rounded-tile border border-accent/45 bg-accent/10 text-accent">
          {icon}
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <h1 className="text-xl font-semibold tracking-tight md:text-2xl">{title}</h1>
        {description ? <p className="mt-1 text-sm text-ink-muted">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  )
}
