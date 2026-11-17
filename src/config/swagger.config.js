// Configuración de Swagger / OpenAPI 3.0. Arma la especificación completa a partir de:
//   - información general (acá),
//   - schemas y parámetros reutilizables (src/docs/components.js),
//   - rutas documentadas por módulo (src/docs/paths/*.docs.js).
// No contiene lógica de rutas: el router de docs solo sirve esta especificación.
import { readFileSync } from 'node:fs'
import { config } from './env.config.js'
import { MOCK_LIMITS } from '../constants/index.js'
import { schemas, parameters } from '../docs/components.js'
import { usersPaths } from '../docs/paths/users.docs.js'
import { productsPaths } from '../docs/paths/products.docs.js'
import { ordersPaths } from '../docs/paths/orders.docs.js'
import { deliveriesPaths } from '../docs/paths/deliveries.docs.js'
import { mocksPaths } from '../docs/paths/mocks.docs.js'
import { loggerPaths } from '../docs/paths/logger.docs.js'
import { uploadsPaths } from '../docs/paths/uploads.docs.js'

const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'))

export const SWAGGER_ROUTES = Object.freeze({
  UI: '/api/docs',
  JSON: '/api/docs.json'
})

export const swaggerSpec = Object.freeze({
  openapi: '3.0.3',
  info: {
    title: 'ShipNow API',
    version: pkg.version,
    description: [
      'API REST de **ShipNow**, una plataforma de envíos: gestiona usuarios (clientes, repartidores y administradores), productos, pedidos y entregas.',
      '',
      '**Propósito:** proyecto del curso de Backend. Está construida con una arquitectura por capas (Router → Controller → Service → Repository → Model) e incluye mocking de datos, manejo centralizado de errores y logging con Winston.',
      '',
      '**Formato de respuestas**',
      '- Éxito: `{ "status": "success", "payload": ... }`',
      '- Error: `{ "status": "error", "error": { code, message, statusCode, details, path, method, timestamp } }` (ver schema **ErrorResponse**). Los códigos salen del diccionario de errores del proyecto.',
      '',
      `**Autenticación:** esta versión de la API no requiere autenticación.`,
      '',
      `Cualquier ruta inexistente responde 404 con código \`ROUTE_NOT_FOUND\`. Los endpoints de mocks aceptan como máximo ${MOCK_LIMITS.MAX_QTY} registros por pedido.`
    ].join('\n'),
    contact: { name: 'Martina Ledesma', url: 'https://github.com/martuledesma/BackendIII' }
  },
  servers: [
    { url: `http://localhost:${config.port}`, description: `Servidor local (${config.nodeEnv})` }
  ],
  tags: [
    { name: 'Users', description: 'Usuarios: clientes (USER), repartidores (COURIER) y administradores (ADMIN)' },
    { name: 'Products', description: 'Catálogo de productos' },
    { name: 'Orders', description: 'Pedidos de los clientes' },
    { name: 'Deliveries', description: 'Entregas asociadas a pedidos y repartidores' },
    { name: 'Uploads', description: 'Carga y descarga de archivos (multipart/form-data): documentos de usuario y comprobantes de entrega' },
    { name: 'Mocks', description: 'Generación de datos falsos (sin guardar) y carga controlada de datos de prueba en MongoDB' },
    { name: 'Logger', description: 'Herramienta interna para validar la configuración de logs. No es una funcionalidad del negocio.' }
  ],
  paths: {
    ...usersPaths,
    ...productsPaths,
    ...ordersPaths,
    ...deliveriesPaths,
    ...uploadsPaths,
    ...mocksPaths,
    ...loggerPaths
  },
  components: { schemas, parameters }
})

export const swaggerUiOptions = Object.freeze({
  customSiteTitle: 'ShipNow API · Documentación',
  swaggerOptions: {
    docExpansion: 'none', // tags colapsados al abrir
    tryItOutEnabled: true,
    displayRequestDuration: true
  }
})
