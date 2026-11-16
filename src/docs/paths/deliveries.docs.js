import { DELIVERY_STATUS } from '../../constants/index.js'
import { errorResponses, successResponse, schemaRef, paramRef, arrayOf, SERVER_ERRORS } from '../helpers.js'

const TAG = 'Deliveries'
const BASE = '/api/deliveries'
const BY_ID = '/api/deliveries/{did}'

export const deliveriesPaths = {
  [BASE]: {
    get: {
      tags: [TAG],
      summary: 'Listar entregas',
      description: 'Devuelve las entregas con el pedido y el repartidor (populate). Por ahora las entregas se crean con el módulo de mocks.',
      parameters: [
        { name: 'status', in: 'query', required: false, description: 'Filtra por estado de la entrega', schema: { type: 'string', enum: Object.values(DELIVERY_STATUS) } }
      ],
      responses: {
        200: successResponse('Lista de entregas', arrayOf('Delivery')),
        ...errorResponses({ path: `${BASE}?status=X`, method: 'GET' }, 'INVALID_STATUS', 'INVALID_QUERY_PARAM', ...SERVER_ERRORS)
      }
    }
  },
  [BY_ID]: {
    parameters: [paramRef('DeliveryId')],
    get: {
      tags: [TAG],
      summary: 'Obtener una entrega',
      responses: {
        200: successResponse('Entrega encontrada', schemaRef('Delivery')),
        ...errorResponses({ path: '/api/deliveries/6739f1c2a8b4e5d6f7a8b9c0', method: 'GET' }, 'INVALID_ID', 'DELIVERY_NOT_FOUND', ...SERVER_ERRORS)
      }
    }
  }
}
