// Punto de arranque.
// La configuración se importa de forma dinámica para poder registrar como FATAL
// un error de variables de entorno (en ese caso el logger compartido todavía no existe).
import { createAppLogger, flushLogger } from './config/logger.factory.js'

const fatalExit = async (logger, message, error) => {
  logger.fatal(`${message}: ${error.message}`)
  await flushLogger(logger)
  process.exit(1)
}

let config, logger, connectDB
try {
  ({ config, logger, connectDB } = await import('./config/index.js'))
} catch (error) {
  // Logger de emergencia con la configuración por defecto: escribe en consola y en logs/error.log.
  await fatalExit(createAppLogger(), 'Configuración de entorno inválida, la app no puede arrancar', error)
}

// Errores que se escaparon de todo manejo: se registran como fatales y se cierra el proceso.
process.on('unhandledRejection', (reason) => {
  fatalExit(logger, 'Promesa rechazada sin manejar', reason instanceof Error ? reason : new Error(String(reason)))
})
process.on('uncaughtException', (error) => fatalExit(logger, 'Excepción no capturada', error))

try {
  await connectDB()
} catch (error) {
  await fatalExit(logger, 'No se pudo conectar a MongoDB al iniciar', error)
}

const { default: app } = await import('./app.js')
const server = app.listen(config.port, () => {
  logger.info(`Servidor ShipNow escuchando en el puerto ${config.port} (${config.nodeEnv})`)
})

server.on('error', (error) => {
  const reason = error.code === 'EADDRINUSE' ? new Error(`el puerto ${config.port} ya está en uso`) : error
  fatalExit(logger, 'No se pudo levantar el servidor HTTP', reason)
})
