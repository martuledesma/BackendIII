// Puerta de entrada HTTP del módulo de mocks: pasa la query al service y responde.
// No valida, no genera datos y no arma errores: todo error llega al middleware global vía asyncHandler.
import { mocksService } from '../services/mocks.service.js'
import { HTTP_STATUS } from '../constants/index.js'
import { asyncHandler } from '../utils/async-handler.js'
import { sendSuccess } from '../utils/response.js'

export const getMockUsers = asyncHandler(async (req, res) => {
  sendSuccess(res, mocksService.generateUsers(req.query))
})

export const getMockCouriers = asyncHandler(async (req, res) => {
  sendSuccess(res, mocksService.generateCouriers(req.query))
})

export const getMockOrders = asyncHandler(async (req, res) => {
  sendSuccess(res, mocksService.generateOrders(req.query))
})

export const getMockDeliveries = asyncHandler(async (req, res) => {
  sendSuccess(res, mocksService.generateDeliveries(req.query))
})

export const getMockDataset = asyncHandler(async (req, res) => {
  sendSuccess(res, mocksService.generateDataset(req.query))
})

export const seedMocks = asyncHandler(async (req, res) => {
  sendSuccess(res, await mocksService.seed(req.query, req.body), HTTP_STATUS.CREATED)
})

export const clearMocks = asyncHandler(async (req, res) => {
  sendSuccess(res, await mocksService.clear(req.query))
})
