// Única puerta de entrada HTTP para usuarios: lee req, llama al service y responde.
// No arma respuestas de error ni importa Mongoose: cualquier error llega al middleware global vía asyncHandler.
import { usersService } from '../services/users.service.js'
import { HTTP_STATUS } from '../constants/index.js'
import { asyncHandler } from '../utils/async-handler.js'
import { sendSuccess, sendNoContent } from '../utils/response.js'

export const getUsers = asyncHandler(async (req, res) => {
  sendSuccess(res, await usersService.getUsers(req.query))
})

export const getUserById = asyncHandler(async (req, res) => {
  sendSuccess(res, await usersService.getUserById(req.params.uid))
})

export const createUser = asyncHandler(async (req, res) => {
  sendSuccess(res, await usersService.createUser(req.body), HTTP_STATUS.CREATED)
})

export const updateUser = asyncHandler(async (req, res) => {
  sendSuccess(res, await usersService.updateUser(req.params.uid, req.body))
})

export const deleteUser = asyncHandler(async (req, res) => {
  await usersService.deleteUser(req.params.uid)
  sendNoContent(res)
})
