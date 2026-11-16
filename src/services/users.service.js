// Lógica de negocio de usuarios. No conoce Express (ni req ni res) ni Mongoose.
import { usersRepository } from '../repositories/users.repository.js'
import { USER_ROLES } from '../constants/index.js'
import { HttpError } from '../utils/http-error.js'
import { hashPassword } from '../utils/password.js'

const REQUIRED_FIELDS = ['firstName', 'lastName', 'email', 'password']
const UPDATABLE_FIELDS = ['firstName', 'lastName', 'role']
const MIN_PASSWORD_LENGTH = 8
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const VALID_ROLES = Object.values(USER_ROLES)

const validateRole = (role) => {
  if (role !== undefined && !VALID_ROLES.includes(role)) {
    throw HttpError.badRequest(`Rol inválido. Valores permitidos: ${VALID_ROLES.join(', ')}`)
  }
}

const findOrFail = async (id) => {
  const user = await usersRepository.getById(id)
  if (!user) throw HttpError.notFound(`No existe un usuario con id ${id}`)
  return user
}

export const usersService = {
  getUsers: async ({ role } = {}) => {
    validateRole(role)
    return usersRepository.getAll(role ? { role } : {})
  },

  getUserById: async (id) => findOrFail(id),

  createUser: async (data = {}) => {
    const missing = REQUIRED_FIELDS.filter((field) => !data[field])
    if (missing.length > 0) {
      throw HttpError.badRequest(`Faltan campos obligatorios: ${missing.join(', ')}`)
    }
    if (!EMAIL_REGEX.test(data.email)) throw HttpError.badRequest('El email no tiene un formato válido')
    if (data.password.length < MIN_PASSWORD_LENGTH) {
      throw HttpError.badRequest(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`)
    }
    validateRole(data.role)

    const existing = await usersRepository.getByEmail(data.email)
    if (existing) throw HttpError.conflict(`El email ${data.email} ya está registrado`)

    return usersRepository.create({
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      password: await hashPassword(data.password),
      role: data.role ?? USER_ROLES.USER
    })
  },

  updateUser: async (id, data = {}) => {
    const current = await findOrFail(id)

    const changes = Object.fromEntries(
      Object.entries(data).filter(([key]) => UPDATABLE_FIELDS.includes(key))
    )
    if (Object.keys(changes).length === 0) {
      throw HttpError.badRequest(`No hay campos válidos para actualizar. Permitidos: ${UPDATABLE_FIELDS.join(', ')}`)
    }
    validateRole(changes.role)

    // Regla de negocio: no se puede quitar el rol al último administrador.
    if (current.role === USER_ROLES.ADMIN && changes.role === USER_ROLES.USER) {
      await ensureNotLastAdmin()
    }

    return usersRepository.update(id, changes)
  },

  deleteUser: async (id) => {
    const current = await findOrFail(id)
    if (current.role === USER_ROLES.ADMIN) await ensureNotLastAdmin()
    return usersRepository.softDelete(id)
  }
}

async function ensureNotLastAdmin () {
  const admins = await usersRepository.getAll({ role: USER_ROLES.ADMIN })
  if (admins.length <= 1) {
    throw HttpError.conflict('No se puede quitar o eliminar al último usuario ADMIN')
  }
}
