// Schemas y parámetros reutilizables de la documentación OpenAPI.
// Los enums salen de las constantes del proyecto: si cambia un rol o un estado, la documentación cambia sola.
import {
  USER_ROLES,
  VEHICLE_TYPES,
  PRODUCT_STATUS,
  ORDER_STATUS,
  ORDER_PRIORITY,
  DELIVERY_STATUS,
  MOCK_ENTITIES,
  MOCK_LIMITS,
  MOCK_DEFAULTS,
  RESPONSE_STATUS
} from '../constants/index.js'
import { ERRORS } from '../errors/index.js'
import { schemaRef as ref } from './helpers.js'

const objectId = (description, example = '6739f1c2a8b4e5d6f7a8b9c0') => ({
  type: 'string', pattern: '^[a-fA-F0-9]{24}$', description, example
})
const timestamps = {
  createdAt: { type: 'string', format: 'date-time', example: '2026-11-16T21:53:04.499Z' },
  updatedAt: { type: 'string', format: 'date-time', example: '2026-11-16T21:53:04.499Z' }
}
const isMock = { type: 'boolean', description: 'true si el documento lo generó el módulo de mocks', example: false }

export const schemas = {
  // ---------- Respuestas genéricas ----------
  SuccessResponse: {
    type: 'object',
    description: 'Formato de todas las respuestas exitosas (excepto 204 No Content).',
    required: ['status', 'payload'],
    properties: {
      status: { type: 'string', enum: [RESPONSE_STATUS.SUCCESS], example: RESPONSE_STATUS.SUCCESS },
      payload: { description: 'Datos de la respuesta. Su forma depende del endpoint.' }
    }
  },
  ErrorResponse: {
    type: 'object',
    description: 'Formato único de error. Lo construye solo el middleware global de errores.',
    required: ['status', 'error'],
    properties: {
      status: { type: 'string', enum: [RESPONSE_STATUS.ERROR], example: RESPONSE_STATUS.ERROR },
      error: {
        type: 'object',
        required: ['code', 'message', 'statusCode', 'details', 'path', 'method', 'timestamp'],
        properties: {
          code: { type: 'string', enum: Object.keys(ERRORS), description: 'Identificador estable del error (diccionario de errores)', example: 'USER_NOT_FOUND' },
          message: { type: 'string', description: 'Descripción legible', example: 'No existe un usuario con id 6739f1c2a8b4e5d6f7a8b9c0' },
          statusCode: { type: 'integer', description: 'Igual al status HTTP de la respuesta', example: 404 },
          details: { type: 'object', nullable: true, additionalProperties: true, description: 'Datos extra del caso (campo, valor recibido, valores permitidos). En producción es null para los errores 500.', example: { id: '6739f1c2a8b4e5d6f7a8b9c0' } },
          path: { type: 'string', example: '/api/users/6739f1c2a8b4e5d6f7a8b9c0' },
          method: { type: 'string', example: 'GET' },
          timestamp: { type: 'string', format: 'date-time', example: '2026-11-16T22:10:00.000Z' }
        }
      }
    }
  },

  // ---------- Usuarios ----------
  CourierProfile: {
    type: 'object',
    nullable: true,
    description: `Solo existe en usuarios con rol ${USER_ROLES.COURIER}; en el resto es null.`,
    required: ['vehicle'],
    properties: {
      vehicle: { type: 'string', enum: Object.values(VEHICLE_TYPES), example: VEHICLE_TYPES.MOTORCYCLE },
      licensePlate: { type: 'string', nullable: true, example: 'AB123CD' },
      isAvailable: { type: 'boolean', example: true }
    }
  },
  User: {
    type: 'object',
    description: 'Usuario tal como lo devuelve la API (nunca incluye la contraseña).',
    properties: {
      _id: objectId('Id del usuario'),
      firstName: { type: 'string', example: 'Ana' },
      lastName: { type: 'string', example: 'Pérez' },
      email: { type: 'string', format: 'email', example: 'ana.perez@test.com' },
      phone: { type: 'string', nullable: true, example: '+54 381 555-1234' },
      role: { type: 'string', enum: Object.values(USER_ROLES), example: USER_ROLES.USER },
      courierProfile: ref('CourierProfile'),
      isMock,
      ...timestamps
    }
  },
  UserSummary: {
    type: 'object',
    description: 'Datos públicos del usuario incluidos (populate) dentro de un pedido o una entrega.',
    properties: {
      _id: objectId('Id del usuario'),
      firstName: { type: 'string', example: 'Ana' },
      lastName: { type: 'string', example: 'Pérez' },
      email: { type: 'string', example: 'ana.perez@test.com' },
      role: { type: 'string', enum: Object.values(USER_ROLES) },
      courierProfile: { ...ref('CourierProfile'), description: 'Solo se incluye en el repartidor de una entrega' }
    }
  },
  UserCreateInput: {
    type: 'object',
    required: ['firstName', 'lastName', 'email', 'password'],
    properties: {
      firstName: { type: 'string', example: 'Ana' },
      lastName: { type: 'string', example: 'Pérez' },
      email: { type: 'string', format: 'email', description: 'Único en la base', example: 'ana.perez@test.com' },
      password: { type: 'string', minLength: 8, description: 'Se guarda hasheada (scrypt)', example: 'clave1234' },
      phone: { type: 'string', example: '+54 381 555-1234' },
      role: { type: 'string', enum: Object.values(USER_ROLES), default: USER_ROLES.USER },
      courierProfile: { ...ref('CourierProfile'), description: `Obligatorio si role = ${USER_ROLES.COURIER}; se ignora en otros roles.` }
    }
  },
  UserUpdateInput: {
    type: 'object',
    description: 'Solo se aceptan estos campos (email y password no se modifican por acá). Al menos uno es obligatorio.',
    minProperties: 1,
    properties: {
      firstName: { type: 'string' },
      lastName: { type: 'string' },
      phone: { type: 'string' },
      role: { type: 'string', enum: Object.values(USER_ROLES) },
      courierProfile: ref('CourierProfile')
    }
  },

  // ---------- Productos ----------
  Product: {
    type: 'object',
    properties: {
      _id: objectId('Id del producto'),
      title: { type: 'string', example: 'Caja chica' },
      description: { type: 'string', example: '' },
      code: { type: 'string', example: 'BOX-01' },
      price: { type: 'number', minimum: 0, example: 1500 },
      stock: { type: 'integer', minimum: 0, example: 10 },
      category: { type: 'string', example: 'embalaje' },
      status: { type: 'string', enum: Object.values(PRODUCT_STATUS), description: 'Lo calcula el sistema a partir del stock', example: PRODUCT_STATUS.AVAILABLE },
      ...timestamps
    }
  },
  ProductCreateInput: {
    type: 'object',
    required: ['title', 'code', 'price', 'category'],
    properties: {
      title: { type: 'string', example: 'Caja chica' },
      description: { type: 'string', example: 'Caja de cartón 20x20' },
      code: { type: 'string', description: 'Único', example: 'BOX-01' },
      price: { type: 'number', minimum: 0, example: 1500 },
      stock: { type: 'integer', minimum: 0, default: 0, example: 10 },
      category: { type: 'string', example: 'embalaje' }
    }
  },
  ProductUpdateInput: {
    type: 'object',
    description: 'code y status no se pueden modificar. Al menos un campo es obligatorio.',
    minProperties: 1,
    properties: {
      title: { type: 'string' },
      description: { type: 'string' },
      price: { type: 'number', minimum: 0 },
      stock: { type: 'integer', minimum: 0 },
      category: { type: 'string' }
    }
  },

  // ---------- Pedidos ----------
  OrderItem: {
    type: 'object',
    required: ['title', 'unitPrice', 'quantity'],
    properties: {
      title: { type: 'string', example: 'Caja chica' },
      unitPrice: { type: 'number', minimum: 0, example: 1500 },
      quantity: { type: 'integer', minimum: 1, example: 2 }
    }
  },
  Address: {
    type: 'object',
    required: ['street', 'city', 'province', 'zipCode'],
    properties: {
      street: { type: 'string', example: 'San Martín 100' },
      city: { type: 'string', example: 'San Miguel de Tucumán' },
      province: { type: 'string', example: 'Tucumán' },
      zipCode: { type: 'string', example: '4000' }
    }
  },
  Order: {
    type: 'object',
    properties: {
      _id: objectId('Id del pedido'),
      user: ref('UserSummary'),
      items: { type: 'array', items: ref('OrderItem') },
      total: { type: 'number', description: 'Suma de unitPrice × quantity. Lo calcula el sistema.', example: 3000 },
      shippingAddress: ref('Address'),
      status: { type: 'string', enum: Object.values(ORDER_STATUS), example: ORDER_STATUS.PENDING },
      priority: { type: 'string', enum: Object.values(ORDER_PRIORITY), example: ORDER_PRIORITY.NORMAL },
      isMock,
      ...timestamps
    }
  },
  OrderCreateInput: {
    type: 'object',
    required: ['user', 'items', 'shippingAddress'],
    description: `El pedido se crea en estado ${ORDER_STATUS.PENDING} y el total lo calcula el sistema.`,
    properties: {
      user: objectId(`Id de un usuario existente con rol ${USER_ROLES.USER} (cliente)`),
      items: { type: 'array', minItems: 1, items: ref('OrderItem') },
      shippingAddress: ref('Address'),
      priority: { type: 'string', enum: Object.values(ORDER_PRIORITY), default: ORDER_PRIORITY.NORMAL }
    }
  },

  OrderStatusUpdateInput: {
    type: 'object',
    required: ['status'],
    description: [
      'Transiciones permitidas:',
      `${ORDER_STATUS.PENDING} → ${ORDER_STATUS.CONFIRMED} | ${ORDER_STATUS.CANCELLED};`,
      `${ORDER_STATUS.CONFIRMED} → ${ORDER_STATUS.IN_TRANSIT} | ${ORDER_STATUS.CANCELLED};`,
      `${ORDER_STATUS.IN_TRANSIT} → ${ORDER_STATUS.DELIVERED}.`,
      `${ORDER_STATUS.DELIVERED} y ${ORDER_STATUS.CANCELLED} son finales.`
    ].join(' '),
    properties: {
      status: { type: 'string', enum: Object.values(ORDER_STATUS), example: ORDER_STATUS.CONFIRMED }
    }
  },

  // ---------- Entregas ----------
  OrderSummary: {
    type: 'object',
    description: 'Datos del pedido incluidos (populate) dentro de una entrega.',
    properties: {
      _id: objectId('Id del pedido'),
      user: objectId('Id del cliente'),
      status: { type: 'string', enum: Object.values(ORDER_STATUS) },
      priority: { type: 'string', enum: Object.values(ORDER_PRIORITY) },
      total: { type: 'number', example: 3000 }
    }
  },
  Delivery: {
    type: 'object',
    description: `Cada pedido tiene como máximo una entrega. Los estados ${DELIVERY_STATUS.ASSIGNED}, ${DELIVERY_STATUS.IN_TRANSIT} y ${DELIVERY_STATUS.DELIVERED} siempre tienen repartidor.`,
    properties: {
      _id: objectId('Id de la entrega'),
      order: ref('OrderSummary'),
      courier: { allOf: [ref('UserSummary')], nullable: true, description: `Repartidor (rol ${USER_ROLES.COURIER}) o null si está ${DELIVERY_STATUS.UNASSIGNED}` },
      status: { type: 'string', enum: Object.values(DELIVERY_STATUS), example: DELIVERY_STATUS.IN_TRANSIT },
      trackingCode: { type: 'string', example: 'SN-5X1PBU00IZ' },
      estimatedDeliveryDate: { type: 'string', format: 'date-time' },
      deliveredAt: { type: 'string', format: 'date-time', nullable: true },
      isMock,
      ...timestamps
    }
  },

  // ---------- Mocks (datos generados en memoria) ----------
  MockUser: {
    type: 'object',
    description: 'Usuario generado con faker (no se guarda). Misma forma que User, sin timestamps.',
    properties: {
      _id: objectId('Id generado'),
      firstName: { type: 'string', example: 'Luis' },
      lastName: { type: 'string', example: 'Gómez' },
      email: { type: 'string', example: `luis.gomez.p2m7@${MOCK_DEFAULTS.EMAIL_DOMAIN}` },
      phone: { type: 'string', example: '939-292-684' },
      role: { type: 'string', enum: Object.values(USER_ROLES), example: USER_ROLES.COURIER },
      courierProfile: ref('CourierProfile'),
      isMock: { type: 'boolean', example: true }
    }
  },
  MockOrder: {
    type: 'object',
    description: 'Pedido generado con faker (no se guarda). `user` es el id de un cliente generado en el mismo lote.',
    properties: {
      _id: objectId('Id generado'),
      user: objectId('Id del cliente generado'),
      items: { type: 'array', items: ref('OrderItem') },
      total: { type: 'number', example: 36846 },
      shippingAddress: ref('Address'),
      status: { type: 'string', enum: Object.values(ORDER_STATUS) },
      priority: { type: 'string', enum: Object.values(ORDER_PRIORITY) },
      isMock: { type: 'boolean', example: true }
    }
  },
  MockDelivery: {
    type: 'object',
    description: 'Entrega generada con faker (no se guarda). `order` y `courier` son ids generados en el mismo lote.',
    properties: {
      _id: objectId('Id generado'),
      order: objectId('Id del pedido generado'),
      courier: { ...objectId('Id del repartidor generado'), nullable: true },
      status: { type: 'string', enum: Object.values(DELIVERY_STATUS) },
      trackingCode: { type: 'string', example: 'SN-AMK2I3H0PG' },
      estimatedDeliveryDate: { type: 'string', format: 'date-time' },
      deliveredAt: { type: 'string', format: 'date-time', nullable: true },
      isMock: { type: 'boolean', example: true }
    }
  },
  MockDataset: {
    type: 'object',
    description: 'Conjunto relacionado: los ids de orders.user, deliveries.order y deliveries.courier apuntan a documentos del mismo conjunto.',
    properties: {
      users: { type: 'array', items: ref('MockUser') },
      couriers: { type: 'array', items: ref('MockUser') },
      orders: { type: 'array', items: ref('MockOrder') },
      deliveries: { type: 'array', items: ref('MockDelivery') }
    }
  },
  SeedInput: {
    type: 'object',
    description: 'Parámetros de la carga. Se pueden enviar en este body JSON o como query (?entity=all&qty=10). Si llegan en ambos, gana la query.',
    properties: {
      entity: { type: 'string', enum: Object.values(MOCK_ENTITIES), default: MOCK_ENTITIES.USERS, description: 'Qué cargar' },
      qty: { type: 'integer', minimum: 1, maximum: MOCK_LIMITS.MAX_QTY, default: MOCK_LIMITS.DEFAULT_QTY, description: 'Cantidad (en entity=all, cantidad de pedidos)' },
      role: { type: 'string', enum: Object.values(USER_ROLES), description: 'Solo válido con entity=users' },
      simulateFailure: { type: 'boolean', default: false, description: 'Solo fuera de producción: provoca una falla después de la primera inserción para probar el rollback' }
    }
  },
  SeedResult: {
    type: 'object',
    description: 'Resultado de la carga. `relacionados` aparece con entity=orders/deliveries, `rol` con entity=couriers y `detalle` con entity=all.',
    required: ['insertados', 'coleccion'],
    properties: {
      insertados: { type: 'integer', example: 10 },
      coleccion: { type: 'string', enum: [MOCK_ENTITIES.USERS, MOCK_ENTITIES.ORDERS, MOCK_ENTITIES.DELIVERIES, MOCK_ENTITIES.ALL], example: MOCK_ENTITIES.USERS },
      rol: { type: 'string', enum: [USER_ROLES.COURIER] },
      relacionados: { type: 'object', additionalProperties: { type: 'integer' }, example: { deliveries: 7 } },
      detalle: {
        type: 'object',
        properties: {
          users: { type: 'integer' }, couriers: { type: 'integer' }, orders: { type: 'integer' }, deliveries: { type: 'integer' }
        }
      }
    }
  },
  ClearResult: {
    type: 'object',
    properties: {
      eliminados: {
        type: 'object',
        properties: { deliveries: { type: 'integer' }, orders: { type: 'integer' }, users: { type: 'integer' } },
        example: { deliveries: 6, orders: 10, users: 6 }
      }
    }
  },

  // ---------- Logger ----------
  LoggerTestResult: {
    type: 'object',
    properties: {
      mensaje: { type: 'string', example: 'Se emitió un log de cada nivel. Revisá la consola y la carpeta logs/.' },
      entorno: { type: 'string', example: 'development' },
      niveles: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            nivel: { type: 'string', enum: ['debug', 'http', 'info', 'warning', 'error', 'fatal'] },
            consola: { type: 'boolean', description: 'Se muestra en consola en el entorno actual' },
            archivoGeneral: { type: 'boolean', description: 'Se escribe en logs/combined-AAAA-MM-DD.log' },
            archivoErrores: { type: 'boolean', description: 'Se escribe en logs/error.log (solo error y fatal)' }
          }
        }
      },
      archivos: {
        type: 'object',
        properties: {
          errores: { type: 'string', example: 'logs/error.log' },
          general: { type: 'string', example: 'logs/combined-AAAA-MM-DD.log' }
        }
      }
    }
  }
}

const idParam = (name, entity) => ({
  name, in: 'path', required: true, description: `Id del ${entity} (ObjectId de 24 caracteres hexadecimales)`,
  schema: { type: 'string', example: '6739f1c2a8b4e5d6f7a8b9c0' }
})

export const parameters = {
  UserId: idParam('uid', 'usuario'),
  ProductId: idParam('pid', 'producto'),
  OrderId: idParam('oid', 'pedido'),
  DeliveryId: idParam('did', 'entrega'),
  MockQty: {
    name: 'qty',
    in: 'query',
    required: false,
    description: `Cantidad a generar: entero entre 1 y ${MOCK_LIMITS.MAX_QTY}. Texto, decimales, cero, negativos o valores repetidos devuelven 400.`,
    schema: { type: 'integer', minimum: 1, maximum: MOCK_LIMITS.MAX_QTY, default: MOCK_LIMITS.DEFAULT_QTY }
  },
  RoleFilter: {
    name: 'role', in: 'query', required: false, description: 'Filtra por rol',
    schema: { type: 'string', enum: Object.values(USER_ROLES) }
  }
}
