// Único lugar que conoce Mongoose para entregas.
// Encapsula el populate del pedido y del repartidor (solo datos públicos).
import mongoose from 'mongoose'
import DeliveryModel from '../models/delivery.model.js'

const ORDER_FIELDS = 'user status priority total'
const COURIER_FIELDS = 'firstName lastName email role courierProfile'

const isValidId = (id) => mongoose.isValidObjectId(id)

export const deliveriesRepository = {
  getAll: async (filters = {}) => {
    return DeliveryModel
      .find(filters)
      .populate('order', ORDER_FIELDS)
      .populate('courier', COURIER_FIELDS)
      .sort({ createdAt: -1 })
      .lean()
  },

  getById: async (id) => {
    if (!isValidId(id)) return null
    return DeliveryModel
      .findById(id)
      .populate('order', ORDER_FIELDS)
      .populate('courier', COURIER_FIELDS)
      .lean()
  },

  insertMany: async (deliveries) => {
    const inserted = await DeliveryModel.insertMany(deliveries, { ordered: false })
    return inserted.length
  },

  deleteMocks: async () => {
    const { deletedCount } = await DeliveryModel.deleteMany({ isMock: true })
    return deletedCount
  },

  // Rollback de un lote de mocks: borra solo los documentos con esos _id y marcados como mock.
  deleteByIds: async (ids) => {
    const { deletedCount } = await DeliveryModel.deleteMany({ _id: { $in: ids }, isMock: true })
    return deletedCount
  }
}
