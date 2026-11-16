// Única puerta de entrada HTTP para usuarios: lee req, llama al service y arma la respuesta.
// No importa Mongoose ni repositorios.
import { usersService } from '../services/users.service.js'
import { HTTP_STATUS, RESPONSE_STATUS } from '../constants/index.js'

const ok = (res, payload, status = HTTP_STATUS.OK) =>
  res.status(status).json({ status: RESPONSE_STATUS.SUCCESS, payload })

export const getUsers = async (req, res, next) => {
  try {
    ok(res, await usersService.getUsers({ role: req.query.role }))
  } catch (error) {
    next(error)
  }
}

export const getUserById = async (req, res, next) => {
  try {
    ok(res, await usersService.getUserById(req.params.uid))
  } catch (error) {
    next(error)
  }
}

export const createUser = async (req, res, next) => {
  try {
    ok(res, await usersService.createUser(req.body), HTTP_STATUS.CREATED)
  } catch (error) {
    next(error)
  }
}

export const updateUser = async (req, res, next) => {
  try {
    ok(res, await usersService.updateUser(req.params.uid, req.body))
  } catch (error) {
    next(error)
  }
}

export const deleteUser = async (req, res, next) => {
  try {
    await usersService.deleteUser(req.params.uid)
    res.status(HTTP_STATUS.NO_CONTENT).end()
  } catch (error) {
    next(error)
  }
}
