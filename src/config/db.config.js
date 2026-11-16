import mongoose from 'mongoose'
import { config } from './env.config.js'
import { logger } from './logger.js'

// Eventos de la conexión una vez establecida: caídas y reconexiones quedan registradas.
mongoose.connection.on('disconnected', () => logger.warning('Se perdió la conexión con MongoDB'))
mongoose.connection.on('reconnected', () => logger.info('Conexión con MongoDB restablecida'))
mongoose.connection.on('error', (error) => logger.error(`Error en la conexión con MongoDB: ${error.message}`))

// Oculta usuario y contraseña de la URI antes de loguearla.
const safeUri = (uri) => uri.replace(/\/\/[^@]+@/, '//***:***@')

export const connectDB = async () => {
  logger.debug(`Conectando a MongoDB en ${safeUri(config.mongoUri)}`)
  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 10000 })
  logger.info(`Conexión a MongoDB establecida (base "${mongoose.connection.name}")`)
}
