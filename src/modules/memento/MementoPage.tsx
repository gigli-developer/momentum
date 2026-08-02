import { useMemo } from 'react'
import { Hourglass, Quote } from 'lucide-react'
import { PageHeader } from '@/components/layout/AppShell'
import { Card, Panel, SectionTitle } from '@/components/ui/Card'
import { Input, Label } from '@/components/ui/Input'
import { ProgressBar } from '@/components/ui/Progress'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatNumber } from '@/lib/date'
import { WEEKS_PER_YEAR, lifeProgress } from '@/lib/stats'
import { useStore } from '@/lib/store'

/** Citas de dominio público sobre el tiempo. Rota una por día. */
const QUOTES = [
  {
    text: 'No es que tengamos poco tiempo, sino que perdemos mucho.',
    author: 'Séneca',
  },
  {
    text: 'Vivís como si fueras a vivir para siempre; nunca pensás en tu fragilidad.',
    author: 'Séneca',
  },
  {
    text: 'No actúes como si tuvieras diez mil años por delante.',
    author: 'Marco Aurelio',
  },
  {
    text: 'Cada día que pasa nos pertenece un poco menos.',
    author: 'Séneca',
  },
  {
    text: 'Enseñanos a contar nuestros días para que traigamos al corazón sabiduría.',
    author: 'Salmo 90',
  },
]

const WEEKS_PER_ROW = WEEKS_PER_YEAR

export function MementoPage() {
  const profile = useStore((s) => s.profile)
  const updateProfile = useStore((s) => s.updateProfile)

  const progress = useMemo(
    () => lifeProgress(profile.birthDate, profile.lifeExpectancy),
    [profile.birthDate, profile.lifeExpectancy],
  )

  const quote = QUOTES[new Date().getDate() % QUOTES.length]

  return (
    <>
      <PageHeader
        icon={<Hourglass className="size-5" />}
        title="Memento Mori"
        description="Recordá lo que realmente importa y viví con propósito."
      />

      {!progress ? (
        <Card>
          <EmptyState
            title="Necesitamos tu fecha de nacimiento"
            description="Es el único dato que hace falta. Se guarda sólo en este navegador."
          />
          <div className="mx-auto mt-4 grid max-w-sm gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="birth">Fecha de nacimiento</Label>
              <Input
                id="birth"
                type="date"
                value={profile.birthDate}
                onChange={(e) => updateProfile({ birthDate: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="expectancy">Expectativa (años)</Label>
              <Input
                id="expectancy"
                type="number"
                min={20}
                max={120}
                value={profile.lifeExpectancy}
                onChange={(e) => updateProfile({ lifeExpectancy: Number(e.target.value) })}
              />
            </div>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4">
          <Card>
            <SectionTitle>Tu vida en semanas</SectionTitle>
            <p className="mt-2 text-2xl font-semibold tracking-tight">
              Llevás vividas {formatNumber(progress.weeksLived)} de{' '}
              {formatNumber(progress.weeksTotal)} semanas.
            </p>
            <div className="mt-4 flex items-center gap-4">
              <ProgressBar value={progress.pct} className="flex-1" size={8} />
              <span className="text-lg font-semibold tabular-nums">{progress.pct}%</span>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3">
              <Panel>
                <SectionTitle>Años vividos</SectionTitle>
                <p className="mt-1 text-xl font-semibold tabular-nums">{progress.yearsLived}</p>
              </Panel>
              <Panel>
                <SectionTitle>Semanas restantes</SectionTitle>
                <p className="mt-1 text-xl font-semibold tabular-nums">
                  {formatNumber(Math.max(0, progress.weeksTotal - progress.weeksLived))}
                </p>
              </Panel>
              <Panel>
                <SectionTitle>Veranos que quedan</SectionTitle>
                <p className="mt-1 text-xl font-semibold tabular-nums">
                  {Math.max(0, profile.lifeExpectancy - progress.yearsLived)}
                </p>
              </Panel>
            </div>
          </Card>

          <Card>
            <SectionTitle>Cada punto es una semana</SectionTitle>
            <p className="mt-1 text-xs text-ink-faint">
              Una fila por año de vida. Las llenas ya pasaron.
            </p>
            <div className="mt-4 flex flex-col gap-[3px]" aria-hidden>
              {Array.from({ length: profile.lifeExpectancy }, (_, year) => (
                <div
                  key={year}
                  className="grid gap-[3px]"
                  style={{ gridTemplateColumns: `repeat(${WEEKS_PER_ROW}, minmax(0, 1fr))` }}
                >
                  {Array.from({ length: WEEKS_PER_ROW }, (_, week) => {
                    const index = year * WEEKS_PER_ROW + week
                    const lived = index < progress.weeksLived
                    const isCurrent = index === progress.weeksLived
                    return (
                      <span
                        key={week}
                        className={
                          isCurrent
                            ? 'aspect-square rounded-[1px] bg-accent ring-2 ring-accent/40'
                            : lived
                              ? 'aspect-square rounded-[1px] bg-ramp-3'
                              : 'aspect-square rounded-[1px] bg-surface-3'
                        }
                      />
                    )
                  })}
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-ink-muted">
              El cuadrito naranja con anillo es esta semana.
            </p>
          </Card>

          <Card>
            <figure className="flex flex-col items-center gap-3 py-4 text-center">
              <Quote className="size-5 text-accent" />
              <blockquote className="max-w-lg text-lg leading-relaxed text-ink">
                {quote.text}
              </blockquote>
              <figcaption className="text-sm text-ink-muted">{quote.author}</figcaption>
            </figure>
          </Card>
        </div>
      )}
    </>
  )
}
