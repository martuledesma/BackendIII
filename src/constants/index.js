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
  INTERNAL_SERVER_ERROR: 500
})

export const RESPONSE_STATUS = Object.freeze({
  SUCCESS: 'success',
  ERROR: 'error'
})
