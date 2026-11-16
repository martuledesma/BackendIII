import { config } from '../config/index.js'
import { HTTP_STATUS, RESPONSE_STATUS } from '../constants/index.js'

export const notFoundHandler = (req, res) => {
  res.status(HTTP_STATUS.NOT_FOUND).json({
    status: RESPONSE_STATUS.ERROR,
    error: `Ruta no encontrada: ${req.method} ${req.originalUrl}`
  })
}

// Middleware centralizado: todos los errores que llegan vía next(error) terminan acá.
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode ?? HTTP_STATUS.INTERNAL_SERVER_ERROR
  let message = err.message

  // JSON mal formado en el body
  if (err.type === 'entity.parse.failed') {
    statusCode = HTTP_STATUS.BAD_REQUEST
    message = 'El cuerpo de la petición no es un JSON válido'
  }

  // Clave única duplicada en MongoDB (email, code, trackingCode...)
  if (err.code === 11000 || err.writeErrors?.some((e) => e.code === 11000)) {
    statusCode = HTTP_STATUS.CONFLICT
    message = 'Ya existe un registro con un valor único repetido (por ejemplo, un email)'
  }

  if (statusCode >= HTTP_STATUS.INTERNAL_SERVER_ERROR) {
    console.error('[error]', err)
    if (config.isProduction) message = 'Error interno del servidor'
  }

  res.status(statusCode).json({ status: RESPONSE_STATUS.ERROR, error: message })
}
