import { Router } from 'express'
import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser
} from '../controllers/users.controller.js'
import { uploadUserDocument as uploadUserDocumentFile } from '../config/multer.config.js'
import { uploadUserDocument, getUserDocuments, downloadUserDocument } from '../controllers/files.controller.js'

const router = Router()

router.get('/', getUsers)
router.get('/:uid', getUserById)
router.post('/', createUser)
router.put('/:uid', updateUser)
router.delete('/:uid', deleteUser)

// Documentos del usuario (multipart/form-data, campo "document")
router.post('/:uid/documents', uploadUserDocumentFile, uploadUserDocument)
router.get('/:uid/documents', getUserDocuments)
router.get('/:uid/documents/:docId/file', downloadUserDocument)

export default router
