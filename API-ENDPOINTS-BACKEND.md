# API Backend - Guia de pruebas endpoint por endpoint

Este documento lista los endpoints del backend para probarlos uno por uno.

## Base URL

- Local: `http://localhost:9001`
- Health check: `GET /health`
- Prefijo API: `/api`

## Autenticacion

Todos los endpoints (excepto `/health` y `/api/auth/login`) requieren autenticacion.
El token JWT se obtiene via `POST /api/auth/login` y se almacena automaticamente en una cookie httpOnly (`token`).

Alternativamente, se puede usar el header:

- `Authorization: Bearer <token>`

## Formato de respuesta paginada

Todos los endpoints de listado (`GET`) ahora son paginados.

Query params comunes:

- `page` (default: `1`)
- `limit` (default: `10`, maximo: `100`)

Respuesta:

```json
{
  "message": "Usuarios encontrados correctamente",
  "error": false,
  "status": 200,
  "data": [],
  "total": 2,
  "limit": 10,
  "totalPages": 1,
  "page": 1,
  "pagingCounter": 1,
  "hasPrevPage": false,
  "hasNextPage": false,
  "prevPage": null,
  "nextPage": null
}
```

## 1) Auth

### POST `/api/auth/login`

Body:

```json
{
  "username": "admin",
  "password": "123456"
}
```

Respuesta: setea una cookie httpOnly `token` con el JWT. Devuelve los datos del usuario:

```json
{
  "user": {
    "id": 1,
    "username": "admin",
    "fullName": "Admin",
    "email": "admin@correo.com",
    "dni": "00000258",
    "isActive": true,
    "role": {
      "id": 1,
      "name": "Admin",
      "description": "Acceso total al sistema",
      "permissions": []
    },
    "createdAt": "2026-05-18T23:55:52.452Z",
    "updatedAt": "2026-05-18T23:55:52.452Z"
  }
}
```

### POST `/api/auth/logout`

Requiere autenticacion (token en cookie o Authorization header). Limpia la cookie `token`.

```json
{
  "message": "Sesión cerrada correctamente"
}
```

## 2) Roles

### GET `/api/roles?page=1&limit=10`

### GET `/api/roles/:id`

### POST `/api/roles`

Body:

```json
{
  "name": "SECRETARIA",
  "description": "Rol de secretaria",
  "permissions": [
    {
      "key": "certificates.read",
      "description": "Leer certificados"
    },
    {
      "key": "certificates.create",
      "description": "Crear certificados"
    }
  ]
}
```

### PUT `/api/roles/:id`

```json
{
  "name": "SECRETARIA",
  "description": "Rol actualizado",
  "permissions": [
    { "key": "certificates.read" },
    { "key": "certificates.update" }
  ]
}
```

### DELETE `/api/roles/:id`

## 3) Users

### GET `/api/users?page=1&limit=10`

Filtros opcionales:

- `roleId=2`
- `isActive=true|false`

### GET `/api/users/:id`

### POST `/api/users`

Body:

```json
{
  "username": "presidente1",
  "password": "123456",
  "fullName": "Usuario Presidente",
  "email": "presidente1@correo.com",
  "dni": "73171547",
  "roleId": 2
}
```

### PUT `/api/users/:id`

Body (ejemplo):

```json
{
  "username": "presidente1",
  "fullName": "Usuario Presidente Actualizado",
  "email": "presidente1-actualizado@correo.com",
  "dni": "73171549",
  "roleId": 2,
  "password": "nueva-clave"
}
```

### PATCH `/api/users/:id/status`

Body:

```json
{
  "isActive": false
}
```

Si `isActive` es `false`, el usuario no puede iniciar sesion en `/api/auth/login`.

Shape esperado del usuario en respuestas:

```json
{
  "id": 1,
  "username": "pierols",
  "fullName": "Piero Llanos Sanchez",
  "email": "piero@gmail.com",
  "dni": "73171545",
  "isActive": true,
  "role": {
    "id": 3,
    "name": "Admin",
    "description": "Acceso total al sistema",
    "permissions": []
  },
  "createdAt": "2026-05-18T23:55:52.452Z",
  "updatedAt": "2026-05-18T23:55:52.452Z"
}
```

### DELETE `/api/users/:id`

## 4) Sectors

### GET `/api/sectors?page=1&limit=10`

### GET `/api/sectors/:id`

### POST `/api/sectors`

```json
{
  "name": "Sector Norte"
}
```

### PUT `/api/sectors/:id`

```json
{
  "name": "Sector Norte A"
}
```

### DELETE `/api/sectors/:id`

## 5) Terrain Types

### GET `/api/terrain-types?page=1&limit=10`

### GET `/api/terrain-types/:id`

### POST `/api/terrain-types`

```json
{
  "name": "Agricola"
}
```

### PUT `/api/terrain-types/:id`

```json
{
  "name": "Residencial"
}
```

### DELETE `/api/terrain-types/:id`

## 6) Clients

### GET `/api/clients?page=1&limit=10`

Query opcional adicional:

- `clientType=Comunero`
- `clientType=Tercero`

### GET `/api/clients/:id`

### POST `/api/clients`

```json
{
  "fullName": "Juan Perez",
  "documentNumber": "12345678",
  "address": "Av. Principal 123",
  "phone": "999888777",
  "clientType": "Comunero"
}
```

### PUT `/api/clients/:id`

```json
{
  "fullName": "Juan Perez Quispe",
  "documentNumber": "12345678",
  "address": "Av. Principal 456",
  "phone": "999888111",
  "clientType": "Comunero"
}
```

### DELETE `/api/clients/:id`

## 7) Certificate Requests

### GET `/api/certificate-requests?page=1&limit=10`

Query opcional adicional:

- `status=Pendiente|Aprobada|Rechazada`

### GET `/api/certificate-requests/:id`

Acepta tanto el `id` numerico como el `requestNumber` (ej: `000001` o `000001-26`).

### GET `/api/certificate-requests/:id/pdf`

### POST `/api/certificate-requests`

El cliente titular se toma desde el objeto `client` del body.
Si se envia `partnerClient` con datos, se registra como partner y se almacena su `partnerId`.
`isComunero` determina el `clientType`: `true` -> `Comunero`, `false` -> `Tercero`.
El campo `createdBy` se completa automaticamente con el usuario autenticado que realiza el registro.

```json
{
  "isComunero": true,
  "destination": "Ingeniero",
  "requestDescription": "Solicito emision de certificado para tramite de posesion.",
  "sectorLocation": "Las Lomas Santa Rosa De Asia Mz:A1 Lt:4",
  "client": {
    "searchType": "Reniec",
    "fullName": "Arias Aburto, Olga Lidia",
    "documentNumber": "80093634",
    "address": "Asia"
  },
  "partnerClient": {
    "searchType": "Comunidad",
    "fullName": "",
    "documentNumber": "",
    "address": ""
  },
  "certificateTypes": [
    {
      "type": "CertificadoPosesion"
    },
    {
      "type": "Otros",
      "otherType": "Constancia de residencia"
    }
  ],
  "exposure": "Solicito certificado de posesion.",
  "attachments": [
    {
      "type": "CopiaDni"
    },
    {
      "type": "CopiaPlanoMemoria"
    },
    {
      "type": "Celular",
      "phoneNumber": "980215312"
    }
  ]
}
```

### PUT `/api/certificate-requests/:id`

```json
{
  "destination": "Notaria",
  "requestDescription": "Solicitud revisada",
  "status": "Aprobada"
}
```

Estructura de respuesta de `GET /api/certificate-requests/:id`:

```json
{
  "id": 1,
  "requestNumber": "003223-26",
  "isComunero": true,
  "destination": "Ingeniero",
  "requestDescription": "Solicito emision de certificado para tramite de posesion.",
  "sectorLocation": "Las Lomas Santa Rosa De Asia Mz:A1 Lt:4",
  "client": {
    "searchType": "Reniec",
    "fullName": "Arias Aburto, Olga Lidia",
    "documentNumber": "80093634",
    "address": "Asia"
  },
  "partnerClient": {
    "searchType": "Comunidad",
    "fullName": "",
    "documentNumber": "",
    "address": ""
  },
  "certificateTypes": [
    {
      "type": "CertificadoPosesion"
    },
    {
      "type": "Otros",
      "otherType": "Constancia de residencia"
    }
  ],
  "exposure": "Solicito certificado de posesion.",
  "attachments": [
    {
      "type": "CopiaDni"
    },
    {
      "type": "CopiaPlanoMemoria"
    },
    {
      "type": "Celular",
      "phoneNumber": "980215312"
    }
  ],
  "createdBy": {
    "dni": "00000258",
    "role": "Atencion"
  },
  "createdAt": "2026-05-18T20:35:20.000Z",
  "updatedAt": "2026-05-18T20:35:20.000Z"
}
```

### DELETE `/api/certificate-requests/:id`

## 8) Certificates

### GET `/api/certificates?page=1&limit=10`

Filtros opcionales:

- `certificateNumber` — busqueda parcial del numero de certificado
- `requestNumber` — busqueda por numero de solicitud asociado
- `name` — nombre del propietario (busca en cliente y partner)
- `documentNumber` — DNI del propietario (busca en cliente y partner)
- `mz` — manzana
- `lot` — lote
- `status=Por Firmar|Por Recoger|Entregado`
- `sectorId` — ID del sector
- `terrainTypeId` — ID del tipo de terreno

### GET `/api/certificates/:id`

### GET `/api/certificates/:id/pdf`

### POST `/api/certificates`

`owners` es un array de objetos con `id` del cliente. El primer elemento es el propietario principal (`clientId`), el segundo (opcional) es el conyuge/partner (`partnerId`).
`requestNumber` debe corresponder a una solicitud de certificado existente.
`createdBy` se asigna automaticamente desde el token JWT.

```json
{
  "owners": [{ "id": 1 }, { "id": 2 }],
  "terrain": {
    "terrainType": { "id": 1 },
    "width": 10.5,
    "length": 20.0,
    "totalArea": 210.0
  },
  "location": {
    "sectors": { "id": 1 },
    "mz": "L-2",
    "lot": "7"
  },
  "borders": {
    "north": "LOTE 6",
    "south": "LOTE 8",
    "east": "LOTE 5",
    "west": "CALLE FRANCISCO AVALOS"
  },
  "requestNumber": "003223-26"
}
```

### PUT `/api/certificates/:id`

```json
{
  "owners": [{ "id": 1 }],
  "terrain": {
    "terrainType": { "id": 1 },
    "width": 12.0,
    "length": 25.0,
    "totalArea": 300.0
  },
  "location": {
    "sectors": { "id": 2 },
    "mz": "MZ-1",
    "lot": "L-5"
  },
  "borders": {
    "north": "CALLE LOS OLIVOS",
    "south": "LOTE 3",
    "east": "LOTE 4",
    "west": "AV. PRINCIPAL"
  },
  "status": "Por Recoger"
}
```

Estructura de respuesta de `GET /api/certificates/:id`:

```json
{
  "id": 1,
  "owners": [
    {
      "id": 1,
      "fullName": "LUZ SELENE PALOMINO ALVAREZ",
      "documentNumber": "30422693"
    },
    {
      "id": 2,
      "fullName": "CESAR AUGUSTO BARDALES ASTE",
      "documentNumber": "42538515"
    }
  ],
  "terrain": {
    "terrainType": {
      "id": 1,
      "name": "VIVIENDA"
    },
    "width": 10.5,
    "length": 20.0,
    "totalArea": 210.0
  },
  "location": {
    "sectors": {
      "id": 1,
      "name": "VIGARAY"
    },
    "mz": "L-2",
    "lot": "7"
  },
  "borders": {
    "north": "LOTE 6",
    "south": "LOTE 8",
    "east": "LOTE 5",
    "west": "CALLE FRANCISCO AVALOS"
  },
  "certificateNumber": "000001",
  "requestNumber": "003223-26",
  "status": "Entregado",
  "createdBy": {
    "dni": "00000258",
    "role": "ATENCION"
  },
  "createdAt": "2026-05-19T20:35:20Z",
  "updatedAt": "2026-05-19T20:35:20Z"
}
```

### DELETE `/api/certificates/:id`

## 9) Assembly Record Requests

### GET `/api/assembly-record-requests?page=1&limit=10`

Query opcional adicional:

- `status=Pendiente|Aprobada|Rechazada`

### GET `/api/assembly-record-requests/:id`

### GET `/api/assembly-record-requests/:id/preview`

### GET `/api/assembly-record-requests/:id/pdf`

### POST `/api/assembly-record-requests`

```json
{
  "clientId": 1,
  "certificateId": 1,
  "description": "Solicitud de acta de asamblea"
}
```

### PUT `/api/assembly-record-requests/:id`

```json
{
  "description": "Solicitud validada",
  "status": "Aprobada"
}
```

### DELETE `/api/assembly-record-requests/:id`

## 10) Dashboard

### GET `/api/dashboard/summary`

Devuelve totales de:

- certificados
- clientes
- terrainTypes
- sectors

## 11) Reports

### GET `/api/reports/certificates`

Exporta Excel (`.xlsx`) y acepta los mismos filtros que `GET /api/certificates`:

- `certificateNumber`, `requestNumber`, `name`, `documentNumber`, `mz`, `lot`, `status`

## Valores permitidos (enums)

- `clientType`: `Comunero`, `Tercero`
- `certificate status`: `Por Firmar`, `Por Recoger`, `Entregado`
- `request status`: `Pendiente`, `Aprobada`, `Rechazada`

## Roles base que se crean automaticamente

- `Admin`
- `Presidente`
- `AtencionCliente`

## Orden recomendado para pruebas 1 a 1

1. `POST /api/auth/login` (guardar token)
2. `POST /api/users` (crear usuario, publico)
3. Crear catalogos: sectors + terrain-types
4. Crear clients
5. Crear certificate-requests
6. Crear certificates
7. Crear assembly-record-requests
8. Probar previews/pdf/reportes/dashboard
