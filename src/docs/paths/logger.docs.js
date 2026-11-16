import { successResponse, schemaRef } from '../helpers.js'

export const loggerPaths = {
  '/api/loggerTest': {
    get: {
      tags: ['Logger'],
      summary: 'Probar el logger (herramienta interna)',
      description: [
        '**Herramienta de validación, no es una funcionalidad del negocio.**',
        '',
        'Emite un log de cada nivel (debug, http, info, warning, error, fatal) con Winston y responde en qué salida aparece cada uno según el entorno actual:',
        '- consola',
        '- `logs/combined-AAAA-MM-DD.log` (historial general, rotación diaria)',
        '- `logs/error.log` (solo error y fatal)',
        '',
        'El log "fatal" es simulado: el servidor sigue funcionando.'
      ].join('\n'),
      responses: {
        200: successResponse('Logs emitidos', schemaRef('LoggerTestResult'))
      }
    }
  }
}
