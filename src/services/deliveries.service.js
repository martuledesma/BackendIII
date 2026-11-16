// Lógica de negocio de entregas (por ahora, lectura). No conoce Express ni Mongoose.
import { deliveriesRepository } from '../repositories/deliveries.repository.js'
import { DELIVERY_STATUS } from '../constants/index.js'
import { HttpError } from '../utils/http-error.js'

const VALID_STATUSES = Object.values(DELIVERY_STATUS)

export const deliveriesService = {
  getDeliveries: async ({ status } = {}) => {
    if (status && !VALID_STATUSES.includes(status)) {
      throw HttpError.badRequest(`Estado inválido. Valores permitidos: ${VALID_STATUSES.join(', ')}`)
    }
    return deliveriesRepository.getAll(status ? { status } : {})
  },

  getDeliveryById: async (id) => {
    const delivery = await deliveriesRepository.getById(id)
    if (!delivery) throw HttpError.notFound(`No existe una entrega con id ${id}`)
    return delivery
  }
}
