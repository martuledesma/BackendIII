// Acceso al sistema de archivos del servidor. Es el "repository" de los archivos:
// los services no usan fs directamente, igual que no usan Mongoose.
import { mkdir, rename, rm, open, stat } from 'node:fs/promises'
import path from 'node:path'

export const fileStorageRepository = {
  // Mueve un archivo a su carpeta definitiva y devuelve la nueva ruta (relativa al proyecto).
  move: async (fromPath, toDir, fileName) => {
    await mkdir(toDir, { recursive: true })
    const destination = path.join(toDir, fileName)
    await rename(fromPath, destination)
    return destination
  },

  // Borra un archivo; no falla si ya no existe.
  remove: (filePath) => rm(filePath, { force: true }),

  // Lee los primeros bytes para validar la firma (magic bytes) del archivo.
  readSignature: async (filePath, length) => {
    const handle = await open(filePath, 'r')
    try {
      const buffer = Buffer.alloc(length)
      const { bytesRead } = await handle.read(buffer, 0, length, 0)
      return buffer.subarray(0, bytesRead)
    } finally {
      await handle.close()
    }
  },

  exists: async (filePath) => {
    try {
      return (await stat(filePath)).isFile()
    } catch {
      return false
    }
  },

  toAbsolute: (filePath) => path.resolve(filePath)
}
