import { expect } from 'chai'
import { api, expectError } from './helpers/api.helper.js'
import { clearDatabase } from './helpers/db.helper.js'
import { NON_EXISTENT_ID, INVALID_ID } from './helpers/fixtures.js'

const REQUIRED_TAGS = ['Users', 'Orders', 'Deliveries', 'Mocks', 'Logger']
const REQUIRED_SCHEMAS = ['User', 'Order', 'OrderItem', 'Delivery', 'ErrorResponse', 'SuccessResponse']

describe('Swagger — /api/docs', () => {
  let spec

  before(async () => {
    await clearDatabase()
    const res = await api.get('/api/docs.json')
    expect(res.status).to.equal(200)
    spec = res.body
  })
  after(clearDatabase)

  it('200: /api/docs/ sirve Swagger UI', async () => {
    const res = await api.get('/api/docs/')
    expect(res.status).to.equal(200)
    expect(res.headers['content-type']).to.match(/text\/html/)
    expect(res.text).to.include('swagger-ui')
    expect(res.text).to.include('<title>ShipNow API · Documentación</title>')
  })

  it('301: /api/docs redirige a /api/docs/', async () => {
    const res = await api.get('/api/docs')
    expect(res.status).to.equal(301)
    expect(res.headers.location).to.equal('/api/docs/')
  })

  it('200: /api/docs.json tiene la información general, los tags y los schemas', () => {
    expect(spec.openapi).to.match(/^3\./)
    expect(spec.info).to.include({ title: 'ShipNow API' })
    expect(spec.info.version).to.be.a('string')
    expect(spec.servers[0].url).to.match(/^http:\/\/localhost:\d+$/)
    expect(spec.tags.map((t) => t.name)).to.include.members(REQUIRED_TAGS)
    expect(spec.components.schemas).to.include.keys(...REQUIRED_SCHEMAS)
  })

  it('cada operación tiene tag, resumen, respuesta exitosa y errores con el schema ErrorResponse', () => {
    for (const [path, item] of Object.entries(spec.paths)) {
      for (const [method, op] of Object.entries(item)) {
        if (method === 'parameters') continue
        const label = `${method.toUpperCase()} ${path}`
        expect(op.tags, label).to.have.lengthOf(1)
        expect(op.summary, label).to.be.a('string')
        expect(Object.keys(op.responses).some((code) => code.startsWith('2')), label).to.equal(true)
        Object.entries(op.responses)
          .filter(([code]) => Number(code) >= 400)
          .forEach(([, response]) => {
            expect(response.content['application/json'].schema.$ref, label).to.equal('#/components/schemas/ErrorResponse')
          })
      }
    }
  })

  // Coherencia con Swagger: todo GET por id documentado con 404 y 400 se comprueba contra la API real.
  describe('coherencia: los errores documentados son los que devuelve la API', () => {
    const byIdGets = () => Object.entries(spec.paths)
      .filter(([path, item]) => /\{\w+\}$/.test(path) && item.get?.responses?.['404'])

    it('GET por id inexistente → 404 con el código documentado', async () => {
      const endpoints = byIdGets()
      expect(endpoints.length).to.be.at.least(4)
      for (const [path, item] of endpoints) {
        const [documentedCode] = Object.keys(item.get.responses['404'].content['application/json'].examples)
        const res = await api.get(path.replace(/\{\w+\}$/, NON_EXISTENT_ID))
        expectError(res, 404, documentedCode)
      }
    })

    it('GET por id con formato inválido → 400 INVALID_ID documentado', async () => {
      for (const [path, item] of byIdGets()) {
        expect(Object.keys(item.get.responses['400'].content['application/json'].examples)).to.include('INVALID_ID')
        expectError(await api.get(path.replace(/\{\w+\}$/, INVALID_ID)), 400, 'INVALID_ID')
      }
    })

    it('los endpoints de mocks documentan y devuelven los errores de cantidad', async () => {
      const mockGets = Object.entries(spec.paths).filter(([path, item]) => path.startsWith('/api/mocks/') && item.get)
      expect(mockGets).to.have.lengthOf(5)
      for (const [path, item] of mockGets) {
        const documented = Object.keys(item.get.responses['400'].content['application/json'].examples)
        expect(documented).to.include.members(['MOCK_INVALID_QUANTITY', 'MOCK_NEGATIVE_QUANTITY', 'MOCK_QUANTITY_EXCEEDED'])
        expectError(await api.get(path).query({ qty: -1 }), 400, 'MOCK_NEGATIVE_QUANTITY')
      }
    })
  })
})
