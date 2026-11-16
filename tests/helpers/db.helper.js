// Limpieza de la base de testing. Cada archivo de tests la llama en before() y after(),
// así ningún grupo depende de lo que dejó otro y la suite se puede correr las veces que haga falta.
import mongoose from 'mongoose'

export const TEST_DB_SUFFIX = '_test'

export const clearDatabase = async () => {
  const dbName = mongoose.connection.name
  // Doble control: nunca vaciar una base que no sea de testing.
  if (!dbName?.endsWith(TEST_DB_SUFFIX)) {
    throw new Error(`clearDatabase() se negó a vaciar la base "${dbName}": no es una base de testing`)
  }
  const collections = Object.values(mongoose.connection.collections)
  await Promise.all(collections.map((collection) => collection.deleteMany({})))
}

export const countDocuments = (collectionName) =>
  mongoose.connection.collection(collectionName).countDocuments()
