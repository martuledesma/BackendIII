// Cliente HTTP de los tests. Supertest recibe la app de Express (src/app.js) sin levantar
// el servidor: cada petición usa un puerto efímero que Supertest abre y cierra solo.
import request from 'supertest'
import { expect } from 'chai'
import app from '../../src/app.js'
import { RESPONSE_STATUS } from '../../src/constants/index.js'

export const api = request(app)

const ERROR_KEYS = ['code', 'message', 'statusCode', 'details', 'path', 'method', 'timestamp']

// Valida el formato de éxito { status: "success", payload } y devuelve el payload.
export const expectSuccess = (res, statusCode = 200) => {
  expect(res.status, `Respuesta inesperada: ${JSON.stringify(res.body)}`).to.equal(statusCode)
  expect(res.headers['content-type']).to.match(/application\/json/)
  expect(res.body).to.have.property('status', RESPONSE_STATUS.SUCCESS)
  expect(res.body).to.have.property('payload')
  return res.body.payload
}

// Valida el formato de error del middleware global y el código del diccionario. Devuelve res.body.error.
export const expectError = (res, statusCode, code) => {
  expect(res.status, `Respuesta inesperada: ${JSON.stringify(res.body)}`).to.equal(statusCode)
  expect(res.headers['content-type']).to.match(/application\/json/)
  expect(res.body).to.have.property('status', RESPONSE_STATUS.ERROR)

  const { error } = res.body
  expect(error).to.have.all.keys(...ERROR_KEYS)
  expect(error.code).to.equal(code)
  expect(error.statusCode).to.equal(statusCode)
  expect(error.message).to.be.a('string').and.not.equal('')
  expect(error.method).to.equal(res.req.method)
  expect(error.path).to.equal(res.req.path)
  expect(Number.isNaN(Date.parse(error.timestamp))).to.equal(false)
  return error
}
