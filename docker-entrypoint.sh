#!/bin/sh
set -e

echo "Running database migrations..."
npx prisma migrate deploy

if [ -z "$FORCE_SEEDS" ]; then
  node -e "
    const{PrismaClient}=require('@prisma/client');
    new PrismaClient().client.count().then(c=>process.exit(c>0?0:1)).catch(()=>process.exit(1))
  " && {
    echo "Base de datos con datos. Saltando seeds (usa FORCE_SEEDS=true para forzar)."
    exec node src/server.js
  }
fi

echo "Running seeders..."
node prisma/seed/index.js

echo "Starting server..."
exec node src/server.js