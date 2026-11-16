// Sirve la documentación. La especificación y las opciones viven en config/swagger.config.js.
import { Router } from 'express'
import swaggerUi from 'swagger-ui-express'
import { swaggerSpec, swaggerUiOptions } from '../config/swagger.config.js'

const router = Router()

// Especificación OpenAPI en JSON (útil para importarla en Postman o Insomnia).
router.get('/docs.json', (req, res) => res.json(swaggerSpec))

// Swagger UI interactivo.
router.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions))

export default router
