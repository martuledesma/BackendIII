import { expect } from 'chai'
import { api, expectSuccess, expectError } from './helpers/api.helper.js'
import { clearDatabase } from './helpers/db.helper.js'
import {
  buildOrder, createOrder, createCustomer, createCourier,
  ORDER_TOTAL, ORDER_ITEMS, SHIPPING_ADDRESS, NON_EXISTENT_ID, INVALID_ID
} from './helpers/fixtures.js'
import { ORDER_STATUS, ORDER_PRIORITY, DELIVERY_STATUS, USER_ROLES } from '../src/constants/index.js'
import { deliveriesRepository } from '../src/repositories/deliveries.repository.js'

const findDeliveryOf = async (orderId) => {
  const deliveries = expectSuccess(await api.get('/api/deliveries'))
  return deliveries.find((d) => d.order._id === orderId)
}

describe('Orders — /api/orders', () => {
  let customer

  before(async () => {
    await clearDatabase()
    customer = await createCustomer({ firstName: 'Ana' })
  })
  after(clearDatabase)

  describe('POST /api/orders', () => {
    it('201: crea un pedido PENDING con el total calculado y el cliente populado', async () => {
      const order = expectSuccess(await api.post('/api/orders').send(buildOrder(customer._id)), 201)

      expect(order).to.include.keys('_id', 'user', 'items', 'total', 'shippingAddress', 'status', 'priority', 'createdAt')
      expect(order.status).to.equal(ORDER_STATUS.PENDING)
      expect(order.priority).to.equal(ORDER_PRIORITY.HIGH)
      expect(order.total).to.equal(ORDER_TOTAL)
      expect(order.items).to.deep.equal(ORDER_ITEMS)
      expect(order.shippingAddress).to.deep.equal(SHIPPING_ADDRESS)
      expect(order.user).to.include({ _id: customer._id, email: customer.email, role: USER_ROLES.USER })
    })

    it('201: usa prioridad NORMAL por defecto e ignora un total enviado por el cliente', async () => {
      const order = expectSuccess(await api.post('/api/orders').send(buildOrder(customer._id, { priority: undefined, total: 1 })), 201)
      expect(order.priority).to.equal(ORDER_PRIORITY.NORMAL)
      expect(order.total).to.equal(ORDER_TOTAL)
    })

    it('400 MISSING_FIELDS: datos incompletos', async () => {
      const error = expectError(await api.post('/api/orders').send({ user: customer._id }), 400, 'MISSING_FIELDS')
      expect(error.details.fields).to.have.members(['items', 'shippingAddress'])
    })

    it('400 MISSING_FIELDS: dirección incompleta', async () => {
      const res = await api.post('/api/orders').send(buildOrder(customer._id, { shippingAddress: { street: 'X' } }))
      const error = expectError(res, 400, 'MISSING_FIELDS')
      expect(error.details.fields).to.include('shippingAddress.city')
    })

    it('400 INVALID_FIELD: ítem con cantidad inválida', async () => {
      const res = await api.post('/api/orders').send(buildOrder(customer._id, { items: [{ title: 'Caja', unitPrice: 100, quantity: 0 }] }))
      const error = expectError(res, 400, 'INVALID_FIELD')
      expect(error.details.field).to.equal('items[0].quantity')
    })

    it('400 INVALID_PRIORITY: prioridad inexistente', async () => {
      expectError(await api.post('/api/orders').send(buildOrder(customer._id, { priority: 'YA' })), 400, 'INVALID_PRIORITY')
    })

    it('404 USER_NOT_FOUND: el cliente no existe', async () => {
      expectError(await api.post('/api/orders').send(buildOrder(NON_EXISTENT_ID)), 404, 'USER_NOT_FOUND')
    })

    it('400 INVALID_FIELD: el usuario no es un cliente (rol COURIER)', async () => {
      const courier = await createCourier()
      const error = expectError(await api.post('/api/orders').send(buildOrder(courier._id)), 400, 'INVALID_FIELD')
      expect(error.details.field).to.equal('user')
    })

    it('400 INVALID_JSON: body mal formado', async () => {
      const res = await api.post('/api/orders').set('Content-Type', 'application/json').send('{"user":')
      expectError(res, 400, 'INVALID_JSON')
    })
  })

  describe('GET /api/orders', () => {
    let order

    before(async () => {
      order = await createOrder(customer._id, { priority: ORDER_PRIORITY.URGENT })
    })

    it('200: lista los pedidos con su estructura', async () => {
      const orders = expectSuccess(await api.get('/api/orders'))
      expect(orders).to.be.an('array').that.is.not.empty
      orders.forEach((o) => {
        expect(o).to.include.keys('_id', 'user', 'items', 'total', 'status', 'priority')
        expect(Object.values(ORDER_STATUS)).to.include(o.status)
      })
      expect(orders.map((o) => o._id)).to.include(order._id)
    })

    it('200: filtra por estado y prioridad', async () => {
      const urgent = expectSuccess(await api.get('/api/orders').query({ status: ORDER_STATUS.PENDING, priority: ORDER_PRIORITY.URGENT }))
      expect(urgent.map((o) => o._id)).to.deep.equal([order._id])

      const delivered = expectSuccess(await api.get('/api/orders').query({ status: ORDER_STATUS.DELIVERED }))
      expect(delivered).to.deep.equal([])
    })

    it('400 INVALID_STATUS: estado inválido en el filtro', async () => {
      const error = expectError(await api.get('/api/orders').query({ status: 'PERDIDO' }), 400, 'INVALID_STATUS')
      expect(error.details.allowed).to.have.members(Object.values(ORDER_STATUS))
    })

    it('400 INVALID_PRIORITY: prioridad inválida en el filtro', async () => {
      expectError(await api.get('/api/orders').query({ priority: 'YA' }), 400, 'INVALID_PRIORITY')
    })
  })

  describe('GET /api/orders/:oid', () => {
    it('200: devuelve el pedido consultado por id', async () => {
      const created = await createOrder(customer._id)
      const order = expectSuccess(await api.get(`/api/orders/${created._id}`))
      expect(order).to.deep.include({ _id: created._id, total: ORDER_TOTAL, status: ORDER_STATUS.PENDING })
      expect(order.user._id).to.equal(customer._id)
    })

    it('404 ORDER_NOT_FOUND: pedido inexistente', async () => {
      const error = expectError(await api.get(`/api/orders/${NON_EXISTENT_ID}`), 404, 'ORDER_NOT_FOUND')
      expect(error.details).to.deep.equal({ id: NON_EXISTENT_ID })
    })

    it('400 INVALID_ID: id con formato inválido', async () => {
      expectError(await api.get(`/api/orders/${INVALID_ID}`), 400, 'INVALID_ID')
    })
  })

  describe('PATCH /api/orders/:oid/status', () => {
    let order

    // Cada test arranca con un pedido nuevo en PENDING: no dependen del orden de ejecución.
    beforeEach(async () => {
      order = await createOrder(customer._id)
    })

    it('200: PENDING → CONFIRMED crea la entrega UNASSIGNED', async () => {
      const updated = expectSuccess(await api.patch(`/api/orders/${order._id}/status`).send({ status: ORDER_STATUS.CONFIRMED }))
      expect(updated).to.include({ _id: order._id, status: ORDER_STATUS.CONFIRMED })

      const delivery = await findDeliveryOf(order._id)
      expect(delivery).to.include({ status: DELIVERY_STATUS.UNASSIGNED, courier: null })
      expect(delivery.trackingCode).to.match(/^SN-[A-Z0-9]{10}$/)
    })

    it('200: flujo completo CONFIRMED → IN_TRANSIT → DELIVERED con repartidor asignado', async () => {
      const courier = await createCourier()
      await api.patch(`/api/orders/${order._id}/status`).send({ status: ORDER_STATUS.CONFIRMED })

      // Preparación: se asigna el repartidor a la entrega (todavía no hay endpoint para eso).
      const delivery = await findDeliveryOf(order._id)
      await deliveriesRepository.update(delivery._id, { courier: courier._id, status: DELIVERY_STATUS.ASSIGNED })

      const inTransit = expectSuccess(await api.patch(`/api/orders/${order._id}/status`).send({ status: ORDER_STATUS.IN_TRANSIT }))
      expect(inTransit.status).to.equal(ORDER_STATUS.IN_TRANSIT)
      expect((await findDeliveryOf(order._id)).status).to.equal(DELIVERY_STATUS.IN_TRANSIT)

      const delivered = expectSuccess(await api.patch(`/api/orders/${order._id}/status`).send({ status: ORDER_STATUS.DELIVERED }))
      expect(delivered.status).to.equal(ORDER_STATUS.DELIVERED)
      const finalDelivery = await findDeliveryOf(order._id)
      expect(finalDelivery.status).to.equal(DELIVERY_STATUS.DELIVERED)
      expect(finalDelivery.deliveredAt).to.be.a('string')
      expect(finalDelivery.courier._id).to.equal(courier._id)
    })

    it('200: cancelar un pedido confirmado deja su entrega en FAILED', async () => {
      await api.patch(`/api/orders/${order._id}/status`).send({ status: ORDER_STATUS.CONFIRMED })
      const cancelled = expectSuccess(await api.patch(`/api/orders/${order._id}/status`).send({ status: ORDER_STATUS.CANCELLED }))
      expect(cancelled.status).to.equal(ORDER_STATUS.CANCELLED)
      expect((await findDeliveryOf(order._id)).status).to.equal(DELIVERY_STATUS.FAILED)
    })

    it('400 INVALID_STATUS: estado inexistente', async () => {
      const error = expectError(await api.patch(`/api/orders/${order._id}/status`).send({ status: 'PERDIDO' }), 400, 'INVALID_STATUS')
      expect(error.details).to.include({ value: 'PERDIDO' })
    })

    it('400 MISSING_FIELDS: falta status', async () => {
      expectError(await api.patch(`/api/orders/${order._id}/status`).send({}), 400, 'MISSING_FIELDS')
    })

    it('409 INVALID_STATUS_TRANSITION: PENDING → DELIVERED no está permitido', async () => {
      const error = expectError(await api.patch(`/api/orders/${order._id}/status`).send({ status: ORDER_STATUS.DELIVERED }), 409, 'INVALID_STATUS_TRANSITION')
      expect(error.details).to.deep.include({ from: ORDER_STATUS.PENDING, to: ORDER_STATUS.DELIVERED })
      expect(error.details.allowed).to.have.members([ORDER_STATUS.CONFIRMED, ORDER_STATUS.CANCELLED])
    })

    it('409 COURIER_NOT_ASSIGNED: no sale a reparto sin repartidor', async () => {
      await api.patch(`/api/orders/${order._id}/status`).send({ status: ORDER_STATUS.CONFIRMED })
      expectError(await api.patch(`/api/orders/${order._id}/status`).send({ status: ORDER_STATUS.IN_TRANSIT }), 409, 'COURIER_NOT_ASSIGNED')
    })

    it('404 ORDER_NOT_FOUND: pedido inexistente', async () => {
      expectError(await api.patch(`/api/orders/${NON_EXISTENT_ID}/status`).send({ status: ORDER_STATUS.CONFIRMED }), 404, 'ORDER_NOT_FOUND')
    })
  })
})
