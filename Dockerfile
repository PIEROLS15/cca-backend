FROM node:20-alpine AS deps

RUN apk add --no-cache openssl
RUN corepack enable && corepack prepare pnpm@10 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY prisma ./prisma
RUN pnpm prisma generate

FROM node:20-alpine

RUN apk add --no-cache openssl

ENV NODE_ENV=production

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN sed -i 's/\r$//' /docker-entrypoint.sh && chmod +x /docker-entrypoint.sh

COPY src ./src
COPY package.json ./

EXPOSE 9001

HEALTHCHECK --interval=10s --timeout=3s --start-period=40s --retries=5 CMD node -e "fetch('http://127.0.0.1:9001/health').then((res) => process.exit(res.ok ? 0 : 1)).catch(() => process.exit(1))"

ENTRYPOINT ["sh", "/docker-entrypoint.sh"]
