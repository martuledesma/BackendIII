import { expect } from 'chai'
import { api, expectSuccess, expectError } from './helpers/api.helper.js'
import { clearDatabase } from './helpers/db.helper.js'
import { NON_EXISTENT_ID, INVALID_ID } from './helpers/fixtures.js'
import { DELIVERY_STATUS, USER_ROLES, MOCK_ENTITIES } from '../src/constants/index.js'

const WITH_COURIER = [DELIVERY_STATUS.ASSIGNED, DELIVERY_STATUS.IN_TRANSIT, DELIVERY_STATUS.DELIVERED]

describe('Deliveries — /api/deliveries', () => {
  let deliveries

  // Datos controlados: se cargan con el módulo de mocks hasta tener al menos una entrega.
  before(async () => {
    await clearDatabase()
    do {
      const res = await api.post('/api/mocks/seed').query({ entity: MOCK_ENTITIES.ALL, qty: 10 })
      expect(res.status).to.equal(201)
      deliveries = expectSuccess(await api.get('/api/deliveries'))
    } while (deliveries.length === 0)
  })
  after(clearDatabase)

  describe('GET /api/deliveries', () => {
    it('200: lista las entregas con pedido y repartidor populados y estados coherentes', () => {
      deliveries.forEach((d) => {
        expect(d).to.include.keys('_id', 'order', 'courier', 'status', 'trackingCode', 'estimatedDeliveryDate', 'deliveredAt')
        expect(d.order).to.include.keys('_id', 'user', 'status', 'priority', 'total')
        expect(Object.values(DELIVERY_STATUS)).to.include(d.status)
        if (WITH_COURIER.includes(d.status)) {
          expect(d.courier.role).to.equal(USER_ROLES.COURIER)
        } else {
          expect(d.courier).to.equal(null)
        }
        expect(Boolean(d.deliveredAt)).to.equal(d.status === DELIVERY_STATUS.DELIVERED)
      })
    })

    it('200: filtra por estado', async () => {
      const { status } = deliveries[0]
      const filtered = expectSuccess(await api.get('/api/deliveries').query({ status }))
      expect(filtered).to.not.be.empty
      filtered.forEach((d) => expect(d.status).to.equal(status))
    })

    it('400 INVALID_STATUS: estado de entrega inválido', async () => {
      const error = expectError(await api.get('/api/deliveries').query({ status: 'PERDIDA' }), 400, 'INVALID_STATUS')
      expect(error.details.allowed).to.have.members(Object.values(DELIVERY_STATUS))
    })
  })

  describe('GET /api/deliveries/:did', () => {
    it('200: devuelve la entrega consultada', async () => {
      const delivery = expectSuccess(await api.get(`/api/deliveries/${deliveries[0]._id}`))
      expect(delivery).to.include({ _id: deliveries[0]._id, trackingCode: deliveries[0].trackingCode })
    })

    it('404 DELIVERY_NOT_FOUND: entrega inexistente', async () => {
      expectError(await api.get(`/api/deliveries/${NON_EXISTENT_ID}`), 404, 'DELIVERY_NOT_FOUND')
    })

    it('400 INVALID_ID: id con formato inválido', async () => {
      expectError(await api.get(`/api/deliveries/${INVALID_ID}`), 400, 'INVALID_ID')
    })
  })
})
