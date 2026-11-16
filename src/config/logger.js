// Instancia compartida del logger. Cualquier módulo hace:
//   import { logger } from '../config/logger.js'
//   logger.info('mensaje')
// y obtiene siempre la misma configuración (definida en logger.factory.js).
import { config } from './env.config.js'
import { createAppLogger, getLoggerSettings } from './logger.factory.js'

export const logger = createAppLogger(config.nodeEnv)
export const loggerSettings = getLoggerSettings(config.nodeEnv)
