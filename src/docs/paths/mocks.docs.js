import { MOCK_ENTITIES, MOCK_LIMITS, MOCK_DEFAULTS, USER_ROLES } from '../../constants/index.js'
import { errorResponses, successResponse, schemaRef, paramRef, arrayOf, jsonBody } from '../helpers.js'

const TAG = 'Mocks'
const QTY_ERRORS = ['MOCK_INVALID_QUANTITY', 'MOCK_NEGATIVE_QUANTITY', 'MOCK_QUANTITY_EXCEEDED']
const GENERATE_NOTE = 'Solo genera datos en memoria con faker: **no guarda nada en MongoDB**.'

// Los GET de mocks comparten estructura: solo cambian la ruta, el schema y los parámetros.
const generateEndpoint = ({ path, summary, description, schema, extraParams = [], extraErrors = [] }) => ({
  [path]: {
    get: {
      tags: [TAG],
      summary,
      description: `${description} ${GENERATE_NOTE}`,
      parameters: [paramRef('MockQty'), ...extraParams],
      responses: {
        200: successResponse('Datos generados', schema),
        ...errorResponses({ path: `${path}?qty=-5`, method: 'GET' }, ...QTY_ERRORS, ...extraErrors, 'INVALID_QUERY_PARAM', 'MOCK_GENERATION_FAILED')
      }
    }
  }
})

const seedQueryParams = [
  { name: 'entity', in: 'query', required: false, description: 'Qué cargar', schema: { type: 'string', enum: Object.values(MOCK_ENTITIES), default: MOCK_ENTITIES.USERS } },
  { ...paramRef('MockQty') },
  { name: 'role', in: 'query', required: false, description: `Solo con entity=${MOCK_ENTITIES.USERS}: rol de los usuarios a cargar`, schema: { type: 'string', enum: Object.values(USER_ROLES) } },
  { name: 'simulateFailure', in: 'query', required: false, description: 'Solo fuera de producción: falla después de la primera inserción para probar el rollback', schema: { type: 'string', enum: ['true', 'false'] } }
]

export const mocksPaths = {
  ...generateEndpoint({
    path: '/api/mocks/users',
    summary: 'Generar usuarios mock',
    description: `Sin \`role\`, mezcla clientes (${USER_ROLES.USER}) y repartidores (${USER_ROLES.COURIER}). Solo los ${USER_ROLES.COURIER} tienen courierProfile.`,
    schema: arrayOf('MockUser'),
    extraParams: [{ ...paramRef('RoleFilter') }],
    extraErrors: ['INVALID_ROLE']
  }),
  ...generateEndpoint({
    path: '/api/mocks/couriers',
    summary: 'Generar repartidores mock',
    description: `Usuarios con rol ${USER_ROLES.COURIER} y perfil de repartidor (vehículo, patente, disponibilidad).`,
    schema: arrayOf('MockUser')
  }),
  ...generateEndpoint({
    path: '/api/mocks/orders',
    summary: 'Generar pedidos mock',
    description: 'Pedidos con ítems, total calculado, dirección, estado y prioridad.',
    schema: arrayOf('MockOrder')
  }),
  ...generateEndpoint({
    path: '/api/mocks/deliveries',
    summary: 'Generar entregas mock',
    description: 'Entregas asociadas a pedidos generados en el mismo lote. El estado de la entrega es coherente con el del pedido.',
    schema: arrayOf('MockDelivery')
  }),
  ...generateEndpoint({
    path: '/api/mocks/dataset',
    summary: 'Generar un conjunto relacionado',
    description: '`qty` pedidos, con aproximadamente 1 cliente cada 3 pedidos, 1 repartidor cada 5 y las entregas que correspondan. Sirve para ver las relaciones entre ids.',
    schema: schemaRef('MockDataset')
  }),

  '/api/mocks/seed': {
    post: {
      tags: [TAG],
      summary: 'Insertar datos de prueba en MongoDB',
      description: [
        'Genera e **inserta** datos de prueba. Los parámetros se pueden enviar por **query** o en el **body JSON** (si llegan en ambos, gana la query).',
        '',
        `- \`entity=${MOCK_ENTITIES.USERS}\` (por defecto): usuarios. Acepta \`role\`.`,
        `- \`entity=${MOCK_ENTITIES.COURIERS}\`: repartidores (se guardan en la colección users).`,
        `- \`entity=${MOCK_ENTITIES.ORDERS}\`: pedidos y sus entregas, asignados a clientes **que ya existen** en la base.`,
        `- \`entity=${MOCK_ENTITIES.DELIVERIES}\`: entregas con sus pedidos, usando clientes y repartidores existentes.`,
        `- \`entity=${MOCK_ENTITIES.ALL}\`: un set completo y relacionado.`,
        '',
        `\`qty\` es un entero entre 1 y ${MOCK_LIMITS.MAX_QTY} (por defecto ${MOCK_LIMITS.DEFAULT_QTY}). Todos los usuarios cargados tienen la contraseña \`${MOCK_DEFAULTS.PASSWORD}\`. Todo lo cargado lleva isMock: true.`,
        '',
        'Si la inserción falla a mitad de un lote, se revierten los documentos de ese lote (rollback) y se responde 500 MOCK_SEED_FAILED. En producción responde 403.'
      ].join('\n'),
      parameters: seedQueryParams,
      requestBody: {
        ...jsonBody('SeedInput', { entity: MOCK_ENTITIES.ALL, qty: 10 }, false),
        description: 'Opcional. Mismos parámetros que la query.'
      },
      responses: {
        201: successResponse('Datos insertados', schemaRef('SeedResult'), {
          insertados: 22, coleccion: MOCK_ENTITIES.ALL, detalle: { users: 4, couriers: 2, orders: 10, deliveries: 6 }
        }),
        ...errorResponses({ path: '/api/mocks/seed?entity=all&qty=-1', method: 'POST' },
          ...QTY_ERRORS, 'MOCK_INVALID_ENTITY', 'INVALID_ROLE', 'INVALID_QUERY_PARAM', 'INVALID_FIELD', 'INVALID_JSON',
          'SEEDING_DISABLED', 'MOCK_MISSING_DEPENDENCIES',
          'MOCK_GENERATION_FAILED', 'MOCK_SEED_FAILED', 'DATABASE_ERROR')
      }
    },
    delete: {
      tags: [TAG],
      summary: 'Eliminar los datos de prueba',
      description: 'Borra de MongoDB **solo** los documentos con isMock: true (entregas, pedidos y usuarios). Los datos reales no se tocan. No acepta parámetros. En producción responde 403.',
      responses: {
        200: successResponse('Datos de prueba eliminados', schemaRef('ClearResult')),
        ...errorResponses({ path: '/api/mocks/seed', method: 'DELETE' }, 'INVALID_QUERY_PARAM', 'SEEDING_DISABLED', 'DATABASE_ERROR', 'INTERNAL_ERROR')
      }
    }
  }
}
