// Capa común de errores: el ÚNICO lugar del proyecto que arma respuestas de error.
// Recibe cualquier error que llegue vía next(error), lo normaliza a un AppError
// y responde siempre con la misma estructura.
import { config, logger } from '../config/index.js'
import { RESPONSE_STATUS, HTTP_STATUS } from '../constants/index.js'
import {
  ERRORS,
  AppError,
  InvalidJsonError,
  RouteNotFoundError,
  DuplicateResourceError
} from '../errors/index.js'

const MONGO_ERROR_NAMES = ['MongoServerError', 'MongoNetworkError', 'MongooseServerSelectionError', 'MongoBulkWriteError']

// Traduce errores de librerías (Express, Mongoose, MongoDB) a errores del dominio.
const normalizeError = (err) => {
  if (err instanceof AppError) return err

  // body-parser: JSON mal formado
  if (err.type === 'entity.parse.failed') return new InvalidJsonError()

  // Clave única duplicada (email, code, trackingCode...)
  if (err.code === 11000) return new DuplicateResourceError(Object.keys(err.keyValue ?? {}))

  // Mongoose: id con formato inválido
  if (err.name === 'CastError') {
    return new AppError(ERRORS.INVALID_ID, {
      message: `El valor "${err.value}" no es válido para el campo "${err.path}"`,
      details: { field: err.path, value: err.value }
    })
  }

  // Mongoose: el documento no cumple el esquema
  if (err.name === 'ValidationError' && err.errors) {
    const fields = Object.values(err.errors).map((e) => ({ field: e.path, reason: e.message }))
    return new AppError(ERRORS.VALIDATION_ERROR, { details: { fields } })
  }

  // MongoDB: conexión caída, timeout, error del servidor
  if (MONGO_ERROR_NAMES.includes(err.name) || /buffering timed out/i.test(err.message ?? '')) {
    const error = new AppError(ERRORS.DATABASE_ERROR, { details: { reason: err.message }, cause: err })
    error.isOperational = false
    return error
  }

  // Cualquier otra cosa es un error inesperado (bug).
  const error = new AppError(ERRORS.INTERNAL_ERROR, { details: { reason: err.message }, cause: err })
  error.isOperational = false
  return error
}

// Registra el error con el nivel que corresponde. El log complementa la respuesta, no la reemplaza.
// - Errores esperados del dominio (4xx: datos inválidos, no encontrado, conflicto) → warning
// - Fallas controladas del servidor (5xx operacional, ej. MOCK_SEED_FAILED) → error
// - Errores inesperados (bugs, caída de MongoDB) → error con stack trace
const logError = (error, originalError, req) => {
  const summary = `${error.code} en ${req.method} ${req.originalUrl} → ${error.statusCode}: ${error.message}`
  const isServerError = error.statusCode >= HTTP_STATUS.INTERNAL_SERVER_ERROR

  if (!isServerError && error.isOperational) {
    logger.warning(summary)
  } else if (error.isOperational) {
    logger.error(summary, { details: error.details })
  } else {
    // Incluye el stack de la causa real (o del error original) para poder investigarlo.
    const stack = error.cause?.stack ?? originalError.stack
    logger.error(summary, { details: error.details, stack })
  }
}

// 404 para rutas inexistentes: no responde, deriva al middleware de errores.
export const notFoundHandler = (req, res, next) => {
  next(new RouteNotFoundError(req.method, req.originalUrl))
}

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  const error = normalizeError(err)
  const isServerError = error.statusCode >= HTTP_STATUS.INTERNAL_SERVER_ERROR

  logError(error, err, req)

  // En producción no se exponen detalles internos de los errores 500.
  const hideInternals = isServerError && config.isProduction

  res.status(error.statusCode).json({
    status: RESPONSE_STATUS.ERROR,
    error: {
      code: error.code,
      message: hideInternals ? ERRORS[error.code]?.message ?? ERRORS.INTERNAL_ERROR.message : error.message,
      statusCode: error.statusCode,
      details: hideInternals ? null : error.details,
      path: req.originalUrl,
      method: req.method,
      timestamp: new Date().toISOString()
    }
  })
}
