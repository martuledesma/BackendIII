// Puerta de entrada HTTP de la carga y descarga de archivos.
// Multer ya dejó el archivo en req.file; el service valida, guarda y asocia.
import { filesService } from '../services/files.service.js'
import { HTTP_STATUS } from '../constants/index.js'
import { asyncHandler } from '../utils/async-handler.js'
import { sendSuccess } from '../utils/response.js'

// Envía el archivo con su nombre original. Los errores de envío van al middleware global.
const sendStoredFile = (res, next, file) => {
  res.type(file.mimeType)
  res.download(file.absolutePath, file.originalName, (error) => {
    if (error && !res.headersSent) next(error)
  })
}

// ----- Documentos de usuario -----
export const uploadUserDocument = asyncHandler(async (req, res) => {
  sendSuccess(res, await filesService.uploadUserDocument(req.params.uid, req.file, req.body), HTTP_STATUS.CREATED)
})

export const getUserDocuments = asyncHandler(async (req, res) => {
  sendSuccess(res, await filesService.getUserDocuments(req.params.uid))
})

export const downloadUserDocument = asyncHandler(async (req, res, next) => {
  sendStoredFile(res, next, await filesService.getUserDocumentFile(req.params.uid, req.params.docId))
})

// ----- Comprobantes de entrega -----
export const uploadDeliveryProof = asyncHandler(async (req, res) => {
  sendSuccess(res, await filesService.uploadDeliveryProof(req.params.did, req.file, req.body), HTTP_STATUS.CREATED)
})

export const getDeliveryProofs = asyncHandler(async (req, res) => {
  sendSuccess(res, await filesService.getDeliveryProofs(req.params.did))
})

export const downloadDeliveryProof = asyncHandler(async (req, res, next) => {
  sendStoredFile(res, next, await filesService.getDeliveryProofFile(req.params.did, req.params.proofId))
})
