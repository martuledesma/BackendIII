// Herramienta interna (no es funcionalidad del negocio): emite un log de cada nivel
// para comprobar que la configuración de Winston funciona y dónde termina cada registro.
import { logger, loggerSettings, config } from '../config/index.js'
import { LOG_LEVELS, LOG_FILES } from '../constants/index.js'

// Mensajes de ejemplo, del más leve al más grave.
const SAMPLE_MESSAGES = Object.freeze({
  debug: 'Prueba de logger: detalle de depuración (solo se ve en development)',
  http: 'Prueba de logger: registro de una petición HTTP',
  info: 'Prueba de logger: evento normal del servidor',
  warning: 'Prueba de logger: pedido #A-102 sin repartidor asignado',
  error: 'Prueba de logger: falló la creación del pedido (error simulado)',
  fatal: 'Prueba de logger: falla crítica simulada (el servidor sigue funcionando)'
})

// ¿Un transport configurado con `transportLevel` registra un log de nivel `level`?
const isRecorded = (level, transportLevel) => LOG_LEVELS[level] <= LOG_LEVELS[transportLevel]

export const loggerService = {
  emitTestLogs: () => {
    // De debug a fatal: el orden en la consola queda igual que la escala de gravedad.
    const levels = Object.keys(LOG_LEVELS).reverse()
    levels.forEach((level) => logger[level](SAMPLE_MESSAGES[level]))

    return {
      mensaje: 'Se emitió un log de cada nivel. Revisá la consola y la carpeta logs/.',
      entorno: config.nodeEnv,
      niveles: levels.map((level) => ({
        nivel: level,
        consola: isRecorded(level, loggerSettings.consoleLevel),
        archivoGeneral: isRecorded(level, loggerSettings.fileLevel),
        archivoErrores: isRecorded(level, 'error')
      })),
      archivos: {
        errores: LOG_FILES.ERROR,
        general: LOG_FILES.COMBINED_PATTERN.replace('%DATE%', 'AAAA-MM-DD')
      }
    }
  }
}
