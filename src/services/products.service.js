// Lógica de negocio de productos. No conoce Express (ni req ni res) ni Mongoose.
import { productsRepository } from '../repositories/products.repository.js'
import { PRODUCT_STATUS } from '../constants/index.js'
import { HttpError } from '../utils/http-error.js'

const REQUIRED_FIELDS = ['title', 'code', 'price', 'category']
const UPDATABLE_FIELDS = ['title', 'description', 'price', 'stock', 'category']

// Regla de negocio: el estado se deriva del stock, nunca lo decide el cliente.
const resolveStatus = (stock) => (stock > 0 ? PRODUCT_STATUS.AVAILABLE : PRODUCT_STATUS.OUT_OF_STOCK)

const validateNumbers = ({ price, stock }) => {
  if (price !== undefined && (typeof price !== 'number' || price < 0)) {
    throw HttpError.badRequest('El precio debe ser un número mayor o igual a 0')
  }
  if (stock !== undefined && (!Number.isInteger(stock) || stock < 0)) {
    throw HttpError.badRequest('El stock debe ser un número entero mayor o igual a 0')
  }
}

const findOrFail = async (id) => {
  const product = await productsRepository.getById(id)
  if (!product) throw HttpError.notFound(`No existe un producto con id ${id}`)
  return product
}

export const productsService = {
  // Por defecto solo se listan productos con stock; includeOutOfStock permite verlos todos.
  getProducts: async ({ includeOutOfStock = false, category } = {}) => {
    const filters = {}
    if (!includeOutOfStock) filters.status = PRODUCT_STATUS.AVAILABLE
    if (category) filters.category = category
    return productsRepository.getAll(filters)
  },

  getProductById: async (id) => findOrFail(id),

  createProduct: async (data = {}) => {
    const missing = REQUIRED_FIELDS.filter((field) => data[field] === undefined || data[field] === '')
    if (missing.length > 0) {
      throw HttpError.badRequest(`Faltan campos obligatorios: ${missing.join(', ')}`)
    }
    validateNumbers(data)

    const existing = await productsRepository.getByCode(data.code)
    if (existing) throw HttpError.conflict(`Ya existe un producto con el código ${data.code}`)

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
    if (Object.keys(changes).length === 0) {
      throw HttpError.badRequest(`No hay campos válidos para actualizar. Permitidos: ${UPDATABLE_FIELDS.join(', ')}`)
    }
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
