// Punto de arranque. Importar config primero hace que la validación de variables
// se ejecute antes que cualquier otra cosa: si falta algo, la app no arranca.
import { config, connectDB } from './config/index.js'
import app from './app.js'

const start = async () => {
  try {
    await connectDB()
    app.listen(config.port, () => {
      console.log(`[server] ShipNow escuchando en http://localhost:${config.port} (${config.nodeEnv})`)
    })
  } catch (error) {
    console.error('[server] No se pudo iniciar la aplicación:', error.message)
    process.exit(1)
  }
}

start()
