// Express 4 no captura los errores de funciones async por sí solo.
// asyncHandler envuelve cada controller y deriva cualquier error al middleware global con next(error),
// así los controllers no necesitan try/catch ni arman respuestas de error.
export const asyncHandler = (controller) => (req, res, next) => {
  Promise.resolve(controller(req, res, next)).catch(next)
}
