// El modelo solo define la estructura del documento. Sin lógica de negocio.
import mongoose from 'mongoose'
import { USER_ROLES, VEHICLE_TYPES } from '../constants/index.js'
import { fileMetadataSchema } from './file-metadata.schema.js'

// Datos propios del repartidor. Solo se completa cuando role === COURIER
// (esa regla la controla la capa de servicios).
const courierProfileSchema = new mongoose.Schema(
  {
    vehicle: { type: String, enum: Object.values(VEHICLE_TYPES), required: true },
    licensePlate: { type: String, default: null, trim: true },
    isAvailable: { type: Boolean, default: true }
  },
  { _id: false }
)

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    phone: { type: String, default: null, trim: true },
    role: {
      type: String,
      enum: Object.values(USER_ROLES),
      default: USER_ROLES.USER
    },
    courierProfile: { type: courierProfileSchema, default: null },
    // Documentos subidos (DNI, licencia...): solo metadatos, el archivo está en uploads/.
    documents: { type: [fileMetadataSchema], default: [] },
    isMock: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false }
  },
  { timestamps: true, versionKey: false }
)

const UserModel = mongoose.model('User', userSchema)

export default UserModel
