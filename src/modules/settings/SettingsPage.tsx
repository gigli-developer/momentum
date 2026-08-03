import { useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Download, Settings, Trash2, Upload } from 'lucide-react'
import { PageHeader } from '@/components/layout/AppShell'
import { Card, Panel, SectionTitle } from '@/components/ui/Card'
import { Button, IconButton } from '@/components/ui/Button'
import { InlineAdd, Input, Label, Textarea } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { downloadBackup } from '@/lib/storage'
import { snapshot, useStore } from '@/lib/store'
import type { AppData } from '@/lib/types'

const PILLAR_EMOJI = ['🎯', '💪', '🤝', '🧠', '🌱', '💰']

export function SettingsPage() {
  const data = useStore(useShallow(snapshot))
  const updateProfile = useStore((s) => s.updateProfile)
  const pillars = useStore((s) => s.pillars)
  const addPillar = useStore((s) => s.addPillar)
  const removePillar = useStore((s) => s.removePillar)
  const projects = useStore((s) => s.projects)
  const addProject = useStore((s) => s.addProject)
  const removeProject = useStore((s) => s.removeProject)
  const replaceAll = useStore((s) => s.replaceAll)
  const resetToSeed = useStore((s) => s.resetToSeed)
  const resetToEmpty = useStore((s) => s.resetToEmpty)

  const [confirm, setConfirm] = useState<'seed' | 'empty' | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  async function onImport(file: File) {
    setImportError(null)
    try {
      const parsed = JSON.parse(await file.text()) as AppData
      if (!parsed || !Array.isArray(parsed.habits) || typeof parsed.profile !== 'object') {
        throw new Error('formato')
      }
      replaceAll(parsed)
    } catch {
      setImportError('El archivo no tiene el formato de un backup de Momentum.')
    }
  }

  return (
    <>
      <PageHeader
        icon={<Settings className="size-5" />}
        title="Ajustes"
        description="Perfil, pilares, proyectos y tus datos."
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <SectionTitle>Perfil</SectionTitle>
          <div className="mt-3 grid gap-3">
            <div>
              <Label htmlFor="name">Cómo te llamás</Label>
              <Input
                id="name"
                value={data.profile.name}
                onChange={(e) => updateProfile({ name: e.target.value })}
                placeholder="Tu nombre"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="birth">Fecha de nacimiento</Label>
                <Input
                  id="birth"
                  type="date"
                  value={data.profile.birthDate}
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
                  value={data.profile.lifeExpectancy}
                  onChange={(e) => updateProfile({ lifeExpectancy: Number(e.target.value) })}
                />
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <SectionTitle>Pilares</SectionTitle>
          <p className="mt-1 text-xs text-ink-faint">
            Las 3 o 4 áreas que sostienen tu vida. Aparecen en el ritual matutino.
          </p>
          <ul className="mt-3 flex flex-col gap-1.5">
            {pillars.map((p) => (
              <li
                key={p.id}
                className="group flex items-center gap-2 rounded-tile bg-surface-2 px-3 py-2 text-sm"
              >
                <span aria-hidden>{p.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-ink">{p.name}</p>
                  <p className="truncate text-xs text-ink-faint">{p.description}</p>
                </div>
                <IconButton
                  label={`Eliminar ${p.name}`}
                  className="opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={() => removePillar(p.id)}
                >
                  <Trash2 className="size-3.5" />
                </IconButton>
              </li>
            ))}
          </ul>
          <InlineAdd
            className="mt-3"
            placeholder="Nuevo pilar"
            onAdd={(name) =>
              addPillar({
                name,
                emoji: PILLAR_EMOJI[pillars.length % PILLAR_EMOJI.length],
                description: 'Definí qué significa este pilar para vos.',
              })
            }
          />
        </Card>

        <Card>
          <SectionTitle>Proyectos</SectionTitle>
          <p className="mt-1 text-xs text-ink-faint">
            Los frentes abiertos que elegís cada mañana en el ritual.
          </p>
          <ul className="mt-3 flex flex-col gap-1.5">
            {projects.map((p) => (
              <li
                key={p.id}
                className="group flex items-center gap-2 rounded-tile bg-surface-2 px-3 py-2 text-sm"
              >
                <span aria-hidden>{p.emoji}</span>
                <span className="min-w-0 flex-1 truncate text-ink">{p.name}</span>
                <IconButton
                  label={`Eliminar ${p.name}`}
                  className="opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={() => removeProject(p.id)}
                >
                  <Trash2 className="size-3.5" />
                </IconButton>
              </li>
            ))}
          </ul>
          <InlineAdd
            className="mt-3"
            placeholder="Nuevo proyecto"
            onAdd={(name) => addProject({ name, emoji: '📁' })}
          />
        </Card>

        <Card>
          <SectionTitle>Tus datos</SectionTitle>
          <p className="mt-1 text-xs text-ink-faint">
            Todo vive en el localStorage de este navegador. Si lo borrás, se van los datos —
            descargá un backup cada tanto.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              onClick={() =>
                downloadBackup(data, `momentum-backup-${new Date().toISOString().slice(0, 10)}.json`)
              }
            >
              <Download className="size-4" /> Exportar
            </Button>
            <Button onClick={() => fileInput.current?.click()}>
              <Upload className="size-4" /> Importar
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void onImport(file)
                e.target.value = ''
              }}
            />
          </div>

          {importError ? (
            <p className="mt-3 text-sm text-negative">{importError}</p>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => setConfirm('seed')}>
              Restaurar datos de ejemplo
            </Button>
            <Button variant="danger" onClick={() => setConfirm('empty')}>
              Empezar de cero
            </Button>
          </div>

          <Panel className="mt-4">
            <Label htmlFor="raw">Estado actual (sólo lectura)</Label>
            <Textarea
              id="raw"
              readOnly
              rows={4}
              className="font-mono text-[11px]"
              value={`${data.habits.length} hábitos · ${data.goals.length} objetivos · ${data.dreams.length} sueños · ${data.tasks.length} tareas · ${data.lifeAreas.length} áreas de la rueda`}
            />
          </Panel>
        </Card>
      </div>

      <Modal
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm === 'seed' ? 'Restaurar datos de ejemplo' : 'Empezar de cero'}
        footer={
          <>
            <Button onClick={() => setConfirm(null)}>Cancelar</Button>
            <Button
              variant={confirm === 'empty' ? 'danger' : 'primary'}
              onClick={() => {
                if (confirm === 'seed') resetToSeed()
                else resetToEmpty()
                setConfirm(null)
              }}
            >
              Sí, continuar
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-muted">
          Esto reemplaza <strong className="text-ink">todos</strong> tus datos actuales y no se
          puede deshacer. Si querés conservarlos, exportá un backup antes.
        </p>
      </Modal>
    </>
  )
}
