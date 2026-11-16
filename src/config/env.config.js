// Único archivo del proyecto que lee process.env.
// Carga el .env, valida las variables críticas y exporta un objeto ya tipado y congelado.
import dotenv from 'dotenv'
import { ENVIRONMENTS } from '../constants/index.js'

dotenv.config()

const REQUIRED_VARS = ['PORT', 'MONGODB_URI', 'NODE_ENV']

const fail = (message) => {
  throw new Error(`[config] ${message}. Revisá tu archivo .env (podés usar .env.example como guía).`)
}

const missing = REQUIRED_VARS.filter((key) => !process.env[key] || process.env[key].trim() === '')
if (missing.length > 0) {
  fail(`Faltan variables de entorno obligatorias: ${missing.join(', ')}`)
}

const port = Number(process.env.PORT)
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  fail(`PORT debe ser un número entero entre 1 y 65535 (valor recibido: "${process.env.PORT}")`)
}

const mongoUri = process.env.MONGODB_URI.trim()
if (!/^mongodb(\+srv)?:\/\//.test(mongoUri)) {
  fail('MONGODB_URI debe empezar con "mongodb://" o "mongodb+srv://"')
}

const nodeEnv = process.env.NODE_ENV.trim()
const validEnvs = Object.values(ENVIRONMENTS)
if (!validEnvs.includes(nodeEnv)) {
  fail(`NODE_ENV debe ser uno de: ${validEnvs.join(', ')} (valor recibido: "${nodeEnv}")`)
}

export const config = Object.freeze({
  port,
  mongoUri,
  nodeEnv,
  isProduction: nodeEnv === ENVIRONMENTS.PRODUCTION
})
