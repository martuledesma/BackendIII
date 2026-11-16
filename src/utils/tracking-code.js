// Genera códigos de seguimiento para las entregas reales (SN-XXXXXXXXXX), sin depender de faker.
import { randomInt } from 'node:crypto'
import { DELIVERY_DEFAULTS } from '../constants/index.js'

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

export const generateTrackingCode = () =>
  DELIVERY_DEFAULTS.TRACKING_PREFIX +
  Array.from({ length: DELIVERY_DEFAULTS.TRACKING_LENGTH }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')
