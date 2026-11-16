import { Router } from 'express'
import { getOrders, getOrderById } from '../controllers/orders.controller.js'

const router = Router()

router.get('/', getOrders)
router.get('/:oid', getOrderById)

export default router
