// Hooks globales de Mocha (root hooks): se ejecutan una sola vez para toda la suite.
// - Verifica que se esté corriendo en el entorno de testing.
// - Se conecta a la base de testing y comprueba que NO sea la de desarrollo.
// - Deja la base vacía al empezar y al terminar.
import mongoose from 'mongoose'
import { config, connectDB } from '../src/config/index.js'
import { ENVIRONMENTS } from '../src/constants/index.js'
import { clearDatabase, TEST_DB_SUFFIX } from './helpers/db.helper.js'

export const mochaHooks = {
  async beforeAll () {
    if (config.nodeEnv !== ENVIRONMENTS.TEST) {
      throw new Error(`Los tests tienen que correr con NODE_ENV=${ENVIRONMENTS.TEST}. Usá "npm test".`)
    }

    await connectDB()

    // Protección: los tests vacían la base, así que solo se permite una base de testing.
    const dbName = mongoose.connection.name
    if (!dbName.endsWith(TEST_DB_SUFFIX)) {
      await mongoose.disconnect()
      throw new Error(
        `Por seguridad, los tests solo corren sobre una base cuyo nombre termine en "${TEST_DB_SUFFIX}". ` +
        `La base configurada en .env.test es "${dbName}".`
      )
    }

    await clearDatabase()
  },

  async afterAll () {
    await clearDatabase()
    await mongoose.disconnect()
  }
}
