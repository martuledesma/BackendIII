import { ORDER_STATUS, ORDER_PRIORITY, USER_ROLES } from '../../constants/index.js'
import { errorResponses, successResponse, schemaRef, paramRef, arrayOf, jsonBody, SERVER_ERRORS } from '../helpers.js'

const TAG = 'Orders'
const BASE = '/api/orders'
const BY_ID = '/api/orders/{oid}'

export const ordersPaths = {
  [BASE]: {
    get: {
      tags: [TAG],
      summary: 'Listar pedidos',
      description: 'Devuelve los pedidos con los datos públicos del cliente (populate), del más nuevo al más viejo.',
      parameters: [
        { name: 'status', in: 'query', required: false, description: 'Filtra por estado del pedido', schema: { type: 'string', enum: Object.values(ORDER_STATUS) } },
        { name: 'priority', in: 'query', required: false, description: 'Filtra por prioridad', schema: { type: 'string', enum: Object.values(ORDER_PRIORITY) } }
      ],
      responses: {
        200: successResponse('Lista de pedidos', arrayOf('Order')),
        ...errorResponses({ path: `${BASE}?status=PERDIDO`, method: 'GET' }, 'INVALID_STATUS', 'INVALID_PRIORITY', 'INVALID_QUERY_PARAM', ...SERVER_ERRORS)
      }
    },
    post: {
      tags: [TAG],
      summary: 'Crear pedido',
      description: `El cliente (user) debe existir y tener rol ${USER_ROLES.USER}. El pedido se crea en estado ${ORDER_STATUS.PENDING} y el total se calcula como la suma de unitPrice × quantity. Queda registrado en el log (info; warning si la prioridad es ${ORDER_PRIORITY.URGENT}).`,
      requestBody: jsonBody('OrderCreateInput', {
        user: '6739f1c2a8b4e5d6f7a8b9c0',
        priority: ORDER_PRIORITY.HIGH,
        items: [{ title: 'Caja chica', unitPrice: 1500, quantity: 2 }],
        shippingAddress: { street: 'San Martín 100', city: 'San Miguel de Tucumán', province: 'Tucumán', zipCode: '4000' }
      }),
      responses: {
        201: successResponse('Pedido creado', schemaRef('Order')),
        ...errorResponses({ path: BASE, method: 'POST' },
          'MISSING_FIELDS', 'INVALID_ID', 'INVALID_FIELD', 'INVALID_PRIORITY', 'INVALID_JSON', 'USER_NOT_FOUND', ...SERVER_ERRORS)
      }
    }
  },
  [BY_ID]: {
    parameters: [paramRef('OrderId')],
    get: {
      tags: [TAG],
      summary: 'Obtener un pedido',
      responses: {
        200: successResponse('Pedido encontrado', schemaRef('Order')),
        ...errorResponses({ path: '/api/orders/6739f1c2a8b4e5d6f7a8b9c0', method: 'GET' }, 'INVALID_ID', 'ORDER_NOT_FOUND', ...SERVER_ERRORS)
      }
    }
  }
}
