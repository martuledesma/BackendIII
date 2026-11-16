// Generadores de datos falsos con @faker-js/faker.
// Solo producen campos "crudos" con la forma de los modelos; las reglas de negocio
// (qué rol, qué estado, si hay repartidor, el total del pedido) las decide mocks.service.js.
import { fakerES as faker } from '@faker-js/faker'
import { VEHICLE_TYPES, MOCK_DEFAULTS } from '../constants/index.js'

// "José Núñez" → "jose.nunez"
const slug = (text) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')

export const generateObjectId = () => faker.database.mongodbObjectId()

export const generatePerson = () => {
  const firstName = faker.person.firstName()
  const lastName = faker.person.lastName()
  // El sufijo aleatorio evita emails repetidos (el campo es único en la base).
  const suffix = faker.string.alphanumeric({ length: 4, casing: 'lower' })
  return {
    _id: generateObjectId(),
    firstName,
    lastName,
    email: `${slug(firstName)}.${slug(lastName)}.${suffix}@${MOCK_DEFAULTS.EMAIL_DOMAIN}`,
    phone: faker.phone.number()
  }
}

export const generateCourierProfile = () => {
  const vehicle = faker.helpers.arrayElement(Object.values(VEHICLE_TYPES))
  const needsPlate = vehicle !== VEHICLE_TYPES.BIKE
  return {
    vehicle,
    // Patente con formato argentino nuevo: AB123CD
    licensePlate: needsPlate
      ? `${faker.string.alpha({ length: 2, casing: 'upper' })}${faker.string.numeric(3)}${faker.string.alpha({ length: 2, casing: 'upper' })}`
      : null,
    isAvailable: faker.datatype.boolean()
  }
}

export const generateOrderItems = () =>
  Array.from({ length: faker.number.int({ min: 1, max: 4 }) }, () => ({
    title: faker.commerce.productName(),
    unitPrice: faker.number.int({ min: 500, max: 50000 }),
    quantity: faker.number.int({ min: 1, max: 5 })
  }))

export const generateAddress = () => ({
  street: faker.location.streetAddress(),
  city: faker.location.city(),
  province: faker.location.state(),
  zipCode: faker.location.zipCode()
})

export const generateTrackingCode = () =>
  `SN-${faker.string.alphanumeric({ length: 10, casing: 'upper' })}`

export const generateFutureDate = (maxDays = 5) => faker.date.soon({ days: maxDays })

export const generateRecentDate = (maxDays = 3) => faker.date.recent({ days: maxDays })

export const pickOne = (values) => faker.helpers.arrayElement(values)

// weights: [{ value, weight }]
export const pickWeighted = (weights) => faker.helpers.weightedArrayElement(weights)
