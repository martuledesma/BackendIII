// El modelo solo define la estructura del documento. Sin lógica de negocio.
import mongoose from 'mongoose'
import { DELIVERY_STATUS } from '../constants/index.js'
import { fileMetadataSchema } from './file-metadata.schema.js'

const deliverySchema = new mongoose.Schema(
  {
    // Cada pedido tiene como máximo una entrega.
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
    // Repartidor asignado (usuario con rol COURIER). Null mientras no se asigne.
    courier: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    status: {
      type: String,
      enum: Object.values(DELIVERY_STATUS),
      default: DELIVERY_STATUS.UNASSIGNED
    },
    trackingCode: { type: String, required: true, unique: true },
    estimatedDeliveryDate: { type: Date, required: true },
    deliveredAt: { type: Date, default: null },
    // Comprobantes de la entrega (remito, foto, firma): solo metadatos, el archivo está en uploads/.
    proofs: { type: [fileMetadataSchema], default: [] },
    isMock: { type: Boolean, default: false }
  },
  { timestamps: true, versionKey: false }
)

const DeliveryModel = mongoose.model('Delivery', deliverySchema)

export default DeliveryModel
