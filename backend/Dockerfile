FROM node:22-alpine AS deps

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=deps /app/dist ./dist
COPY --from=deps /app/prisma ./prisma
COPY assets ./assets

EXPOSE 4000
CMD ["npm", "run", "start"]
