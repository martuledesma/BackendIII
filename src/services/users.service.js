// Lógica de negocio de usuarios. No conoce Express (ni req ni res) ni Mongoose.
import { usersRepository } from '../repositories/users.repository.js'
import { USER_ROLES, VEHICLE_TYPES } from '../constants/index.js'
import { HttpError } from '../utils/http-error.js'
import { hashPassword } from '../utils/password.js'

const REQUIRED_FIELDS = ['firstName', 'lastName', 'email', 'password']
const UPDATABLE_FIELDS = ['firstName', 'lastName', 'phone', 'role', 'courierProfile']
const MIN_PASSWORD_LENGTH = 8
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const VALID_ROLES = Object.values(USER_ROLES)
const VALID_VEHICLES = Object.values(VEHICLE_TYPES)

const validateRole = (role) => {
  if (role !== undefined && !VALID_ROLES.includes(role)) {
    throw HttpError.badRequest(`Rol inválido. Valores permitidos: ${VALID_ROLES.join(', ')}`)
  }
}

// Regla: un repartidor (COURIER) debe tener un vehículo válido; los demás roles no tienen perfil de repartidor.
const resolveCourierProfile = (role, courierProfile) => {
  if (role !== USER_ROLES.COURIER) return null
  if (!courierProfile || !VALID_VEHICLES.includes(courierProfile.vehicle)) {
    throw HttpError.badRequest(
      `Un usuario ${USER_ROLES.COURIER} necesita courierProfile.vehicle con uno de: ${VALID_VEHICLES.join(', ')}`
    )
  }
  return {
    vehicle: courierProfile.vehicle,
    licensePlate: courierProfile.licensePlate ?? null,
    isAvailable: courierProfile.isAvailable ?? true
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

    const role = data.role ?? USER_ROLES.USER
    return usersRepository.create({
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      password: await hashPassword(data.password),
      phone: data.phone ?? null,
      role,
      courierProfile: resolveCourierProfile(role, data.courierProfile)
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

    // Mantiene coherente el perfil de repartidor con el rol final del usuario.
    if (changes.role !== undefined || changes.courierProfile !== undefined) {
      const finalRole = changes.role ?? current.role
      changes.courierProfile = resolveCourierProfile(finalRole, changes.courierProfile ?? current.courierProfile)
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
