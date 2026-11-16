// Lógica de negocio de pedidos. No conoce Express ni Mongoose.
import { ordersRepository } from '../repositories/orders.repository.js'
import { usersRepository } from '../repositories/users.repository.js'
import { deliveriesRepository } from '../repositories/deliveries.repository.js'
import {
  ORDER_STATUS,
  ORDER_PRIORITY,
  ORDER_STATUS_TRANSITIONS,
  DELIVERY_STATUS,
  DELIVERY_DEFAULTS,
  USER_ROLES
} from '../constants/index.js'
import { logger } from '../config/logger.js'
import {
  InvalidIdError,
  InvalidFieldError,
  MissingFieldsError,
  InvalidStatusError,
  InvalidPriorityError,
  InvalidQueryParamError,
  OrderNotFoundError,
  UserNotFoundError,
  InvalidStatusTransitionError,
  CourierNotAssignedError
} from '../errors/index.js'
import { isValidObjectId, findUnknownParams } from '../utils/validators.js'
import { generateTrackingCode } from '../utils/tracking-code.js'

const ENTITY = 'pedido'
const VALID_STATUSES = Object.values(ORDER_STATUS)
const VALID_PRIORITIES = Object.values(ORDER_PRIORITY)
const LIST_QUERY_PARAMS = ['status', 'priority']
const REQUIRED_FIELDS = ['user', 'items', 'shippingAddress']
const ADDRESS_FIELDS = ['street', 'city', 'province', 'zipCode']

// Regla de negocio: el total es la suma de precio unitario × cantidad. Nunca lo envía el cliente.
export const calculateOrderTotal = (items) =>
  items.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0)

const validateItems = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new InvalidFieldError('items', 'debe ser una lista con al menos un ítem', items)
  }
  items.forEach((item, i) => {
    if (typeof item?.title !== 'string' || item.title.trim() === '') {
      throw new InvalidFieldError(`items[${i}].title`, 'es obligatorio', item?.title)
    }
    if (typeof item.unitPrice !== 'number' || Number.isNaN(item.unitPrice) || item.unitPrice < 0) {
      throw new InvalidFieldError(`items[${i}].unitPrice`, 'debe ser un número mayor o igual a 0', item.unitPrice)
    }
    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      throw new InvalidFieldError(`items[${i}].quantity`, 'debe ser un entero mayor o igual a 1', item.quantity)
    }
  })
  return items.map(({ title, unitPrice, quantity }) => ({ title: title.trim(), unitPrice, quantity }))
}

const validateAddress = (address) => {
  if (typeof address !== 'object' || address === null) {
    throw new InvalidFieldError('shippingAddress', 'debe ser un objeto con street, city, province y zipCode', address)
  }
  const missing = ADDRESS_FIELDS.filter((field) => !address[field]).map((field) => `shippingAddress.${field}`)
  if (missing.length) throw new MissingFieldsError(missing)
  return Object.fromEntries(ADDRESS_FIELDS.map((field) => [field, String(address[field]).trim()]))
}

const DAY_MS = 24 * 60 * 60 * 1000

const findOrderOrFail = async (id) => {
  if (!isValidObjectId(id)) throw new InvalidIdError(ENTITY, id)
  const order = await ordersRepository.getById(id)
  if (!order) throw new OrderNotFoundError(id)
  return order
}

// Qué le pasa a la entrega cuando cambia el estado del pedido.
// Mantiene la misma regla que el módulo de mocks: CONFIRMED tiene entrega (sin asignar al crearla),
// IN_TRANSIT y DELIVERED tienen repartidor.
const syncDelivery = async (order, nextStatus) => {
  const delivery = await deliveriesRepository.getByOrderId(order._id)

  switch (nextStatus) {
    case ORDER_STATUS.CONFIRMED:
      // Se crea la entrega, todavía sin repartidor.
      await deliveriesRepository.create({
        order: order._id,
        courier: null,
        status: DELIVERY_STATUS.UNASSIGNED,
        trackingCode: generateTrackingCode(),
        estimatedDeliveryDate: new Date(Date.now() + DELIVERY_DEFAULTS.ESTIMATED_DAYS * DAY_MS)
      })
      logger.warning(`Pedido ${order._id} confirmado: su entrega queda sin repartidor asignado`)
      return

    case ORDER_STATUS.IN_TRANSIT:
      // Solo sale a reparto si la entrega ya tiene repartidor.
      if (!delivery?.courier) throw new CourierNotAssignedError(String(order._id))
      await deliveriesRepository.update(delivery._id, { status: DELIVERY_STATUS.IN_TRANSIT })
      return

    case ORDER_STATUS.DELIVERED:
      await deliveriesRepository.update(delivery._id, { status: DELIVERY_STATUS.DELIVERED, deliveredAt: new Date() })
      return

    case ORDER_STATUS.CANCELLED:
      // Si ya tenía entrega (pedido confirmado), la entrega queda fallida.
      if (delivery) await deliveriesRepository.update(delivery._id, { status: DELIVERY_STATUS.FAILED })
  }
}

export const ordersService = {
  getOrders: async (query = {}) => {
    const unknown = findUnknownParams(query, LIST_QUERY_PARAMS)
    if (unknown.length) throw new InvalidQueryParamError(unknown, LIST_QUERY_PARAMS)

    const { status, priority } = query
    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      throw new InvalidStatusError(ENTITY, status, VALID_STATUSES)
    }
    if (priority !== undefined && !VALID_PRIORITIES.includes(priority)) {
      throw new InvalidPriorityError(priority, VALID_PRIORITIES)
    }

    const filters = {}
    if (status) filters.status = status
    if (priority) filters.priority = priority
    logger.debug(`Consultando pedidos con filtros ${JSON.stringify(filters)}`)
    return ordersRepository.getAll(filters)
  },

  getOrderById: async (id) => findOrderOrFail(id),

  // Cambia el estado respetando ORDER_STATUS_TRANSITIONS y sincroniza la entrega.
  updateOrderStatus: async (id, data = {}) => {
    if (data.status === undefined) throw new MissingFieldsError(['status'])
    if (!VALID_STATUSES.includes(data.status)) throw new InvalidStatusError(ENTITY, data.status, VALID_STATUSES)

    const order = await findOrderOrFail(id)
    const allowed = ORDER_STATUS_TRANSITIONS[order.status]
    if (!allowed.includes(data.status)) {
      throw new InvalidStatusTransitionError(ENTITY, order.status, data.status, allowed)
    }

    await syncDelivery(order, data.status)
    const updated = await ordersRepository.updateStatus(id, data.status)
    logger.info(`Pedido ${id}: estado ${order.status} → ${data.status}`)
    return updated
  },

  // Un pedido nuevo siempre arranca en PENDING y con el total calculado por el sistema.
  createOrder: async (data = {}) => {
    const missing = REQUIRED_FIELDS.filter((field) => data[field] === undefined)
    if (missing.length) throw new MissingFieldsError(missing)

    if (!isValidObjectId(data.user)) throw new InvalidIdError('usuario', data.user)
    const items = validateItems(data.items)
    const shippingAddress = validateAddress(data.shippingAddress)

    const priority = data.priority ?? ORDER_PRIORITY.NORMAL
    if (!VALID_PRIORITIES.includes(priority)) throw new InvalidPriorityError(priority, VALID_PRIORITIES)

    // Relación pedido ↔ usuario: debe existir y ser un cliente.
    const customer = await usersRepository.getById(data.user)
    if (!customer) throw new UserNotFoundError(data.user)
    if (customer.role !== USER_ROLES.USER) {
      throw new InvalidFieldError('user', `debe ser un cliente (rol ${USER_ROLES.USER}), no ${customer.role}`, data.user)
    }

    const total = calculateOrderTotal(items)
    const order = await ordersRepository.create({
      user: customer._id,
      items,
      total,
      shippingAddress,
      status: ORDER_STATUS.PENDING,
      priority
    })

    logger.info(`Pedido ${order._id} creado para ${customer.email} (total $${total}, prioridad ${priority})`)
    if (priority === ORDER_PRIORITY.URGENT) {
      logger.warning(`Pedido urgente ${order._id} pendiente de confirmación y sin repartidor asignado`)
    }
    return order
  }
}
