# API Backend - Guia de pruebas endpoint por endpoint

Este documento lista los endpoints del backend para probarlos uno por uno.

## Base URL

- Local: `http://localhost:9001`
- Health check: `GET /health`
- Prefijo API: `/api`

## Autenticacion

Todos los endpoints (excepto `/health` y `/api/auth/*`) requieren header:

- `Authorization: Bearer <token>`

Obtienes el token desde `POST /api/auth/login`.

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

### GET `/api/certificate-requests/role-view?page=1&limit=10`

### GET `/api/certificate-requests/:id`

### GET `/api/certificate-requests/:id/pdf`

### POST `/api/certificate-requests`

El cliente titular se toma desde el objeto `client` del body.
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

- `code`
- `name` (nombre de cliente)
- `documentNumber`
- `location`
- `mz`
- `lot`
- `requestCode`
- `status=PorFirmar|PorRecoger|Entregado`

### GET `/api/certificates/:id`

### GET `/api/certificates/:id/preview`

### GET `/api/certificates/:id/pdf`

### POST `/api/certificates`

```json
{
  "clientId": 1,
  "requestId": 1,
  "sectorId": 1,
  "terrainTypeId": 1,
  "location": "Zona A",
  "mz": "MZ-01",
  "lot": "L-10",
  "status": "PorFirmar",
  "issuedAt": "2026-05-16T00:00:00.000Z",
  "deliveredAt": null
}
```

### PUT `/api/certificates/:id`

```json
{
  "sectorId": 1,
  "terrainTypeId": 1,
  "location": "Zona B",
  "mz": "MZ-02",
  "lot": "L-20",
  "status": "PorRecoger",
  "issuedAt": "2026-05-16T00:00:00.000Z",
  "deliveredAt": null
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

- `code`, `name`, `documentNumber`, `location`, `mz`, `lot`, `requestCode`, `status`

## Valores permitidos (enums)

- `clientType`: `Comunero`, `Tercero`
- `certificate status`: `PorFirmar`, `PorRecoger`, `Entregado`
- `request status`: `Pendiente`, `Aprobada`, `Rechazada`

## Roles base que se crean automaticamente

- `Admin`
- `Presidente`
- `AtencionCliente`

## Orden recomendado para pruebas 1 a 1

1. `POST /api/auth/login` (guardar token)
2. Crear usuarios con `POST /api/users`
3. Crear roles (`/api/roles`) si necesitas roles nuevos
4. Crear catalogos: sectors + terrain-types
5. Crear clients
6. Crear certificate-requests
7. Crear certificates
8. Crear assembly-record-requests
9. Probar previews/pdf/reportes/dashboard
