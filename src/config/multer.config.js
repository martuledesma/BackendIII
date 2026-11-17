// Configuración ÚNICA de Multer. Define:
//   - dónde se guardan los archivos (carpetas por tipo),
//   - cómo se nombran,
//   - qué tipos se aceptan y el tamaño máximo,
//   - cómo se traducen los errores de carga a errores del dominio.
// Los routers solo usan los middlewares que exporta este archivo.
//
// Flujo: Multer escribe el archivo en uploads/tmp/. El service valida la entidad y el tipo de documento
// y recién ahí lo mueve a su carpeta definitiva. Si algo falla, el archivo temporal se borra:
// nunca queda un archivo suelto sin entidad asociada.
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { randomBytes } from 'node:crypto'
import multer from 'multer'
import { config } from './env.config.js'
import { logger } from './logger.js'
import { ENVIRONMENTS, ALLOWED_FILE_TYPES, UPLOAD_LIMITS, FILE_FIELDS } from '../constants/index.js'
import {
  AppError,
  InvalidFileTypeError,
  FileTooLargeError,
  UnexpectedFileFieldError,
  TooManyFilesError,
  InvalidMultipartError
} from '../errors/index.js'

// En testing los archivos van a una carpeta aparte que los tests borran al terminar.
const ROOT = config.nodeEnv === ENVIRONMENTS.TEST ? 'uploads/test' : 'uploads'

export const UPLOAD_DIRS = Object.freeze({
  ROOT,
  TMP: `${ROOT}/tmp`,
  USER_DOCUMENTS: `${ROOT}/users/documents`, // DNI, constancia de domicilio
  USER_LICENSES: `${ROOT}/users/licenses`, // licencia de conducir, cédula del vehículo
  DELIVERY_PROOFS: `${ROOT}/deliveries/proofs` // remitos, fotos y firmas de entregas
})

Object.values(UPLOAD_DIRS).forEach((dir) => mkdirSync(dir, { recursive: true }))

export const ALLOWED_LABELS = Object.values(ALLOWED_FILE_TYPES).map((type) => type.label)

// Nombre controlado por el servidor: <timestamp>-<16 hex aleatorios>.<extensión según el tipo real>.
// Nunca se usa el nombre original (puede traer espacios, rutas o caracteres raros).
export const generateFileName = (mimeType) =>
  `${Date.now()}-${randomBytes(8).toString('hex')}${ALLOWED_FILE_TYPES[mimeType].extension}`

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIRS.TMP),
  filename: (req, file, cb) => cb(null, generateFileName(file.mimetype))
})

// Primer filtro: el Content-Type y la extensión tienen que estar permitidos y coincidir.
// (El service hace un segundo control leyendo la firma real del archivo).
const fileFilter = (req, file, cb) => {
  const type = ALLOWED_FILE_TYPES[file.mimetype]
  const extension = path.extname(file.originalname).toLowerCase()

  if (!type || !type.extensions.includes(extension)) {
    logger.warning(
      `Intento de subir un tipo de archivo no permitido: "${file.originalname}" (${file.mimetype}) en ${req.method} ${req.originalUrl}`
    )
    return cb(new InvalidFileTypeError({ mimeType: file.mimetype, extension, allowed: ALLOWED_LABELS }))
  }
  cb(null, true)
}

const uploader = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: UPLOAD_LIMITS.MAX_FILE_SIZE_BYTES,
    files: UPLOAD_LIMITS.MAX_FILES,
    fields: UPLOAD_LIMITS.MAX_FIELDS,
    fieldSize: UPLOAD_LIMITS.MAX_FIELD_SIZE_BYTES
  }
})

// Traduce los errores de Multer (y de busboy) a errores del dominio con el formato de la API.
const toDomainError = (error, expectedField) => {
  if (error instanceof AppError) return error
  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE': return new FileTooLargeError(UPLOAD_LIMITS.MAX_FILE_SIZE_MB)
      case 'LIMIT_UNEXPECTED_FILE': return new UnexpectedFileFieldError(error.field, expectedField)
      case 'LIMIT_FILE_COUNT': return new TooManyFilesError(UPLOAD_LIMITS.MAX_FILES)
      default: return new InvalidMultipartError(error.message)
    }
  }
  return new InvalidMultipartError(error.message)
}

// Middleware que acepta un único archivo en `fieldName` y deriva cualquier error al middleware global.
const singleFile = (fieldName) => {
  const handler = uploader.single(fieldName)
  return (req, res, next) => handler(req, res, (error) => (error ? next(toDomainError(error, fieldName)) : next()))
}

export const uploadUserDocument = singleFile(FILE_FIELDS.USER_DOCUMENT)
export const uploadDeliveryProof = singleFile(FILE_FIELDS.DELIVERY_PROOF)
