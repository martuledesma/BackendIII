import { expect } from 'chai'
import { api, expectError } from './helpers/api.helper.js'

describe('Errores generales (middleware global)', () => {
  it('404 ROUTE_NOT_FOUND: ruta inexistente (GET y POST)', async () => {
    const error = expectError(await api.get('/api/no-existe'), 404, 'ROUTE_NOT_FOUND')
    expect(error.details).to.deep.equal({ method: 'GET', path: '/api/no-existe' })

    expectError(await api.post('/api/pedidos'), 404, 'ROUTE_NOT_FOUND')
  })

  it('400 INVALID_JSON: body con JSON mal formado', async () => {
    const res = await api.post('/api/users').set('Content-Type', 'application/json').send('{"firstName":')
    expectError(res, 400, 'INVALID_JSON')
  })

  it('todas las respuestas de error tienen exactamente la misma estructura', async () => {
    const responses = await Promise.all([
      api.get('/api/no-existe'),
      api.get('/api/users/123'),
      api.get('/api/orders').query({ status: 'PERDIDO' }),
      api.get('/api/mocks/users').query({ qty: 'abc' })
    ])
    const shapes = responses.map((res) => Object.keys(res.body.error).sort().join(','))
    expect(new Set(shapes).size).to.equal(1)
  })
})
