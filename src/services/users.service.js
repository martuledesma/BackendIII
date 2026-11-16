// Lógica de negocio de usuarios. No conoce Express (ni req ni res) ni Mongoose.
// Detecta las reglas inválidas y lanza errores del dominio; no arma respuestas HTTP.
import { usersRepository } from '../repositories/users.repository.js'
import { USER_ROLES, VEHICLE_TYPES } from '../constants/index.js'
import {
  MissingFieldsError,
  InvalidFieldError,
  InvalidIdError,
  InvalidRoleError,
  InvalidQueryParamError,
  NoUpdatableFieldsError,
  CourierProfileRequiredError,
  UserNotFoundError,
  EmailAlreadyRegisteredError,
  LastAdminError
} from '../errors/index.js'
import { hashPassword } from '../utils/password.js'
import { logger } from '../config/logger.js'
import { isValidObjectId, findUnknownParams } from '../utils/validators.js'

const ENTITY = 'usuario'
const REQUIRED_FIELDS = ['firstName', 'lastName', 'email', 'password']
const UPDATABLE_FIELDS = ['firstName', 'lastName', 'phone', 'role', 'courierProfile']
const LIST_QUERY_PARAMS = ['role']
const MIN_PASSWORD_LENGTH = 8
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const VALID_ROLES = Object.values(USER_ROLES)
const VALID_VEHICLES = Object.values(VEHICLE_TYPES)

const validateRole = (role) => {
  if (role !== undefined && !VALID_ROLES.includes(role)) throw new InvalidRoleError(role, VALID_ROLES)
}

// Regla: un repartidor (COURIER) debe tener un vehículo válido; los demás roles no tienen perfil de repartidor.
const resolveCourierProfile = (role, courierProfile) => {
  if (role !== USER_ROLES.COURIER) return null
  if (!courierProfile || !VALID_VEHICLES.includes(courierProfile.vehicle)) {
    throw new CourierProfileRequiredError(VALID_VEHICLES)
  }
  return {
    vehicle: courierProfile.vehicle,
    licensePlate: courierProfile.licensePlate ?? null,
    isAvailable: courierProfile.isAvailable ?? true
  }
}

const findOrFail = async (id) => {
  if (!isValidObjectId(id)) throw new InvalidIdError(ENTITY, id)
  const user = await usersRepository.getById(id)
  if (!user) throw new UserNotFoundError(id)
  return user
}

const ensureNotLastAdmin = async () => {
  const admins = await usersRepository.getIdsByRole(USER_ROLES.ADMIN)
  if (admins.length <= 1) throw new LastAdminError()
}

export const usersService = {
  getUsers: async (query = {}) => {
    const unknown = findUnknownParams(query, LIST_QUERY_PARAMS)
    if (unknown.length) throw new InvalidQueryParamError(unknown, LIST_QUERY_PARAMS)
    validateRole(query.role)
    return usersRepository.getAll(query.role ? { role: query.role } : {})
  },

  getUserById: async (id) => findOrFail(id),

  createUser: async (data = {}) => {
    const missing = REQUIRED_FIELDS.filter((field) => !data[field])
    if (missing.length > 0) throw new MissingFieldsError(missing)
    if (!EMAIL_REGEX.test(data.email)) throw new InvalidFieldError('email', 'no tiene un formato válido', data.email)
    if (typeof data.password !== 'string' || data.password.length < MIN_PASSWORD_LENGTH) {
      throw new InvalidFieldError('password', `debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`)
    }
    validateRole(data.role)

    const existing = await usersRepository.getByEmail(data.email)
    if (existing) throw new EmailAlreadyRegisteredError(data.email)

    const role = data.role ?? USER_ROLES.USER
    const user = await usersRepository.create({
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      password: await hashPassword(data.password),
      phone: data.phone ?? null,
      role,
      courierProfile: resolveCourierProfile(role, data.courierProfile)
    })
    logger.info(`Usuario ${user._id} creado (${user.email}, rol ${user.role})`)
    return user
  },

  updateUser: async (id, data = {}) => {
    const current = await findOrFail(id)

    const changes = Object.fromEntries(
      Object.entries(data).filter(([key]) => UPDATABLE_FIELDS.includes(key))
    )
    if (Object.keys(changes).length === 0) throw new NoUpdatableFieldsError(UPDATABLE_FIELDS)
    validateRole(changes.role)

    // Regla de negocio: no se puede quitar el rol al último administrador.
    if (current.role === USER_ROLES.ADMIN && changes.role && changes.role !== USER_ROLES.ADMIN) {
      await ensureNotLastAdmin()
    }

    // Mantiene coherente el perfil de repartidor con el rol final del usuario.
    if (changes.role !== undefined || changes.courierProfile !== undefined) {
      const finalRole = changes.role ?? current.role
      changes.courierProfile = resolveCourierProfile(finalRole, changes.courierProfile ?? current.courierProfile)
    }

    const updated = await usersRepository.update(id, changes)
    logger.info(`Usuario ${id} actualizado: ${Object.keys(changes).join(', ')}`)
    if (changes.role && changes.role !== current.role) {
      logger.warning(`Cambio de rol del usuario ${id}: ${current.role} → ${changes.role}`)
    }
    return updated
  },

  deleteUser: async (id) => {
    const current = await findOrFail(id)
    if (current.role === USER_ROLES.ADMIN) await ensureNotLastAdmin()
    const deleted = await usersRepository.softDelete(id)
    logger.info(`Usuario ${id} eliminado (borrado lógico)`)
    return deleted
  }
}
