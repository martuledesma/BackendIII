// El modelo solo define la estructura del documento. Sin lógica de negocio.
import mongoose from 'mongoose'
import { ORDER_STATUS, ORDER_PRIORITY } from '../constants/index.js'

const orderItemSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    unitPrice: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 }
  },
  { _id: false }
)

const addressSchema = new mongoose.Schema(
  {
    street: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    province: { type: String, required: true, trim: true },
    zipCode: { type: String, required: true, trim: true }
  },
  { _id: false }
)

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: {
      type: [orderItemSchema],
      validate: (items) => items.length > 0
    },
    total: { type: Number, required: true, min: 0 },
    shippingAddress: { type: addressSchema, required: true },
    status: {
      type: String,
      enum: Object.values(ORDER_STATUS),
      default: ORDER_STATUS.PENDING
    },
    priority: {
      type: String,
      enum: Object.values(ORDER_PRIORITY),
      default: ORDER_PRIORITY.NORMAL
    },
    isMock: { type: Boolean, default: false }
  },
  { timestamps: true, versionKey: false }
)

const OrderModel = mongoose.model('Order', orderSchema)

export default OrderModel
