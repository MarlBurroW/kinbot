import pino from 'pino'
import pinoPretty from 'pino-pretty'
import { Writable } from 'node:stream'
import { logStore } from '@/server/services/log-store'

const level = (process.env.LOG_LEVEL ?? 'info') as pino.Level
const isProd = process.env.NODE_ENV === 'production'

/** Writable stream that captures raw Pino JSON lines into the in-memory log store. */
const captureStream = new Writable({
  write(chunk: Buffer, _encoding: string, callback: () => void) {
    logStore.pushRaw(chunk.toString())
    callback()
  },
})

const streams: pino.StreamEntry[] = [
  // Capture to ring buffer (info+ only, regardless of root level)
  { level: 'info', stream: captureStream },
  // Human-readable output
  isProd
    ? { stream: pino.destination(1) }
    : {
        stream: pinoPretty({
          colorize: true,
          translateTime: 'HH:MM:ss.l',
          ignore: 'pid,hostname',
        }),
      },
]

export const rootLogger = pino(
  {
    level,
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: ['apiKey', 'encryptionKey', 'token', 'password', 'secret', 'configEncrypted'],
      censor: '[REDACTED]',
    },
  },
  pino.multistream(streams),
)

/** Create a child logger scoped to a module. */
export function createLogger(module: string) {
  return rootLogger.child({ module })
}
