import { expect } from 'chai'
import { api, expectSuccess, expectError } from './helpers/api.helper.js'
import { clearDatabase, countDocuments } from './helpers/db.helper.js'
import {
  USER_ROLES, ORDER_STATUS, ORDER_PRIORITY, DELIVERY_STATUS, MOCK_ENTITIES, MOCK_LIMITS
} from '../src/constants/index.js'

const OBJECT_ID = /^[a-f\d]{24}$/

const expectValidMockUser = (user) => {
  expect(user).to.include.keys('_id', 'firstName', 'lastName', 'email', 'phone', 'role', 'courierProfile', 'isMock')
  expect(user._id).to.match(OBJECT_ID)
  expect(user.email).to.match(/@test\.com$/)
  expect(user.isMock).to.equal(true)
  expect(user).to.not.have.property('password')
  expect(Object.values(USER_ROLES)).to.include(user.role)
  // Solo los repartidores tienen perfil de repartidor.
  if (user.role === USER_ROLES.COURIER) expect(user.courierProfile).to.have.property('vehicle')
  else expect(user.courierProfile).to.equal(null)
}

describe('Mocks — /api/mocks', () => {
  beforeEach(clearDatabase)
  after(clearDatabase)

  describe('GET (solo generan, no guardan)', () => {
    it('200 /users: genera la cantidad pedida con estructura válida y sin guardar nada', async () => {
      const users = expectSuccess(await api.get('/api/mocks/users').query({ qty: 5 }))
      expect(users).to.be.an('array').with.lengthOf(5)
      users.forEach(expectValidMockUser)
      expect(await countDocuments('users')).to.equal(0)
    })

    it(`200 /users: sin qty genera ${MOCK_LIMITS.DEFAULT_QTY}`, async () => {
      const users = expectSuccess(await api.get('/api/mocks/users'))
      expect(users).to.have.lengthOf(MOCK_LIMITS.DEFAULT_QTY)
    })

    it('200 /users?role=COURIER y /couriers: solo repartidores con vehículo', async () => {
      for (const res of [
        await api.get('/api/mocks/users').query({ qty: 3, role: USER_ROLES.COURIER }),
        await api.get('/api/mocks/couriers').query({ qty: 3 })
      ]) {
        const couriers = expectSuccess(res)
        expect(couriers).to.have.lengthOf(3)
        couriers.forEach((c) => {
          expectValidMockUser(c)
          expect(c.role).to.equal(USER_ROLES.COURIER)
        })
      }
    })

    it('200 /orders: pedidos con total calculado, estado y prioridad válidos', async () => {
      const orders = expectSuccess(await api.get('/api/mocks/orders').query({ qty: 8 }))
      expect(orders).to.have.lengthOf(8)
      orders.forEach((o) => {
        expect(o.user).to.match(OBJECT_ID)
        expect(o.items).to.be.an('array').that.is.not.empty
        expect(o.total).to.equal(o.items.reduce((acc, i) => acc + i.unitPrice * i.quantity, 0))
        expect(Object.values(ORDER_STATUS)).to.include(o.status)
        expect(Object.values(ORDER_PRIORITY)).to.include(o.priority)
        expect(o.shippingAddress).to.include.keys('street', 'city', 'province', 'zipCode')
      })
    })

    it('200 /deliveries: entregas con repartidor solo cuando el estado lo requiere', async () => {
      const deliveries = expectSuccess(await api.get('/api/mocks/deliveries').query({ qty: 10 }))
      expect(deliveries).to.have.lengthOf(10)
      deliveries.forEach((d) => {
        expect(d.order).to.match(OBJECT_ID)
        expect(d.trackingCode).to.match(/^SN-/)
        if (d.status === DELIVERY_STATUS.UNASSIGNED) expect(d.courier).to.equal(null)
        else expect(d.courier).to.match(OBJECT_ID)
      })
    })

    it('200 /dataset: las relaciones entre ids son coherentes', async () => {
      const { users, couriers, orders, deliveries } = expectSuccess(await api.get('/api/mocks/dataset').query({ qty: 12 }))
      const customerIds = new Set(users.map((u) => u._id))
      const courierIds = new Set(couriers.map((c) => c._id))
      const orderById = new Map(orders.map((o) => [o._id, o]))

      expect(orders).to.have.lengthOf(12)
      users.forEach((u) => expect(u.role).to.equal(USER_ROLES.USER))
      couriers.forEach((c) => expect(c.role).to.equal(USER_ROLES.COURIER))
      orders.forEach((o) => expect(customerIds.has(o.user)).to.equal(true))
      deliveries.forEach((d) => {
        const order = orderById.get(d.order)
        expect(order).to.not.equal(undefined)
        expect([ORDER_STATUS.CONFIRMED, ORDER_STATUS.IN_TRANSIT, ORDER_STATUS.DELIVERED]).to.include(order.status)
        if (d.courier) expect(courierIds.has(d.courier)).to.equal(true)
      })
    })
  })

  describe('GET: cantidades y datos inválidos', () => {
    const cases = [
      { qty: '-5', code: 'MOCK_NEGATIVE_QUANTITY', label: 'negativa' },
      { qty: '0', code: 'MOCK_NEGATIVE_QUANTITY', label: 'cero' },
      { qty: 'abc', code: 'MOCK_INVALID_QUANTITY', label: 'texto' },
      { qty: '2.5', code: 'MOCK_INVALID_QUANTITY', label: 'decimal' },
      { qty: String(MOCK_LIMITS.MAX_QTY + 1), code: 'MOCK_QUANTITY_EXCEEDED', label: 'mayor al máximo' }
    ]
    for (const { qty, code, label } of cases) {
      it(`400 ${code}: cantidad ${label} (qty=${qty})`, async () => {
        const error = expectError(await api.get('/api/mocks/users').query({ qty }), 400, code)
        expect(error.details).to.include({ field: 'qty', value: qty, min: 1, max: MOCK_LIMITS.MAX_QTY })
      })
    }

    it('400 MOCK_INVALID_QUANTITY: qty repetido (?qty=1&qty=2)', async () => {
      expectError(await api.get('/api/mocks/orders?qty=1&qty=2'), 400, 'MOCK_INVALID_QUANTITY')
    })

    it('400 INVALID_ROLE: rol inexistente', async () => {
      expectError(await api.get('/api/mocks/users').query({ role: 'cliente' }), 400, 'INVALID_ROLE')
    })

    it('400 INVALID_QUERY_PARAM: parámetro no permitido', async () => {
      const error = expectError(await api.get('/api/mocks/couriers').query({ color: 'rojo' }), 400, 'INVALID_QUERY_PARAM')
      expect(error.details).to.deep.equal({ params: ['color'], allowed: ['qty'] })
    })
  })

  describe('POST /api/mocks/seed (inserta en MongoDB)', () => {
    it('201: sin entity carga usuarios y quedan guardados', async () => {
      const result = expectSuccess(await api.post('/api/mocks/seed').query({ qty: 5 }), 201)
      expect(result).to.deep.equal({ insertados: 5, coleccion: MOCK_ENTITIES.USERS })

      const users = expectSuccess(await api.get('/api/users'))
      expect(users).to.have.lengthOf(5)
      users.forEach((u) => expect(u.isMock).to.equal(true))
    })

    it('201: entity=all carga un set relacionado (por query o por body JSON)', async () => {
      const byQuery = expectSuccess(await api.post('/api/mocks/seed').query({ entity: MOCK_ENTITIES.ALL, qty: 6 }), 201)
      expect(byQuery).to.include({ coleccion: MOCK_ENTITIES.ALL })
      expect(byQuery.detalle).to.include({ orders: 6 })
      const { users, couriers, orders, deliveries } = byQuery.detalle
      expect(byQuery.insertados).to.equal(users + couriers + orders + deliveries)

      const byBody = expectSuccess(await api.post('/api/mocks/seed').send({ entity: MOCK_ENTITIES.ALL, qty: 3 }), 201)
      expect(byBody.detalle).to.include({ orders: 3 })

      expect(await countDocuments('orders')).to.equal(9)
    })

    it('201: entity=orders usa clientes existentes y crea sus entregas', async () => {
      await api.post('/api/mocks/seed').query({ entity: MOCK_ENTITIES.USERS, role: USER_ROLES.USER, qty: 2 })
      const result = expectSuccess(await api.post('/api/mocks/seed').query({ entity: MOCK_ENTITIES.ORDERS, qty: 4 }), 201)
      expect(result).to.include({ insertados: 4, coleccion: MOCK_ENTITIES.ORDERS })
      expect(result.relacionados).to.have.property('deliveries')

      const customerIds = expectSuccess(await api.get('/api/users').query({ role: USER_ROLES.USER })).map((u) => u._id)
      const orders = expectSuccess(await api.get('/api/orders'))
      orders.forEach((o) => expect(customerIds).to.include(o.user._id))
    })

    it('409 MOCK_MISSING_DEPENDENCIES: pedidos sin clientes en la base', async () => {
      expectError(await api.post('/api/mocks/seed').query({ entity: MOCK_ENTITIES.ORDERS }), 409, 'MOCK_MISSING_DEPENDENCIES')
    })

    it('400 MOCK_NEGATIVE_QUANTITY: cantidad negativa (query y body)', async () => {
      expectError(await api.post('/api/mocks/seed').query({ qty: -1 }), 400, 'MOCK_NEGATIVE_QUANTITY')
      expectError(await api.post('/api/mocks/seed').send({ entity: MOCK_ENTITIES.ALL, qty: -3 }), 400, 'MOCK_NEGATIVE_QUANTITY')
      expect(await countDocuments('users')).to.equal(0)
    })

    it('400 MOCK_INVALID_ENTITY: entidad inexistente', async () => {
      const error = expectError(await api.post('/api/mocks/seed').query({ entity: 'pizzas' }), 400, 'MOCK_INVALID_ENTITY')
      expect(error.details.allowed).to.have.members(Object.values(MOCK_ENTITIES))
    })

    it('400 INVALID_QUERY_PARAM: role con una entidad que no es users', async () => {
      expectError(await api.post('/api/mocks/seed').query({ entity: MOCK_ENTITIES.ORDERS, role: USER_ROLES.USER }), 400, 'INVALID_QUERY_PARAM')
    })

    it('500 MOCK_SEED_FAILED: una falla en la carga revierte el lote completo', async () => {
      const res = await api.post('/api/mocks/seed').query({ entity: MOCK_ENTITIES.ALL, qty: 5, simulateFailure: true })
      const error = expectError(res, 500, 'MOCK_SEED_FAILED')
      expect(error.details.rollback.done).to.equal(true)
      expect(error.details.rollback.eliminados.users).to.be.above(0)
      expect(await countDocuments('users')).to.equal(0)
      expect(await countDocuments('orders')).to.equal(0)
    })
  })

  describe('DELETE /api/mocks/seed', () => {
    it('200: borra solo lo generado por mocks y conserva los datos reales', async () => {
      await api.post('/api/mocks/seed').query({ entity: MOCK_ENTITIES.ALL, qty: 5 })
      const real = expectSuccess(await api.post('/api/users').send({
        firstName: 'Real', lastName: 'User', email: `real.${Date.now()}@test.com`, password: 'clave1234'
      }), 201)

      const { eliminados } = expectSuccess(await api.delete('/api/mocks/seed'))
      expect(eliminados).to.have.all.keys('deliveries', 'orders', 'users')
      expect(eliminados.orders).to.equal(5)

      const remaining = expectSuccess(await api.get('/api/users'))
      expect(remaining.map((u) => u._id)).to.deep.equal([real._id])
    })

    it('400 INVALID_QUERY_PARAM: no acepta parámetros', async () => {
      expectError(await api.delete('/api/mocks/seed').query({ x: 1 }), 400, 'INVALID_QUERY_PARAM')
    })
  })
})
