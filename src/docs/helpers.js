// Helpers para escribir la documentación OpenAPI sin repetir estructura.
// Las respuestas de error se construyen a partir del diccionario real (src/errors/errors.dictionary.js):
// si un código no existe o se documenta con un status distinto al real, el arranque falla.
import { ERRORS } from '../errors/index.js'

const ref = (name) => ({ $ref: `#/components/schemas/${name}` })
export const schemaRef = ref
export const paramRef = (name) => ({ $ref: `#/components/parameters/${name}` })

const STATUS_DESCRIPTIONS = Object.freeze({
  400: 'Datos inválidos en la petición (body, parámetros de ruta o query)',
  403: 'Operación no permitida en el entorno actual',
  404: 'El recurso no existe',
  409: 'Conflicto con el estado actual de los datos',
  500: 'Error interno del servidor'
})

// Mensajes y detalles de ejemplo con el formato que devuelve realmente la API.
const SAMPLE_ERRORS = Object.freeze({
  INVALID_ID: { message: 'El id de usuario "123" no tiene un formato válido', details: { entity: 'usuario', id: '123' } },
  MISSING_FIELDS: { message: 'Faltan campos obligatorios: email, password', details: { fields: ['email', 'password'] } },
  INVALID_FIELD: { message: 'El campo "price" es inválido: debe ser un número mayor o igual a 0', details: { field: 'price', value: -10 } },
  INVALID_ROLE: { message: 'Rol inválido "cliente". Valores permitidos: ADMIN, USER, COURIER', details: { value: 'cliente', allowed: ['ADMIN', 'USER', 'COURIER'] } },
  INVALID_STATUS: { message: 'Estado de pedido inválido "PERDIDO". Valores permitidos: PENDING, CONFIRMED, IN_TRANSIT, DELIVERED, CANCELLED', details: { entity: 'pedido', value: 'PERDIDO', allowed: ['PENDING', 'CONFIRMED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'] } },
  INVALID_PRIORITY: { message: 'Prioridad inválida "YA". Valores permitidos: LOW, NORMAL, HIGH, URGENT', details: { value: 'YA', allowed: ['LOW', 'NORMAL', 'HIGH', 'URGENT'] } },
  INVALID_QUERY_PARAM: { message: 'Parámetros no permitidos: color. Permitidos: qty', details: { params: ['color'], allowed: ['qty'] } },
  NO_UPDATABLE_FIELDS: { message: 'No hay campos válidos para actualizar. Permitidos: firstName, lastName, phone, role, courierProfile', details: { allowed: ['firstName', 'lastName', 'phone', 'role', 'courierProfile'] } },
  COURIER_PROFILE_REQUIRED: { message: 'Un repartidor necesita courierProfile.vehicle con uno de: BIKE, MOTORCYCLE, CAR, VAN', details: { allowedVehicles: ['BIKE', 'MOTORCYCLE', 'CAR', 'VAN'] } },
  USER_NOT_FOUND: { message: 'No existe un usuario con id 6739f1c2a8b4e5d6f7a8b9c0', details: { id: '6739f1c2a8b4e5d6f7a8b9c0' } },
  PRODUCT_NOT_FOUND: { message: 'No existe un producto con id 6739f1c2a8b4e5d6f7a8b9c0', details: { id: '6739f1c2a8b4e5d6f7a8b9c0' } },
  ORDER_NOT_FOUND: { message: 'No existe un pedido con id 6739f1c2a8b4e5d6f7a8b9c0', details: { id: '6739f1c2a8b4e5d6f7a8b9c0' } },
  DELIVERY_NOT_FOUND: { message: 'No existe una entrega con id 6739f1c2a8b4e5d6f7a8b9c0', details: { id: '6739f1c2a8b4e5d6f7a8b9c0' } },
  EMAIL_ALREADY_REGISTERED: { message: 'El email ana@test.com ya está registrado', details: { email: 'ana@test.com' } },
  PRODUCT_CODE_TAKEN: { message: 'Ya existe un producto con el código BOX-01', details: { code: 'BOX-01' } },
  MOCK_INVALID_QUANTITY: { message: 'La cantidad de mocks debe ser un número entero: se recibió "abc" y debe ser un entero entre 1 y 100', details: { field: 'qty', value: 'abc', min: 1, max: 100 } },
  MOCK_NEGATIVE_QUANTITY: { message: 'La cantidad de mocks no puede ser negativa ni cero: se recibió "-5" y debe ser un entero entre 1 y 100', details: { field: 'qty', value: '-5', min: 1, max: 100 } },
  MOCK_QUANTITY_EXCEEDED: { message: 'La cantidad de mocks supera el máximo permitido: se recibió "500" y debe ser un entero entre 1 y 100', details: { field: 'qty', value: '500', min: 1, max: 100 } },
  MOCK_INVALID_ENTITY: { message: 'Entidad de mocks inválida "pizzas". Valores permitidos: users, couriers, orders, deliveries, all', details: { field: 'entity', value: 'pizzas', allowed: ['users', 'couriers', 'orders', 'deliveries', 'all'] } },
  MOCK_MISSING_DEPENDENCIES: { message: 'No se puede generar orders: faltan clientes (rol USER) en la base. Cargalos primero con POST /api/mocks/seed?entity=users o usá entity=all', details: { entity: 'orders', missing: 'clientes (rol USER)' } },
  SEEDING_DISABLED: { message: 'La carga de datos de prueba está deshabilitada en el entorno "production"', details: { environment: 'production' } },
  MOCK_SEED_FAILED: { message: 'Falló la carga de all en MongoDB. Se revirtieron los registros del lote.', details: { entity: 'all', reason: 'Falla simulada después de insertar users (simulateFailure=true)', rollback: { done: true, eliminados: { users: 6 } } } },
  ROUTE_NOT_FOUND: { message: 'Ruta no encontrada: GET /api/no-existe', details: { method: 'GET', path: '/api/no-existe' } }
})

const errorExample = (code, path, method) => {
  const sample = SAMPLE_ERRORS[code] ?? {}
  return {
    summary: code,
    value: {
      status: 'error',
      error: {
        code,
        message: sample.message ?? ERRORS[code].message,
        statusCode: ERRORS[code].statusCode,
        details: sample.details ?? null,
        path,
        method,
        timestamp: '2026-11-16T22:10:00.000Z'
      }
    }
  }
}

/**
 * Genera las respuestas de error de un endpoint agrupadas por status HTTP.
 * @param {{path: string, method: string}} context ruta de ejemplo para los examples
 * @param {...string} codes códigos del diccionario ERRORS que el endpoint puede devolver
 */
export const errorResponses = ({ path, method }, ...codes) => {
  const byStatus = {}
  for (const code of codes) {
    const definition = ERRORS[code]
    if (!definition) throw new Error(`[swagger] El código de error "${code}" no existe en el diccionario`)
    const status = definition.statusCode
    byStatus[status] ??= []
    byStatus[status].push(code)
  }
  return Object.fromEntries(
    Object.entries(byStatus).map(([status, statusCodes]) => [
      status,
      {
        description: `${STATUS_DESCRIPTIONS[status]}. Códigos posibles: ${statusCodes.join(', ')}`,
        content: {
          'application/json': {
            schema: ref('ErrorResponse'),
            examples: Object.fromEntries(statusCodes.map((code) => [code, errorExample(code, path, method)]))
          }
        }
      }
    ])
  )
}

// Respuesta exitosa: { status: "success", payload: <schema> }
export const successResponse = (description, payloadSchema, example) => ({
  description,
  content: {
    'application/json': {
      schema: {
        allOf: [
          ref('SuccessResponse'),
          { type: 'object', properties: { payload: payloadSchema } }
        ]
      },
      ...(example !== undefined && { example: { status: 'success', payload: example } })
    }
  }
})

export const arrayOf = (name) => ({ type: 'array', items: ref(name) })

export const jsonBody = (schemaName, example, required = true) => ({
  required,
  content: { 'application/json': { schema: ref(schemaName), ...(example && { example }) } }
})

// Errores que puede devolver cualquier endpoint que consulta MongoDB.
export const SERVER_ERRORS = Object.freeze(['DATABASE_ERROR', 'INTERNAL_ERROR'])
