// Metadatos de un archivo subido. El archivo en sí queda en el disco del servidor;
// en MongoDB solo se guarda esta referencia, dentro de la entidad a la que pertenece.
import mongoose from 'mongoose'

export const fileMetadataSchema = new mongoose.Schema(
  {
    originalName: { type: String, required: true }, // nombre con el que lo subió el usuario
    fileName: { type: String, required: true }, // nombre generado por el servidor
    path: { type: String, required: true }, // ruta relativa en el servidor
    mimeType: { type: String, required: true },
    size: { type: Number, required: true }, // bytes
    documentType: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now }
  },
  { versionKey: false }
)
