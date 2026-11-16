import { ordersService } from '../services/orders.service.js'
import { HTTP_STATUS, RESPONSE_STATUS } from '../constants/index.js'

const ok = (res, payload) =>
  res.status(HTTP_STATUS.OK).json({ status: RESPONSE_STATUS.SUCCESS, payload })

export const getOrders = async (req, res, next) => {
  try {
    ok(res, await ordersService.getOrders(req.query))
  } catch (error) {
    next(error)
  }
}

export const getOrderById = async (req, res, next) => {
  try {
    ok(res, await ordersService.getOrderById(req.params.oid))
  } catch (error) {
    next(error)
  }
}
