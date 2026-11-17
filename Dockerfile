# Сборка фронтенда и локальных шрифтов / WASM
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build

# Финальный легковесный образ без логов IP и без внешних зависимостей (Zero-PII / 152-ФЗ)
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
ENV DATA_DIR=/data

RUN mkdir -p /data && chown -R node:node /data /app

COPY --from=builder --chown=node:node /app/dist ./dist
COPY --chown=node:node server.mjs ./server.mjs

USER node
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1

CMD ["node", "server.mjs"]
