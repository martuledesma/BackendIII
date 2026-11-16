// Configuración ÚNICA del logger (Winston). Define niveles, formato, salidas y comportamiento por entorno.
// No lee process.env: recibe el entorno ya validado por env.config.js.
// Está separada de logger.js para poder crear un logger de emergencia si la configuración
// de entorno falla al arrancar (ver server.js).
import winston from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'
import { ENVIRONMENTS, LOG_LEVELS, LOG_FILES } from '../constants/index.js'

const { combine, timestamp, errors, printf, colorize, splat } = winston.format

// Colores de consola por nivel.
winston.addColors({
  fatal: 'bold white redBG',
  error: 'red',
  warning: 'yellow',
  info: 'green',
  http: 'cyan',
  debug: 'gray'
})

// Qué se registra en cada entorno.
// - development: todo (desde debug) en consola; archivo general desde http.
// - production: desde info en consola y en archivo general (sin debug ni http).
// - test: consola casi silenciosa (solo error y fatal) para no ensuciar la salida de los tests.
const ENVIRONMENT_SETTINGS = Object.freeze({
  [ENVIRONMENTS.DEVELOPMENT]: { consoleLevel: 'debug', fileLevel: 'http', colors: true },
  [ENVIRONMENTS.PRODUCTION]: { consoleLevel: 'info', fileLevel: 'info', colors: false },
  [ENVIRONMENTS.TEST]: { consoleLevel: 'error', fileLevel: 'info', colors: false }
})

// Ancho fijo para alinear los mensajes: "[warning] " ocupa 10 caracteres.
const LEVEL_COLUMN_WIDTH = 10
const LEVEL = Symbol.for('level')

// Formato: 2026-08-01 10:12:03 [info]    Mensaje {metadatos}
const lineFormat = printf((info) => {
  const rawLevel = info[LEVEL]
  const padding = ' '.repeat(Math.max(1, LEVEL_COLUMN_WIDTH - rawLevel.length - 2))
  const { timestamp: time, level, message, stack, ...meta } = info
  const metaText = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : ''
  const stackText = stack ? `\n${stack}` : ''
  return `${time} [${level}]${padding}${message}${metaText}${stackText}`
})

const baseFormat = [
  errors({ stack: true }), // si se loguea un Error, incluye el stack
  splat(),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' })
]

export const getLoggerSettings = (nodeEnv) =>
  ENVIRONMENT_SETTINGS[nodeEnv] ?? ENVIRONMENT_SETTINGS[ENVIRONMENTS.DEVELOPMENT]

export const createAppLogger = (nodeEnv = ENVIRONMENTS.DEVELOPMENT) => {
  const settings = getLoggerSettings(nodeEnv)

  const transports = [
    // Consola
    new winston.transports.Console({
      level: settings.consoleLevel,
      format: settings.colors
        ? combine(...baseFormat, colorize(), lineFormat)
        : combine(...baseFormat, lineFormat)
    }),

    // logs/error.log → SOLO error y fatal. Rotación por tamaño: al llegar a 5 MB se renombra
    // (error1.log, error2.log...) y se conservan como máximo 5 archivos.
    new winston.transports.File({
      filename: LOG_FILES.ERROR,
      level: 'error',
      maxsize: LOG_FILES.ERROR_MAX_SIZE_BYTES,
      maxFiles: LOG_FILES.ERROR_MAX_FILES,
      tailable: true, // error.log siempre es el archivo más reciente
      format: combine(...baseFormat, lineFormat)
    }),

    // logs/combined-AAAA-MM-DD.log → historial general, un archivo por día.
    // Se comprimen los días anteriores y se borran los de más de 14 días (o al superar 20 MB por archivo).
    new DailyRotateFile({
      filename: LOG_FILES.COMBINED_PATTERN,
      datePattern: 'YYYY-MM-DD',
      level: settings.fileLevel,
      maxSize: LOG_FILES.COMBINED_MAX_SIZE,
      maxFiles: LOG_FILES.COMBINED_RETENTION,
      zippedArchive: true,
      format: combine(...baseFormat, lineFormat)
    })
  ]

  return winston.createLogger({
    levels: LOG_LEVELS, // fatal, error, warning, info, http, debug
    level: 'debug', // cada transport filtra con su propio nivel
    transports,
    exitOnError: false
  })
}

// Espera a que los archivos terminen de escribirse (usar antes de process.exit).
export const flushLogger = (logger, timeoutMs = 2000) =>
  new Promise((resolve) => {
    const timer = setTimeout(resolve, timeoutMs)
    logger.on('finish', () => { clearTimeout(timer); resolve() })
    logger.end()
  })
