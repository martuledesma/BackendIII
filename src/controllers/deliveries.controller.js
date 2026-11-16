import { deliveriesService } from '../services/deliveries.service.js'
import { HTTP_STATUS, RESPONSE_STATUS } from '../constants/index.js'

const ok = (res, payload) =>
  res.status(HTTP_STATUS.OK).json({ status: RESPONSE_STATUS.SUCCESS, payload })

export const getDeliveries = async (req, res, next) => {
  try {
    ok(res, await deliveriesService.getDeliveries(req.query))
  } catch (error) {
    next(error)
  }
}

export const getDeliveryById = async (req, res, next) => {
  try {
    ok(res, await deliveriesService.getDeliveryById(req.params.did))
  } catch (error) {
    next(error)
  }
}
