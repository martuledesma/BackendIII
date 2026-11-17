import {
  USER_DOCUMENT_TYPES, COURIER_ONLY_DOCUMENT_TYPES, DELIVERY_PROOF_TYPES, ALLOWED_FILE_TYPES,
  UPLOAD_LIMITS, FILE_FIELDS, USER_ROLES
} from '../../constants/index.js'
import { errorResponses, successResponse, schemaRef, arrayOf, SERVER_ERRORS } from '../helpers.js'

const TAG = 'Uploads'
const ACCEPTED = Object.values(ALLOWED_FILE_TYPES).map((t) => `${t.label} (${t.extensions.join(', ')})`).join(', ')
const MIME_TYPES = Object.keys(ALLOWED_FILE_TYPES).join(', ')
const FILE_ERRORS = [
  'FILE_REQUIRED', 'UNEXPECTED_FILE_FIELD', 'TOO_MANY_FILES', 'INVALID_MULTIPART',
  'INVALID_DOCUMENT_TYPE', 'INVALID_FIELD', 'FILE_TOO_LARGE', 'INVALID_FILE_TYPE', 'FILE_SAVE_FAILED'
]
const RULES = [
  `**Tipos aceptados:** ${ACCEPTED}. Se valida el Content-Type, la extensión y el contenido real del archivo (firma).`,
  `**Tamaño máximo:** ${UPLOAD_LIMITS.MAX_FILE_SIZE_MB} MB. **Un solo archivo** por petición.`,
  'El archivo se guarda en el servidor con un nombre generado; en MongoDB se guardan solo los metadatos, dentro de la entidad.',
  'Si algo falla (entidad inexistente, tipo inválido...), el archivo no queda guardado.'
].join('\n\n')

const multipartBody = (schemaName) => ({
  required: true,
  content: {
    'multipart/form-data': {
      schema: schemaRef(schemaName),
      encoding: { [schemaName === 'UserDocumentUploadInput' ? FILE_FIELDS.USER_DOCUMENT : FILE_FIELDS.DELIVERY_PROOF]: { contentType: MIME_TYPES } }
    }
  }
})

const fileDownload = {
  description: 'El archivo, con su nombre original (Content-Disposition: attachment)',
  content: Object.fromEntries(Object.keys(ALLOWED_FILE_TYPES).map((mime) => [mime, { schema: { type: 'string', format: 'binary' } }]))
}

const idParam = (name, description) => ({ name, in: 'path', required: true, description, schema: { type: 'string', example: '6739f1c2a8b4e5d6f7a8b9c0' } })

export const uploadsPaths = {
  '/api/users/{uid}/documents': {
    parameters: [idParam('uid', 'Id del usuario')],
    post: {
      tags: [TAG],
      summary: 'Subir un documento de usuario',
      description: [
        `Campo del archivo: **\`${FILE_FIELDS.USER_DOCUMENT}\`**. Campo obligatorio: **\`documentType\`** (${Object.values(USER_DOCUMENT_TYPES).join(', ')}).`,
        `${COURIER_ONLY_DOCUMENT_TYPES.join(' y ')} solo se aceptan para usuarios ${USER_ROLES.COURIER} y se guardan en \`uploads/users/licenses/\`; el resto en \`uploads/users/documents/\`.`,
        RULES
      ].join('\n\n'),
      requestBody: multipartBody('UserDocumentUploadInput'),
      responses: {
        201: successResponse('Documento subido y asociado al usuario', schemaRef('UserDocumentUploadResult')),
        ...errorResponses({ path: '/api/users/6739f1c2a8b4e5d6f7a8b9c0/documents', method: 'POST' },
          'INVALID_ID', 'MISSING_FIELDS', ...FILE_ERRORS, 'USER_NOT_FOUND', ...SERVER_ERRORS)
      }
    },
    get: {
      tags: [TAG],
      summary: 'Listar los documentos de un usuario',
      responses: {
        200: successResponse('Metadatos de los documentos del usuario', arrayOf('FileMetadata')),
        ...errorResponses({ path: '/api/users/6739f1c2a8b4e5d6f7a8b9c0/documents', method: 'GET' }, 'INVALID_ID', 'USER_NOT_FOUND', ...SERVER_ERRORS)
      }
    }
  },
  '/api/users/{uid}/documents/{docId}/file': {
    parameters: [idParam('uid', 'Id del usuario'), idParam('docId', 'Id del documento (el _id de FileMetadata)')],
    get: {
      tags: [TAG],
      summary: 'Descargar un documento de usuario',
      responses: {
        200: fileDownload,
        ...errorResponses({ path: '/api/users/6739f1c2a8b4e5d6f7a8b9c0/documents/6739f1c2a8b4e5d6f7a8b9c1/file', method: 'GET' },
          'INVALID_ID', 'USER_NOT_FOUND', 'DOCUMENT_NOT_FOUND', ...SERVER_ERRORS)
      }
    }
  },
  '/api/deliveries/{did}/proofs': {
    parameters: [idParam('did', 'Id de la entrega')],
    post: {
      tags: [TAG],
      summary: 'Subir un comprobante de entrega',
      description: [
        `Campo del archivo: **\`${FILE_FIELDS.DELIVERY_PROOF}\`**. Campo opcional: **\`documentType\`** (${Object.values(DELIVERY_PROOF_TYPES).join(', ')}; por defecto ${DELIVERY_PROOF_TYPES.DELIVERY_RECEIPT}).`,
        'El comprobante se asocia a la entrega (y, a través de ella, a su pedido) y se guarda en `uploads/deliveries/proofs/`.',
        RULES
      ].join('\n\n'),
      requestBody: multipartBody('DeliveryProofUploadInput'),
      responses: {
        201: successResponse('Comprobante subido y asociado a la entrega', schemaRef('DeliveryProofUploadResult')),
        ...errorResponses({ path: '/api/deliveries/6739f1c2a8b4e5d6f7a8b9c0/proofs', method: 'POST' },
          'INVALID_ID', ...FILE_ERRORS, 'DELIVERY_NOT_FOUND', ...SERVER_ERRORS)
      }
    },
    get: {
      tags: [TAG],
      summary: 'Listar los comprobantes de una entrega',
      responses: {
        200: successResponse('Metadatos de los comprobantes de la entrega', arrayOf('FileMetadata')),
        ...errorResponses({ path: '/api/deliveries/6739f1c2a8b4e5d6f7a8b9c0/proofs', method: 'GET' }, 'INVALID_ID', 'DELIVERY_NOT_FOUND', ...SERVER_ERRORS)
      }
    }
  },
  '/api/deliveries/{did}/proofs/{proofId}/file': {
    parameters: [idParam('did', 'Id de la entrega'), idParam('proofId', 'Id del comprobante (el _id de FileMetadata)')],
    get: {
      tags: [TAG],
      summary: 'Descargar un comprobante de entrega',
      responses: {
        200: fileDownload,
        ...errorResponses({ path: '/api/deliveries/6739f1c2a8b4e5d6f7a8b9c0/proofs/6739f1c2a8b4e5d6f7a8b9c1/file', method: 'GET' },
          'INVALID_ID', 'DELIVERY_NOT_FOUND', 'DOCUMENT_NOT_FOUND', ...SERVER_ERRORS)
      }
    }
  }
}
