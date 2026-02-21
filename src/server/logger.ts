import pino from 'pino'

const level = (process.env.LOG_LEVEL ?? 'info') as pino.Level
const isProd = process.env.NODE_ENV === 'production'

export const rootLogger = pino({
  level,
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: ['apiKey', 'encryptionKey', 'token', 'password', 'secret', 'configEncrypted'],
    censor: '[REDACTED]',
  },
  transport: isProd
    ? undefined
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss.l',
          ignore: 'pid,hostname',
        },
      },
})

/** Create a child logger scoped to a module. */
export function createLogger(module: string) {
  return rootLogger.child({ module })
}
