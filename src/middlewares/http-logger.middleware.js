// Registra cada petición HTTP con nivel "http": método, ruta, status y duración.
import { logger } from '../config/logger.js'

export const httpLogger = (req, res, next) => {
  const start = process.hrtime.bigint()
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6
    logger.http(`${req.method} ${req.originalUrl} ${res.statusCode} - ${ms.toFixed(1)} ms`)
  })
  next()
}
