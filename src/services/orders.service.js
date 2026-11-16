// Lógica de negocio de pedidos. No conoce Express ni Mongoose.
import { ordersRepository } from '../repositories/orders.repository.js'
import { usersRepository } from '../repositories/users.repository.js'
import { ORDER_STATUS, ORDER_PRIORITY, USER_ROLES } from '../constants/index.js'
import { logger } from '../config/logger.js'
import {
  InvalidIdError,
  InvalidFieldError,
  MissingFieldsError,
  InvalidStatusError,
  InvalidPriorityError,
  InvalidQueryParamError,
  OrderNotFoundError,
  UserNotFoundError
} from '../errors/index.js'
import { isValidObjectId, findUnknownParams } from '../utils/validators.js'

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

  getOrderById: async (id) => {
    if (!isValidObjectId(id)) throw new InvalidIdError(ENTITY, id)
    const order = await ordersRepository.getById(id)
    if (!order) throw new OrderNotFoundError(id)
    return order
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
