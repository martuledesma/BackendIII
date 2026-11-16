// Configuración de la aplicación Express (sin levantar el servidor).
// Separarlo de server.js permite testear la app con Supertest más adelante.
import express from 'express'
import apiRouter from './routes/index.js'
import { httpLogger } from './middlewares/http-logger.middleware.js'
import { notFoundHandler, errorHandler } from './middlewares/error.middleware.js'

const app = express()

app.use(httpLogger)
app.use(express.json())

app.get('/health', (req, res) => res.json({ status: 'ok' }))
app.use('/api', apiRouter)

app.use(notFoundHandler)
app.use(errorHandler)

export default app
