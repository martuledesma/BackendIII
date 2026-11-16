import { Router } from 'express'
import { getDeliveries, getDeliveryById } from '../controllers/deliveries.controller.js'

const router = Router()

router.get('/', getDeliveries)
router.get('/:did', getDeliveryById)

export default router
