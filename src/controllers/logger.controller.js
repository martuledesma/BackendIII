import { loggerService } from '../services/logger.service.js'
import { asyncHandler } from '../utils/async-handler.js'
import { sendSuccess } from '../utils/response.js'

export const testLogger = asyncHandler(async (req, res) => {
  sendSuccess(res, loggerService.emitTestLogs())
})
