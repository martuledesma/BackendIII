import { PRODUCT_STATUS } from '../../constants/index.js'
import { errorResponses, successResponse, schemaRef, paramRef, arrayOf, jsonBody, SERVER_ERRORS } from '../helpers.js'

const TAG = 'Products'
const BASE = '/api/products'
const BY_ID = '/api/products/{pid}'
const SAMPLE_ID_PATH = '/api/products/6739f1c2a8b4e5d6f7a8b9c0'

export const productsPaths = {
  [BASE]: {
    get: {
      tags: [TAG],
      summary: 'Listar productos',
      description: `Por defecto devuelve solo los productos ${PRODUCT_STATUS.AVAILABLE} (con stock).`,
      parameters: [
        { name: 'includeOutOfStock', in: 'query', required: false, description: 'true para incluir los productos sin stock', schema: { type: 'string', enum: ['true', 'false'], default: 'false' } },
        { name: 'category', in: 'query', required: false, description: 'Filtra por categoría', schema: { type: 'string', example: 'embalaje' } }
      ],
      responses: {
        200: successResponse('Lista de productos', arrayOf('Product')),
        ...errorResponses({ path: `${BASE}?includeOutOfStock=si`, method: 'GET' }, 'INVALID_FIELD', 'INVALID_QUERY_PARAM', ...SERVER_ERRORS)
      }
    },
    post: {
      tags: [TAG],
      summary: 'Crear producto',
      description: 'El estado (AVAILABLE / OUT_OF_STOCK) se calcula a partir del stock.',
      requestBody: jsonBody('ProductCreateInput', { title: 'Caja chica', code: 'BOX-01', price: 1500, stock: 10, category: 'embalaje' }),
      responses: {
        201: successResponse('Producto creado', schemaRef('Product')),
        ...errorResponses({ path: BASE, method: 'POST' }, 'MISSING_FIELDS', 'INVALID_FIELD', 'INVALID_JSON', 'PRODUCT_CODE_TAKEN', 'DUPLICATE_RESOURCE', ...SERVER_ERRORS)
      }
    }
  },
  [BY_ID]: {
    parameters: [paramRef('ProductId')],
    get: {
      tags: [TAG],
      summary: 'Obtener un producto',
      responses: {
        200: successResponse('Producto encontrado', schemaRef('Product')),
        ...errorResponses({ path: SAMPLE_ID_PATH, method: 'GET' }, 'INVALID_ID', 'PRODUCT_NOT_FOUND', ...SERVER_ERRORS)
      }
    },
    put: {
      tags: [TAG],
      summary: 'Actualizar un producto',
      description: 'Acepta title, description, price, stock y category. code y status no se modifican: el estado se recalcula según el stock.',
      requestBody: jsonBody('ProductUpdateInput', { stock: 0 }),
      responses: {
        200: successResponse('Producto actualizado', schemaRef('Product')),
        ...errorResponses({ path: SAMPLE_ID_PATH, method: 'PUT' }, 'INVALID_ID', 'NO_UPDATABLE_FIELDS', 'INVALID_FIELD', 'INVALID_JSON', 'PRODUCT_NOT_FOUND', ...SERVER_ERRORS)
      }
    },
    delete: {
      tags: [TAG],
      summary: 'Eliminar un producto (borrado lógico)',
      responses: {
        204: { description: 'Producto eliminado (sin contenido)' },
        ...errorResponses({ path: SAMPLE_ID_PATH, method: 'DELETE' }, 'INVALID_ID', 'PRODUCT_NOT_FOUND', ...SERVER_ERRORS)
      }
    }
  }
}
