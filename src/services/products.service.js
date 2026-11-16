// Lógica de negocio de productos. No conoce Express (ni req ni res) ni Mongoose.
// Detecta las reglas inválidas y lanza errores del dominio; no arma respuestas HTTP.
import { productsRepository } from '../repositories/products.repository.js'
import { PRODUCT_STATUS } from '../constants/index.js'
import {
  MissingFieldsError,
  InvalidFieldError,
  InvalidIdError,
  InvalidQueryParamError,
  NoUpdatableFieldsError,
  ProductNotFoundError,
  ProductCodeTakenError
} from '../errors/index.js'
import { isValidObjectId, findUnknownParams } from '../utils/validators.js'

const ENTITY = 'producto'
const REQUIRED_FIELDS = ['title', 'code', 'price', 'category']
const UPDATABLE_FIELDS = ['title', 'description', 'price', 'stock', 'category']
const LIST_QUERY_PARAMS = ['includeOutOfStock', 'category']

// Regla de negocio: el estado se deriva del stock, nunca lo decide el cliente.
const resolveStatus = (stock) => (stock > 0 ? PRODUCT_STATUS.AVAILABLE : PRODUCT_STATUS.OUT_OF_STOCK)

const validateNumbers = ({ price, stock }) => {
  if (price !== undefined && (typeof price !== 'number' || Number.isNaN(price) || price < 0)) {
    throw new InvalidFieldError('price', 'debe ser un número mayor o igual a 0', price)
  }
  if (stock !== undefined && (!Number.isInteger(stock) || stock < 0)) {
    throw new InvalidFieldError('stock', 'debe ser un número entero mayor o igual a 0', stock)
  }
}

const findOrFail = async (id) => {
  if (!isValidObjectId(id)) throw new InvalidIdError(ENTITY, id)
  const product = await productsRepository.getById(id)
  if (!product) throw new ProductNotFoundError(id)
  return product
}

export const productsService = {
  // Por defecto solo se listan productos con stock; includeOutOfStock=true permite verlos todos.
  getProducts: async (query = {}) => {
    const unknown = findUnknownParams(query, LIST_QUERY_PARAMS)
    if (unknown.length) throw new InvalidQueryParamError(unknown, LIST_QUERY_PARAMS)

    const { includeOutOfStock, category } = query
    if (includeOutOfStock !== undefined && !['true', 'false'].includes(includeOutOfStock)) {
      throw new InvalidFieldError('includeOutOfStock', 'debe ser "true" o "false"', includeOutOfStock)
    }

    const filters = {}
    if (includeOutOfStock !== 'true') filters.status = PRODUCT_STATUS.AVAILABLE
    if (category) filters.category = category
    return productsRepository.getAll(filters)
  },

  getProductById: async (id) => findOrFail(id),

  createProduct: async (data = {}) => {
    const missing = REQUIRED_FIELDS.filter((field) => data[field] === undefined || data[field] === '')
    if (missing.length > 0) throw new MissingFieldsError(missing)
    validateNumbers(data)

    const existing = await productsRepository.getByCode(data.code)
    if (existing) throw new ProductCodeTakenError(data.code)

    const stock = data.stock ?? 0
    return productsRepository.create({
      title: data.title,
      description: data.description,
      code: data.code,
      price: data.price,
      stock,
      category: data.category,
      status: resolveStatus(stock)
    })
  },

  updateProduct: async (id, data = {}) => {
    const current = await findOrFail(id)

    // Solo se aceptan campos permitidos: ni code, ni status, ni isDeleted se pisan desde afuera.
    const changes = Object.fromEntries(
      Object.entries(data).filter(([key]) => UPDATABLE_FIELDS.includes(key))
    )
    if (Object.keys(changes).length === 0) throw new NoUpdatableFieldsError(UPDATABLE_FIELDS)
    validateNumbers(changes)

    const stock = changes.stock ?? current.stock
    changes.status = resolveStatus(stock)

    return productsRepository.update(id, changes)
  },

  deleteProduct: async (id) => {
    await findOrFail(id)
    return productsRepository.softDelete(id)
  }
}
