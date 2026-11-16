import { HTTP_STATUS } from '../constants/index.js'

// Error con código HTTP. Lo lanzan los services y lo traduce el middleware de errores.
export class HttpError extends Error {
  constructor (statusCode, message) {
    super(message)
    this.name = 'HttpError'
    this.statusCode = statusCode
  }

  static badRequest (message) { return new HttpError(HTTP_STATUS.BAD_REQUEST, message) }
  static notFound (message) { return new HttpError(HTTP_STATUS.NOT_FOUND, message) }
  static conflict (message) { return new HttpError(HTTP_STATUS.CONFLICT, message) }
}
