FROM node:22-bookworm-slim AS frontend-build

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
ENV VITE_API_BASE_URL=/api
RUN npm run build

FROM node:22-bookworm-slim AS backend-build

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app/backend

COPY backend/package*.json ./
COPY backend/prisma ./prisma
RUN npm ci
RUN npx prisma generate

COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build

FROM node:22-bookworm-slim AS runner

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV FRONTEND_DIST_PATH=/app/public
ENV NODE_OPTIONS=--dns-result-order=ipv4first

COPY backend/package*.json ./
COPY backend/prisma ./prisma
RUN npm ci --omit=dev
RUN npx prisma generate

COPY --from=backend-build /app/backend/dist ./dist
COPY backend/assets ./assets
COPY --from=frontend-build /app/frontend/dist ./public

COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN sed -i 's/\r$//' /app/docker-entrypoint.sh && chmod +x /app/docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["sh", "-c", "npx prisma migrate deploy && node prisma/seed.cjs && npm run start"]
