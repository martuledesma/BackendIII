// Lógica de negocio de pedidos (por ahora, lectura). No conoce Express ni Mongoose.
import { ordersRepository } from '../repositories/orders.repository.js'
import { ORDER_STATUS, ORDER_PRIORITY } from '../constants/index.js'
import {
  InvalidIdError,
  InvalidStatusError,
  InvalidPriorityError,
  InvalidQueryParamError,
  OrderNotFoundError
} from '../errors/index.js'
import { isValidObjectId, findUnknownParams } from '../utils/validators.js'

const ENTITY = 'pedido'
const VALID_STATUSES = Object.values(ORDER_STATUS)
const VALID_PRIORITIES = Object.values(ORDER_PRIORITY)
const LIST_QUERY_PARAMS = ['status', 'priority']

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
    return ordersRepository.getAll(filters)
  },

  getOrderById: async (id) => {
    if (!isValidObjectId(id)) throw new InvalidIdError(ENTITY, id)
    const order = await ordersRepository.getById(id)
    if (!order) throw new OrderNotFoundError(id)
    return order
  }
}
