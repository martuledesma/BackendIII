// Diccionario centralizado de errores de ShipNow.
// Cada entrada define: code (identificador estable para el cliente), statusCode HTTP y mensaje por defecto.
// Los errores personalizados (custom-errors.js) se construyen siempre a partir de una de estas entradas.
import { HTTP_STATUS } from '../constants/index.js'

const entry = (code, statusCode, message) => Object.freeze({ code, statusCode, message })

export const ERRORS = Object.freeze({
  // ---------- 400: datos inválidos ----------
  VALIDATION_ERROR: entry('VALIDATION_ERROR', HTTP_STATUS.BAD_REQUEST, 'Los datos enviados no son válidos'),
  MISSING_FIELDS: entry('MISSING_FIELDS', HTTP_STATUS.BAD_REQUEST, 'Faltan campos obligatorios'),
  INVALID_FIELD: entry('INVALID_FIELD', HTTP_STATUS.BAD_REQUEST, 'Un campo tiene un valor inválido'),
  NO_UPDATABLE_FIELDS: entry('NO_UPDATABLE_FIELDS', HTTP_STATUS.BAD_REQUEST, 'No se enviaron campos válidos para actualizar'),
  INVALID_ID: entry('INVALID_ID', HTTP_STATUS.BAD_REQUEST, 'El id no tiene un formato válido'),
  INVALID_JSON: entry('INVALID_JSON', HTTP_STATUS.BAD_REQUEST, 'El cuerpo de la petición no es un JSON válido'),
  INVALID_QUERY_PARAM: entry('INVALID_QUERY_PARAM', HTTP_STATUS.BAD_REQUEST, 'La petición incluye parámetros no permitidos'),
  INVALID_ROLE: entry('INVALID_ROLE', HTTP_STATUS.BAD_REQUEST, 'El rol indicado no existe'),
  INVALID_STATUS: entry('INVALID_STATUS', HTTP_STATUS.BAD_REQUEST, 'El estado indicado no es válido'),
  INVALID_PRIORITY: entry('INVALID_PRIORITY', HTTP_STATUS.BAD_REQUEST, 'La prioridad indicada no es válida'),
  COURIER_PROFILE_REQUIRED: entry('COURIER_PROFILE_REQUIRED', HTTP_STATUS.BAD_REQUEST, 'Un repartidor necesita un perfil con vehículo válido'),

  // ---------- Archivos ----------
  FILE_REQUIRED: entry('FILE_REQUIRED', HTTP_STATUS.BAD_REQUEST, 'Falta el archivo en la petición'),
  UNEXPECTED_FILE_FIELD: entry('UNEXPECTED_FILE_FIELD', HTTP_STATUS.BAD_REQUEST, 'El archivo se envió en un campo distinto al esperado'),
  TOO_MANY_FILES: entry('TOO_MANY_FILES', HTTP_STATUS.BAD_REQUEST, 'Se envió más de un archivo'),
  INVALID_MULTIPART: entry('INVALID_MULTIPART', HTTP_STATUS.BAD_REQUEST, 'El cuerpo multipart/form-data es inválido'),
  INVALID_DOCUMENT_TYPE: entry('INVALID_DOCUMENT_TYPE', HTTP_STATUS.BAD_REQUEST, 'El tipo de documento no es válido'),
  FILE_TOO_LARGE: entry('FILE_TOO_LARGE', HTTP_STATUS.PAYLOAD_TOO_LARGE, 'El archivo supera el tamaño máximo permitido'),
  INVALID_FILE_TYPE: entry('INVALID_FILE_TYPE', HTTP_STATUS.UNSUPPORTED_MEDIA_TYPE, 'El tipo de archivo no está permitido'),
  DOCUMENT_NOT_FOUND: entry('DOCUMENT_NOT_FOUND', HTTP_STATUS.NOT_FOUND, 'El documento no existe'),
  FILE_SAVE_FAILED: entry('FILE_SAVE_FAILED', HTTP_STATUS.INTERNAL_SERVER_ERROR, 'No se pudo guardar el archivo'),

  // ---------- 400: mocks ----------
  MOCK_INVALID_QUANTITY: entry('MOCK_INVALID_QUANTITY', HTTP_STATUS.BAD_REQUEST, 'La cantidad de mocks debe ser un número entero'),
  MOCK_NEGATIVE_QUANTITY: entry('MOCK_NEGATIVE_QUANTITY', HTTP_STATUS.BAD_REQUEST, 'La cantidad de mocks no puede ser negativa ni cero'),
  MOCK_QUANTITY_EXCEEDED: entry('MOCK_QUANTITY_EXCEEDED', HTTP_STATUS.BAD_REQUEST, 'La cantidad de mocks supera el máximo permitido'),
  MOCK_INVALID_ENTITY: entry('MOCK_INVALID_ENTITY', HTTP_STATUS.BAD_REQUEST, 'La entidad de mocks indicada no existe'),

  // ---------- 403 ----------
  SEEDING_DISABLED: entry('SEEDING_DISABLED', HTTP_STATUS.FORBIDDEN, 'La carga de datos de prueba está deshabilitada en este entorno'),

  // ---------- 404 ----------
  ROUTE_NOT_FOUND: entry('ROUTE_NOT_FOUND', HTTP_STATUS.NOT_FOUND, 'La ruta solicitada no existe'),
  PRODUCT_NOT_FOUND: entry('PRODUCT_NOT_FOUND', HTTP_STATUS.NOT_FOUND, 'El producto no existe'),
  USER_NOT_FOUND: entry('USER_NOT_FOUND', HTTP_STATUS.NOT_FOUND, 'El usuario no existe'),
  ORDER_NOT_FOUND: entry('ORDER_NOT_FOUND', HTTP_STATUS.NOT_FOUND, 'El pedido no existe'),
  DELIVERY_NOT_FOUND: entry('DELIVERY_NOT_FOUND', HTTP_STATUS.NOT_FOUND, 'La entrega no existe'),

  // ---------- 409: conflictos con el estado actual ----------
  DUPLICATE_RESOURCE: entry('DUPLICATE_RESOURCE', HTTP_STATUS.CONFLICT, 'Ya existe un registro con un valor que debe ser único'),
  EMAIL_ALREADY_REGISTERED: entry('EMAIL_ALREADY_REGISTERED', HTTP_STATUS.CONFLICT, 'El email ya está registrado'),
  PRODUCT_CODE_TAKEN: entry('PRODUCT_CODE_TAKEN', HTTP_STATUS.CONFLICT, 'Ya existe un producto con ese código'),
  INVALID_STATUS_TRANSITION: entry('INVALID_STATUS_TRANSITION', HTTP_STATUS.CONFLICT, 'El cambio de estado no está permitido desde el estado actual'),
  COURIER_NOT_ASSIGNED: entry('COURIER_NOT_ASSIGNED', HTTP_STATUS.CONFLICT, 'La entrega del pedido todavía no tiene un repartidor asignado'),
  LAST_ADMIN: entry('LAST_ADMIN', HTTP_STATUS.CONFLICT, 'No se puede quitar o eliminar al último administrador'),
  MOCK_MISSING_DEPENDENCIES: entry('MOCK_MISSING_DEPENDENCIES', HTTP_STATUS.CONFLICT, 'Faltan datos previos para generar esta entidad'),

  // ---------- 500: fallas internas ----------
  MOCK_GENERATION_FAILED: entry('MOCK_GENERATION_FAILED', HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Falló la generación de datos de prueba'),
  MOCK_SEED_FAILED: entry('MOCK_SEED_FAILED', HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Falló la carga de datos de prueba en MongoDB'),
  DATABASE_ERROR: entry('DATABASE_ERROR', HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Error al acceder a la base de datos'),
  INTERNAL_ERROR: entry('INTERNAL_ERROR', HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Error interno del servidor')
})
