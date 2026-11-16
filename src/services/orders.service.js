// Lógica de negocio de pedidos (por ahora, lectura). No conoce Express ni Mongoose.
import { ordersRepository } from '../repositories/orders.repository.js'
import { ORDER_STATUS, ORDER_PRIORITY } from '../constants/index.js'
import { HttpError } from '../utils/http-error.js'

const VALID_STATUSES = Object.values(ORDER_STATUS)
const VALID_PRIORITIES = Object.values(ORDER_PRIORITY)

export const ordersService = {
  getOrders: async ({ status, priority } = {}) => {
    if (status && !VALID_STATUSES.includes(status)) {
      throw HttpError.badRequest(`Estado inválido. Valores permitidos: ${VALID_STATUSES.join(', ')}`)
    }
    if (priority && !VALID_PRIORITIES.includes(priority)) {
      throw HttpError.badRequest(`Prioridad inválida. Valores permitidos: ${VALID_PRIORITIES.join(', ')}`)
    }
    const filters = {}
    if (status) filters.status = status
    if (priority) filters.priority = priority
    return ordersRepository.getAll(filters)
  },

  getOrderById: async (id) => {
    const order = await ordersRepository.getById(id)
    if (!order) throw HttpError.notFound(`No existe un pedido con id ${id}`)
    return order
  }
}
