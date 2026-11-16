// Única puerta de entrada HTTP para productos: lee req, llama al service y responde.
// No arma respuestas de error ni importa Mongoose: cualquier error llega al middleware global vía asyncHandler.
import { productsService } from '../services/products.service.js'
import { HTTP_STATUS } from '../constants/index.js'
import { asyncHandler } from '../utils/async-handler.js'
import { sendSuccess, sendNoContent } from '../utils/response.js'

export const getProducts = asyncHandler(async (req, res) => {
  sendSuccess(res, await productsService.getProducts(req.query))
})

export const getProductById = asyncHandler(async (req, res) => {
  sendSuccess(res, await productsService.getProductById(req.params.pid))
})

export const createProduct = asyncHandler(async (req, res) => {
  sendSuccess(res, await productsService.createProduct(req.body), HTTP_STATUS.CREATED)
})

export const updateProduct = asyncHandler(async (req, res) => {
  sendSuccess(res, await productsService.updateProduct(req.params.pid, req.body))
})

export const deleteProduct = asyncHandler(async (req, res) => {
  await productsService.deleteProduct(req.params.pid)
  sendNoContent(res)
})
