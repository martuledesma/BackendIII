// Validaciones reutilizables por los services. No dependen de Express ni de Mongoose.

// Un ObjectId de MongoDB son 24 caracteres hexadecimales.
const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i

export const isValidObjectId = (id) => typeof id === 'string' && OBJECT_ID_REGEX.test(id)

// Devuelve los parámetros de la query que no están en la lista de permitidos.
export const findUnknownParams = (query = {}, allowed = []) =>
  Object.keys(query).filter((key) => !allowed.includes(key))
