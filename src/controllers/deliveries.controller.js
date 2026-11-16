import { deliveriesService } from '../services/deliveries.service.js'
import { asyncHandler } from '../utils/async-handler.js'
import { sendSuccess } from '../utils/response.js'

export const getDeliveries = asyncHandler(async (req, res) => {
  sendSuccess(res, await deliveriesService.getDeliveries(req.query))
})

export const getDeliveryById = asyncHandler(async (req, res) => {
  sendSuccess(res, await deliveriesService.getDeliveryById(req.params.did))
})
