import { Router } from 'express'
import { getDeliveries, getDeliveryById } from '../controllers/deliveries.controller.js'
import { uploadDeliveryProof as uploadDeliveryProofFile } from '../config/multer.config.js'
import { uploadDeliveryProof, getDeliveryProofs, downloadDeliveryProof } from '../controllers/files.controller.js'

const router = Router()

router.get('/', getDeliveries)
router.get('/:did', getDeliveryById)

// Comprobantes de la entrega (multipart/form-data, campo "proof")
router.post('/:did/proofs', uploadDeliveryProofFile, uploadDeliveryProof)
router.get('/:did/proofs', getDeliveryProofs)
router.get('/:did/proofs/:proofId/file', downloadDeliveryProof)

export default router
