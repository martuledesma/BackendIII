# ShipNow API — Pre-entrega Módulo 1

API REST de ShipNow refactorizada a una **arquitectura por capas** (Router → Controller → Service → Repository → Model), con **configuración de entorno validada al arranque** y **constantes de dominio centralizadas**.

## Requisitos

- Node.js 18 o superior
- MongoDB (local o Atlas)

## Cómo correr el proyecto localmente

```bash
# 1. Clonar el repositorio
git clone <url-del-repo>
cd shipnow-api

# 2. Instalar dependencias
npm install

# 3. Crear el archivo de entorno a partir del ejemplo
cp .env.example .env
#    y completar los valores, por ejemplo:
#    PORT=8080
#    MONGODB_URI=mongodb://localhost:27017/shipnow
#    NODE_ENV=development

# 4. Levantar la app
npm run dev     # con recarga automática (node --watch)
# o
npm start
```

Para comprobar que funciona: `GET http://localhost:8080/health` → `{ "status": "ok" }`.

### Validación del entorno

`src/config/env.config.js` es el **único** archivo que lee `process.env`. Al arrancar valida que existan `PORT`, `MONGODB_URI` y `NODE_ENV`, y además que tengan un formato correcto. Si algo falla, la app no arranca y muestra un error descriptivo. Por ejemplo, si se borra `MONGODB_URI`:

```
Error: [config] Faltan variables de entorno obligatorias: MONGODB_URI. Revisá tu archivo .env (podés usar .env.example como guía).
```

`.env` está en `.gitignore`. En el repositorio solo se sube `.env.example`, con las claves y sin valores.

## Estructura

```
src/
├── config/
│   ├── env.config.js        # dotenv + validación (único acceso a process.env)
│   ├── db.config.js         # conexión a MongoDB
│   └── index.js             # punto de entrada de la configuración
├── constants/
│   └── index.js             # USER_ROLES, PRODUCT_STATUS, HTTP_STATUS... (Object.freeze)
├── controllers/             # HTTP: req → service → res
├── services/                # reglas de negocio
├── repositories/            # único lugar que conoce Mongoose
├── models/                  # esquemas de Mongoose (solo estructura)
├── routes/                  # path → método del controller
├── middlewares/             # manejo centralizado de errores y 404
├── utils/                   # HttpError, hash de contraseñas, alias de constantes
├── app.js                   # configuración de Express
└── server.js                # arranque (config → DB → listen)
```

## Endpoints

### Productos — `/api/products`

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/products` | Lista productos **con stock**. `?includeOutOfStock=true` incluye los agotados; `?category=` filtra por categoría. |
| GET | `/api/products/:pid` | Obtiene un producto |
| POST | `/api/products` | Crea un producto (`title`, `code`, `price`, `category` obligatorios; `stock`, `description` opcionales) |
| PUT | `/api/products/:pid` | Actualiza `title`, `description`, `price`, `stock` o `category` |
| DELETE | `/api/products/:pid` | Borrado lógico |

### Usuarios — `/api/users`

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/users` | Lista usuarios. `?role=ADMIN` o `?role=USER` filtra por rol. |
| GET | `/api/users/:uid` | Obtiene un usuario |
| POST | `/api/users` | Crea un usuario (`firstName`, `lastName`, `email`, `password` obligatorios; `role` opcional, por defecto `USER`) |
| PUT | `/api/users/:uid` | Actualiza `firstName`, `lastName` o `role` |
| DELETE | `/api/users/:uid` | Borrado lógico |

Formato de respuesta: `{ "status": "success", "payload": ... }` o `{ "status": "error", "error": "mensaje" }`.

## Por qué separé la lógica así entre Service y Repository

El criterio fue: **el Repository sabe *cómo* se guardan y se buscan los datos; el Service sabe *qué* se puede hacer con ellos.**

**El Repository** encapsula todo lo que depende de Mongoose y de la forma en que están guardados los documentos:

- Aplica siempre un **filtro por defecto** (`isDeleted: false`), así ningún service tiene que acordarse de excluir los registros borrados lógicamente.
- Aplica una **proyección pública**: en usuarios nunca devuelve `password` (salvo `getByEmailWithPassword`, pensado para el login). Así la contraseña no puede filtrarse por error desde otra capa.
- Devuelve objetos planos (`.lean()`), ordena los resultados y transforma un id con formato inválido en `null` en lugar de un `CastError` de Mongoose.

Con esto, el Repository no es un simple "pasamanos" de `model.find()`. Si mañana cambia la base o el esquema, solo se toca esta capa.

**El Service** contiene las decisiones de negocio, que no deberían depender de la base de datos:

- **Estado del producto**: se calcula a partir del stock (`stock > 0` → `AVAILABLE`, si no `OUT_OF_STOCK`). El cliente no puede mandar el estado.
- **Listado por defecto**: el catálogo muestra solo productos disponibles. Esa es una regla de negocio, por eso vive en el Service y no en el Repository.
- **Validaciones**: campos obligatorios, precio y stock no negativos, código de producto y email únicos, rol válido según `USER_ROLES`.
- **Whitelist de campos editables**: en un `PUT` no se pueden pisar `code`, `status`, `email` ni `isDeleted`.
- **Seguridad**: hashea la contraseña antes de guardarla e impide quitar o eliminar al último `ADMIN`.

El Service no recibe `req` ni `res`, así que se puede testear de forma aislada, sin levantar Express. Los errores de negocio se lanzan como `HttpError` y los traduce el middleware centralizado. El **Controller**, por su parte, solo traduce HTTP: lee parámetros y body, llama al Service y elige el status code. Nunca importa Mongoose ni un repositorio.

## Constantes

`src/constants/index.js` define objetos congelados con `Object.freeze`: `USER_ROLES` (`ADMIN`, `USER`), `PRODUCT_STATUS` (`AVAILABLE`, `OUT_OF_STOCK`), `ENVIRONMENTS`, `HTTP_STATUS` y `RESPONSE_STATUS`. Los modelos usan `Object.values(...)` para los `enum`, y los services y controllers los usan en lugar de strings sueltos. `src/utils/constants.js` reexporta lo mismo, para respetar también la ruta que sugiere la actividad.
