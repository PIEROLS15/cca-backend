# Comunidad Campesina Asia - Backend

[![CI](https://github.com/PIEROLS15/cca-backend/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/PIEROLS15/cca-backend/actions/workflows/ci.yml)
![Node.js](https://img.shields.io/badge/node-%3E%3D20-green)
![Express](https://img.shields.io/badge/express-5.x-black)
![Prisma](https://img.shields.io/badge/prisma-6.16.2-2D3748)
![License: ISC](https://img.shields.io/badge/license-ISC-blue)

Backend modular construido con **Express + Prisma** para el sistema de gestion comunal.
Incluye autenticacion JWT, control por roles/permisos, generacion de PDF y reportes.

---

## Tecnologias principales

- [Node.js 20+](https://nodejs.org/) - Entorno de ejecucion del servidor.
- [Express 5](https://expressjs.com/) - Framework HTTP para APIs REST.
- [Prisma ORM](https://www.prisma.io/) - Modelado y acceso a datos.
- [PostgreSQL](https://www.postgresql.org/) - Base de datos relacional.
- [JWT](https://jwt.io/) - Autenticacion basada en token.
- [PDFKit](https://pdfkit.org/) + [bwip-js](https://github.com/metafloor/bwip-js) - PDFs con formato y codigos.
- [xlsx](https://www.npmjs.com/package/xlsx) - Exportacion de reportes.
- [GitHub Actions](https://docs.github.com/en/actions) - CI.

---

## Estructura del proyecto

```bash
prisma/
  migrations/               # Migraciones de base de datos
  schema.prisma             # Modelos y enums
src/
  api/                      # Modulos de negocio por recurso
    auth/
    users/
    roles/
    clients/
    certificate-requests/
    certificates/
    assembly-record-requests/
    sectors/
    terrain-types/
    reports/
    dashboard/
  config/
    prisma.js               # Instancia Prisma Client
  middlewares/              # auth, roles, manejo de errores
  pdf/                      # Plantillas PDF
  utils/                    # Respuestas, paginacion, helpers
  app.js                    # Configuracion Express
  server.js                 # Punto de arranque
```

---

## Instalacion

### Prerequisitos

- Node.js 20 o superior
- pnpm instalado globalmente
- PostgreSQL en ejecucion

Verifica versiones:

```bash
node -v
pnpm -v
```

### Configuracion del proyecto

1. Clona el repositorio y entra al backend:

```bash
git clone https://github.com/PIEROLS15/comunidad-campesina-asia.git
cd comunidad-campesina-asia/cca-backend
```

2. Instala dependencias:

```bash
pnpm install
```

3. Crea el archivo `.env` en la raiz de `cca-backend`:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/comunidad_campesina_asia"
PORT=3000
JWT_SECRET="dev-secret"
```

4. Genera cliente Prisma y aplica migraciones:

```bash
pnpm prisma generate
pnpm prisma migrate dev
```

---

## Docker

### Prerequisitos

- [Docker](https://docs.docker.com/engine/install/) y [Docker Compose](https://docs.docker.com/compose/install/) instalados.

### Primer despliegue

1. Crea el archivo `.env` en la raiz de `cca-backend` usando `.env.example` como referencia:

```bash
cp .env.example .env
# Edita las variables segun tu entorno
```

2. Construye e inicia los contenedores:

```bash
docker compose up -d --build
```

Esto levanta:
- **PostgreSQL 16** en el puerto configurado (`POSTGRES_PORT`)
- **Backend** en el puerto configurado (`BACKEND_PORT`)

El arranque ya no ejecuta migraciones ni seeds automaticamente.

### Migrar manualmente

```bash
docker compose exec backend npm run prisma:migrate:deploy
```

### Ejecutar seeds manualmente

```bash
docker compose exec backend npm run prisma:seed
```

Si quieres forzar reimportaciones masivas, usa `FORCE_SEEDS=true` solo al ejecutar `docker compose exec backend npm run prisma:seed`.

### Seed data

Los siguientes datos se importan con `docker compose exec backend npm run prisma:seed` (o con `FORCE_SEEDS=true docker compose exec backend npm run prisma:seed`):

| Seed | Origen | Registros aprox. |
|---|---|---|
| Roles | Fijo (`prisma/seed/roles.js`) | 8 |
| Usuarios | Fijo (`prisma/seed/users.js`) | 1 (admin) |
| Sectores | API externa | 71 |
| Tipos de terreno | API externa | 13 |
| Clientes | API externa (2 endpoints) | ~8600 |
| Usuarios anteriores | JSON local (`prisma/seed/users-data.json`) | 14 |
| Solicitudes de certificados | API externa (paginada) | ~3400 |
| Certificados | API externa (paginada) | ~9200 |
| Solicitudes de acta de asamblea | API externa (paginada) | ~80 |

---

## Desarrollo

Inicia el servidor en modo desarrollo:

```bash
pnpm run dev
```

Servidor por defecto: `http://localhost:3000`

Healthcheck:

```bash
GET /health
```

---

## Scripts disponibles

```bash
pnpm run dev               # Ejecuta con nodemon
pnpm run start             # Ejecuta en modo produccion
pnpm run prisma:generate   # Genera Prisma Client
pnpm run prisma:migrate    # Ejecuta prisma migrate dev
pnpm run prisma:studio     # Abre Prisma Studio
```

---

## Contribucion

1. Crea una rama para tu cambio (`feature/...` o `fix/...`).
2. Mantiene la estructura modular por recurso en `src/api`.
3. Si cambias modelo de datos, incluye migracion Prisma.
4. Actualiza `API-ENDPOINTS-BACKEND.md` si cambian contratos.
5. Abre un Pull Request con descripcion clara.

---

## Licencia

Este proyecto usa licencia **ISC**.

---

Desarrollado por [PIEROLS15](https://github.com/PIEROLS15)
