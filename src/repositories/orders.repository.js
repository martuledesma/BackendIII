// Único lugar que conoce Mongoose para pedidos.
// Encapsula el populate del cliente (solo datos públicos) y el orden por defecto.
import mongoose from 'mongoose'
import OrderModel from '../models/order.model.js'

const USER_PUBLIC_FIELDS = 'firstName lastName email role'

const isValidId = (id) => mongoose.isValidObjectId(id)

export const ordersRepository = {
  getAll: async (filters = {}) => {
    return OrderModel
      .find(filters)
      .populate('user', USER_PUBLIC_FIELDS)
      .sort({ createdAt: -1 })
      .lean()
  },

  getById: async (id) => {
    if (!isValidId(id)) return null
    return OrderModel
      .findById(id)
      .populate('user', USER_PUBLIC_FIELDS)
      .lean()
  },

  create: async (orderData) => {
    const created = await OrderModel.create(orderData)
    return ordersRepository.getById(created._id)
  },

  insertMany: async (orders) => {
    const inserted = await OrderModel.insertMany(orders, { ordered: false })
    return inserted.length
  },

  deleteMocks: async () => {
    const { deletedCount } = await OrderModel.deleteMany({ isMock: true })
    return deletedCount
  },

  // Rollback de un lote de mocks: borra solo los documentos con esos _id y marcados como mock.
  deleteByIds: async (ids) => {
    const { deletedCount } = await OrderModel.deleteMany({ _id: { $in: ids }, isMock: true })
    return deletedCount
  }
}
