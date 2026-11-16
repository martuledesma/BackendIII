// Errores personalizados del dominio de ShipNow.
// Todos heredan de AppError y se construyen a partir de una entrada del diccionario (ERRORS).
// Los lanzan principalmente los services; el middleware global los transforma en la respuesta HTTP.
import { ERRORS } from './errors.dictionary.js'

// ---------- Base ----------

export class AppError extends Error {
  /**
   * @param {{code: string, statusCode: number, message: string}} definition entrada de ERRORS
   * @param {{message?: string, details?: object|null, cause?: unknown}} [options]
   */
  constructor (definition = ERRORS.INTERNAL_ERROR, { message, details = null, cause } = {}) {
    super(message ?? definition.message, cause ? { cause } : undefined)
    this.name = this.constructor.name
    this.code = definition.code
    this.statusCode = definition.statusCode
    this.details = details
    // Operacional = error esperado del dominio (no un bug). El middleware no lo loguea como fallo.
    this.isOperational = true
  }
}

// ---------- Categorías ----------

export class ValidationError extends AppError {
  constructor (definition = ERRORS.VALIDATION_ERROR, options) { super(definition, options) }
}

export class NotFoundError extends AppError {}
export class ConflictError extends AppError {}
export class ForbiddenError extends AppError {}

export class MockError extends AppError {
  constructor (definition, options) {
    super(definition, options)
    // Las fallas de generación/carga son errores del servidor, no del cliente.
    this.isOperational = definition.statusCode < 500
  }
}

// ---------- Validación ----------

export class MissingFieldsError extends ValidationError {
  constructor (fields) {
    super(ERRORS.MISSING_FIELDS, { message: `Faltan campos obligatorios: ${fields.join(', ')}`, details: { fields } })
  }
}

export class InvalidFieldError extends ValidationError {
  constructor (field, reason, value) {
    super(ERRORS.INVALID_FIELD, { message: `El campo "${field}" es inválido: ${reason}`, details: { field, value } })
  }
}

export class NoUpdatableFieldsError extends ValidationError {
  constructor (allowed) {
    super(ERRORS.NO_UPDATABLE_FIELDS, {
      message: `No hay campos válidos para actualizar. Permitidos: ${allowed.join(', ')}`,
      details: { allowed }
    })
  }
}

export class InvalidIdError extends ValidationError {
  constructor (entity, id) {
    super(ERRORS.INVALID_ID, { message: `El id de ${entity} "${id}" no tiene un formato válido`, details: { entity, id } })
  }
}

export class InvalidJsonError extends ValidationError {
  constructor () { super(ERRORS.INVALID_JSON) }
}

export class InvalidQueryParamError extends ValidationError {
  constructor (params, allowed) {
    super(ERRORS.INVALID_QUERY_PARAM, {
      message: `Parámetros no permitidos: ${params.join(', ')}. Permitidos: ${allowed.length ? allowed.join(', ') : 'ninguno'}`,
      details: { params, allowed }
    })
  }
}

export class InvalidRoleError extends ValidationError {
  constructor (value, allowed) {
    super(ERRORS.INVALID_ROLE, {
      message: `Rol inválido "${value}". Valores permitidos: ${allowed.join(', ')}`,
      details: { value, allowed }
    })
  }
}

export class InvalidStatusError extends ValidationError {
  constructor (entity, value, allowed) {
    super(ERRORS.INVALID_STATUS, {
      message: `Estado de ${entity} inválido "${value}". Valores permitidos: ${allowed.join(', ')}`,
      details: { entity, value, allowed }
    })
  }
}

export class InvalidPriorityError extends ValidationError {
  constructor (value, allowed) {
    super(ERRORS.INVALID_PRIORITY, {
      message: `Prioridad inválida "${value}". Valores permitidos: ${allowed.join(', ')}`,
      details: { value, allowed }
    })
  }
}

export class CourierProfileRequiredError extends ValidationError {
  constructor (allowedVehicles) {
    super(ERRORS.COURIER_PROFILE_REQUIRED, {
      message: `Un repartidor necesita courierProfile.vehicle con uno de: ${allowedVehicles.join(', ')}`,
      details: { allowedVehicles }
    })
  }
}

// ---------- No encontrado ----------

export class RouteNotFoundError extends NotFoundError {
  constructor (method, path) {
    super(ERRORS.ROUTE_NOT_FOUND, { message: `Ruta no encontrada: ${method} ${path}`, details: { method, path } })
  }
}

export class ProductNotFoundError extends NotFoundError {
  constructor (id) { super(ERRORS.PRODUCT_NOT_FOUND, { message: `No existe un producto con id ${id}`, details: { id } }) }
}

export class UserNotFoundError extends NotFoundError {
  constructor (id) { super(ERRORS.USER_NOT_FOUND, { message: `No existe un usuario con id ${id}`, details: { id } }) }
}

export class OrderNotFoundError extends NotFoundError {
  constructor (id) { super(ERRORS.ORDER_NOT_FOUND, { message: `No existe un pedido con id ${id}`, details: { id } }) }
}

export class DeliveryNotFoundError extends NotFoundError {
  constructor (id) { super(ERRORS.DELIVERY_NOT_FOUND, { message: `No existe una entrega con id ${id}`, details: { id } }) }
}

// ---------- Conflictos ----------

export class DuplicateResourceError extends ConflictError {
  constructor (fields = []) {
    super(ERRORS.DUPLICATE_RESOURCE, {
      message: fields.length
        ? `Ya existe un registro con el mismo valor en: ${fields.join(', ')}`
        : ERRORS.DUPLICATE_RESOURCE.message,
      details: { fields }
    })
  }
}

export class EmailAlreadyRegisteredError extends ConflictError {
  constructor (email) { super(ERRORS.EMAIL_ALREADY_REGISTERED, { message: `El email ${email} ya está registrado`, details: { email } }) }
}

export class ProductCodeTakenError extends ConflictError {
  constructor (code) { super(ERRORS.PRODUCT_CODE_TAKEN, { message: `Ya existe un producto con el código ${code}`, details: { code } }) }
}

export class InvalidStatusTransitionError extends ConflictError {
  constructor (entity, from, to, allowed) {
    super(ERRORS.INVALID_STATUS_TRANSITION, {
      message: allowed.length
        ? `No se puede pasar un ${entity} de ${from} a ${to}. Desde ${from} solo se permite: ${allowed.join(', ')}`
        : `No se puede pasar un ${entity} de ${from} a ${to}: ${from} es un estado final`,
      details: { entity, from, to, allowed }
    })
  }
}

export class CourierNotAssignedError extends ConflictError {
  constructor (orderId) {
    super(ERRORS.COURIER_NOT_ASSIGNED, {
      message: `El pedido ${orderId} no puede salir a reparto: su entrega no tiene repartidor asignado`,
      details: { orderId }
    })
  }
}

export class LastAdminError extends ConflictError {
  constructor () { super(ERRORS.LAST_ADMIN) }
}

// ---------- Mocks ----------

// Elige el código según el problema: no es entero, es <= 0 o supera el máximo.
export class InvalidMockQuantityError extends MockError {
  constructor (value, { min, max }) {
    const number = Number(value)
    let definition = ERRORS.MOCK_INVALID_QUANTITY
    if (Number.isInteger(number) && number < min) definition = ERRORS.MOCK_NEGATIVE_QUANTITY
    else if (Number.isInteger(number) && number > max) definition = ERRORS.MOCK_QUANTITY_EXCEEDED

    super(definition, {
      message: `${definition.message}: se recibió "${value}" y debe ser un entero entre ${min} y ${max}`,
      details: { field: 'qty', value, min, max }
    })
  }
}

export class InvalidMockEntityError extends MockError {
  constructor (value, allowed) {
    super(ERRORS.MOCK_INVALID_ENTITY, {
      message: `Entidad de mocks inválida "${value}". Valores permitidos: ${allowed.join(', ')}`,
      details: { field: 'entity', value, allowed }
    })
  }
}

export class MockDependencyError extends MockError {
  constructor (entity, missing, hint) {
    super(ERRORS.MOCK_MISSING_DEPENDENCIES, {
      message: `No se puede generar ${entity}: faltan ${missing} en la base. ${hint}`,
      details: { entity, missing }
    })
  }
}

export class SeedingDisabledError extends ForbiddenError {
  constructor (environment) {
    super(ERRORS.SEEDING_DISABLED, {
      message: `La carga de datos de prueba está deshabilitada en el entorno "${environment}"`,
      details: { environment }
    })
  }
}

export class MockGenerationError extends MockError {
  constructor (entity, cause) {
    super(ERRORS.MOCK_GENERATION_FAILED, {
      message: `Falló la generación de ${entity} de prueba`,
      details: { entity, reason: cause?.message ?? null },
      cause
    })
  }
}

export class MockSeedError extends MockError {
  constructor (entity, cause, rollback) {
    super(ERRORS.MOCK_SEED_FAILED, {
      message: `Falló la carga de ${entity} en MongoDB. ${rollback.done ? 'Se revirtieron los registros del lote.' : 'No se pudo revertir el lote completo.'}`,
      details: { entity, reason: cause?.message ?? null, rollback },
      cause
    })
  }
}
