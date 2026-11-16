// Único lugar que conoce Mongoose para productos.
// Encapsula el acceso: excluye siempre los borrados lógicos, aplica proyección pública,
// devuelve objetos planos (lean) y traduce ids inválidos a "no encontrado".
import mongoose from 'mongoose'
import ProductModel from '../models/product.model.js'

const BASE_FILTER = Object.freeze({ isDeleted: false })
const PUBLIC_PROJECTION = '-isDeleted'

const isValidId = (id) => mongoose.isValidObjectId(id)

export const productsRepository = {
  getAll: async (filters = {}) => {
    return ProductModel
      .find({ ...filters, ...BASE_FILTER })
      .select(PUBLIC_PROJECTION)
      .sort({ createdAt: -1 })
      .lean()
  },

  getById: async (id) => {
    if (!isValidId(id)) return null
    return ProductModel
      .findOne({ _id: id, ...BASE_FILTER })
      .select(PUBLIC_PROJECTION)
      .lean()
  },

  getByCode: async (code) => {
    return ProductModel
      .findOne({ code, ...BASE_FILTER })
      .select(PUBLIC_PROJECTION)
      .lean()
  },

  create: async (productData) => {
    const created = await ProductModel.create(productData)
    return productsRepository.getById(created._id)
  },

  update: async (id, changes) => {
    if (!isValidId(id)) return null
    return ProductModel
      .findOneAndUpdate({ _id: id, ...BASE_FILTER }, changes, { new: true, runValidators: true })
      .select(PUBLIC_PROJECTION)
      .lean()
  },

  // Borrado lógico: el documento queda en la base pero deja de ser visible.
  softDelete: async (id) => {
    if (!isValidId(id)) return null
    return ProductModel
      .findOneAndUpdate({ _id: id, ...BASE_FILTER }, { isDeleted: true }, { new: true })
      .select(PUBLIC_PROJECTION)
      .lean()
  }
}
