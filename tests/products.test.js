import { expect } from 'chai'
import { api, expectSuccess, expectError } from './helpers/api.helper.js'
import { clearDatabase } from './helpers/db.helper.js'
import { buildProduct, NON_EXISTENT_ID } from './helpers/fixtures.js'
import { PRODUCT_STATUS } from '../src/constants/index.js'

describe('Products — /api/products', () => {
  let withStock
  let withoutStock

  before(async () => {
    await clearDatabase()
    withStock = expectSuccess(await api.post('/api/products').send(buildProduct({ stock: 5 })), 201)
    withoutStock = expectSuccess(await api.post('/api/products').send(buildProduct({ stock: 0 })), 201)
  })
  after(clearDatabase)

  it('201: el estado se calcula a partir del stock', () => {
    expect(withStock.status).to.equal(PRODUCT_STATUS.AVAILABLE)
    expect(withoutStock.status).to.equal(PRODUCT_STATUS.OUT_OF_STOCK)
  })

  it('200: por defecto lista solo los disponibles; includeOutOfStock=true los incluye a todos', async () => {
    const available = expectSuccess(await api.get('/api/products'))
    expect(available.map((p) => p._id)).to.deep.equal([withStock._id])

    const all = expectSuccess(await api.get('/api/products').query({ includeOutOfStock: true }))
    expect(all.map((p) => p._id)).to.have.members([withStock._id, withoutStock._id])
  })

  it('400 MISSING_FIELDS: datos incompletos', async () => {
    const error = expectError(await api.post('/api/products').send({ title: 'Solo título' }), 400, 'MISSING_FIELDS')
    expect(error.details.fields).to.have.members(['code', 'price', 'category'])
  })

  it('409 PRODUCT_CODE_TAKEN: código repetido', async () => {
    expectError(await api.post('/api/products').send(buildProduct({ code: withStock.code })), 409, 'PRODUCT_CODE_TAKEN')
  })

  it('404 PRODUCT_NOT_FOUND: producto inexistente', async () => {
    expectError(await api.get(`/api/products/${NON_EXISTENT_ID}`), 404, 'PRODUCT_NOT_FOUND')
  })
})
