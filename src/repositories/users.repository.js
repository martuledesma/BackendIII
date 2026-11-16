// Único lugar que conoce Mongoose para usuarios.
// La proyección pública nunca expone la contraseña; solo getByEmailWithPassword la incluye
// (pensado para un futuro login).
import mongoose from 'mongoose'
import UserModel from '../models/user.model.js'

const BASE_FILTER = Object.freeze({ isDeleted: false })
const PUBLIC_PROJECTION = '-password -isDeleted'

const isValidId = (id) => mongoose.isValidObjectId(id)

export const usersRepository = {
  getAll: async (filters = {}) => {
    return UserModel
      .find({ ...filters, ...BASE_FILTER })
      .select(PUBLIC_PROJECTION)
      .sort({ createdAt: -1 })
      .lean()
  },

  getById: async (id) => {
    if (!isValidId(id)) return null
    return UserModel
      .findOne({ _id: id, ...BASE_FILTER })
      .select(PUBLIC_PROJECTION)
      .lean()
  },

  getByEmail: async (email) => {
    return UserModel
      .findOne({ email: email.toLowerCase(), ...BASE_FILTER })
      .select(PUBLIC_PROJECTION)
      .lean()
  },

  getByEmailWithPassword: async (email) => {
    return UserModel
      .findOne({ email: email.toLowerCase(), ...BASE_FILTER })
      .lean()
  },

  create: async (userData) => {
    const created = await UserModel.create(userData)
    return usersRepository.getById(created._id)
  },

  update: async (id, changes) => {
    if (!isValidId(id)) return null
    return UserModel
      .findOneAndUpdate({ _id: id, ...BASE_FILTER }, changes, { new: true, runValidators: true })
      .select(PUBLIC_PROJECTION)
      .lean()
  },

  softDelete: async (id) => {
    if (!isValidId(id)) return null
    return UserModel
      .findOneAndUpdate({ _id: id, ...BASE_FILTER }, { isDeleted: true }, { new: true })
      .select(PUBLIC_PROJECTION)
      .lean()
  }
}
