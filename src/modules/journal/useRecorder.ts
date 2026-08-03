import { useCallback, useEffect, useRef, useState } from 'react'

export type RecorderState =
  | 'unsupported'
  | 'idle'
  | 'requesting'
  | 'recording'
  | 'paused'
  | 'denied'
  | 'error'

export interface Recording {
  blob: Blob
  durationMs: number
  mimeType: string
}

/** Formatos en orden de preferencia. Opus da voz nítida en muy poco espacio. */
const CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/mp4',
  'audio/mpeg',
]

function pickMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null
  for (const type of CANDIDATES) {
    if (MediaRecorder.isTypeSupported(type)) return type
  }
  return ''
}

function supported(): boolean {
  return (
    typeof MediaRecorder !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia
  )
}

interface UseRecorderOptions {
  onFinish: (recording: Recording) => void | Promise<void>
}

export function useRecorder({ onFinish }: UseRecorderOptions) {
  const [state, setState] = useState<RecorderState>(() => (supported() ? 'idle' : 'unsupported'))
  const [elapsedMs, setElapsedMs] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  // El cronómetro se calcula por reloj y no acumulando ticks: si la pestaña se
  // va a segundo plano los intervalos se estrangulan y la duración quedaría corta.
  const startedAtRef = useRef(0)
  const accumulatedRef = useRef(0)
  const tickRef = useRef<number | null>(null)
  const onFinishRef = useRef(onFinish)
  onFinishRef.current = onFinish

  const stopTicking = useCallback(() => {
    if (tickRef.current !== null) {
      window.clearInterval(tickRef.current)
      tickRef.current = null
    }
  }, [])

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  // Si el usuario cambia de día o se va de la página con el micrófono abierto,
  // hay que soltarlo igual: el indicador del navegador queda encendido si no.
  useEffect(() => {
    return () => {
      stopTicking()
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
      releaseStream()
    }
  }, [releaseStream, stopTicking])

  const start = useCallback(async () => {
    if (!supported()) {
      setState('unsupported')
      return
    }
    setError(null)
    setState('requesting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      })
      streamRef.current = stream

      const mimeType = pickMimeType()
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      recorderRef.current = recorder
      chunksRef.current = []
      accumulatedRef.current = 0

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }

      recorder.onstop = () => {
        stopTicking()
        const type = recorder.mimeType || mimeType || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type })
        const durationMs = accumulatedRef.current + (Date.now() - startedAtRef.current)
        chunksRef.current = []
        releaseStream()
        setState('idle')
        setElapsedMs(0)
        // Un blob vacío pasa si se corta la grabación al instante: no lo guardamos.
        if (blob.size > 0) void onFinishRef.current({ blob, durationMs, mimeType: type })
      }

      recorder.onerror = () => {
        stopTicking()
        releaseStream()
        setError('Se cortó la grabación. Probá de nuevo.')
        setState('error')
      }

      recorder.start(1000)
      startedAtRef.current = Date.now()
      setElapsedMs(0)
      setState('recording')
      tickRef.current = window.setInterval(() => {
        setElapsedMs(accumulatedRef.current + (Date.now() - startedAtRef.current))
      }, 200)
    } catch (cause) {
      releaseStream()
      const name = cause instanceof DOMException ? cause.name : ''
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setState('denied')
      } else if (name === 'NotFoundError') {
        setError('No encontramos ningún micrófono conectado.')
        setState('error')
      } else {
        setError('No se pudo abrir el micrófono.')
        setState('error')
      }
    }
  }, [releaseStream, stopTicking])

  const pause = useCallback(() => {
    const recorder = recorderRef.current
    if (recorder?.state !== 'recording') return
    recorder.pause()
    accumulatedRef.current += Date.now() - startedAtRef.current
    stopTicking()
    setState('paused')
  }, [stopTicking])

  const resume = useCallback(() => {
    const recorder = recorderRef.current
    if (recorder?.state !== 'paused') return
    recorder.resume()
    startedAtRef.current = Date.now()
    setState('recording')
    tickRef.current = window.setInterval(() => {
      setElapsedMs(accumulatedRef.current + (Date.now() - startedAtRef.current))
    }, 200)
  }, [])

  const stop = useCallback(() => {
    const recorder = recorderRef.current
    if (!recorder || recorder.state === 'inactive') return
    if (recorder.state === 'paused') {
      // En pausa el reloj está congelado; que onstop no sume tiempo de más.
      startedAtRef.current = Date.now()
    }
    recorder.stop()
  }, [])

  /** Descarta lo grabado sin guardarlo. */
  const cancel = useCallback(() => {
    const recorder = recorderRef.current
    if (!recorder || recorder.state === 'inactive') return
    recorder.onstop = () => {
      stopTicking()
      chunksRef.current = []
      releaseStream()
      setState('idle')
      setElapsedMs(0)
    }
    recorder.stop()
  }, [releaseStream, stopTicking])

  return { state, elapsedMs, error, start, stop, pause, resume, cancel }
}
