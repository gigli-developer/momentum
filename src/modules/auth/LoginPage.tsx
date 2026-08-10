import { useState, type FormEvent } from 'react'
import { Zap } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input, Label } from '@/components/ui/Input'
import { signIn, signUp } from '@/lib/session'

type Mode = 'signin' | 'signup'

export function LoginPage() {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setNotice(null)
    setBusy(true)
    try {
      if (mode === 'signin') {
        await signIn(email, password)
      } else {
        await signUp(email, password, name)
        // Si el proyecto pide confirmación por mail, no hay sesión todavía.
        setNotice('Cuenta creada. Si te pide confirmar el email, revisá tu casilla.')
        setMode('signin')
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Algo falló.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-tile bg-accent text-accent-ink">
            <Zap className="size-5 fill-current" />
          </span>
          <span className="text-lg font-semibold tracking-tight">Momentum</span>
        </div>

        <h1 className="text-2xl font-semibold tracking-tight">
          {mode === 'signin' ? 'Entrá a lo tuyo' : 'Creá tu cuenta'}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {mode === 'signin'
            ? 'Tus hábitos, tu journal y tus objetivos.'
            : 'Una sola vez, y después andás siempre logueado.'}
        </p>

        <form onSubmit={submit} className="mt-6 grid gap-3">
          {mode === 'signup' ? (
            <div>
              <Label htmlFor="name">Cómo te llamás</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Lucas"
                autoComplete="name"
              />
            </div>
          ) : null}

          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          <div>
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            />
          </div>

          {error ? <p className="text-sm text-negative">{error}</p> : null}
          {notice ? <p className="text-sm text-positive">{notice}</p> : null}

          <Button type="submit" variant="primary" size="lg" disabled={busy} className="mt-1 w-full">
            {busy ? 'Un segundo…' : mode === 'signin' ? 'Entrar' : 'Crear cuenta'}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin')
            setError(null)
            setNotice(null)
          }}
          className="mt-4 text-sm text-ink-muted underline-offset-4 hover:text-accent hover:underline"
        >
          {mode === 'signin' ? '¿No tenés cuenta? Creala' : 'Ya tengo cuenta'}
        </button>
      </div>
    </div>
  )
}
