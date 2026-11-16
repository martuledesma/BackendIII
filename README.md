# ShipNow API

API REST de ShipNow con **arquitectura por capas** (Router → Controller → Service → Repository → Model), **configuración de entorno validada al arranque**, **constantes de dominio centralizadas** y un **módulo de mocking** para generar y cargar datos de prueba.

- Módulo 1: estructura por capas y configuración de entorno.
- Módulo 2: mocking y carga de datos de prueba → ver [Módulo de mocking](#módulo-de-mocking-apimocks).
- Módulo 3: manejo profesional de errores → ver [Manejo de errores](#manejo-de-errores).
- Módulo 4: logging y monitoreo básico con Winston → ver [Logging](#logging-con-winston).
- Módulo 5: documentación de la API con Swagger → ver [Documentación con Swagger](#documentación-con-swagger).
- Módulo 6: testing funcional con Mocha, Chai y Supertest → ver [Testing](#testing).

> 📘 **Documentación interactiva:** con el servidor levantado, entrá a **http://localhost:8080/api/docs**.

## Requisitos

- Node.js 18 o superior
- MongoDB (local o Atlas)

## Cómo correr el proyecto localmente

```bash
# 1. Clonar el repositorio
git clone https://github.com/martuledesma/BackendIII.git
cd BackendIII

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

Para comprobar que funciona: `GET http://localhost:8080/health` → `{ "status": "ok" }`. La documentación queda en **http://localhost:8080/api/docs**.

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
│   ├── logger.factory.js    # configuración única de Winston (niveles, formato, salidas, entornos)
│   ├── logger.js            # instancia compartida del logger
│   ├── swagger.config.js    # especificación OpenAPI (info, servidor, tags) + opciones de Swagger UI
│   ├── db.config.js         # conexión a MongoDB
│   └── index.js             # punto de entrada de la configuración
├── constants/
│   └── index.js             # USER_ROLES, PRODUCT_STATUS, HTTP_STATUS... (Object.freeze)
├── docs/
│   ├── components.js        # schemas y parámetros reutilizables
│   ├── helpers.js           # arma respuestas de éxito/error desde el diccionario de errores
│   └── paths/               # un archivo por módulo: users, products, orders, deliveries, mocks, logger
├── controllers/             # HTTP: req → service → res (products, users, orders, deliveries, mocks)
├── services/                # reglas de negocio (incluye mocks.service.js)
├── repositories/            # único lugar que conoce Mongoose
├── models/                  # esquemas: product, user, order, delivery
├── routes/                  # path → método del controller (incluye mocks.router.js)
├── errors/
│   ├── errors.dictionary.js # diccionario: code, statusCode y mensaje de cada error
│   ├── custom-errors.js     # AppError y errores del dominio (UserNotFoundError, InvalidMockQuantityError...)
│   └── index.js
├── middlewares/             # middleware global de errores, 404 y log de peticiones HTTP
├── utils/                   # asyncHandler, respuestas de éxito, validadores, hash, generadores faker
├── app.js                   # configuración de Express
└── server.js                # arranque (config → DB → listen), con logs fatales si falla
logs/                        # archivos de log generados (ignorados por Git)
tests/                       # tests funcionales (Mocha + Chai + Supertest), uno por módulo
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

### Pedidos y entregas

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/orders` | Lista pedidos con el cliente populado. Filtros: `?status=` y `?priority=` |
| GET | `/api/orders/:oid` | Obtiene un pedido |
| PATCH | `/api/orders/:oid/status` | Cambia el estado (`{ "status": "CONFIRMED" }`) respetando las transiciones permitidas y actualiza la entrega asociada |
| POST | `/api/orders` | Crea un pedido: `user` (id de un cliente con rol `USER`), `items` (`title`, `unitPrice`, `quantity`), `shippingAddress` (`street`, `city`, `province`, `zipCode`) y `priority` opcional. El estado inicial es `PENDING` y el total lo calcula el service. |
| GET | `/api/deliveries` | Lista entregas con el pedido y el repartidor populados. Filtro: `?status=` |
| GET | `/api/deliveries/:did` | Obtiene una entrega |

Sirven para verificar en la base las relaciones de los datos cargados con el seed.

Las respuestas exitosas tienen el formato `{ "status": "success", "payload": ... }`. El formato de los errores está explicado en [Manejo de errores](#manejo-de-errores).

## Módulo de mocking (`/api/mocks`)

Genera usuarios, repartidores, pedidos y entregas con [`@faker-js/faker`](https://fakerjs.dev) (locale español). Hay dos tipos de endpoints:

- **GET → solo generan datos en memoria.** No guardan nada en MongoDB; sirven para ver la forma de los datos o usarlos en el front o en tests.
- **POST / DELETE `/seed` → escriben en MongoDB.** Insertan o borran datos de prueba de forma controlada.

### Endpoints que solo devuelven datos (no guardan)

| Método | Ruta | Qué genera |
|---|---|---|
| GET | `/api/mocks/users?qty=10&role=` | Usuarios. Sin `role` mezcla clientes (`USER`) y repartidores (`COURIER`). `role` acepta `ADMIN`, `USER` o `COURIER`. |
| GET | `/api/mocks/couriers?qty=10` | Repartidores (`role: COURIER` con `courierProfile`: vehículo, patente, disponibilidad) |
| GET | `/api/mocks/orders?qty=10` | Pedidos con ítems, total calculado, dirección, estado y prioridad |
| GET | `/api/mocks/deliveries?qty=10` | Entregas, cada una asociada a un pedido y, si corresponde, a un repartidor |
| GET | `/api/mocks/dataset?qty=10` | Un conjunto relacionado completo: `{ users, couriers, orders, deliveries }`. Sirve para ver las relaciones entre los `_id`. |

`qty` es opcional: por defecto vale 10 y como máximo 100 (`MOCK_LIMITS` en las constantes).

Ejemplo — `GET /api/mocks/users?qty=2`:

```json
{
  "status": "success",
  "payload": [
    {
      "_id": "6739f1c2a8b4e5d6f7a8b9c0",
      "firstName": "Ana",
      "lastName": "Pérez",
      "email": "ana.perez.k3x9@test.com",
      "phone": "+54 381 555-1234",
      "role": "USER",
      "courierProfile": null,
      "isMock": true
    },
    {
      "_id": "6739f1c2a8b4e5d6f7a8b9c1",
      "firstName": "Luis",
      "lastName": "Gómez",
      "email": "luis.gomez.p2m7@test.com",
      "phone": "+54 11 5555-6789",
      "role": "COURIER",
      "courierProfile": { "vehicle": "MOTORCYCLE", "licensePlate": "AB123CD", "isAvailable": true },
      "isMock": true
    }
  ]
}
```

### Carga de datos de prueba en MongoDB

| Método | Ruta | Qué hace |
|---|---|---|
| POST | `/api/mocks/seed?entity=users&qty=10` | Inserta usuarios (clientes y repartidores). Acepta `&role=` |
| POST | `/api/mocks/seed?entity=couriers&qty=5` | Inserta repartidores |
| POST | `/api/mocks/seed?entity=orders&qty=10` | Inserta pedidos asignados a **clientes que ya existen en la base**, junto con sus entregas |
| POST | `/api/mocks/seed?entity=deliveries&qty=10` | Inserta entregas con sus pedidos, usando clientes y repartidores existentes |
| POST | `/api/mocks/seed?entity=all&qty=10` | Inserta un set completo y relacionado: 10 pedidos, aprox. 1 cliente cada 3 pedidos, 1 repartidor cada 5 y las entregas que correspondan |
| DELETE | `/api/mocks/seed` | Borra **solo** los documentos generados por mocks (`isMock: true`) |

Sin `entity`, el seed carga `users`. Ejemplo — `POST /api/mocks/seed?qty=10`:

```json
{ "status": "success", "payload": { "insertados": 10, "coleccion": "users" } }
```

`POST /api/mocks/seed?entity=all&qty=10`:

```json
{
  "status": "success",
  "payload": {
    "insertados": 23,
    "coleccion": "all",
    "detalle": { "users": 4, "couriers": 2, "orders": 10, "deliveries": 7 }
  }
}
```

El total de entregas varía porque depende de los estados que salgan sorteados para los pedidos.

**Controles de la carga** (los códigos de error de cada caso están en [Manejo de errores](#manejo-de-errores)):
- `qty` tiene que ser un entero entre 1 y 100. Se rechazan el texto, los decimales, el cero, los negativos y los valores repetidos.
- Cada endpoint acepta solo sus parámetros: `?foo=1` o `role` con una `entity` distinta de `users` responden 400.
- `entity=orders` y `entity=deliveries` necesitan clientes en la base. Si no hay, la API responde 409 con un mensaje que indica qué seed correr primero.
- Si falla la inserción en MongoDB a mitad de un lote, se **revierten** los documentos de ese lote y la API responde 500 con `MOCK_SEED_FAILED`. Los datos que ya estaban en la base no se tocan.
- Si no hay repartidores cargados, solo se generan pedidos que no necesitan uno: `PENDING`, `CANCELLED` o `CONFIRMED` con la entrega `UNASSIGNED`.
- Todos los documentos generados llevan `isMock: true`. Por eso `DELETE /api/mocks/seed` puede limpiarlos sin tocar los datos reales.
- Con `NODE_ENV=production`, seed y delete responden 403.
- Todos los usuarios de prueba tienen la contraseña `coder123` (`MOCK_DEFAULTS.PASSWORD`), guardada hasheada.

### Reglas de consistencia

Las reglas viven en `src/services/mocks.service.js` y todos los valores salen de `src/constants/index.js`.

| Regla | Detalle |
|---|---|
| Roles válidos | Se usan solo los valores de `USER_ROLES` (`ADMIN`, `USER`, `COURIER`) |
| Repartidor coherente | Solo los `COURIER` tienen `courierProfile`, con un vehículo de `VEHICLE_TYPES`. Las bicis (`BIKE`) no tienen patente. |
| Pedido ↔ usuario | `order.user` siempre es el `_id` de un usuario con rol `USER` |
| Total | `total = Σ unitPrice × quantity`. Lo calcula el service, no faker. |
| Estados y prioridades | Salen de `ORDER_STATUS` y `ORDER_PRIORITY` |
| Entrega ↔ pedido | Solo tienen entrega los pedidos `CONFIRMED`, `IN_TRANSIT` o `DELIVERED`, y cada pedido tiene como máximo una (`order` es único) |
| Estado de la entrega | `CONFIRMED` → `UNASSIGNED` o `ASSIGNED` · `IN_TRANSIT` → `IN_TRANSIT` · `DELIVERED` → `DELIVERED`, con `deliveredAt` |
| Entrega ↔ repartidor | `ASSIGNED`, `IN_TRANSIT` y `DELIVERED` siempre tienen el `_id` de un usuario `COURIER`. `UNASSIGNED` tiene `courier: null`. |

### Cómo probarlo

```bash
# 1. Ver datos falsos (no guarda nada)
curl "http://localhost:8080/api/mocks/users?qty=2"
curl "http://localhost:8080/api/mocks/dataset?qty=5"

# 2. Cargar un set completo en MongoDB
curl -X POST "http://localhost:8080/api/mocks/seed?entity=all&qty=10"

# 3. Verificar las relaciones en la base (con populate)
curl "http://localhost:8080/api/orders"
curl "http://localhost:8080/api/deliveries?status=IN_TRANSIT"

# 4. Agregar más pedidos sobre los clientes ya cargados
curl -X POST "http://localhost:8080/api/mocks/seed?entity=orders&qty=5"

# 5. Limpiar todo lo generado
curl -X DELETE "http://localhost:8080/api/mocks/seed"
```

### Cómo respeta las capas

| Capa | Archivo | Responsabilidad |
|---|---|---|
| Router | `routes/mocks.router.js` | Solo conecta cada path con un método del controller |
| Controller | `controllers/mocks.controller.js` | Lee `req.query`, llama al service y responde con el status code |
| Service | `services/mocks.service.js` | Reglas: roles, estados posibles, relaciones, cálculo del total, validación de `qty`, bloqueo en producción |
| Generadores | `utils/mock-generators.js` | Solo produce campos falsos con faker (nombres, emails, direcciones, códigos). No decide reglas. |
| Repository | `repositories/*.repository.js` | `insertMany`, `getIdsByRole` y `deleteMocks`: el único lugar que habla con Mongoose |
| Model | `models/*.model.js` | Esquemas con los `enum` tomados de las constantes |

## Manejo de errores

Todos los errores de la API pasan por una sola capa:

```
service detecta el problema → throw new UserNotFoundError(id)
controller (asyncHandler)   → next(error)
middleware global           → arma la respuesta HTTP
```

- **Diccionario** (`src/errors/errors.dictionary.js`): cada error tiene un `code` estable, el `statusCode` HTTP y un mensaje por defecto. Es la única fuente de verdad de los códigos.
- **Errores personalizados** (`src/errors/custom-errors.js`): todos heredan de `AppError` y se construyen a partir de una entrada del diccionario. Hay categorías (`ValidationError`, `NotFoundError`, `ConflictError`, `ForbiddenError`, `MockError`) y errores concretos del dominio: `UserNotFoundError`, `OrderNotFoundError`, `InvalidStatusError`, `InvalidMockQuantityError`, `MockSeedError`, etc.
- **Middleware global** (`src/middlewares/error.middleware.js`): es el **único** lugar que responde errores. También traduce los errores de librerías: JSON mal formado, `CastError` y `ValidationError` de Mongoose, clave duplicada `11000` y fallas de conexión a MongoDB. Cualquier otro error inesperado responde `INTERNAL_ERROR`.
- **`asyncHandler`** (`src/utils/async-handler.js`): envuelve cada controller y deriva al middleware cualquier error, también los de funciones async. Por eso los controllers no tienen `try/catch` ni `res.status(4xx)`.
- **Rutas inexistentes**: `notFoundHandler` no responde por su cuenta; lanza `RouteNotFoundError` y el middleware lo responde con el mismo formato.

### Estructura de la respuesta de error

Todas las respuestas de error tienen exactamente la misma forma:

```json
{
  "status": "error",
  "error": {
    "code": "MOCK_NEGATIVE_QUANTITY",
    "message": "La cantidad de mocks no puede ser negativa ni cero: se recibió \"-5\" y debe ser un entero entre 1 y 100",
    "statusCode": 400,
    "details": { "field": "qty", "value": "-5", "min": 1, "max": 100 },
    "path": "/api/mocks/users?qty=-5",
    "method": "GET",
    "timestamp": "2026-11-16T22:10:00.000Z"
  }
}
```

| Campo | Para qué sirve |
|---|---|
| `code` | Identificador estable del error. Es lo que debería usar el front o el cliente para decidir qué hacer. |
| `message` | Descripción legible en español |
| `statusCode` | El mismo código HTTP de la respuesta |
| `details` | Datos extra del caso (campo, valor recibido, valores permitidos) o `null` |
| `path`, `method`, `timestamp` | Contexto de la petición, útil para depurar o loguear |

En `NODE_ENV=production`, los errores 500 ocultan `details` y muestran solo el mensaje genérico del diccionario, para no exponer detalles internos.

### Códigos de error

| Código | HTTP | Cuándo aparece |
|---|---|---|
| `VALIDATION_ERROR` | 400 | El documento no cumple el esquema de Mongoose |
| `MISSING_FIELDS` | 400 | Faltan campos obligatorios en el body |
| `INVALID_FIELD` | 400 | Un campo tiene un valor inválido (precio negativo, email mal formado, etc.) |
| `NO_UPDATABLE_FIELDS` | 400 | Un PUT sin campos que se puedan modificar |
| `INVALID_ID` | 400 | El id no es un ObjectId válido |
| `INVALID_JSON` | 400 | El body no es un JSON válido |
| `INVALID_QUERY_PARAM` | 400 | Se envió un parámetro de query que el endpoint no acepta |
| `INVALID_ROLE` / `INVALID_STATUS` / `INVALID_PRIORITY` | 400 | El valor no está en `USER_ROLES`, en `*_STATUS` o en `ORDER_PRIORITY` |
| `COURIER_PROFILE_REQUIRED` | 400 | Se creó o modificó un `COURIER` sin un vehículo válido |
| `MOCK_INVALID_QUANTITY` | 400 | `qty` no es un entero (`abc`, `2.5`, repetido) |
| `MOCK_NEGATIVE_QUANTITY` | 400 | `qty` es negativo o cero |
| `MOCK_QUANTITY_EXCEEDED` | 400 | `qty` es mayor que 100 |
| `MOCK_INVALID_ENTITY` | 400 | La `entity` del seed no existe |
| `SEEDING_DISABLED` | 403 | Se intentó un seed o un delete en producción |
| `ROUTE_NOT_FOUND` | 404 | La ruta no existe |
| `PRODUCT_NOT_FOUND` / `USER_NOT_FOUND` / `ORDER_NOT_FOUND` / `DELIVERY_NOT_FOUND` | 404 | El recurso no existe |
| `EMAIL_ALREADY_REGISTERED` / `PRODUCT_CODE_TAKEN` / `DUPLICATE_RESOURCE` | 409 | Se repitió un valor que tiene que ser único |
| `LAST_ADMIN` | 409 | Se intentó quitar o eliminar al último `ADMIN` |
| `MOCK_MISSING_DEPENDENCIES` | 409 | Un seed de pedidos o entregas sin clientes en la base |
| `MOCK_GENERATION_FAILED` | 500 | Falló la generación de datos en memoria |
| `MOCK_SEED_FAILED` | 500 | Falló la inserción en MongoDB; el lote se revierte |
| `DATABASE_ERROR` | 500 | MongoDB no responde o devuelve un error |
| `INTERNAL_ERROR` | 500 | Error inesperado |

### Cómo probar los casos inválidos

Con la app corriendo (`npm run dev`), en otra terminal:

```bash
# --- Mocks: cantidad inválida ---
curl "http://localhost:8080/api/mocks/users?qty=-5"        # 400 MOCK_NEGATIVE_QUANTITY
curl "http://localhost:8080/api/mocks/users?qty=0"         # 400 MOCK_NEGATIVE_QUANTITY
curl "http://localhost:8080/api/mocks/users?qty=abc"       # 400 MOCK_INVALID_QUANTITY
curl "http://localhost:8080/api/mocks/orders?qty=2.5"      # 400 MOCK_INVALID_QUANTITY
curl "http://localhost:8080/api/mocks/users?qty=500"       # 400 MOCK_QUANTITY_EXCEEDED

# --- Mocks: datos incorrectos ---
curl "http://localhost:8080/api/mocks/users?role=cliente"                      # 400 INVALID_ROLE
curl "http://localhost:8080/api/mocks/couriers?color=rojo"                     # 400 INVALID_QUERY_PARAM
curl -X POST "http://localhost:8080/api/mocks/seed?entity=pizzas"              # 400 MOCK_INVALID_ENTITY
curl -X POST "http://localhost:8080/api/mocks/seed?entity=orders&role=USER"    # 400 INVALID_QUERY_PARAM

# --- Mocks: falta de datos previos (con la base sin clientes) ---
curl -X DELETE "http://localhost:8080/api/mocks/seed"
curl -X POST "http://localhost:8080/api/mocks/seed?entity=orders"              # 409 MOCK_MISSING_DEPENDENCIES

# --- Mocks: falla durante la carga en MongoDB, con rollback ---
curl -X POST "http://localhost:8080/api/mocks/seed?entity=all&qty=10&simulateFailure=true"   # 500 MOCK_SEED_FAILED
curl "http://localhost:8080/api/orders"     # sigue igual: el lote fallido se revirtió

# --- Resto de la API ---
curl "http://localhost:8080/api/no-existe"                    # 404 ROUTE_NOT_FOUND
curl "http://localhost:8080/api/users/123"                    # 400 INVALID_ID
curl "http://localhost:8080/api/users/6739f1c2a8b4e5d6f7a8b9c0"   # 404 USER_NOT_FOUND
curl "http://localhost:8080/api/orders?status=PERDIDO"        # 400 INVALID_STATUS
curl "http://localhost:8080/api/orders?priority=YA"           # 400 INVALID_PRIORITY
curl -X POST http://localhost:8080/api/products -H "Content-Type: application/json" -d '{"title":"x"}'          # 400 MISSING_FIELDS
curl -X POST http://localhost:8080/api/products -H "Content-Type: application/json" -d '{"title":'              # 400 INVALID_JSON
curl -X POST http://localhost:8080/api/users -H "Content-Type: application/json" -d '{"firstName":"A","lastName":"B","email":"a@b.com","password":"12345678","role":"COURIER"}'   # 400 COURIER_PROFILE_REQUIRED
```

`simulateFailure=true` existe solo fuera de producción. Provoca una falla después de insertar la primera colección del lote, para que se pueda comprobar que el rollback deja la base como estaba. En producción ese parámetro no existe y la API lo rechaza con `INVALID_QUERY_PARAM`.

## Logging con Winston

La API registra lo que pasa en el servidor con [Winston](https://github.com/winstonjs/winston) y [winston-daily-rotate-file](https://github.com/winstonjs/winston-daily-rotate-file). En `src/` no queda ningún `console.log`: todo pasa por un logger centralizado.

- **Configuración única**: `src/config/logger.factory.js` define los niveles, el formato, las salidas (consola y archivos) y el comportamiento según el entorno.
- **Instancia compartida**: `src/config/logger.js` crea el logger con el `NODE_ENV` validado en el Módulo 1. Cualquier archivo lo usa así:
  ```js
  import { logger } from '../config/logger.js'
  logger.info('Pedido creado')
  ```

### Niveles

Definidos en `LOG_LEVELS` (`src/constants/index.js`). Cuanto menor es el número, más grave es el evento.

| Nivel | Prioridad | Para qué se usa en ShipNow |
|---|---|---|
| `fatal` | 0 | La app no puede seguir: configuración de entorno inválida, falla en la conexión inicial a MongoDB, puerto ocupado, excepciones no capturadas |
| `error` | 1 | Errores inesperados del servidor (500), caídas de MongoDB, fallas en la carga de mocks |
| `warning` | 2 | Errores esperados del negocio (4xx: cantidad inválida de mocks, pedido o ruta inexistente, datos inválidos), rollback de un seed, pedidos sin repartidor asignado, productos sin stock, cambios de rol |
| `info` | 3 | Eventos normales: servidor iniciado, MongoDB conectado, pedido, usuario o producto creados, mocks generados, seed completado |
| `http` | 4 | Cada petición: método, ruta, status y duración |
| `debug` | 5 | Detalle para desarrollo: filtros de consultas, parámetros del seed, URI de conexión (con la contraseña oculta) |

Formato de cada línea, igual en la consola y en los archivos:

```
2026-11-16 19:40:03 [info]    Conexión a MongoDB establecida (base "shipnow")
2026-11-16 19:40:03 [info]    Servidor ShipNow escuchando en el puerto 8080 (development)
2026-11-16 19:41:10 [warning] MOCK_NEGATIVE_QUANTITY en GET /api/mocks/users?qty=-5 → 400: La cantidad de mocks no puede ser negativa ni cero...
2026-11-16 19:41:10 [http]    GET /api/mocks/users?qty=-5 400 - 3.2 ms
2026-11-16 19:42:30 [error]   MOCK_SEED_FAILED en POST /api/mocks/seed?entity=all&simulateFailure=true → 500: Falló la carga de all en MongoDB...
```

### Comportamiento según el entorno (`NODE_ENV`)

| Entorno | Consola | `logs/combined-*.log` | `logs/error.log` |
|---|---|---|---|
| `development` | Desde `debug` (todo), con colores | Desde `http` | `error` y `fatal` |
| `production` | Desde `info`, sin colores | Desde `info` | `error` y `fatal` |
| `test` | Solo `error` y `fatal`, para no ensuciar la salida de los tests | Desde `info` | `error` y `fatal` |

### Archivos de log y rotación

| Archivo | Qué guarda | Rotación |
|---|---|---|
| `logs/error.log` | **Solo `error` y `fatal`** | Por tamaño: al llegar a 5 MB pasa a `error1.log`, `error2.log`, etc. Se conservan como máximo 5 archivos y `error.log` es siempre el más reciente. |
| `logs/combined-AAAA-MM-DD.log` | Historial general (según el entorno) | Por fecha: un archivo por día, con un tope de 20 MB por archivo. Los días anteriores se comprimen (`.gz`) y se borran los de más de 14 días. |

Los parámetros de rotación están en `LOG_FILES` (`src/constants/index.js`). La carpeta `logs/` se crea sola al arrancar la app.

### Qué ignora Git

En `.gitignore`:

```
logs/*
!logs/.gitkeep
*.log
```

En el repo solo se versiona `logs/.gitkeep`, para que la carpeta exista. Ningún archivo de log generado por la app se sube. Tampoco se suben `node_modules/` ni `.env`.

### Endpoint de prueba del logger

`GET /api/loggerTest` es una herramienta interna, no una funcionalidad del negocio. Emite un log de **cada nivel**, de `debug` a `fatal`, y responde en qué salidas debería aparecer cada uno según el entorno actual:

```bash
curl http://localhost:8080/api/loggerTest
```

```json
{
  "status": "success",
  "payload": {
    "mensaje": "Se emitió un log de cada nivel. Revisá la consola y la carpeta logs/.",
    "entorno": "development",
    "niveles": [
      { "nivel": "debug",   "consola": true, "archivoGeneral": false, "archivoErrores": false },
      { "nivel": "http",    "consola": true, "archivoGeneral": true,  "archivoErrores": false },
      { "nivel": "info",    "consola": true, "archivoGeneral": true,  "archivoErrores": false },
      { "nivel": "warning", "consola": true, "archivoGeneral": true,  "archivoErrores": false },
      { "nivel": "error",   "consola": true, "archivoGeneral": true,  "archivoErrores": true },
      { "nivel": "fatal",   "consola": true, "archivoGeneral": true,  "archivoErrores": true }
    ],
    "archivos": { "errores": "logs/error.log", "general": "logs/combined-AAAA-MM-DD.log" }
  }
}
```

Para validar que funciona:

1. **Consola**: en la terminal de `npm run dev` aparecen las 6 líneas de prueba, cada una con su color.
2. **Archivo de errores**: `cat logs/error.log` muestra **solo** las líneas `[error]` y `[fatal]`.
3. **Archivo general**: `cat logs/combined-$(date +%F).log` muestra desde `[http]` hacia arriba. `debug` no se escribe en archivos.
4. **Producción**: con `NODE_ENV=production` en el `.env`, reiniciá la app y volvé a llamar al endpoint. La línea `debug` y la `http` ya no aparecen, y la respuesta lo indica con `consola: false`.

### Otros eventos para probar

```bash
curl "http://localhost:8080/api/mocks/users?qty=3"                  # [info] Mocks generados en memoria (sin guardar): 3 users
curl "http://localhost:8080/api/mocks/users?qty=-5"                 # [warning] MOCK_NEGATIVE_QUANTITY ...
curl -X POST "http://localhost:8080/api/mocks/seed?entity=all&qty=5"   # [info] Seed completado en MongoDB: ...
curl -X POST "http://localhost:8080/api/mocks/seed?entity=all&qty=5&simulateFailure=true"   # [warning] rollback + [error] MOCK_SEED_FAILED (también en error.log)
curl "http://localhost:8080/api/orders/6739f1c2a8b4e5d6f7a8b9c0"    # [warning] ORDER_NOT_FOUND ...
curl "http://localhost:8080/api/no-existe"                           # [warning] ROUTE_NOT_FOUND ...
```

Para registrar el alta de un pedido (`[info] Pedido ... creado para ...`), usá el `_id` de un cliente que exista, por ejemplo uno que aparezca en `GET /api/users?role=USER`:

```bash
curl -X POST http://localhost:8080/api/orders -H "Content-Type: application/json" -d '{"user":"<ID_CLIENTE>","priority":"URGENT","items":[{"title":"Caja","unitPrice":1500,"quantity":2}],"shippingAddress":{"street":"San Martín 100","city":"San Miguel de Tucumán","province":"Tucumán","zipCode":"4000"}}'
```

Para ver un `fatal`, borrá `MONGODB_URI` del `.env` y corré `npm run dev`. La app registra el fatal en la consola y en `logs/error.log` y no arranca.

## Documentación con Swagger

La API está documentada con **OpenAPI 3.0** y se puede consultar y probar desde **Swagger UI** ([swagger-ui-express](https://github.com/scottie1984/swagger-ui-express)).

| Ruta | Qué muestra |
|---|---|
| **`/api/docs`** | Swagger UI interactivo. Con **Try it out** se puede ejecutar cada endpoint contra el servidor local. |
| `/api/docs.json` | La especificación OpenAPI en JSON, por ejemplo para importarla en Postman o Insomnia |

### Cómo verla

1. Levantá el servidor (ver [Cómo correr el proyecto](#cómo-correr-el-proyecto-localmente)):
   ```bash
   npm install
   npm run dev
   ```
2. Abrí **http://localhost:8080/api/docs** en el navegador. Si cambiaste `PORT` en el `.env`, usá ese puerto: el servidor que figura en Swagger se arma con el mismo `PORT`.

### Qué está documentado

Los endpoints están agrupados por **tags**, uno por módulo:

| Tag | Endpoints |
|---|---|
| **Users** | `GET/POST /api/users`, `GET/PUT/DELETE /api/users/{uid}` |
| **Products** | `GET/POST /api/products`, `GET/PUT/DELETE /api/products/{pid}` |
| **Orders** | `GET/POST /api/orders`, `GET /api/orders/{oid}`, `PATCH /api/orders/{oid}/status` |
| **Deliveries** | `GET /api/deliveries`, `GET /api/deliveries/{did}` |
| **Mocks** | `GET /api/mocks/users`, `/couriers`, `/orders`, `/deliveries`, `/dataset` · `POST /api/mocks/seed` · `DELETE /api/mocks/seed` |
| **Logger** | `GET /api/loggerTest` (herramienta interna de validación, no es una funcionalidad del negocio) |

Cada endpoint indica el método, la ruta, una descripción, los parámetros de ruta y de query, el body esperado (con ejemplo), la respuesta exitosa y **todas las respuestas de error posibles**, agrupadas por status, con un ejemplo por código.

**Schemas reutilizables** (`components.schemas`):
- Respuestas: `SuccessResponse` y `ErrorResponse`.
- Entidades: `User`, `CourierProfile`, `Product`, `Order`, `OrderItem`, `Address`, `Delivery`, más `UserSummary` y `OrderSummary` (datos incluidos con populate).
- Entradas: `UserCreateInput`, `UserUpdateInput`, `ProductCreateInput`, `ProductUpdateInput`, `OrderCreateInput`, `SeedInput`.
- Mocks y logger: `MockUser`, `MockOrder`, `MockDelivery`, `MockDataset`, `SeedResult`, `ClearResult`, `LoggerTestResult`.

### Cómo se mantiene fiel a la API real

- **La configuración está separada de las rutas.** `src/config/swagger.config.js` arma la especificación con la información general, el servidor local y los tags. La documentación de cada módulo vive en `src/docs/paths/`. `src/routes/docs.router.js` solo sirve la especificación.
- **Los enums salen de las constantes del proyecto.** Roles, estados de pedido y de entrega, prioridades, vehículos, entidades de mocks y límites de `qty` se toman de `src/constants/index.js`, el mismo archivo que usan los modelos y los services.
- **Los errores salen del diccionario real.** Cada respuesta de error se genera con `errorResponses(...códigos)` (`src/docs/helpers.js`), que toma el status y el mensaje de `src/errors/errors.dictionary.js`. Si se documenta un código que no existe, la app no arranca. Además, el status HTTP de cada código siempre es el real.
- **Las rutas documentadas coinciden con las de Express.** Son las mismas 24 operaciones en los routers que en Swagger, con los mismos nombres de parámetros (`uid`, `pid`, `oid`, `did`, `qty`, `role`, `entity`, `status`, `priority`, etc.).

### Aclaraciones para probar desde Swagger

- **No hay autenticación**: todos los endpoints se pueden probar directamente.
- **Para crear un pedido** (`POST /api/orders`), el campo `user` tiene que ser el `_id` de un cliente existente con rol `USER`. Podés cargar clientes con `POST /api/mocks/seed` (entity `users` o `all`) y copiar un `_id` de `GET /api/users?role=USER`.
- **El seed acepta los parámetros por query o en el body JSON** (`{ "entity": "all", "qty": 10 }`). Si llegan en ambos, gana la query.
- **Errores fáciles de probar:**
  - `qty = -5`, `0`, `abc` o `500` en cualquier endpoint de mocks devuelve 400 con `MOCK_*_QUANTITY`.
  - `status = PERDIDO` en `GET /api/orders` devuelve 400 `INVALID_STATUS`.
  - Un id inexistente con formato válido devuelve 404.
  - `simulateFailure = true` en el seed devuelve 500 `MOCK_SEED_FAILED`, con rollback.
- **En producción** (`NODE_ENV=production`), el seed y el borrado de mocks responden 403 `SEEDING_DISABLED`, y `simulateFailure` deja de existir.

## Testing

Suite de **tests funcionales** que prueba los endpoints de punta a punta: petición HTTP → router → controller → service → repository → MongoDB, y la respuesta de vuelta.

### Herramientas

| Herramienta | Para qué |
|---|---|
| [Mocha](https://mochajs.org) | Organiza y ejecuta los tests (`describe`, `it`, hooks `before`/`after`/`beforeEach`) |
| [Chai](https://www.chaijs.com) | Assertions (`expect`) sobre el status, el body y sus propiedades |
| [Supertest](https://github.com/ladjs/supertest) | Hace las peticiones HTTP contra la app de Express **sin levantar el servidor** |

La app de Express está separada del arranque: `src/app.js` exporta la app y `src/server.js` es el único que conecta a MongoDB y hace `listen`. Los tests importan `src/app.js` y Supertest abre y cierra un puerto efímero por cada petición.

### Entorno de testing (separado del de desarrollo)

`npm test` corre con `NODE_ENV=test`. En ese caso `src/config/env.config.js` carga **`.env.test`** en lugar de `.env`, con su propia base de datos:

| Variable | Valor en `.env.test` | Para qué |
|---|---|---|
| `NODE_ENV` | `test` | Activa el entorno de testing; el logger casi no escribe en consola |
| `PORT` | `8081` | Obligatoria por la validación de entorno. Los tests no la usan, porque Supertest no abre ese puerto. |
| `MONGODB_URI` | URI de una base **distinta** a la de desarrollo, cuyo nombre termine en `_test` | Por ejemplo `mongodb+srv://usuario:pass@cluster0.xxxxx.mongodb.net/shipnow_test?retryWrites=true&w=majority` |

**Sí se requiere una base de datos de testing.** Puede estar en el mismo cluster de Atlas que la de desarrollo: alcanza con cambiar el nombre de la base en la URI (`/shipnow` → `/shipnow_test`). MongoDB la crea sola la primera vez.

Por seguridad, los tests **se niegan a correr** si el nombre de la base no termina en `_test`, porque vacían la base al empezar y al terminar.

Para configurarlo:

```bash
cp .env.test.example .env.test
# completá MONGODB_URI apuntando a la base *_test
```

`.env.test` no se sube al repo (está en `.gitignore`); solo se versiona `.env.test.example`.

### Cómo ejecutarlos

```bash
npm install     # instala también mocha, chai y supertest (devDependencies)
npm test
```

La configuración de Mocha está en `.mocharc.json`: archivos `tests/**/*.test.js`, hooks globales en `tests/setup.js`, timeout de 20 s y reporter `spec`. En Windows, el script `NODE_ENV=test mocha` necesita Git Bash o WSL.

### Qué se cubre

Los tests están en `tests/`, agrupados por módulo:

| Archivo | Casos de éxito | Casos de error |
|---|---|---|
| `users.test.js` | Listar usuarios (estructura, sin contraseña), filtrar por rol, obtener por id, crear, actualizar, borrado lógico | `INVALID_ROLE`, `INVALID_QUERY_PARAM`, 404 `USER_NOT_FOUND`, `INVALID_ID`, `MISSING_FIELDS`, `INVALID_FIELD`, `COURIER_PROFILE_REQUIRED`, 409 `EMAIL_ALREADY_REGISTERED`, `NO_UPDATABLE_FIELDS` |
| `orders.test.js` | Crear un pedido válido (PENDING, total calculado, cliente populado), listar, filtrar por estado y prioridad, consultar por id, **actualizar el estado**: PENDING → CONFIRMED (crea la entrega), CONFIRMED → IN_TRANSIT → DELIVERED, cancelación | `MISSING_FIELDS` (datos incompletos), `INVALID_FIELD`, `INVALID_PRIORITY`, 404 `USER_NOT_FOUND`, `INVALID_JSON`, **`INVALID_STATUS`** (estado inválido), 404 `ORDER_NOT_FOUND`, `INVALID_ID`, 409 `INVALID_STATUS_TRANSITION`, 409 `COURIER_NOT_ASSIGNED` |
| `deliveries.test.js` | Listar con pedido y repartidor populados y estados coherentes, filtrar por estado, obtener por id | `INVALID_STATUS`, 404 `DELIVERY_NOT_FOUND`, `INVALID_ID` |
| `mocks.test.js` | Generar users, couriers, orders, deliveries y dataset con estructura y relaciones válidas, sin guardar nada. Seed de users, all (por query y por body) y orders. Borrado que conserva los datos reales. | **Cantidades inválidas**: `-5` y `0` → `MOCK_NEGATIVE_QUANTITY`; `abc`, `2.5` y repetido → `MOCK_INVALID_QUANTITY`; `101` → `MOCK_QUANTITY_EXCEEDED`. También `INVALID_ROLE`, `INVALID_QUERY_PARAM`, `MOCK_INVALID_ENTITY`, 409 `MOCK_MISSING_DEPENDENCIES` y 500 `MOCK_SEED_FAILED` con rollback verificado en la base. |
| `logger.test.js` | `GET /api/loggerTest`: los 6 niveles, el entorno `test`, qué nivel va a cada salida, y que `logs/error.log` tenga solo `error` y `fatal` | — |
| `docs.test.js` | Swagger UI en `/api/docs/`, redirección de `/api/docs`, `/api/docs.json` con la info, los tags y los schemas | **Coherencia con Swagger**: cada GET por id documentado con 404 se llama con un id inexistente y tiene que devolver el código documentado. Lo mismo con el 400 `INVALID_ID` y con los errores de cantidad de los 5 GET de mocks. |
| `products.test.js` | Crear (estado según stock), listar con y sin los productos sin stock | `MISSING_FIELDS`, 409 `PRODUCT_CODE_TAKEN`, 404 `PRODUCT_NOT_FOUND` |
| `errors.test.js` | — | 404 `ROUTE_NOT_FOUND` (ruta inexistente), `INVALID_JSON`, misma estructura en todos los errores |

**Cada test valida el status y la forma de la respuesta**, no solo que "responde":
- Los helpers `expectSuccess` y `expectError` (`tests/helpers/api.helper.js`) comprueban el status HTTP, el `Content-Type` y el formato `{ status, payload }` o `{ status, error }`.
- En los errores verifican el código del diccionario, el `message`, que `statusCode` coincida con el status HTTP, `path`, `method` y `timestamp`.
- Además, cada test revisa las propiedades importantes del caso: total calculado, roles, relaciones, `details` del error, etc.

### Datos de prueba y limpieza

- **Datos controlados y descartables.** Se crean dentro de cada grupo, por la API (`tests/helpers/fixtures.js`: clientes, repartidores, pedidos, productos) o con el módulo de mocks. Los emails y los códigos son únicos en cada corrida. Nunca se usan datos cargados a mano.
- **Limpieza.**
  - `tests/setup.js` (hooks globales) vacía la base `_test` al empezar y al terminar la suite.
  - Además, cada archivo vacía la base en `before()` y `after()`.
  - `mocks.test.js` lo hace en `beforeEach()`, y `orders.test.js` crea un pedido nuevo en `beforeEach()` para los tests de estado.
- **Independientes del orden y repetibles.** Ningún grupo depende de lo que dejó otro, y la suite se puede correr dos veces seguidas sin borrar nada a mano.

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

El Service no recibe `req` ni `res`, así que se puede testear de forma aislada, sin levantar Express. Los errores de negocio se lanzan como errores del dominio (`src/errors/`) y los traduce el middleware global. El **Controller**, por su parte, solo traduce HTTP: lee parámetros y body, llama al Service y elige el status code. Nunca importa Mongoose ni un repositorio.

## Constantes

`src/constants/index.js` define objetos congelados con `Object.freeze`: `USER_ROLES` (`ADMIN`, `USER`, `COURIER`), `VEHICLE_TYPES`, `PRODUCT_STATUS`, `ORDER_STATUS`, `ORDER_PRIORITY`, `DELIVERY_STATUS`, `MOCK_ENTITIES`, `MOCK_LIMITS`, `MOCK_DEFAULTS`, `ENVIRONMENTS`, `HTTP_STATUS` y `RESPONSE_STATUS`. Los modelos usan `Object.values(...)` para los `enum`, y los services y controllers los usan en lugar de strings sueltos. `src/utils/constants.js` reexporta lo mismo, para respetar también la ruta que sugiere la actividad.
