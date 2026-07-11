# API Backend

## Base
- Local: `http://localhost:9001`
- Prefix: `/api`
- Health: `GET /health` o `GET /api/health`

## Auth
Todos los endpoints, salvo `/health`, `/api/health` y `/api/auth/login`, requieren autenticacion.
El login crea una cookie httpOnly `token` y tambien puedes usar `Authorization: Bearer <token>`.

### POST `/api/auth/login`
Inicia sesion y devuelve el usuario autenticado.

Body:
```json
{ "username": "pierols", "password": "123456" }
```

Response:
```json
{
  "user": {
    "id": 1,
    "username": "pierols",
    "fullName": "Piero Llanos Sanchez",
    "email": "piero@gmail.com",
    "dni": "73171545",
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
Cierra la sesion actual.

### GET `/api/auth/me`
Devuelve el usuario autenticado actual.

Response:
```json
{
  "user": {
    "id": 1,
    "username": "pierols",
    "fullName": "Piero Llanos Sanchez",
    "email": "piero@gmail.com",
    "dni": "73171545",
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

### PATCH `/api/auth/profile`
Actualiza el perfil del usuario autenticado.

Body:
```json
{ "fullName": "Nombre Completo", "username": "usuario", "email": "correo@dominio.com" }
```

### POST `/api/auth/change-password`
Cambia la clave del usuario autenticado.

Body:
```json
{ "currentPassword": "123456", "newPassword": "nueva-clave" }
```

### POST `/api/auth/verify-password`
Verifica la clave actual antes de cambiarla.

Body:
```json
{ "password": "123456" }
```

## Pagination
Los listados usan paginacion.

Query comunes:
- `page` default `1`
- `limit` default `10`, maximo `100`

Respuesta:
```json
{
  "message": "...",
  "error": false,
  "status": 200,
  "data": [],
  "total": 0,
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

## Roles
Ruta base: `/api/roles`

### GET `/api/roles`
Lista roles con permisos.

Example response:
```json
{
  "message": "Roles encontrados correctamente",
  "error": false,
  "status": 200,
  "data": [
    {
      "id": 1,
      "name": "Admin",
      "description": "Acceso total al sistema",
      "group": 1,
      "permissions": [],
      "createdAt": "2026-05-18T23:55:52.452Z",
      "updatedAt": "2026-05-18T23:55:52.452Z"
    }
  ],
  "total": 8,
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

### GET `/api/roles/:id`
Devuelve un rol especifico por ID.

### GET `/api/roles/:id/delete-preview`
Muestra el impacto de borrar un rol.

### POST `/api/roles`
Crea un nuevo rol con permisos.

Body:
```json
{
  "name": "Secretaria",
  "description": "Gestion documentaria",
  "permissions": [
    { "key": "certificates.read", "description": "Leer certificados" }
  ]
}
```

### PUT `/api/roles/:id`
Actualiza un rol existente.

### DELETE `/api/roles/:id`
Borra un rol si no tiene dependencias.

## Users
Ruta base: `/api/users`

### GET `/api/users`
Lista usuarios con paginacion y filtros.

Filtros:
- `roleId`
- `isActive`
- `search`

Example response:
```json
{
  "message": "Usuarios encontrados correctamente",
  "error": false,
  "status": 200,
  "data": [
    {
      "id": 1,
      "username": "pierols",
      "fullName": "Piero Llanos Sanchez",
      "email": "piero@gmail.com",
      "dni": "73171545",
      "isActive": true,
      "certificateRangeStart": null,
      "certificateRangeEnd": null,
      "lastCertificate": null,
      "role": {
        "id": 1,
        "name": "Admin",
        "description": "Acceso total al sistema",
        "group": 1,
        "permissions": []
      },
      "createdAt": "2026-05-18T23:55:52.452Z",
      "updatedAt": "2026-05-18T23:55:52.452Z"
    }
  ],
  "total": 16,
  "limit": 10,
  "totalPages": 2,
  "page": 1,
  "pagingCounter": 1,
  "hasPrevPage": false,
  "hasNextPage": true,
  "prevPage": null,
  "nextPage": 2
}
```

### GET `/api/users/:id`
Devuelve un usuario por ID.

### POST `/api/users`
Crea un usuario nuevo.

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
Actualiza un usuario existente.

Body puede incluir:
`username`, `password`, `fullName`, `email`, `dni`, `roleId`, `certificateRangeStart`, `certificateRangeEnd`

### PATCH `/api/users/:id/status`
Activa o desactiva un usuario.

Body:
```json
{ "isActive": false }
```

### DELETE `/api/users/:id`
Borra un usuario del sistema.

## Sectors
Ruta base: `/api/sectors`

### GET `/api/sectors`
Lista sectores con paginacion.

Example response:
```json
{
  "message": "Sectores encontrados correctamente",
  "error": false,
  "status": 200,
  "data": [
    {
      "id": 1,
      "name": "SANTA CRUZ DE ASIA",
      "createdAt": "2026-06-18T03:15:28.000Z",
      "updatedAt": "2026-06-18T03:15:28.000Z"
    }
  ],
  "total": 72,
  "limit": 10,
  "totalPages": 8,
  "page": 1,
  "pagingCounter": 1,
  "hasPrevPage": false,
  "hasNextPage": true,
  "prevPage": null,
  "nextPage": 2
}
```

### GET `/api/sectors/:id`
Devuelve un sector por ID.

### GET `/api/sectors/:id/delete-preview`
Muestra el impacto de borrar un sector.

### POST `/api/sectors`
Crea un sector nuevo.

Body:
```json
{ "name": "Sector Norte" }
```

### PUT `/api/sectors/:id`
Actualiza el nombre de un sector.

Body:
```json
{ "name": "Sector Norte A" }
```

### DELETE `/api/sectors/:id`
Borra un sector si no tiene certificados asociados.

## Terrain Types
Ruta base: `/api/terrain-types`

### GET `/api/terrain-types`
Lista tipos de terreno con su configuracion.

Example response:
```json
{
  "message": "Tipos de terreno encontrados correctamente",
  "error": false,
  "status": 200,
  "data": [
    {
      "id": 1,
      "name": "VIVIENDA",
      "terrainTypeConfigId": 3,
      "config": {
        "id": 3,
        "key": "RECTANGULAR_WITH_OPTIONS",
        "label": "Rectangular con opciones",
        "formMode": "RECTANGULAR_AUTO",
        "showMzLot": true,
        "allowAdditionalMeasure": true,
        "allowAreaPerimeterToggle": true,
        "createdAt": "2026-06-18T03:15:28.887Z",
        "updatedAt": "2026-06-18T03:15:28.887Z"
      },
      "createdAt": "2026-06-18T03:15:28.887Z",
      "updatedAt": "2026-06-18T03:15:28.887Z"
    }
  ],
  "total": 13,
  "limit": 10,
  "totalPages": 2,
  "page": 1,
  "pagingCounter": 1,
  "hasPrevPage": false,
  "hasNextPage": true,
  "prevPage": null,
  "nextPage": 2
}
```

### GET `/api/terrain-types/:id`
Devuelve un tipo de terreno por ID.

### GET `/api/terrain-types/:id/delete-preview`
Muestra el impacto de borrar un tipo de terreno.

### POST `/api/terrain-types`
Crea un nuevo tipo de terreno.

Body:
```json
{ "name": "Vivienda" }
```

### PUT `/api/terrain-types/:id`
Actualiza un tipo de terreno existente.

Body:
```json
{ "name": "Residencial" }
```

### DELETE `/api/terrain-types/:id`
Borra un tipo de terreno si no tiene certificados asociados.

## Clients
Ruta base: `/api/clients`

### GET `/api/clients`
Lista clientes con paginacion y filtros.

Filtros:
- `clientType=Comunero|Tercero`
- `search`
- `documentNumber`

Example response:
```json
{
  "message": "Clientes encontrados correctamente",
  "error": false,
  "status": 200,
  "data": [
    {
      "id": 1,
      "fullName": "Arias Aburto, Olga Lidia",
      "documentNumber": "80093634",
      "address": "Asia",
      "phone": null,
      "clientType": "Comunero",
      "nro_licence": "0001",
      "licenseSequence": 1,
      "createdAt": "2026-05-25T23:46:15.722Z",
      "updatedAt": "2026-05-25T23:46:15.722Z"
    }
  ],
  "total": 10491,
  "limit": 10,
  "totalPages": 1050,
  "page": 1,
  "pagingCounter": 1,
  "hasPrevPage": false,
  "hasNextPage": true,
  "prevPage": null,
  "nextPage": 2
}
```

### GET `/api/clients/search/:document`
Busca un cliente local por documento.

### GET `/api/clients/reniec/:document`
Consulta RENIEC para un documento de 8 digitos.

### GET `/api/clients/:id`
Devuelve un cliente por ID.

### GET `/api/clients/:id/delete-preview`
Muestra las dependencias del cliente antes de borrarlo.

### POST `/api/clients`
Crea un cliente nuevo.

Body:
```json
{
  "fullName": "Juan Perez",
  "documentNumber": "12345678",
  "address": "Av. Principal 123",
  "phone": "999888777",
  "isComunero": true
}
```

### PUT `/api/clients/:id`
Actualiza un cliente existente.

Mismo cuerpo que `POST`.

### DELETE `/api/clients/:id`
Borra un cliente si no tiene dependencias.

## Certificate Requests
Ruta base: `/api/certificate-requests`

### GET `/api/certificate-requests`
Lista solicitudes de certificado con paginacion.

Filtro:
- `search`

Example response:
```json
{
  "message": "Solicitudes de certificado encontradas correctamente",
  "error": false,
  "status": 200,
  "data": [
    {
      "id": 1,
      "requestNumber": "003223-26",
      "isComunero": true,
      "destination": "Ingeniero",
      "requestDescription": "Solicito emision de certificado.",
      "sectorLocation": "VILLA DEL MAR - ETAPA II",
      "client": {
        "id": 1,
        "searchType": "Reniec",
        "fullName": "Arias Aburto, Olga Lidia",
        "documentNumber": "80093634",
        "address": "Asia",
        "nro_licence": "0001"
      },
      "partnerClient": {
        "id": null,
        "searchType": "",
        "fullName": "",
        "documentNumber": "",
        "address": "",
        "nro_licence": null
      },
      "certificateTypes": [
        { "type": "CertificadoPosesion" }
      ],
       "exposure": "Solicito certificado de posesion.",
       "attachments": [
         { "type": "CopiaDni" }
       ],
       "status": "En Proceso",
       "createdBy": { "dni": "00000258", "role": "Atencion" },
       "createdAt": "2026-05-18T20:35:20.000Z",
       "updatedAt": "2026-05-18T20:35:20.000Z"
     }
  ],
  "total": 3803,
  "limit": 10,
  "totalPages": 381,
  "page": 1,
  "pagingCounter": 1,
  "hasPrevPage": false,
  "hasNextPage": true,
  "prevPage": null,
  "nextPage": 2
}
```

### GET `/api/certificate-requests/download/:filename`
Descarga el PDF de una solicitud.

### GET `/api/certificate-requests/:id`
Devuelve una solicitud por ID o numero, incluyendo `status`.

### GET `/api/certificate-requests/:id/delete-preview`
Muestra el impacto de borrar la solicitud.

### POST `/api/certificate-requests`
Crea una nueva solicitud de certificado.

Body:
```json
{
  "isComunero": true,
  "destination": "Ingeniero",
  "requestDescription": "Solicito emision de certificado.",
  "sectorLocation": "VILLA DEL MAR - ETAPA II",
  "client": {
    "fullName": "Arias Aburto, Olga Lidia",
    "documentNumber": "80093634",
    "address": "Asia"
  },
  "partnerClient": {
    "fullName": "",
    "documentNumber": "",
    "address": ""
  },
  "certificateTypes": [
    { "type": "CertificadoPosesion" }
  ],
  "exposure": "Solicito certificado de posesion.",
  "attachments": [
    { "type": "CopiaDni" }
  ]
}
```

### PUT `/api/certificate-requests/:id`
Actualiza una solicitud existente.
Si el body incluye solo `status`, se permite el cambio rapido igual que en certificados.

### DELETE `/api/certificate-requests/:id`
Borra una solicitud si no tiene certificados asociados.

## Certificates
Ruta base: `/api/certificates`

### GET `/api/certificates`
Lista certificados con filtros y paginacion.

Filtros:
- `certificateNumber`
- `requestNumber`
- `name`
- `documentNumber`
- `mz`
- `lot`
- `status`
- `sectorId`
- `terrainTypeId`
- `createdByRoleId`
- `search`

Example response:
```json
{
  "message": "Certificados encontrados correctamente",
  "error": false,
  "status": 200,
  "data": [
    {
      "id": 1,
      "certificateNumber": "024126",
      "requestNumber": "003812-26",
      "owners": [
        {
          "id": 5428,
          "fullName": "Luis Enrique Ramos Arias",
          "documentNumber": "15361523",
          "order": 1,
          "source": "primary"
        }
      ],
      "terrain": {
        "terrainType": {
          "id": 4,
          "name": "VIVIENDA",
          "terrainTypeConfigId": 3,
          "config": {
            "id": 3,
            "key": "RECTANGULAR_WITH_OPTIONS",
            "label": "Rectangular con opciones",
            "formMode": "RECTANGULAR_AUTO",
            "showMzLot": true,
            "allowAdditionalMeasure": true,
            "allowAreaPerimeterToggle": true,
            "createdAt": "2026-06-18T03:15:28.887Z",
            "updatedAt": "2026-06-18T03:15:28.887Z"
          }
        },
        "width": 10,
        "length": 20,
        "totalArea": 200,
        "area": null,
        "perimeter": null,
        "additionalWidth": null,
        "additionalLength": null,
        "measurementModeUsed": "RECTANGULAR_AUTO"
      },
      "location": {
        "sectors": { "id": 15, "name": "VIGARAY" },
        "mz": "LL-A",
        "lot": "6"
      },
      "borders": {
        "north": "LOTE 11",
        "south": "CALLE VICENTE AVALOS",
        "east": "LOTE 07 Y 08",
        "west": "LOTE 05"
      },
      "status": "Por Firmar",
      "createdBy": { "dni": "22222222", "role": "Presidente" },
      "createdAt": "2026-07-06T17:55:18.232Z",
      "updatedAt": "2026-07-06T17:55:18.255Z"
    }
  ],
  "total": 23840,
  "limit": 10,
  "totalPages": 2384,
  "page": 1,
  "pagingCounter": 1,
  "hasPrevPage": false,
  "hasNextPage": true,
  "prevPage": null,
  "nextPage": 2
}
```

### GET `/api/certificates/download/:filename`
Descarga el PDF de un certificado.

### GET `/api/certificates/by-number/:number`
Busca un certificado por numero exacto.

### GET `/api/certificates/:id`
Devuelve un certificado por ID.

### GET `/api/certificates/:id/pdf`
Descarga el PDF de un certificado por ID.

### GET `/api/certificates/:id/delete-preview`
Muestra las dependencias antes de borrar.

### POST `/api/certificates`
Crea un certificado nuevo.

Body:
```json
{
  "owners": [{ "id": 1 }, { "id": 2 }],
  "terrain": {
    "terrainType": { "id": 1 },
    "width": 10.5,
    "length": 20,
    "totalArea": 210
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
    "west": "CALLE PRINCIPAL"
  },
  "requestNumber": "003223-26",
  "certificateRequestId": 1
}
```

### PUT `/api/certificates/:id`
Actualiza un certificado existente.

### DELETE `/api/certificates/:id`
Borra un certificado si no tiene dependencias.

## Assembly Record Requests
Ruta base: `/api/assembly-record-requests`

### GET `/api/assembly-record-requests`
Lista solicitudes de acta con paginacion.

Filtro:
- `search`

Example response:
```json
{
  "message": "Solicitudes de acta encontradas correctamente",
  "error": false,
  "status": 200,
  "data": [
    {
      "id": 1,
      "code": "SOL-ACTA-000001",
      "client": {
        "id": 1,
        "fullName": "Arias Aburto, Olga Lidia",
        "documentNumber": "80093634"
      },
      "certificate": {
        "id": 1,
        "certificateNumber": "000001"
      },
      "description": "Solicitud de acta de asamblea",
      "status": "En Proceso",
      "createdAt": "2026-05-18T20:35:20.000Z",
      "updatedAt": "2026-05-18T20:35:20.000Z"
    }
  ],
  "total": 242,
  "limit": 10,
  "totalPages": 25,
  "page": 1,
  "pagingCounter": 1,
  "hasPrevPage": false,
  "hasNextPage": true,
  "prevPage": null,
  "nextPage": 2
}
```

### GET `/api/assembly-record-requests/download/:filename`
Descarga el PDF de una solicitud de acta.

### GET `/api/assembly-record-requests/:id`
Devuelve una solicitud de acta por ID, incluyendo `status`.

### GET `/api/assembly-record-requests/:id/preview`
Genera un resumen rapido de la solicitud.

Example response:
```json
{
  "code": "SOL-ACTA-000001",
  "client": "Arias Aburto, Olga Lidia",
  "certificateNumber": "000001",
  "preview": "Solicitud SOL-ACTA-000001 basada en certificado 000001"
}
```

### GET `/api/assembly-record-requests/:id/pdf`
Descarga el PDF de la solicitud por ID.

### GET `/api/assembly-record-requests/:id/delete-preview`
Muestra el impacto de borrar la solicitud.

### POST `/api/assembly-record-requests`
Crea una solicitud de acta de asamblea.

Body:
```json
{
  "clientId": 1,
  "certificateId": 1,
  "description": "Solicitud de acta de asamblea"
}
```

### PUT `/api/assembly-record-requests/:id`
Actualiza una solicitud de acta.
Si el body incluye solo `status`, se permite el cambio rapido igual que en certificados.

### DELETE `/api/assembly-record-requests/:id`
Borra una solicitud de acta.

## Dashboard
Ruta base: `/api/dashboard`

### GET `/api/dashboard/summary`
Devuelve los totales principales del sistema.

Example response:
```json
{
  "certificates": 23840,
  "clients": 10491,
  "comuneros": 4780,
  "terceros": 5711,
  "terrainTypes": 13,
  "sectors": 72
}
```

### GET `/api/dashboard/status-breakdown`
Agrupa certificados por estado.

Query opcional:
- `from=YYYY-MM-DD`
- `to=YYYY-MM-DD`

Example response:
```json
[
  { "name": "Por firmar", "value": 5, "color": "oklch(0.6 0.22 25)" },
  { "name": "Por recoger", "value": 3, "color": "oklch(0.78 0.16 75)" },
  { "name": "Entregado", "value": 12, "color": "oklch(0.65 0.16 155)" }
]
```

### GET `/api/dashboard/monthly-activity`
Resume la actividad por mes.

Query opcional:
- `from=YYYY-MM-DD`
- `to=YYYY-MM-DD`

Example response:
```json
[
  { "mes": "Ene", "certificados": 120, "solicitudesCert": 60, "solicitudesActa": 25 },
  { "mes": "Feb", "certificados": 145, "solicitudesCert": 71, "solicitudesActa": 30 }
]
```

### GET `/api/dashboard/recent-activity`
Devuelve las ultimas actividades registradas.

Example response:
```json
[
  { "id": "cert-1", "usuario": "Piero Llanos Sanchez", "accion": "generó el certificado 000001 para Juan Perez", "cuando": "2026-07-06T00:00:00.000Z" },
  { "id": "creq-1", "usuario": "Atencion Cliente", "accion": "registró la solicitud 003223-26 para Juan Perez", "cuando": "2026-07-05T00:00:00.000Z" }
]
```

## Reports
Ruta base: `/api/reports`

### GET `/api/reports/certificates`
Exporta el reporte de certificados a Excel.

Acepta los mismos filtros que `GET /api/certificates`.

Example request:
```bash
GET /api/reports/certificates?status=Entregado&sectorId=1
```

Response: archivo `reporte-certificados.xlsx`

## Public
Ruta base: `/api/public`

### GET `/api/public/certificates/:token`
Verifica un certificado por su token publico.

Example response:
```json
{
  "message": "Certificado verificado correctamente",
  "error": false,
  "status": 200,
  "data": {
    "certificateNumber": "000001",
    "owners": [
      { "fullName": "Juan Perez", "documentNumber": "12345678" }
    ],
    "terrain": {
      "terrainType": { "name": "VIVIENDA" },
      "width": 10,
      "length": 20,
      "totalArea": 200,
      "area": null,
      "perimeter": null,
      "additionalWidth": null,
      "additionalLength": null
    },
    "sector": "VIGARAY",
    "location": { "mz": "L-2", "lot": "7" },
    "borders": {
      "north": "LOTE 6",
      "south": "LOTE 8",
      "east": "LOTE 5",
      "west": "CALLE PRINCIPAL"
    },
    "createdAt": "2026-05-18T20:35:20.000Z"
  }
}
```

### GET `/api/public/tracking/:documentType/:code`
Consulta un documento y devuelve su informacion basica, estado actual e historial.

`documentType` admite alias como `certificado`, `solicitud-certificado`, `solicitud-de-certificado`, `acta`, `solicitud-acta`.

Example response:
```json
{
  "message": "Documento consultado correctamente",
  "error": false,
  "status": 200,
  "data": {
    "documentType": "certificate",
    "title": "Certificado",
    "code": "023665",
    "currentStatus": "Por firmar",
    "information": {
      "people": [
        {
          "role": "Titular",
          "fullName": "ACOSTA ALFARO, DIANA CLAUDIA",
          "documentNumber": "43422119"
        }
      ],
      "fields": [
        { "label": "Ubicación", "value": "Santa Rosa Praderas" },
        { "label": "Tipo de terreno", "value": "Vivienda" },
        { "label": "Manzana", "value": "I-2" },
        { "label": "Lote", "value": "5" }
      ]
    },
    "history": [
      { "status": "Por firmar", "date": "2026-05-15T17:07:00.000Z", "done": true },
      { "status": "Por recoger", "date": null, "done": false },
      { "status": "Entregado", "date": null, "done": false }
    ]
  }
}
```

## Notes
- `page` y `limit` aplican a todos los listados.
- Los archivos PDF se sirven `inline`.
- Los exports de reportes se descargan como archivo `.xlsx`.
