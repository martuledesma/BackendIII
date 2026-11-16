import { Router } from 'express'
import productsRouter from './products.router.js'
import usersRouter from './users.router.js'
import ordersRouter from './orders.router.js'
import deliveriesRouter from './deliveries.router.js'
import mocksRouter from './mocks.router.js'
import loggerRouter from './logger.router.js'
import docsRouter from './docs.router.js'

const router = Router()

router.use(docsRouter) // /api/docs y /api/docs.json
router.use('/products', productsRouter)
router.use('/users', usersRouter)
router.use('/orders', ordersRouter)
router.use('/deliveries', deliveriesRouter)
router.use('/mocks', mocksRouter)
router.use('/loggerTest', loggerRouter)

export default router
