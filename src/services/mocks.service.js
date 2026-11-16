// Lógica de negocio del módulo de mocking.
// Decide QUÉ se genera y con qué reglas; delega la generación de campos a utils/mock-generators.js
// y la persistencia a los repositories. No conoce Express ni Mongoose.
import { config } from '../config/index.js'
import {
  USER_ROLES,
  ORDER_STATUS,
  ORDER_PRIORITY,
  DELIVERY_STATUS,
  MOCK_ENTITIES,
  MOCK_LIMITS,
  MOCK_DEFAULTS,
  HTTP_STATUS
} from '../constants/index.js'
import { usersRepository } from '../repositories/users.repository.js'
import { ordersRepository } from '../repositories/orders.repository.js'
import { deliveriesRepository } from '../repositories/deliveries.repository.js'
import { HttpError } from '../utils/http-error.js'
import { hashPassword } from '../utils/password.js'
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

export const calculateOrderTotal = (items) =>
  items.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0)

// ---------- Validaciones ----------

const parseQty = (qty) => {
  if (qty === undefined || qty === '') return MOCK_LIMITS.DEFAULT_QTY
  const value = Number(qty)
  if (!Number.isInteger(value) || value < 1 || value > MOCK_LIMITS.MAX_QTY) {
    throw HttpError.badRequest(`qty debe ser un entero entre 1 y ${MOCK_LIMITS.MAX_QTY}`)
  }
  return value
}

const parseRole = (role) => {
  if (role === undefined || role === '') return null
  if (!VALID_ROLES.includes(role)) {
    throw HttpError.badRequest(`Rol inválido. Valores permitidos: ${VALID_ROLES.join(', ')}`)
  }
  return role
}

const ensureSeedingAllowed = () => {
  if (config.isProduction) {
    throw new HttpError(HTTP_STATUS.FORBIDDEN, 'La carga de datos de prueba está deshabilitada en producción')
  }
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

// Conjunto completo y relacionado, en memoria. Por cada `qty` pedidos genera
// aprox. 1 cliente cada 3 pedidos y 1 repartidor cada 5.
const buildDataset = (qty) => {
  const users = buildUsers(Math.max(1, Math.ceil(qty / 3)), USER_ROLES.USER)
  const couriers = buildUsers(Math.max(1, Math.ceil(qty / 5)), USER_ROLES.COURIER)
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

const getSeedRelations = async () => {
  const [customerIds, courierIds] = await Promise.all([
    usersRepository.getIdsByRole(USER_ROLES.USER),
    usersRepository.getIdsByRole(USER_ROLES.COURIER)
  ])
  if (customerIds.length === 0) {
    throw HttpError.conflict(
      `No hay clientes (rol ${USER_ROLES.USER}) en la base. Cargalos primero con ` +
      `POST /api/mocks/seed?entity=${MOCK_ENTITIES.USERS} o usá entity=${MOCK_ENTITIES.ALL}`
    )
  }
  return { customerIds, courierIds }
}

// ---------- API del service ----------

export const mocksService = {
  // GET: solo generan datos en memoria, no tocan la base.
  generateUsers: ({ qty, role } = {}) => buildUsers(parseQty(qty), parseRole(role)),

  generateCouriers: ({ qty } = {}) => buildUsers(parseQty(qty), USER_ROLES.COURIER),

  generateOrders: ({ qty } = {}) => buildDataset(parseQty(qty)).orders,

  generateDeliveries: ({ qty } = {}) => {
    const count = parseQty(qty)
    const users = buildUsers(Math.max(1, Math.ceil(count / 3)), USER_ROLES.USER)
    const couriers = buildUsers(Math.max(1, Math.ceil(count / 5)), USER_ROLES.COURIER)
    return buildOrdersWithDeliveries(count, {
      customerIds: users.map((u) => u._id),
      courierIds: couriers.map((c) => c._id),
      onlyWithDelivery: true
    }).deliveries
  },

  generateDataset: ({ qty } = {}) => buildDataset(parseQty(qty)),

  // POST: inserta datos de prueba en MongoDB.
  seed: async ({ entity = MOCK_ENTITIES.USERS, qty, role } = {}) => {
    ensureSeedingAllowed()
    if (!SEEDABLE_ENTITIES.includes(entity)) {
      throw HttpError.badRequest(`entity inválida. Valores permitidos: ${SEEDABLE_ENTITIES.join(', ')}`)
    }
    const count = parseQty(qty)

    switch (entity) {
      case MOCK_ENTITIES.USERS: {
        const users = await withPassword(buildUsers(count, parseRole(role)))
        return { insertados: await usersRepository.insertMany(users), coleccion: MOCK_ENTITIES.USERS }
      }

      case MOCK_ENTITIES.COURIERS: {
        const couriers = await withPassword(buildUsers(count, USER_ROLES.COURIER))
        // Los repartidores son usuarios con rol COURIER: viven en la colección users.
        return { insertados: await usersRepository.insertMany(couriers), coleccion: MOCK_ENTITIES.USERS, rol: USER_ROLES.COURIER }
      }

      case MOCK_ENTITIES.ORDERS: {
        const relations = await getSeedRelations()
        const { orders, deliveries } = buildOrdersWithDeliveries(count, relations)
        const insertados = await ordersRepository.insertMany(orders)
        const entregas = deliveries.length ? await deliveriesRepository.insertMany(deliveries) : 0
        return { insertados, coleccion: MOCK_ENTITIES.ORDERS, relacionados: { [MOCK_ENTITIES.DELIVERIES]: entregas } }
      }

      case MOCK_ENTITIES.DELIVERIES: {
        const relations = await getSeedRelations()
        const { orders, deliveries } = buildOrdersWithDeliveries(count, { ...relations, onlyWithDelivery: true })
        // Primero los pedidos: cada entrega referencia a su pedido.
        const pedidos = await ordersRepository.insertMany(orders)
        const insertados = await deliveriesRepository.insertMany(deliveries)
        return { insertados, coleccion: MOCK_ENTITIES.DELIVERIES, relacionados: { [MOCK_ENTITIES.ORDERS]: pedidos } }
      }

      case MOCK_ENTITIES.ALL: {
        const dataset = buildDataset(count)
        const people = await withPassword([...dataset.users, ...dataset.couriers])
        await usersRepository.insertMany(people)
        await ordersRepository.insertMany(dataset.orders)
        if (dataset.deliveries.length) await deliveriesRepository.insertMany(dataset.deliveries)
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
  },

  // DELETE: borra solo lo generado por mocks (isMock: true). Los datos reales no se tocan.
  clear: async () => {
    ensureSeedingAllowed()
    // Orden inverso a las dependencias: entregas → pedidos → usuarios.
    const deliveries = await deliveriesRepository.deleteMocks()
    const orders = await ordersRepository.deleteMocks()
    const users = await usersRepository.deleteMocks()
    return {
      eliminados: {
        [MOCK_ENTITIES.DELIVERIES]: deliveries,
        [MOCK_ENTITIES.ORDERS]: orders,
        [MOCK_ENTITIES.USERS]: users
      }
    }
  }
}
