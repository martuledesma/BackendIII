# ShipNow API

API REST de ShipNow con **arquitectura por capas** (Router → Controller → Service → Repository → Model), **configuración de entorno validada al arranque**, **constantes de dominio centralizadas** y un **módulo de mocking** para generar y cargar datos de prueba.

- Módulo 1: estructura por capas y configuración de entorno.
- Módulo 2: mocking y carga de datos de prueba → ver [Módulo de mocking](#módulo-de-mocking-apimocks).

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
├── controllers/             # HTTP: req → service → res (products, users, orders, deliveries, mocks)
├── services/                # reglas de negocio (incluye mocks.service.js)
├── repositories/            # único lugar que conoce Mongoose
├── models/                  # esquemas: product, user, order, delivery
├── routes/                  # path → método del controller (incluye mocks.router.js)
├── middlewares/             # manejo centralizado de errores y 404
├── utils/                   # HttpError, hash de contraseñas, generadores faker, alias de constantes
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

### Pedidos y entregas — solo lectura

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/orders` | Lista pedidos con el cliente populado. Filtros: `?status=` y `?priority=` |
| GET | `/api/orders/:oid` | Obtiene un pedido |
| GET | `/api/deliveries` | Lista entregas con el pedido y el repartidor populados. Filtro: `?status=` |
| GET | `/api/deliveries/:did` | Obtiene una entrega |

Sirven para verificar en la base las relaciones de los datos cargados con el seed.

Formato de respuesta: `{ "status": "success", "payload": ... }` o `{ "status": "error", "error": "mensaje" }`.

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

**Controles de la carga:**
- `qty` se valida (un entero de 1 a 100); si no cumple, la API responde 400.
- `entity=orders` y `entity=deliveries` necesitan clientes en la base. Si no hay, la API responde 409 con un mensaje que indica qué seed correr primero.
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

`src/constants/index.js` define objetos congelados con `Object.freeze`: `USER_ROLES` (`ADMIN`, `USER`, `COURIER`), `VEHICLE_TYPES`, `PRODUCT_STATUS`, `ORDER_STATUS`, `ORDER_PRIORITY`, `DELIVERY_STATUS`, `MOCK_ENTITIES`, `MOCK_LIMITS`, `MOCK_DEFAULTS`, `ENVIRONMENTS`, `HTTP_STATUS` y `RESPONSE_STATUS`. Los modelos usan `Object.values(...)` para los `enum`, y los services y controllers los usan en lugar de strings sueltos. `src/utils/constants.js` reexporta lo mismo, para respetar también la ruta que sugiere la actividad.
