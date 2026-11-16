// Datos de prueba controlados y descartables. Se crean a través de la API dentro de cada test,
// nunca se dependen de datos cargados a mano. Los emails son únicos en cada corrida.
import { expect } from 'chai'
import { api } from './api.helper.js'
import { USER_ROLES, VEHICLE_TYPES, ORDER_PRIORITY } from '../../src/constants/index.js'

// Id con formato válido que no existe en la base de testing (la base arranca vacía).
export const NON_EXISTENT_ID = '6739f1c2a8b4e5d6f7a8b9c0'
export const INVALID_ID = '123'

let sequence = 0
export const uniqueEmail = (prefix = 'test') => `${prefix}.${Date.now()}.${++sequence}@test.com`

export const buildUser = (overrides = {}) => ({
  firstName: 'Test',
  lastName: 'Cliente',
  email: uniqueEmail(),
  password: 'clave1234',
  ...overrides
})

export const createUser = async (overrides = {}) => {
  const res = await api.post('/api/users').send(buildUser(overrides))
  expect(res.status, JSON.stringify(res.body)).to.equal(201)
  return res.body.payload
}

export const createCustomer = (overrides = {}) => createUser({ role: USER_ROLES.USER, ...overrides })

export const createCourier = (overrides = {}) => createUser({
  firstName: 'Test',
  lastName: 'Repartidor',
  role: USER_ROLES.COURIER,
  courierProfile: { vehicle: VEHICLE_TYPES.MOTORCYCLE, licensePlate: 'AB123CD' },
  ...overrides
})

// Total esperado de ORDER_ITEMS: 1500 × 2 + 500 × 3 = 4500
export const ORDER_ITEMS = Object.freeze([
  { title: 'Caja chica', unitPrice: 1500, quantity: 2 },
  { title: 'Cinta de embalar', unitPrice: 500, quantity: 3 }
])
export const ORDER_TOTAL = 4500

export const SHIPPING_ADDRESS = Object.freeze({
  street: 'San Martín 100',
  city: 'San Miguel de Tucumán',
  province: 'Tucumán',
  zipCode: '4000'
})

export const buildOrder = (userId, overrides = {}) => ({
  user: userId,
  items: ORDER_ITEMS.map((item) => ({ ...item })),
  shippingAddress: { ...SHIPPING_ADDRESS },
  priority: ORDER_PRIORITY.HIGH,
  ...overrides
})

export const createOrder = async (userId, overrides = {}) => {
  const res = await api.post('/api/orders').send(buildOrder(userId, overrides))
  expect(res.status, JSON.stringify(res.body)).to.equal(201)
  return res.body.payload
}

export const buildProduct = (overrides = {}) => ({
  title: 'Caja de prueba',
  code: `TEST-${Date.now()}-${++sequence}`,
  price: 1500,
  stock: 10,
  category: 'embalaje',
  ...overrides
})
