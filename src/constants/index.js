// Valores inmutables del dominio. Object.freeze evita que se modifiquen en tiempo de ejecución.

export const USER_ROLES = Object.freeze({
  ADMIN: 'ADMIN',
  USER: 'USER'
})

export const PRODUCT_STATUS = Object.freeze({
  AVAILABLE: 'AVAILABLE',
  OUT_OF_STOCK: 'OUT_OF_STOCK'
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
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500
})

export const RESPONSE_STATUS = Object.freeze({
  SUCCESS: 'success',
  ERROR: 'error'
})
