// Lógica de negocio de entregas (por ahora, lectura). No conoce Express ni Mongoose.
import { deliveriesRepository } from '../repositories/deliveries.repository.js'
import { DELIVERY_STATUS } from '../constants/index.js'
import {
  InvalidIdError,
  InvalidStatusError,
  InvalidQueryParamError,
  DeliveryNotFoundError
} from '../errors/index.js'
import { isValidObjectId, findUnknownParams } from '../utils/validators.js'

const ENTITY = 'entrega'
const VALID_STATUSES = Object.values(DELIVERY_STATUS)
const LIST_QUERY_PARAMS = ['status']

export const deliveriesService = {
  getDeliveries: async (query = {}) => {
    const unknown = findUnknownParams(query, LIST_QUERY_PARAMS)
    if (unknown.length) throw new InvalidQueryParamError(unknown, LIST_QUERY_PARAMS)

    const { status } = query
    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      throw new InvalidStatusError(ENTITY, status, VALID_STATUSES)
    }
    return deliveriesRepository.getAll(status ? { status } : {})
  },

  getDeliveryById: async (id) => {
    if (!isValidObjectId(id)) throw new InvalidIdError(ENTITY, id)
    const delivery = await deliveriesRepository.getById(id)
    if (!delivery) throw new DeliveryNotFoundError(id)
    return delivery
  }
}
