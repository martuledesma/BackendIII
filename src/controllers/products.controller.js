// Única puerta de entrada HTTP para productos: lee req, llama al service y arma la respuesta.
// No importa Mongoose ni repositorios.
import { productsService } from '../services/products.service.js'
import { HTTP_STATUS, RESPONSE_STATUS } from '../constants/index.js'

const ok = (res, payload, status = HTTP_STATUS.OK) =>
  res.status(status).json({ status: RESPONSE_STATUS.SUCCESS, payload })

export const getProducts = async (req, res, next) => {
  try {
    const products = await productsService.getProducts({
      includeOutOfStock: req.query.includeOutOfStock === 'true',
      category: req.query.category
    })
    ok(res, products)
  } catch (error) {
    next(error)
  }
}

export const getProductById = async (req, res, next) => {
  try {
    ok(res, await productsService.getProductById(req.params.pid))
  } catch (error) {
    next(error)
  }
}

export const createProduct = async (req, res, next) => {
  try {
    ok(res, await productsService.createProduct(req.body), HTTP_STATUS.CREATED)
  } catch (error) {
    next(error)
  }
}

export const updateProduct = async (req, res, next) => {
  try {
    ok(res, await productsService.updateProduct(req.params.pid, req.body))
  } catch (error) {
    next(error)
  }
}

export const deleteProduct = async (req, res, next) => {
  try {
    await productsService.deleteProduct(req.params.pid)
    res.status(HTTP_STATUS.NO_CONTENT).end()
  } catch (error) {
    next(error)
  }
}
