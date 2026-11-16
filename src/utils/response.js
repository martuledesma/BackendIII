// Formato único para respuestas exitosas. Las de error las construye solo el middleware global.
import { HTTP_STATUS, RESPONSE_STATUS } from '../constants/index.js'

export const sendSuccess = (res, payload, statusCode = HTTP_STATUS.OK) =>
  res.status(statusCode).json({ status: RESPONSE_STATUS.SUCCESS, payload })

export const sendNoContent = (res) => res.status(HTTP_STATUS.NO_CONTENT).end()
