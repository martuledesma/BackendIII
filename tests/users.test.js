import { expect } from 'chai'
import { api, expectSuccess, expectError } from './helpers/api.helper.js'
import { clearDatabase } from './helpers/db.helper.js'
import { buildUser, createCustomer, createCourier, NON_EXISTENT_ID, INVALID_ID } from './helpers/fixtures.js'
import { USER_ROLES, VEHICLE_TYPES } from '../src/constants/index.js'

describe('Users — /api/users', () => {
  let customer
  let courier

  // Datos controlados: un cliente y un repartidor creados por la API para este grupo.
  before(async () => {
    await clearDatabase()
    customer = await createCustomer({ firstName: 'Ana' })
    courier = await createCourier({ firstName: 'Luis' })
  })
  after(clearDatabase)

  describe('GET /api/users', () => {
    it('200: lista los usuarios con su estructura y sin contraseña', async () => {
      const users = expectSuccess(await api.get('/api/users'))

      expect(users).to.be.an('array')
      expect(users.length).to.be.at.least(2)
      users.forEach((user) => {
        expect(user).to.include.keys('_id', 'firstName', 'lastName', 'email', 'role', 'courierProfile', 'createdAt')
        expect(user).to.not.have.any.keys('password', 'isDeleted')
        expect(Object.values(USER_ROLES)).to.include(user.role)
      })
      expect(users.map((u) => u.email)).to.include.members([customer.email, courier.email])
    })

    it('200: filtra por rol y solo los COURIER tienen courierProfile', async () => {
      const couriers = expectSuccess(await api.get('/api/users').query({ role: USER_ROLES.COURIER }))
      expect(couriers.map((u) => u._id)).to.include(courier._id)
      couriers.forEach((u) => {
        expect(u.role).to.equal(USER_ROLES.COURIER)
        expect(Object.values(VEHICLE_TYPES)).to.include(u.courierProfile.vehicle)
      })

      const customers = expectSuccess(await api.get('/api/users').query({ role: USER_ROLES.USER }))
      expect(customers.map((u) => u._id)).to.include(customer._id)
      expect(customers.map((u) => u._id)).to.not.include(courier._id)
      customers.forEach((u) => expect(u.courierProfile).to.equal(null))
    })

    it('400 INVALID_ROLE: rol inexistente en el filtro', async () => {
      const error = expectError(await api.get('/api/users').query({ role: 'cliente' }), 400, 'INVALID_ROLE')
      expect(error.details).to.include({ value: 'cliente' })
      expect(error.details.allowed).to.have.members(Object.values(USER_ROLES))
    })

    it('400 INVALID_QUERY_PARAM: parámetro no permitido', async () => {
      const error = expectError(await api.get('/api/users').query({ color: 'rojo' }), 400, 'INVALID_QUERY_PARAM')
      expect(error.details.params).to.deep.equal(['color'])
    })
  })

  describe('GET /api/users/:uid', () => {
    it('200: devuelve el usuario pedido', async () => {
      const user = expectSuccess(await api.get(`/api/users/${customer._id}`))
      expect(user).to.include({ _id: customer._id, email: customer.email, role: USER_ROLES.USER })
      expect(user).to.not.have.property('password')
    })

    it('404 USER_NOT_FOUND: id válido que no existe', async () => {
      const error = expectError(await api.get(`/api/users/${NON_EXISTENT_ID}`), 404, 'USER_NOT_FOUND')
      expect(error.details).to.deep.equal({ id: NON_EXISTENT_ID })
    })

    it('400 INVALID_ID: id con formato inválido', async () => {
      expectError(await api.get(`/api/users/${INVALID_ID}`), 400, 'INVALID_ID')
    })
  })

  describe('POST /api/users', () => {
    it('201: crea un cliente con rol USER por defecto y sin exponer la contraseña', async () => {
      const input = buildUser()
      const user = expectSuccess(await api.post('/api/users').send(input), 201)
      expect(user).to.include({ firstName: input.firstName, email: input.email, role: USER_ROLES.USER, courierProfile: null })
      expect(user._id).to.match(/^[a-f\d]{24}$/)
      expect(user).to.not.have.property('password')
    })

    it('400 MISSING_FIELDS: datos incompletos', async () => {
      const error = expectError(await api.post('/api/users').send({ firstName: 'Ana' }), 400, 'MISSING_FIELDS')
      expect(error.details.fields).to.have.members(['lastName', 'email', 'password'])
    })

    it('400 INVALID_FIELD: contraseña demasiado corta', async () => {
      const error = expectError(await api.post('/api/users').send(buildUser({ password: '123' })), 400, 'INVALID_FIELD')
      expect(error.details.field).to.equal('password')
    })

    it('400 COURIER_PROFILE_REQUIRED: repartidor sin vehículo', async () => {
      expectError(await api.post('/api/users').send(buildUser({ role: USER_ROLES.COURIER })), 400, 'COURIER_PROFILE_REQUIRED')
    })

    it('409 EMAIL_ALREADY_REGISTERED: email repetido', async () => {
      const error = expectError(await api.post('/api/users').send(buildUser({ email: customer.email })), 409, 'EMAIL_ALREADY_REGISTERED')
      expect(error.details.email).to.equal(customer.email)
    })
  })

  describe('PUT y DELETE /api/users/:uid', () => {
    it('200: actualiza datos permitidos', async () => {
      const user = expectSuccess(await api.put(`/api/users/${customer._id}`).send({ phone: '+54 381 555-0000' }))
      expect(user).to.include({ _id: customer._id, phone: '+54 381 555-0000' })
    })

    it('400 NO_UPDATABLE_FIELDS: ningún campo modificable', async () => {
      expectError(await api.put(`/api/users/${customer._id}`).send({ email: 'otro@test.com' }), 400, 'NO_UPDATABLE_FIELDS')
    })

    it('204 y luego 404: borrado lógico', async () => {
      const temp = await createCustomer()
      const res = await api.delete(`/api/users/${temp._id}`)
      expect(res.status).to.equal(204)
      expect(res.body).to.deep.equal({})
      expectError(await api.get(`/api/users/${temp._id}`), 404, 'USER_NOT_FOUND')
    })
  })
})
