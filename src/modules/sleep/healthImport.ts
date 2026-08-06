import { addDays, subDays } from 'date-fns'
import { toISO } from '@/lib/date'
import type { SleepNight, SleepStages } from '@/lib/types'

/**
 * Importador del export de la app Salud de iOS.
 *
 * El archivo (`export.xml`) suele pesar cientos de MB porque trae TODO el
 * historial de salud, así que no se puede parsear con DOMParser ni leer entero
 * en memoria: se lee por chunks y se extraen sólo los registros de sueño.
 *
 * Los registros vienen así, uno por línea:
 *   <Record type="HKCategoryTypeIdentifierSleepAnalysis"
 *           value="HKCategoryValueSleepAnalysisAsleepDeep"
 *           startDate="2026-08-03 01:12:00 -0300"
 *           endDate="2026-08-03 01:47:00 -0300" .../>
 *
 * Cada noche llega partida en decenas de segmentos (uno por cambio de fase),
 * así que hay que agruparlos y sumarlos.
 */

const RECORD_RE =
  /<Record[^>]*?type="HKCategoryTypeIdentifierSleepAnalysis"[^>]*?value="([^"]+)"[^>]*?startDate="([^"]+)"[^>]*?endDate="([^"]+)"/g

/** Formato de Apple: `2026-08-03 01:12:00 -0300`. */
function parseAppleDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2}) ([+-]\d{4})$/.exec(value.trim())
  if (!match) return null
  const [, y, mo, d, h, mi, s, tz] = match
  const iso = `${y}-${mo}-${d}T${h}:${mi}:${s}${tz.slice(0, 3)}:${tz.slice(3)}`
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? null : date
}

type StageKey = keyof SleepStages

/** `InBed` se ignora: marca tiempo en cama, no una fase de sueño. */
function stageOf(value: string): StageKey | null {
  if (value.endsWith('AsleepDeep')) return 'deep'
  if (value.endsWith('AsleepREM')) return 'rem'
  if (value.endsWith('AsleepCore')) return 'core'
  if (value.endsWith('Awake')) return 'awake'
  // Registros viejos y los del iPhone sin Watch: sólo dicen "Asleep".
  if (value.endsWith('Asleep') || value.endsWith('AsleepUnspecified')) return 'unspecified'
  return null
}

interface Segment {
  start: Date
  end: Date
  stage: StageKey
}

/**
 * A qué noche pertenece un segmento. Todo lo que ocurre antes del mediodía
 * cuenta para el día en que amanece; lo que ocurre después, para el día
 * siguiente. Es el corte que usa el propio Apple Watch.
 */
function nightOf(start: Date): string {
  return start.getHours() >= 12 ? toISO(addDays(start, 1)) : toISO(start)
}

export interface ImportProgress {
  bytesRead: number
  totalBytes: number
  segments: number
}

export interface ImportResult {
  nights: SleepNight[]
  segments: number
  /** Segmentos con fecha ilegible, que se descartaron. */
  skipped: number
}

/**
 * Lee el archivo en chunks de 4 MB. Se conserva la cola de cada chunk porque un
 * `<Record .../>` puede quedar cortado justo en el límite.
 */
export async function importAppleHealthSleep(
  file: File,
  onProgress?: (progress: ImportProgress) => void,
  signal?: AbortSignal,
): Promise<ImportResult> {
  const CHUNK = 4 * 1024 * 1024
  const decoder = new TextDecoder('utf-8')

  const segments: Segment[] = []
  let carry = ''
  let offset = 0
  let skipped = 0

  while (offset < file.size) {
    if (signal?.aborted) throw new DOMException('Importación cancelada', 'AbortError')

    const slice = file.slice(offset, offset + CHUNK)
    const text = carry + decoder.decode(await slice.arrayBuffer(), { stream: true })

    RECORD_RE.lastIndex = 0
    let match: RegExpExecArray | null
    let lastEnd = 0
    while ((match = RECORD_RE.exec(text)) !== null) {
      lastEnd = match.index + match[0].length
      const stage = stageOf(match[1])
      if (!stage) continue
      const start = parseAppleDate(match[2])
      const end = parseAppleDate(match[3])
      if (!start || !end || end <= start) {
        skipped++
        continue
      }
      segments.push({ start, end, stage })
    }

    // Guardamos lo que quedó después del último match completo, por si hay un
    // registro cortado al medio.
    carry = text.slice(Math.max(lastEnd, text.length - 4096))
    offset += CHUNK
    onProgress?.({ bytesRead: Math.min(offset, file.size), totalBytes: file.size, segments: segments.length })
  }

  return { nights: groupIntoNights(segments), segments: segments.length, skipped }
}

function emptyStages(): SleepStages {
  return { awake: 0, rem: 0, core: 0, deep: 0, unspecified: 0 }
}

/** Agrupa segmentos por noche y suma minutos por fase. */
export function groupIntoNights(segments: Segment[]): SleepNight[] {
  const byNight = new Map<string, Segment[]>()
  for (const segment of segments) {
    const key = nightOf(segment.start)
    const bucket = byNight.get(key)
    if (bucket) bucket.push(segment)
    else byNight.set(key, [segment])
  }

  const nights: SleepNight[] = []

  for (const [date, list] of byNight) {
    list.sort((a, b) => a.start.getTime() - b.start.getTime())

    const stages = emptyStages()
    for (const segment of list) {
      const minutes = (segment.end.getTime() - segment.start.getTime()) / 60_000
      stages[segment.stage] += minutes
    }

    for (const key of Object.keys(stages) as StageKey[]) {
      stages[key] = Math.round(stages[key])
    }

    const asleepMinutes = stages.rem + stages.core + stages.deep + stages.unspecified
    // Noches con menos de 30 minutos son siestas o ruido del sensor.
    if (asleepMinutes < 30) continue

    const bedtime = list[0].start
    const wakeTime = list.reduce((latest, s) => (s.end > latest ? s.end : latest), list[0].end)

    nights.push({
      date,
      bedtime: bedtime.toISOString(),
      wakeTime: wakeTime.toISOString(),
      asleepMinutes,
      inBedMinutes: Math.round((wakeTime.getTime() - bedtime.getTime()) / 60_000),
      stages,
      source: 'import',
      updatedAt: new Date().toISOString(),
    })
  }

  return nights.sort((a, b) => a.date.localeCompare(b.date))
}

/** Noche vacía para la carga manual, con los valores de la noche pasada. */
export function blankNight(date: string): SleepNight {
  const wake = new Date(`${date}T07:00:00`)
  const bed = subDays(new Date(`${date}T23:00:00`), 1)
  return {
    date,
    bedtime: bed.toISOString(),
    wakeTime: wake.toISOString(),
    asleepMinutes: 480,
    inBedMinutes: 480,
    stages: emptyStages(),
    source: 'manual',
    updatedAt: new Date().toISOString(),
  }
}
