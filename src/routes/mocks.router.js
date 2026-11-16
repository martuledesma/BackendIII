import { Router } from 'express'
import {
  getMockUsers,
  getMockCouriers,
  getMockOrders,
  getMockDeliveries,
  getMockDataset,
  seedMocks,
  clearMocks
} from '../controllers/mocks.controller.js'

const router = Router()

// Solo generan datos (no guardan nada)
router.get('/users', getMockUsers)
router.get('/couriers', getMockCouriers)
router.get('/orders', getMockOrders)
router.get('/deliveries', getMockDeliveries)
router.get('/dataset', getMockDataset)

// Insertan / eliminan datos de prueba en MongoDB
router.post('/seed', seedMocks)
router.delete('/seed', clearMocks)

export default router
