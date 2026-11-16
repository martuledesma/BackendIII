import { ordersService } from '../services/orders.service.js'
import { HTTP_STATUS } from '../constants/index.js'
import { asyncHandler } from '../utils/async-handler.js'
import { sendSuccess } from '../utils/response.js'

export const getOrders = asyncHandler(async (req, res) => {
  sendSuccess(res, await ordersService.getOrders(req.query))
})

export const getOrderById = asyncHandler(async (req, res) => {
  sendSuccess(res, await ordersService.getOrderById(req.params.oid))
})

export const createOrder = asyncHandler(async (req, res) => {
  sendSuccess(res, await ordersService.createOrder(req.body), HTTP_STATUS.CREATED)
})

export const updateOrderStatus = asyncHandler(async (req, res) => {
  sendSuccess(res, await ordersService.updateOrderStatus(req.params.oid, req.body))
})
