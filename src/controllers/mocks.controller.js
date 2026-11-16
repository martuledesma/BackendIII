// Puerta de entrada HTTP del módulo de mocks: lee query params, llama al service y responde.
// No genera datos ni conoce Mongoose.
import { mocksService } from '../services/mocks.service.js'
import { HTTP_STATUS, RESPONSE_STATUS } from '../constants/index.js'

const ok = (res, payload, status = HTTP_STATUS.OK) =>
  res.status(status).json({ status: RESPONSE_STATUS.SUCCESS, payload })

// Envuelve los handlers síncronos/asíncronos para derivar errores al middleware.
const handle = (fn, status) => async (req, res, next) => {
  try {
    ok(res, await fn(req), status)
  } catch (error) {
    next(error)
  }
}

export const getMockUsers = handle((req) => mocksService.generateUsers(req.query))
export const getMockCouriers = handle((req) => mocksService.generateCouriers(req.query))
export const getMockOrders = handle((req) => mocksService.generateOrders(req.query))
export const getMockDeliveries = handle((req) => mocksService.generateDeliveries(req.query))
export const getMockDataset = handle((req) => mocksService.generateDataset(req.query))

export const seedMocks = handle((req) => mocksService.seed(req.query), HTTP_STATUS.CREATED)
export const clearMocks = handle(() => mocksService.clear())
