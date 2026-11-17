import { readdir, readFile, rm, access } from 'node:fs/promises'
import { expect } from 'chai'
import { api, expectSuccess, expectError } from './helpers/api.helper.js'
import { clearDatabase } from './helpers/db.helper.js'
import { createCustomer, createCourier, createOrder, NON_EXISTENT_ID, INVALID_ID } from './helpers/fixtures.js'
import { UPLOAD_DIRS } from '../src/config/multer.config.js'
import {
  USER_DOCUMENT_TYPES, DELIVERY_PROOF_TYPES, ORDER_STATUS, UPLOAD_LIMITS, FILE_FIELDS
} from '../src/constants/index.js'

// ---------- Archivos de prueba en memoria (contenido real de cada tipo) ----------
const PDF = Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n')
const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex')
const JPG = Buffer.from('ffd8ffe000104a46494600010100000100010000ffd9', 'hex')
const TXT = Buffer.from('esto es un archivo de texto')
const FAKE_PDF = Buffer.from('no soy un pdf, solo tengo la extensión') // Content-Type application/pdf falso

const asPdf = (filename = 'dni-frente.pdf') => ({ filename, contentType: 'application/pdf' })
const FILE_NAME_PATTERN = /^\d{13}-[a-f\d]{16}\.(pdf|png|jpg)$/

const exists = (path) => access(path).then(() => true, () => false)
const tmpFiles = () => readdir(UPLOAD_DIRS.TMP)

// Lector binario para comparar el archivo descargado byte a byte.
const binary = (res, cb) => {
  const chunks = []
  res.on('data', (chunk) => chunks.push(chunk))
  res.on('end', () => cb(null, Buffer.concat(chunks)))
}

// Pasar `documentType: null` o `file: null` omite ese campo del formulario.
const uploadUserDocument = (uid, { field = FILE_FIELDS.USER_DOCUMENT, file = PDF, options = asPdf(), documentType = USER_DOCUMENT_TYPES.ID_CARD } = {}) => {
  const req = api.post(`/api/users/${uid}/documents`)
  if (documentType !== null) req.field('documentType', documentType)
  if (file) req.attach(field, file, options)
  return req
}

describe('Uploads — carga de archivos (Multer)', () => {
  let customer
  let courier

  before(async () => {
    await clearDatabase()
    customer = await createCustomer({ firstName: 'Ana' })
    courier = await createCourier({ firstName: 'Luis' })
  })

  // Limpieza: base de testing y carpeta uploads/test/ (los archivos subidos no quedan en el disco ni en el repo).
  after(async () => {
    await clearDatabase()
    await rm(UPLOAD_DIRS.ROOT, { recursive: true, force: true })
  })

  // Ningún caso (exitoso o con error) puede dejar archivos temporales sueltos.
  afterEach(async () => {
    expect(await tmpFiles()).to.deep.equal([])
  })

  describe('POST /api/users/:uid/documents', () => {
    it('201: guarda el archivo en su carpeta y los metadatos en el usuario', async () => {
      const payload = expectSuccess(await uploadUserDocument(customer._id), 201)
      const { document, user } = payload

      expect(document).to.have.all.keys('_id', 'originalName', 'fileName', 'path', 'mimeType', 'size', 'documentType', 'uploadedAt')
      expect(document).to.include({
        originalName: 'dni-frente.pdf',
        mimeType: 'application/pdf',
        size: PDF.length,
        documentType: USER_DOCUMENT_TYPES.ID_CARD
      })
      expect(document.fileName).to.match(FILE_NAME_PATTERN)
      expect(document.path).to.equal(`${UPLOAD_DIRS.USER_DOCUMENTS}/${document.fileName}`)
      expect(Number.isNaN(Date.parse(document.uploadedAt))).to.equal(false)

      // Asociación: el usuario devuelto ya tiene el documento.
      expect(user._id).to.equal(customer._id)
      expect(user.documents.map((d) => d._id)).to.include(document._id)
      expect(user).to.not.have.property('password')

      // El archivo está en el disco con el mismo contenido.
      expect((await readFile(document.path)).equals(PDF)).to.equal(true)
    })

    it('201: la licencia de un COURIER (PNG) va a la carpeta de licencias', async () => {
      const { document } = expectSuccess(await uploadUserDocument(courier._id, {
        file: PNG, options: { filename: 'licencia.png', contentType: 'image/png' }, documentType: USER_DOCUMENT_TYPES.DRIVER_LICENSE
      }), 201)
      expect(document.path.startsWith(`${UPLOAD_DIRS.USER_LICENSES}/`)).to.equal(true)
      expect(document).to.include({ mimeType: 'image/png', documentType: USER_DOCUMENT_TYPES.DRIVER_LICENSE })
      expect(await exists(document.path)).to.equal(true)
    })

    it('400 FILE_REQUIRED: falta el archivo', async () => {
      const error = expectError(await uploadUserDocument(customer._id, { file: null }), 400, 'FILE_REQUIRED')
      expect(error.details).to.deep.equal({ field: FILE_FIELDS.USER_DOCUMENT })
    })

    it('400 FILE_REQUIRED: la petición no es multipart (JSON)', async () => {
      const res = await api.post(`/api/users/${customer._id}/documents`).send({ documentType: USER_DOCUMENT_TYPES.ID_CARD })
      expectError(res, 400, 'FILE_REQUIRED')
    })

    it('400 MISSING_FIELDS: falta documentType (y el archivo no queda guardado)', async () => {
      const error = expectError(await uploadUserDocument(customer._id, { documentType: null }), 400, 'MISSING_FIELDS')
      expect(error.details.fields).to.deep.equal(['documentType'])
    })

    it('400 INVALID_DOCUMENT_TYPE: tipo de documento inexistente', async () => {
      const error = expectError(await uploadUserDocument(customer._id, { documentType: 'PASAPORTE' }), 400, 'INVALID_DOCUMENT_TYPE')
      expect(error.details).to.include({ field: 'documentType', value: 'PASAPORTE' })
      expect(error.details.allowed).to.have.members(Object.values(USER_DOCUMENT_TYPES))
    })

    it('400 INVALID_DOCUMENT_TYPE: un cliente no puede subir una licencia de repartidor', async () => {
      const error = expectError(await uploadUserDocument(customer._id, { documentType: USER_DOCUMENT_TYPES.DRIVER_LICENSE }), 400, 'INVALID_DOCUMENT_TYPE')
      expect(error.message).to.include('COURIER')
    })

    it('415 INVALID_FILE_TYPE: tipo de archivo no permitido (.txt)', async () => {
      const res = await uploadUserDocument(customer._id, { file: TXT, options: { filename: 'notas.txt', contentType: 'text/plain' } })
      const error = expectError(res, 415, 'INVALID_FILE_TYPE')
      expect(error.details).to.include({ mimeType: 'text/plain', extension: '.txt' })
      expect(error.details.allowed).to.have.members(['PDF', 'JPG', 'PNG'])
    })

    it('415 INVALID_FILE_TYPE: el contenido no coincide con el tipo declarado (PDF falso)', async () => {
      const res = await uploadUserDocument(customer._id, { file: FAKE_PDF, options: asPdf('falso.pdf') })
      expectError(res, 415, 'INVALID_FILE_TYPE')
    })

    it('415 INVALID_FILE_TYPE: la extensión no coincide con el Content-Type', async () => {
      const res = await uploadUserDocument(customer._id, { file: PDF, options: { filename: 'dni.exe', contentType: 'application/pdf' } })
      expectError(res, 415, 'INVALID_FILE_TYPE')
    })

    it(`413 FILE_TOO_LARGE: el archivo supera los ${UPLOAD_LIMITS.MAX_FILE_SIZE_MB} MB`, async () => {
      const big = Buffer.concat([PDF, Buffer.alloc(UPLOAD_LIMITS.MAX_FILE_SIZE_BYTES)])
      const error = expectError(await uploadUserDocument(customer._id, { file: big }), 413, 'FILE_TOO_LARGE')
      expect(error.details).to.deep.equal({ maxSizeMB: UPLOAD_LIMITS.MAX_FILE_SIZE_MB })
    })

    it('400 UNEXPECTED_FILE_FIELD: el archivo llega en otro campo', async () => {
      const error = expectError(await uploadUserDocument(customer._id, { field: 'archivo' }), 400, 'UNEXPECTED_FILE_FIELD')
      expect(error.details).to.deep.equal({ received: 'archivo', expected: FILE_FIELDS.USER_DOCUMENT })
    })

    it('400 INVALID_FIELD: campo de texto no permitido', async () => {
      const res = await uploadUserDocument(customer._id).field('color', 'rojo')
      const error = expectError(res, 400, 'INVALID_FIELD')
      expect(error.details.field).to.equal('color')
    })

    it('404 USER_NOT_FOUND: el usuario no existe (y no queda ningún archivo guardado)', async () => {
      const before = await readdir(UPLOAD_DIRS.USER_DOCUMENTS)
      expectError(await uploadUserDocument(NON_EXISTENT_ID), 404, 'USER_NOT_FOUND')
      expect(await readdir(UPLOAD_DIRS.USER_DOCUMENTS)).to.deep.equal(before)
    })

    it('400 INVALID_ID: id de usuario con formato inválido', async () => {
      expectError(await uploadUserDocument(INVALID_ID), 400, 'INVALID_ID')
    })
  })

  describe('GET /api/users/:uid/documents y descarga', () => {
    let document

    before(async () => {
      ({ document } = (await uploadUserDocument(customer._id, {
        file: JPG, options: { filename: 'constancia.jpg', contentType: 'image/jpeg' }, documentType: USER_DOCUMENT_TYPES.PROOF_OF_ADDRESS
      })).body.payload)
    })

    it('200: lista los documentos asociados al usuario', async () => {
      const documents = expectSuccess(await api.get(`/api/users/${customer._id}/documents`))
      expect(documents).to.be.an('array')
      expect(documents.find((d) => d._id === document._id)).to.deep.equal(document)
    })

    it('200: GET /api/users/:uid también incluye los documentos', async () => {
      const user = expectSuccess(await api.get(`/api/users/${customer._id}`))
      expect(user.documents.map((d) => d._id)).to.include(document._id)
    })

    it('200: descarga el archivo con su nombre original y el mismo contenido', async () => {
      const res = await api.get(`/api/users/${customer._id}/documents/${document._id}/file`).buffer(true).parse(binary)
      expect(res.status).to.equal(200)
      expect(res.headers['content-type']).to.match(/image\/jpeg/)
      expect(res.headers['content-disposition']).to.include('constancia.jpg')
      expect(res.body.equals(JPG)).to.equal(true)
    })

    it('404 DOCUMENT_NOT_FOUND: documento inexistente', async () => {
      expectError(await api.get(`/api/users/${customer._id}/documents/${NON_EXISTENT_ID}/file`), 404, 'DOCUMENT_NOT_FOUND')
    })

    it('404 USER_NOT_FOUND: usuario inexistente', async () => {
      expectError(await api.get(`/api/users/${NON_EXISTENT_ID}/documents`), 404, 'USER_NOT_FOUND')
    })
  })

  describe('POST /api/deliveries/:did/proofs (comprobantes)', () => {
    let delivery

    // Datos controlados: pedido creado y confirmado por la API, lo que genera su entrega.
    before(async () => {
      const order = await createOrder(customer._id)
      await api.patch(`/api/orders/${order._id}/status`).send({ status: ORDER_STATUS.CONFIRMED })
      const deliveries = expectSuccess(await api.get('/api/deliveries'))
      delivery = deliveries.find((d) => d.order._id === order._id)
    })

    it('201: asocia el comprobante a la entrega (tipo por defecto DELIVERY_RECEIPT)', async () => {
      const res = await api.post(`/api/deliveries/${delivery._id}/proofs`).attach(FILE_FIELDS.DELIVERY_PROOF, PDF, asPdf('remito.pdf'))
      const { proof, delivery: updated } = expectSuccess(res, 201)

      expect(proof).to.include({ originalName: 'remito.pdf', documentType: DELIVERY_PROOF_TYPES.DELIVERY_RECEIPT, size: PDF.length })
      expect(proof.path.startsWith(`${UPLOAD_DIRS.DELIVERY_PROOFS}/`)).to.equal(true)
      expect(updated._id).to.equal(delivery._id)
      expect(updated.order._id).to.equal(delivery.order._id)
      expect(updated.proofs.map((p) => p._id)).to.include(proof._id)
      expect(await exists(proof.path)).to.equal(true)
    })

    it('201: acepta un tipo de comprobante explícito y se puede listar y descargar', async () => {
      const res = await api.post(`/api/deliveries/${delivery._id}/proofs`)
        .field('documentType', DELIVERY_PROOF_TYPES.DELIVERY_PHOTO)
        .attach(FILE_FIELDS.DELIVERY_PROOF, PNG, { filename: 'paquete.png', contentType: 'image/png' })
      const { proof } = expectSuccess(res, 201)
      expect(proof.documentType).to.equal(DELIVERY_PROOF_TYPES.DELIVERY_PHOTO)

      const proofs = expectSuccess(await api.get(`/api/deliveries/${delivery._id}/proofs`))
      expect(proofs.map((p) => p._id)).to.include(proof._id)

      const file = await api.get(`/api/deliveries/${delivery._id}/proofs/${proof._id}/file`).buffer(true).parse(binary)
      expect(file.status).to.equal(200)
      expect(file.body.equals(PNG)).to.equal(true)
    })

    it('400 FILE_REQUIRED: falta el archivo', async () => {
      expectError(await api.post(`/api/deliveries/${delivery._id}/proofs`).field('documentType', DELIVERY_PROOF_TYPES.SIGNATURE), 400, 'FILE_REQUIRED')
    })

    it('400 INVALID_DOCUMENT_TYPE: tipo de comprobante inválido', async () => {
      const res = await api.post(`/api/deliveries/${delivery._id}/proofs`)
        .field('documentType', 'FACTURA')
        .attach(FILE_FIELDS.DELIVERY_PROOF, PDF, asPdf('remito.pdf'))
      const error = expectError(res, 400, 'INVALID_DOCUMENT_TYPE')
      expect(error.details.allowed).to.have.members(Object.values(DELIVERY_PROOF_TYPES))
    })

    it('415 INVALID_FILE_TYPE: tipo de archivo no permitido', async () => {
      const res = await api.post(`/api/deliveries/${delivery._id}/proofs`).attach(FILE_FIELDS.DELIVERY_PROOF, TXT, { filename: 'remito.txt', contentType: 'text/plain' })
      expectError(res, 415, 'INVALID_FILE_TYPE')
    })

    it('413 FILE_TOO_LARGE: comprobante demasiado grande', async () => {
      const big = Buffer.concat([PDF, Buffer.alloc(UPLOAD_LIMITS.MAX_FILE_SIZE_BYTES)])
      expectError(await api.post(`/api/deliveries/${delivery._id}/proofs`).attach(FILE_FIELDS.DELIVERY_PROOF, big, asPdf('remito.pdf')), 413, 'FILE_TOO_LARGE')
    })

    it('404 DELIVERY_NOT_FOUND: la entrega no existe (y no queda ningún archivo guardado)', async () => {
      const before = await readdir(UPLOAD_DIRS.DELIVERY_PROOFS)
      const res = await api.post(`/api/deliveries/${NON_EXISTENT_ID}/proofs`).attach(FILE_FIELDS.DELIVERY_PROOF, PDF, asPdf('remito.pdf'))
      expectError(res, 404, 'DELIVERY_NOT_FOUND')
      expect(await readdir(UPLOAD_DIRS.DELIVERY_PROOFS)).to.deep.equal(before)
    })
  })
})
