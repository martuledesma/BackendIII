import { readFile } from 'node:fs/promises'
import { expect } from 'chai'
import { api, expectSuccess } from './helpers/api.helper.js'
import { LOG_LEVELS, LOG_FILES, ENVIRONMENTS } from '../src/constants/index.js'

const ALL_LEVELS = Object.keys(LOG_LEVELS).reverse() // debug → fatal
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

describe('Logger — /api/loggerTest', () => {
  let payload

  before(async () => {
    payload = expectSuccess(await api.get('/api/loggerTest'))
  })

  it('200: emite los 6 niveles e informa el entorno de testing', () => {
    expect(payload).to.have.all.keys('mensaje', 'entorno', 'niveles', 'archivos')
    expect(payload.entorno).to.equal(ENVIRONMENTS.TEST)
    expect(payload.niveles.map((n) => n.nivel)).to.deep.equal(ALL_LEVELS)
    payload.niveles.forEach((n) => expect(n).to.have.all.keys('nivel', 'consola', 'archivoGeneral', 'archivoErrores'))
  })

  it('solo error y fatal van a logs/error.log', () => {
    const toErrorFile = payload.niveles.filter((n) => n.archivoErrores).map((n) => n.nivel)
    expect(toErrorFile).to.have.members(['error', 'fatal'])
    expect(payload.archivos.errores).to.equal(LOG_FILES.ERROR)
  })

  it('en test la consola solo muestra error y fatal, y el archivo general registra desde info', () => {
    expect(payload.niveles.filter((n) => n.consola).map((n) => n.nivel)).to.have.members(['error', 'fatal'])
    expect(payload.niveles.filter((n) => n.archivoGeneral).map((n) => n.nivel)).to.have.members(['info', 'warning', 'error', 'fatal'])
  })

  it('las líneas de error y fatal quedan escritas en logs/error.log, y las de info no', async () => {
    await wait(300) // los transports de archivo escriben de forma asíncrona
    const content = await readFile(LOG_FILES.ERROR, 'utf8')
    expect(content).to.match(/\[error\]\s+Prueba de logger: falló la creación del pedido/)
    expect(content).to.match(/\[fatal\]\s+Prueba de logger: falla crítica simulada/)
    expect(content).to.not.match(/\[info\]/)
  })
})
