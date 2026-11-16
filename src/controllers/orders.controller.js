import { ordersService } from '../services/orders.service.js'
import { asyncHandler } from '../utils/async-handler.js'
import { sendSuccess } from '../utils/response.js'

export const getOrders = asyncHandler(async (req, res) => {
  sendSuccess(res, await ordersService.getOrders(req.query))
})

export const getOrderById = asyncHandler(async (req, res) => {
  sendSuccess(res, await ordersService.getOrderById(req.params.oid))
})
