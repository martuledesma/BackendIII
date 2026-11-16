import { USER_ROLES } from '../../constants/index.js'
import { errorResponses, successResponse, schemaRef, paramRef, arrayOf, jsonBody, SERVER_ERRORS } from '../helpers.js'

const TAG = 'Users'
const BASE = '/api/users'
const BY_ID = '/api/users/{uid}'
const SAMPLE_ID_PATH = '/api/users/6739f1c2a8b4e5d6f7a8b9c0'

export const usersPaths = {
  [BASE]: {
    get: {
      tags: [TAG],
      summary: 'Listar usuarios',
      description: 'Devuelve los usuarios activos (sin borrado lógico) ordenados del más nuevo al más viejo. Nunca incluye la contraseña.',
      parameters: [paramRef('RoleFilter')],
      responses: {
        200: successResponse('Lista de usuarios', arrayOf('User')),
        ...errorResponses({ path: `${BASE}?role=cliente`, method: 'GET' }, 'INVALID_ROLE', 'INVALID_QUERY_PARAM', ...SERVER_ERRORS)
      }
    },
    post: {
      tags: [TAG],
      summary: 'Crear usuario',
      description: `Crea un usuario. El rol por defecto es ${USER_ROLES.USER}. Si el rol es ${USER_ROLES.COURIER}, courierProfile.vehicle es obligatorio.`,
      requestBody: jsonBody('UserCreateInput', {
        firstName: 'Ana', lastName: 'Pérez', email: 'ana.perez@test.com', password: 'clave1234', role: USER_ROLES.USER
      }),
      responses: {
        201: successResponse('Usuario creado', schemaRef('User')),
        ...errorResponses({ path: BASE, method: 'POST' },
          'MISSING_FIELDS', 'INVALID_FIELD', 'INVALID_ROLE', 'COURIER_PROFILE_REQUIRED', 'INVALID_JSON',
          'EMAIL_ALREADY_REGISTERED', 'DUPLICATE_RESOURCE', ...SERVER_ERRORS)
      }
    }
  },
  [BY_ID]: {
    parameters: [paramRef('UserId')],
    get: {
      tags: [TAG],
      summary: 'Obtener un usuario',
      responses: {
        200: successResponse('Usuario encontrado', schemaRef('User')),
        ...errorResponses({ path: SAMPLE_ID_PATH, method: 'GET' }, 'INVALID_ID', 'USER_NOT_FOUND', ...SERVER_ERRORS)
      }
    },
    put: {
      tags: [TAG],
      summary: 'Actualizar un usuario',
      description: `Actualiza firstName, lastName, phone, role o courierProfile; el resto de los campos se ignora. No se puede quitar el rol al último ${USER_ROLES.ADMIN}.`,
      requestBody: jsonBody('UserUpdateInput', { role: USER_ROLES.COURIER, courierProfile: { vehicle: 'BIKE' } }),
      responses: {
        200: successResponse('Usuario actualizado', schemaRef('User')),
        ...errorResponses({ path: SAMPLE_ID_PATH, method: 'PUT' },
          'INVALID_ID', 'NO_UPDATABLE_FIELDS', 'INVALID_ROLE', 'COURIER_PROFILE_REQUIRED', 'INVALID_JSON',
          'USER_NOT_FOUND', 'LAST_ADMIN', ...SERVER_ERRORS)
      }
    },
    delete: {
      tags: [TAG],
      summary: 'Eliminar un usuario (borrado lógico)',
      description: `El usuario deja de aparecer en la API, pero queda en la base con isDeleted = true. No se puede eliminar al último ${USER_ROLES.ADMIN}.`,
      responses: {
        204: { description: 'Usuario eliminado (sin contenido)' },
        ...errorResponses({ path: SAMPLE_ID_PATH, method: 'DELETE' }, 'INVALID_ID', 'USER_NOT_FOUND', 'LAST_ADMIN', ...SERVER_ERRORS)
      }
    }
  }
}
