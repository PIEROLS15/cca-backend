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
  seed/                     # Scripts de carga inicial de datos
  schema.prisma             # Modelos y enums
src/
  api/                      # Modulos de negocio por recurso
    auth/
      controllers/
      routes/
      services/
      utils/
    users/
      controllers/
      routes/
      services/
      utils/
    roles/
      controllers/
      routes/
      services/
      utils/
    clients/
      controllers/
      routes/
      services/
      utils/
    certificate-requests/
      controllers/
      routes/
      services/
      utils/
    certificates/
      controllers/
      routes/
      services/
      utils/
    assembly-record-requests/
      controllers/
      routes/
      services/
      utils/
    sectors/
      controllers/
      routes/
      services/
      utils/
    terrain-types/
      controllers/
      routes/
      services/
      utils/
    reports/
      controllers/
      routes/
      services/
      utils/
    dashboard/
      controllers/
      routes/
      services/
      utils/
    public/
      controllers/
      routes/
  config/
    prisma.js                 # Instancia Prisma Client
  constants/                  # Constantes de dominio
  middlewares/                # auth, roles, manejo de errores
  pdf/                        # Plantillas PDF
  utils/                      # Respuestas, paginacion, helpers
  assets/                     # Recursos estaticos del backend
  app.js                      # Configuracion Express
  server.js                   # Punto de arranque
Dockerfile
docker-compose.yml
docker-entrypoint.sh
API-ENDPOINTS-BACKEND.md
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
- **Backend** en el puerto interno `9001` y expuesto en el puerto configurado (`BACKEND_PORT`)

El arranque ya no ejecuta migraciones ni seeds automaticamente.

### Pruebas con Docker

Usa el entorno de test cuando quieras validar cambios antes de desplegar.
Ese compose usa un nombre de proyecto distinto, asi que no comparte contenedores ni volumenes con tu entorno local.

```bash
docker compose -p cca-backend-test -f docker-compose.test.yml up -d db backend
docker compose -p cca-backend-test -f docker-compose.test.yml exec backend npm run prisma:migrate:deploy
docker compose -p cca-backend-test -f docker-compose.test.yml exec backend npm run prisma:seed
docker compose -p cca-backend-test -f docker-compose.test.yml exec backend npm test
```

Para limpiar el entorno de pruebas:

```bash
docker compose -p cca-backend-test -f docker-compose.test.yml down -v
```

El script `deploy/test/deploy.sh` usa el mismo flujo para recrear la BD, aplicar migraciones, sembrar datos y correr la app de pruebas.

### Despliegue en VPS

Para produccion usamos release por carpeta y rollback seguro.

Estructura esperada:

```bash
/opt/app/backend/current
/opt/app/backend/releases/<sha>
/opt/app/backend/shared/.env
/opt/app/backups/db
```

Antes del primer deploy crea el archivo `/opt/app/backend/shared/.env` con las variables de entorno reales del backend y la base de datos, usando `.env.example` como base.

Tambien debes crear la red Docker compartida una sola vez:

```bash
docker network create cca_backend_net
```

Y levantar la base de datos una sola vez:

```bash
docker compose -f docker-compose.db.yml up -d
```

La base de datos se levanta con `docker-compose.db.yml` y el backend de produccion con `docker-compose.prod.yml`.
El workflow `deploy-backend.yml` sube un release nuevo, valida `/health`, hace backup de la DB, aplica `prisma migrate deploy` y solo despues promueve el release.
Recuerda que `BACKEND_PORT` define el puerto expuesto en el host, mientras que el backend dentro del contenedor escucha siempre en `9001`.
Para conectar DBeaver usa SSH tunnel contra `127.0.0.1:${POSTGRES_PORT}` en el VPS; el puerto solo queda abierto en localhost.

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

## CI

El backend incluye un workflow de GitHub Actions en `.github/workflows/ci.yml`.

### Disparadores

- `push` a `main` y `dev`
- `pull_request` hacia `main` y `dev`

### Pasos del pipeline

1. Checkout del repositorio.
2. Configuracion de `pnpm` 10.
3. Configuracion de Node.js 22 con cache de `pnpm`.
4. Instalacion con `pnpm install --frozen-lockfile`.
5. Generacion del Prisma Client.
6. Aplicacion de migraciones con `prisma migrate deploy`.
7. Verificacion de version de Prisma.
8. Ejecucion condicional de `lint`, `build` y `test` si existen scripts.

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

Tambien puedes usar `GET /api/health` por compatibilidad con los frontends.

En produccion, si compartes la cookie de sesion entre `comunidadcampesina-asia.com` y
`seguimiento.comunidadcampesina-asia.com`, define `COOKIE_DOMAIN=comunidadcampesina-asia.com`.

---

## Scripts disponibles

```bash
pnpm run dev                # Ejecuta con nodemon
pnpm run start              # Ejecuta en modo produccion
pnpm run prisma:generate    # Genera Prisma Client
pnpm run prisma:migrate     # Ejecuta prisma migrate dev
pnpm run prisma:migrate:deploy # Aplica migraciones en entornos de despliegue
pnpm run prisma:seed        # Ejecuta el seed del backend
pnpm run prisma:studio      # Abre Prisma Studio
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
