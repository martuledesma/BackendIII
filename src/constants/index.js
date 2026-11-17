// Valores inmutables del dominio. Object.freeze evita que se modifiquen en tiempo de ejecución.

// USER = cliente que hace pedidos. COURIER = repartidor.
export const USER_ROLES = Object.freeze({
  ADMIN: 'ADMIN',
  USER: 'USER',
  COURIER: 'COURIER'
})

export const VEHICLE_TYPES = Object.freeze({
  BIKE: 'BIKE',
  MOTORCYCLE: 'MOTORCYCLE',
  CAR: 'CAR',
  VAN: 'VAN'
})

export const PRODUCT_STATUS = Object.freeze({
  AVAILABLE: 'AVAILABLE',
  OUT_OF_STOCK: 'OUT_OF_STOCK'
})

export const ORDER_STATUS = Object.freeze({
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  IN_TRANSIT: 'IN_TRANSIT',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED'
})

export const ORDER_PRIORITY = Object.freeze({
  LOW: 'LOW',
  NORMAL: 'NORMAL',
  HIGH: 'HIGH',
  URGENT: 'URGENT'
})

export const DELIVERY_STATUS = Object.freeze({
  UNASSIGNED: 'UNASSIGNED',
  ASSIGNED: 'ASSIGNED',
  IN_TRANSIT: 'IN_TRANSIT',
  DELIVERED: 'DELIVERED',
  FAILED: 'FAILED'
})

// Transiciones permitidas del estado de un pedido (PATCH /api/orders/:oid/status).
// DELIVERED y CANCELLED son estados finales.
export const ORDER_STATUS_TRANSITIONS = Object.freeze({
  [ORDER_STATUS.PENDING]: Object.freeze([ORDER_STATUS.CONFIRMED, ORDER_STATUS.CANCELLED]),
  [ORDER_STATUS.CONFIRMED]: Object.freeze([ORDER_STATUS.IN_TRANSIT, ORDER_STATUS.CANCELLED]),
  [ORDER_STATUS.IN_TRANSIT]: Object.freeze([ORDER_STATUS.DELIVERED]),
  [ORDER_STATUS.DELIVERED]: Object.freeze([]),
  [ORDER_STATUS.CANCELLED]: Object.freeze([])
})

export const DELIVERY_DEFAULTS = Object.freeze({
  ESTIMATED_DAYS: 3,
  TRACKING_PREFIX: 'SN-',
  TRACKING_LENGTH: 10
})

// ---------- Carga de archivos ----------

// Tipos de archivo aceptados. La firma (magic bytes) se compara con el contenido real del archivo,
// así no alcanza con renombrar un .exe a .pdf o mandar un Content-Type falso.
export const ALLOWED_FILE_TYPES = Object.freeze({
  'application/pdf': Object.freeze({ label: 'PDF', extension: '.pdf', extensions: ['.pdf'], signature: [0x25, 0x50, 0x44, 0x46] }),
  'image/jpeg': Object.freeze({ label: 'JPG', extension: '.jpg', extensions: ['.jpg', '.jpeg'], signature: [0xff, 0xd8, 0xff] }),
  'image/png': Object.freeze({ label: 'PNG', extension: '.png', extensions: ['.png'], signature: [0x89, 0x50, 0x4e, 0x47] })
})

export const UPLOAD_LIMITS = Object.freeze({
  MAX_FILE_SIZE_MB: 5,
  MAX_FILE_SIZE_BYTES: 5 * 1024 * 1024,
  MAX_FILES: 1,
  MAX_FIELDS: 5,
  MAX_FIELD_SIZE_BYTES: 1024
})

// Nombre del campo multipart que trae el archivo en cada endpoint.
export const FILE_FIELDS = Object.freeze({
  USER_DOCUMENT: 'document',
  DELIVERY_PROOF: 'proof'
})

// Documentos de usuario. Los de repartidor (licencia y cédula del vehículo) solo los puede subir un COURIER.
export const USER_DOCUMENT_TYPES = Object.freeze({
  ID_CARD: 'ID_CARD', // DNI
  PROOF_OF_ADDRESS: 'PROOF_OF_ADDRESS', // constancia de domicilio
  DRIVER_LICENSE: 'DRIVER_LICENSE', // licencia de conducir
  VEHICLE_REGISTRATION: 'VEHICLE_REGISTRATION' // cédula del vehículo
})

export const COURIER_ONLY_DOCUMENT_TYPES = Object.freeze([
  USER_DOCUMENT_TYPES.DRIVER_LICENSE,
  USER_DOCUMENT_TYPES.VEHICLE_REGISTRATION
])

// Comprobantes de una entrega.
export const DELIVERY_PROOF_TYPES = Object.freeze({
  DELIVERY_RECEIPT: 'DELIVERY_RECEIPT', // remito firmado
  DELIVERY_PHOTO: 'DELIVERY_PHOTO', // foto del paquete entregado
  SIGNATURE: 'SIGNATURE' // firma del destinatario
})

// Entidades que se pueden generar / insertar desde /api/mocks.
// El valor es el nombre de la colección en MongoDB.
export const MOCK_ENTITIES = Object.freeze({
  USERS: 'users',
  COURIERS: 'couriers',
  ORDERS: 'orders',
  DELIVERIES: 'deliveries',
  ALL: 'all'
})

export const MOCK_LIMITS = Object.freeze({
  DEFAULT_QTY: 10,
  MAX_QTY: 100
})

// Contraseña en texto plano de los usuarios de prueba (se guarda hasheada).
export const MOCK_DEFAULTS = Object.freeze({
  PASSWORD: 'coder123',
  EMAIL_DOMAIN: 'test.com'
})

// Niveles del logger: cuanto menor el número, más grave.
// Un transport con nivel "warning" registra fatal, error y warning.
export const LOG_LEVELS = Object.freeze({
  fatal: 0,
  error: 1,
  warning: 2,
  info: 3,
  http: 4,
  debug: 5
})

export const LOG_FILES = Object.freeze({
  DIR: 'logs',
  ERROR: 'logs/error.log',
  ERROR_MAX_SIZE_BYTES: 5 * 1024 * 1024, // 5 MB
  ERROR_MAX_FILES: 5,
  COMBINED_PATTERN: 'logs/combined-%DATE%.log',
  COMBINED_MAX_SIZE: '20m',
  COMBINED_RETENTION: '14d'
})

export const ENVIRONMENTS = Object.freeze({
  DEVELOPMENT: 'development',
  PRODUCTION: 'production',
  TEST: 'test'
})

export const HTTP_STATUS = Object.freeze({
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  INTERNAL_SERVER_ERROR: 500
})

export const RESPONSE_STATUS = Object.freeze({
  SUCCESS: 'success',
  ERROR: 'error'
})
