// Lógica de negocio de la carga de archivos: documentos de usuario y comprobantes de entrega.
// Valida (archivo, campos, tipo de documento, entidad, firma real del archivo), mueve el archivo
// a su carpeta definitiva y asocia los metadatos a la entidad.
// Si cualquier paso falla, borra el archivo temporal: nunca quedan archivos sin entidad.
import { UPLOAD_DIRS, ALLOWED_LABELS } from '../config/multer.config.js'
import { logger } from '../config/logger.js'
import {
  ALLOWED_FILE_TYPES,
  FILE_FIELDS,
  USER_DOCUMENT_TYPES,
  COURIER_ONLY_DOCUMENT_TYPES,
  DELIVERY_PROOF_TYPES,
  USER_ROLES
} from '../constants/index.js'
import { usersRepository } from '../repositories/users.repository.js'
import { deliveriesRepository } from '../repositories/deliveries.repository.js'
import { fileStorageRepository } from '../repositories/file-storage.repository.js'
import {
  AppError,
  FileRequiredError,
  FileSaveError,
  InvalidDocumentTypeError,
  InvalidFileTypeError,
  InvalidFieldError,
  InvalidIdError,
  MissingFieldsError,
  UserNotFoundError,
  DeliveryNotFoundError,
  DocumentNotFoundError
} from '../errors/index.js'
import { isValidObjectId } from '../utils/validators.js'

const VALID_USER_DOCUMENT_TYPES = Object.values(USER_DOCUMENT_TYPES)
const VALID_PROOF_TYPES = Object.values(DELIVERY_PROOF_TYPES)

// Campos de texto aceptados en cada formulario (además del archivo).
const USER_DOCUMENT_FIELDS = ['documentType']
const DELIVERY_PROOF_FIELDS = ['documentType']

// Carpeta definitiva según el tipo de documento.
const folderForUserDocument = (documentType) =>
  COURIER_ONLY_DOCUMENT_TYPES.includes(documentType) ? UPLOAD_DIRS.USER_LICENSES : UPLOAD_DIRS.USER_DOCUMENTS

// ---------- Validaciones ----------

const ensureFile = (file, field) => {
  if (!file) throw new FileRequiredError(field)
}

const ensureOnlyFields = (body = {}, allowed) => {
  const unknown = Object.keys(body).find((key) => !allowed.includes(key))
  if (unknown) throw new InvalidFieldError(unknown, `no es un campo permitido. Permitidos: ${allowed.join(', ')}`)
}

// Segundo control de tipo: los primeros bytes del archivo tienen que coincidir con su tipo declarado.
const ensureRealFileType = async (file) => {
  const { signature } = ALLOWED_FILE_TYPES[file.mimetype]
  const header = await fileStorageRepository.readSignature(file.path, signature.length)
  const matches = signature.every((byte, i) => header[i] === byte)
  if (!matches) {
    logger.warning(`Archivo rechazado: "${file.originalname}" dice ser ${file.mimetype} pero su contenido no coincide`)
    throw new InvalidFileTypeError({
      mimeType: file.mimetype,
      extension: file.originalname.slice(file.originalname.lastIndexOf('.')),
      allowed: ALLOWED_LABELS,
      reason: `El contenido de "${file.originalname}" no corresponde a un archivo ${ALLOWED_FILE_TYPES[file.mimetype].label} válido`
    })
  }
}

// ---------- Guardado ----------

// Mueve el temporal a su carpeta y arma los metadatos que se guardan en MongoDB.
const storeFile = async (file, folder, documentType) => {
  try {
    const path = await fileStorageRepository.move(file.path, folder, file.filename)
    return {
      originalName: file.originalname,
      fileName: file.filename,
      path,
      mimeType: file.mimetype,
      size: file.size,
      documentType,
      uploadedAt: new Date()
    }
  } catch (error) {
    throw new FileSaveError(error)
  }
}

/**
 * Esqueleto común de una carga: valida, guarda, asocia y limpia si algo falla.
 * @param {object} params
 * @param {Express.Multer.File|undefined} params.file archivo recibido por Multer (en uploads/tmp)
 * @param {() => Promise<{folder: string, documentType: string}>} params.validate validaciones del caso
 * @param {(metadata: object) => Promise<object|null>} params.associate guarda los metadatos en la entidad
 */
const handleUpload = async ({ file, validate, associate }) => {
  let storedPath = null
  try {
    const { folder, documentType } = await validate()
    await ensureRealFileType(file)

    const metadata = await storeFile(file, folder, documentType)
    storedPath = metadata.path

    const entity = await associate(metadata)
    if (!entity) throw new FileSaveError(new Error('la entidad dejó de existir durante la carga'))
    return { metadata, entity }
  } catch (error) {
    // Limpieza: ni el temporal ni el archivo movido quedan sin entidad.
    if (file?.path) await fileStorageRepository.remove(file.path).catch(() => {})
    if (storedPath) await fileStorageRepository.remove(storedPath).catch(() => {})
    if (!(error instanceof AppError)) throw new FileSaveError(error)
    throw error
  }
}

const findUserOrFail = async (uid) => {
  if (!isValidObjectId(uid)) throw new InvalidIdError('usuario', uid)
  const user = await usersRepository.getById(uid)
  if (!user) throw new UserNotFoundError(uid)
  return user
}

const findDeliveryOrFail = async (did) => {
  if (!isValidObjectId(did)) throw new InvalidIdError('entrega', did)
  const delivery = await deliveriesRepository.getById(did)
  if (!delivery) throw new DeliveryNotFoundError(did)
  return delivery
}

// Busca un archivo de una lista de metadatos y comprueba que siga en el disco.
const resolveStoredFile = async (files, entity, entityId, fileId) => {
  const metadata = files.find((f) => String(f._id) === fileId)
  if (!metadata) throw new DocumentNotFoundError(entity, entityId, fileId)
  if (!(await fileStorageRepository.exists(metadata.path))) {
    logger.error(`El archivo ${metadata.path} figura en ${entity} ${entityId} pero no está en el servidor`)
    throw new DocumentNotFoundError(entity, entityId, fileId)
  }
  return { ...metadata, absolutePath: fileStorageRepository.toAbsolute(metadata.path) }
}

// ---------- API del service ----------

export const filesService = {
  // ----- Documentos de usuario -----
  uploadUserDocument: async (uid, file, body = {}) => {
    const { metadata, entity: user } = await handleUpload({
      file,
      validate: async () => {
        if (!isValidObjectId(uid)) throw new InvalidIdError('usuario', uid)
        ensureFile(file, FILE_FIELDS.USER_DOCUMENT)
        ensureOnlyFields(body, USER_DOCUMENT_FIELDS)

        const { documentType } = body
        if (!documentType) throw new MissingFieldsError(['documentType'])
        if (!VALID_USER_DOCUMENT_TYPES.includes(documentType)) {
          throw new InvalidDocumentTypeError(documentType, VALID_USER_DOCUMENT_TYPES)
        }

        const user = await findUserOrFail(uid)
        // Regla: la licencia y la cédula del vehículo son documentos de repartidor.
        if (COURIER_ONLY_DOCUMENT_TYPES.includes(documentType) && user.role !== USER_ROLES.COURIER) {
          throw new InvalidDocumentTypeError(
            documentType,
            VALID_USER_DOCUMENT_TYPES.filter((t) => !COURIER_ONLY_DOCUMENT_TYPES.includes(t)),
            `El documento ${documentType} solo lo puede subir un usuario ${USER_ROLES.COURIER} (este usuario es ${user.role})`
          )
        }
        return { folder: folderForUserDocument(documentType), documentType }
      },
      associate: (meta) => usersRepository.addDocument(uid, meta)
    })

    const document = user.documents.at(-1)
    logger.info(`Documento ${metadata.documentType} subido para el usuario ${uid}: ${metadata.path} (${metadata.size} bytes)`)
    return { document, user }
  },

  getUserDocuments: async (uid) => (await findUserOrFail(uid)).documents,

  getUserDocumentFile: async (uid, documentId) => {
    const user = await findUserOrFail(uid)
    return resolveStoredFile(user.documents, 'el usuario', uid, documentId)
  },

  // ----- Comprobantes de entrega -----
  uploadDeliveryProof: async (did, file, body = {}) => {
    const { metadata, entity: delivery } = await handleUpload({
      file,
      validate: async () => {
        if (!isValidObjectId(did)) throw new InvalidIdError('entrega', did)
        ensureFile(file, FILE_FIELDS.DELIVERY_PROOF)
        ensureOnlyFields(body, DELIVERY_PROOF_FIELDS)

        // Opcional: si no se envía, es un remito.
        const documentType = body.documentType || DELIVERY_PROOF_TYPES.DELIVERY_RECEIPT
        if (!VALID_PROOF_TYPES.includes(documentType)) {
          throw new InvalidDocumentTypeError(documentType, VALID_PROOF_TYPES)
        }

        await findDeliveryOrFail(did)
        return { folder: UPLOAD_DIRS.DELIVERY_PROOFS, documentType }
      },
      associate: (meta) => deliveriesRepository.addProof(did, meta)
    })

    const proof = delivery.proofs.at(-1)
    logger.info(
      `Comprobante ${metadata.documentType} asociado a la entrega ${did} (pedido ${delivery.order?._id ?? '-'}): ${metadata.path}`
    )
    return { proof, delivery }
  },

  getDeliveryProofs: async (did) => (await findDeliveryOrFail(did)).proofs,

  getDeliveryProofFile: async (did, proofId) => {
    const delivery = await findDeliveryOrFail(did)
    return resolveStoredFile(delivery.proofs, 'la entrega', did, proofId)
  }
}
