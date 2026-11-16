// Lógica de negocio del módulo de mocking.
// Decide QUÉ se genera y con qué reglas; delega la generación de campos a utils/mock-generators.js
// y la persistencia a los repositories. Valida la entrada y lanza errores del dominio:
// nunca arma respuestas HTTP (eso lo hace el middleware global de errores).
import { config, logger } from '../config/index.js'
import {
  USER_ROLES,
  ORDER_STATUS,
  ORDER_PRIORITY,
  DELIVERY_STATUS,
  MOCK_ENTITIES,
  MOCK_LIMITS,
  MOCK_DEFAULTS
} from '../constants/index.js'
import { usersRepository } from '../repositories/users.repository.js'
import { ordersRepository } from '../repositories/orders.repository.js'
import { deliveriesRepository } from '../repositories/deliveries.repository.js'
import { calculateOrderTotal } from './orders.service.js'
import {
  AppError,
  InvalidFieldError,
  InvalidRoleError,
  InvalidQueryParamError,
  InvalidMockQuantityError,
  InvalidMockEntityError,
  MockDependencyError,
  MockGenerationError,
  MockSeedError,
  SeedingDisabledError
} from '../errors/index.js'
import { hashPassword } from '../utils/password.js'
import { findUnknownParams } from '../utils/validators.js'
import {
  generatePerson,
  generateCourierProfile,
  generateOrderItems,
  generateAddress,
  generateTrackingCode,
  generateFutureDate,
  generateRecentDate,
  generateObjectId,
  pickOne,
  pickWeighted
} from '../utils/mock-generators.js'

// ---------- Reglas del dominio ----------

// Qué estados de entrega son coherentes con cada estado de pedido.
// PENDING y CANCELLED no tienen entrega: el pedido todavía no se confirmó o ya no sale.
const DELIVERY_STATUSES_BY_ORDER_STATUS = Object.freeze({
  [ORDER_STATUS.CONFIRMED]: [DELIVERY_STATUS.UNASSIGNED, DELIVERY_STATUS.ASSIGNED],
  [ORDER_STATUS.IN_TRANSIT]: [DELIVERY_STATUS.IN_TRANSIT],
  [ORDER_STATUS.DELIVERED]: [DELIVERY_STATUS.DELIVERED]
})

// Estados de entrega que obligatoriamente tienen un repartidor asignado.
const DELIVERY_STATUSES_WITH_COURIER = Object.freeze([
  DELIVERY_STATUS.ASSIGNED,
  DELIVERY_STATUS.IN_TRANSIT,
  DELIVERY_STATUS.DELIVERED
])

// Mezcla por defecto de GET /api/mocks/users: mayoría clientes, algunos repartidores.
const DEFAULT_ROLE_WEIGHTS = Object.freeze([
  { value: USER_ROLES.USER, weight: 7 },
  { value: USER_ROLES.COURIER, weight: 3 }
])

const VALID_ROLES = Object.values(USER_ROLES)
const SEEDABLE_ENTITIES = Object.values(MOCK_ENTITIES)
const BOOLEAN_VALUES = ['true', 'false']
const QTY_LIMITS = Object.freeze({ min: 1, max: MOCK_LIMITS.MAX_QTY })

// Parámetros de query aceptados por cada operación.
const QUERY_PARAMS = Object.freeze({
  USERS: ['qty', 'role'],
  QTY_ONLY: ['qty'],
  // simulateFailure solo existe fuera de producción (sirve para probar el rollback).
  SEED: config.isProduction ? ['entity', 'qty', 'role'] : ['entity', 'qty', 'role', 'simulateFailure'],
  NONE: []
})

const orderHasDelivery = (status) => status in DELIVERY_STATUSES_BY_ORDER_STATUS

// Estados de pedido posibles según si hay repartidores y si se exige entrega.
const allowedOrderStatuses = ({ hasCouriers, onlyWithDelivery }) =>
  Object.values(ORDER_STATUS).filter((status) => {
    if (onlyWithDelivery && !orderHasDelivery(status)) return false
    if (!hasCouriers && orderHasDelivery(status)) {
      // Sin repartidores solo es válido un pedido confirmado con entrega sin asignar.
      return status === ORDER_STATUS.CONFIRMED
    }
    return true
  })

// ---------- Validaciones de entrada ----------

const validateQueryParams = (query, allowed) => {
  const unknown = findUnknownParams(query, allowed)
  if (unknown.length) throw new InvalidQueryParamError(unknown, allowed)
}

// qty: entero entre 1 y MAX_QTY. Rechaza decimales, texto, negativos, cero y repetidos (?qty=1&qty=2).
const parseQty = (qty) => {
  if (qty === undefined) return MOCK_LIMITS.DEFAULT_QTY
  if (typeof qty !== 'string' || !/^-?\d+$/.test(qty.trim())) {
    throw new InvalidMockQuantityError(qty, QTY_LIMITS)
  }
  const value = Number(qty)
  if (value < QTY_LIMITS.min || value > QTY_LIMITS.max) throw new InvalidMockQuantityError(qty, QTY_LIMITS)
  return value
}

const parseRole = (role) => {
  if (role === undefined) return null
  if (!VALID_ROLES.includes(role)) throw new InvalidRoleError(role, VALID_ROLES)
  return role
}

const parseEntity = (entity) => {
  if (entity === undefined) return MOCK_ENTITIES.USERS
  if (!SEEDABLE_ENTITIES.includes(entity)) throw new InvalidMockEntityError(entity, SEEDABLE_ENTITIES)
  return entity
}

const parseBoolean = (field, value) => {
  if (value === undefined) return false
  if (!BOOLEAN_VALUES.includes(value)) throw new InvalidFieldError(field, 'debe ser "true" o "false"', value)
  return value === 'true'
}

const ensureSeedingAllowed = () => {
  if (config.isProduction) throw new SeedingDisabledError(config.nodeEnv)
}

// Envuelve la generación en memoria: cualquier fallo inesperado (faker, datos corruptos)
// se transforma en un error controlado del dominio.
const generate = (entity, fn) => {
  try {
    return fn()
  } catch (error) {
    if (error instanceof AppError) throw error
    throw new MockGenerationError(entity, error)
  }
}

// Cuenta los documentos de un resultado (lista o dataset { users, couriers, orders, deliveries }).
const describeCount = (result) =>
  Array.isArray(result)
    ? `${result.length}`
    : Object.entries(result).map(([key, list]) => `${list.length} ${key}`).join(', ')

// Para los GET: genera en memoria y deja registro de qué se generó.
const generateAndLog = (entity, fn) => {
  const result = generate(entity, fn)
  logger.info(`Mocks generados en memoria (sin guardar): ${describeCount(result)} ${Array.isArray(result) ? entity : ''}`.trim())
  return result
}

// ---------- Construcción de entidades ----------

const buildUser = (role) => ({
  ...generatePerson(),
  role,
  // Regla: solo los repartidores tienen perfil de repartidor.
  courierProfile: role === USER_ROLES.COURIER ? generateCourierProfile() : null,
  isMock: true
})

const buildUsers = (qty, role = null) =>
  Array.from({ length: qty }, () => buildUser(role ?? pickWeighted(DEFAULT_ROLE_WEIGHTS)))

const buildDelivery = (order, courierIds) => {
  const candidates = DELIVERY_STATUSES_BY_ORDER_STATUS[order.status].filter(
    (status) => courierIds.length > 0 || !DELIVERY_STATUSES_WITH_COURIER.includes(status)
  )
  const status = pickOne(candidates)
  const needsCourier = DELIVERY_STATUSES_WITH_COURIER.includes(status)
  const isDelivered = status === DELIVERY_STATUS.DELIVERED
  const deliveredAt = isDelivered ? generateRecentDate() : null

  return {
    _id: generateObjectId(),
    order: order._id,
    courier: needsCourier ? pickOne(courierIds) : null,
    status,
    trackingCode: generateTrackingCode(),
    estimatedDeliveryDate: isDelivered ? deliveredAt : generateFutureDate(),
    deliveredAt,
    isMock: true
  }
}

// Genera pedidos (y sus entregas cuando corresponde) relacionados con los ids recibidos.
const buildOrdersWithDeliveries = (qty, { customerIds, courierIds, onlyWithDelivery = false }) => {
  const statuses = allowedOrderStatuses({ hasCouriers: courierIds.length > 0, onlyWithDelivery })
  const orders = []
  const deliveries = []

  for (let i = 0; i < qty; i++) {
    const items = generateOrderItems()
    const order = {
      _id: generateObjectId(),
      user: pickOne(customerIds),
      items,
      total: calculateOrderTotal(items),
      shippingAddress: generateAddress(),
      status: pickOne(statuses),
      priority: pickOne(Object.values(ORDER_PRIORITY)),
      isMock: true
    }
    orders.push(order)
    if (orderHasDelivery(order.status)) deliveries.push(buildDelivery(order, courierIds))
  }

  return { orders, deliveries }
}

// Clientes y repartidores en memoria, en proporción a la cantidad de pedidos.
const buildRelatedPeople = (qty) => ({
  users: buildUsers(Math.max(1, Math.ceil(qty / 3)), USER_ROLES.USER),
  couriers: buildUsers(Math.max(1, Math.ceil(qty / 5)), USER_ROLES.COURIER)
})

const buildDataset = (qty) => {
  const { users, couriers } = buildRelatedPeople(qty)
  const { orders, deliveries } = buildOrdersWithDeliveries(qty, {
    customerIds: users.map((u) => u._id),
    courierIds: couriers.map((c) => c._id)
  })
  return { users, couriers, orders, deliveries }
}

const withPassword = async (users) => {
  // Un solo hash para todo el lote: es más rápido y todos comparten la misma contraseña de prueba.
  const password = await hashPassword(MOCK_DEFAULTS.PASSWORD)
  return users.map((user) => ({ ...user, password }))
}

const getSeedRelations = async (entity) => {
  const [customerIds, courierIds] = await Promise.all([
    usersRepository.getIdsByRole(USER_ROLES.USER),
    usersRepository.getIdsByRole(USER_ROLES.COURIER)
  ])
  if (customerIds.length === 0) {
    throw new MockDependencyError(
      entity,
      `clientes (rol ${USER_ROLES.USER})`,
      `Cargalos primero con POST /api/mocks/seed?entity=${MOCK_ENTITIES.USERS} o usá entity=${MOCK_ENTITIES.ALL}`
    )
  }
  if (courierIds.length === 0) {
    logger.warning(
      `No hay repartidores (rol ${USER_ROLES.COURIER}) en la base: los pedidos de ${entity} se generan sin repartidor asignado`
    )
  }
  return { customerIds, courierIds }
}

// ---------- Inserción controlada con rollback ----------

const REPOSITORIES = Object.freeze({
  [MOCK_ENTITIES.USERS]: usersRepository,
  [MOCK_ENTITIES.ORDERS]: ordersRepository,
  [MOCK_ENTITIES.DELIVERIES]: deliveriesRepository
})

// Borra los documentos de este lote, en orden inverso a las dependencias.
const rollbackBatch = async (idsByCollection) => {
  try {
    const eliminados = {}
    for (const collection of [MOCK_ENTITIES.DELIVERIES, MOCK_ENTITIES.ORDERS, MOCK_ENTITIES.USERS]) {
      const ids = idsByCollection[collection] ?? []
      if (ids.length) eliminados[collection] = await REPOSITORIES[collection].deleteByIds(ids)
    }
    return { done: true, eliminados }
  } catch (error) {
    return { done: false, reason: error.message }
  }
}

/**
 * Inserta los lotes en orden (users → orders → deliveries). Si algo falla,
 * revierte lo que se haya insertado de ESTE lote y lanza MockSeedError.
 * @param {string} entity entidad pedida (para el mensaje de error)
 * @param {Array<[string, object[]]>} steps [[coleccion, documentos], ...]
 */
const insertBatch = async (entity, steps, { simulateFailure }) => {
  const pending = steps.filter(([, docs]) => docs.length > 0)
  const idsByCollection = {}
  for (const [collection, docs] of pending) {
    idsByCollection[collection] = [...(idsByCollection[collection] ?? []), ...docs.map((d) => d._id)]
  }

  try {
    const inserted = {}
    for (const [index, [collection, docs]] of pending.entries()) {
      inserted[collection] = (inserted[collection] ?? 0) + await REPOSITORIES[collection].insertMany(docs)
      if (simulateFailure && index === 0) {
        throw new Error(`Falla simulada después de insertar ${collection} (simulateFailure=true)`)
      }
    }
    return inserted
  } catch (cause) {
    logger.warning(`Falló el seed de ${entity} (${cause.message}). Revirtiendo el lote...`)
    const rollback = await rollbackBatch(idsByCollection)
    if (!rollback.done) logger.error(`No se pudo revertir el lote de ${entity}: ${rollback.reason}`)
    throw new MockSeedError(entity, cause, rollback)
  }
}

// ---------- API del service ----------

export const mocksService = {
  // GET: solo generan datos en memoria, no tocan la base.
  generateUsers: (query = {}) => {
    validateQueryParams(query, QUERY_PARAMS.USERS)
    const qty = parseQty(query.qty)
    const role = parseRole(query.role)
    return generateAndLog(MOCK_ENTITIES.USERS, () => buildUsers(qty, role))
  },

  generateCouriers: (query = {}) => {
    validateQueryParams(query, QUERY_PARAMS.QTY_ONLY)
    const qty = parseQty(query.qty)
    return generateAndLog(MOCK_ENTITIES.COURIERS, () => buildUsers(qty, USER_ROLES.COURIER))
  },

  generateOrders: (query = {}) => {
    validateQueryParams(query, QUERY_PARAMS.QTY_ONLY)
    const qty = parseQty(query.qty)
    return generateAndLog(MOCK_ENTITIES.ORDERS, () => buildDataset(qty).orders)
  },

  generateDeliveries: (query = {}) => {
    validateQueryParams(query, QUERY_PARAMS.QTY_ONLY)
    const qty = parseQty(query.qty)
    return generateAndLog(MOCK_ENTITIES.DELIVERIES, () => {
      const { users, couriers } = buildRelatedPeople(qty)
      return buildOrdersWithDeliveries(qty, {
        customerIds: users.map((u) => u._id),
        courierIds: couriers.map((c) => c._id),
        onlyWithDelivery: true
      }).deliveries
    })
  },

  generateDataset: (query = {}) => {
    validateQueryParams(query, QUERY_PARAMS.QTY_ONLY)
    const qty = parseQty(query.qty)
    return generateAndLog(MOCK_ENTITIES.ALL, () => buildDataset(qty))
  },

  // POST: inserta datos de prueba en MongoDB.
  seed: async (query = {}) => {
    logger.debug(`Seed solicitado con parámetros ${JSON.stringify(query)}`)
    const result = await runSeed(query)
    logger.info(`Seed completado en MongoDB: ${JSON.stringify(result)}`)
    return result
  },

  // DELETE: borra solo lo generado por mocks (isMock: true). Los datos reales no se tocan.
  clear: async (query = {}) => {
    ensureSeedingAllowed()
    validateQueryParams(query, QUERY_PARAMS.NONE)
    // Orden inverso a las dependencias: entregas → pedidos → usuarios.
    const deliveries = await deliveriesRepository.deleteMocks()
    const orders = await ordersRepository.deleteMocks()
    const users = await usersRepository.deleteMocks()
    const eliminados = {
      [MOCK_ENTITIES.DELIVERIES]: deliveries,
      [MOCK_ENTITIES.ORDERS]: orders,
      [MOCK_ENTITIES.USERS]: users
    }
    logger.info(`Datos de prueba eliminados de MongoDB: ${JSON.stringify(eliminados)}`)
    return { eliminados }
  }
}

// Lógica del seed: valida la entrada, genera y carga en MongoDB.
const runSeed = async (query = {}) => {
  ensureSeedingAllowed()
  validateQueryParams(query, QUERY_PARAMS.SEED)
  const entity = parseEntity(query.entity)
  const qty = parseQty(query.qty)
  const role = parseRole(query.role)
  const simulateFailure = parseBoolean('simulateFailure', query.simulateFailure)

  // role solo tiene sentido al cargar usuarios.
  if (role && entity !== MOCK_ENTITIES.USERS) {
    throw new InvalidQueryParamError(['role'], QUERY_PARAMS.SEED.filter((p) => p !== 'role'))
  }
  const options = { simulateFailure }

  switch (entity) {
    case MOCK_ENTITIES.USERS: {
      const users = await withPassword(generate(entity, () => buildUsers(qty, role)))
      const inserted = await insertBatch(entity, [[MOCK_ENTITIES.USERS, users]], options)
      return { insertados: inserted[MOCK_ENTITIES.USERS], coleccion: MOCK_ENTITIES.USERS }
    }

    case MOCK_ENTITIES.COURIERS: {
      const couriers = await withPassword(generate(entity, () => buildUsers(qty, USER_ROLES.COURIER)))
      const inserted = await insertBatch(entity, [[MOCK_ENTITIES.USERS, couriers]], options)
      // Los repartidores son usuarios con rol COURIER: viven en la colección users.
      return { insertados: inserted[MOCK_ENTITIES.USERS], coleccion: MOCK_ENTITIES.USERS, rol: USER_ROLES.COURIER }
    }

    case MOCK_ENTITIES.ORDERS: {
      const relations = await getSeedRelations(entity)
      const { orders, deliveries } = generate(entity, () => buildOrdersWithDeliveries(qty, relations))
      const inserted = await insertBatch(entity, [
        [MOCK_ENTITIES.ORDERS, orders],
        [MOCK_ENTITIES.DELIVERIES, deliveries]
      ], options)
      return {
        insertados: inserted[MOCK_ENTITIES.ORDERS],
        coleccion: MOCK_ENTITIES.ORDERS,
        relacionados: { [MOCK_ENTITIES.DELIVERIES]: inserted[MOCK_ENTITIES.DELIVERIES] ?? 0 }
      }
    }

    case MOCK_ENTITIES.DELIVERIES: {
      const relations = await getSeedRelations(entity)
      const { orders, deliveries } = generate(entity, () =>
        buildOrdersWithDeliveries(qty, { ...relations, onlyWithDelivery: true })
      )
      // Primero los pedidos: cada entrega referencia a su pedido.
      const inserted = await insertBatch(entity, [
        [MOCK_ENTITIES.ORDERS, orders],
        [MOCK_ENTITIES.DELIVERIES, deliveries]
      ], options)
      return {
        insertados: inserted[MOCK_ENTITIES.DELIVERIES],
        coleccion: MOCK_ENTITIES.DELIVERIES,
        relacionados: { [MOCK_ENTITIES.ORDERS]: inserted[MOCK_ENTITIES.ORDERS] }
      }
    }

    case MOCK_ENTITIES.ALL: {
      const dataset = generate(entity, () => buildDataset(qty))
      const people = await withPassword([...dataset.users, ...dataset.couriers])
      await insertBatch(entity, [
        [MOCK_ENTITIES.USERS, people],
        [MOCK_ENTITIES.ORDERS, dataset.orders],
        [MOCK_ENTITIES.DELIVERIES, dataset.deliveries]
      ], options)
      const detalle = {
        [MOCK_ENTITIES.USERS]: dataset.users.length,
        [MOCK_ENTITIES.COURIERS]: dataset.couriers.length,
        [MOCK_ENTITIES.ORDERS]: dataset.orders.length,
        [MOCK_ENTITIES.DELIVERIES]: dataset.deliveries.length
      }
      const insertados = Object.values(detalle).reduce((a, b) => a + b, 0)
      return { insertados, coleccion: MOCK_ENTITIES.ALL, detalle }
    }
  }
}
