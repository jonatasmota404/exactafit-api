# Imagem de produção. Migrations rodam no start do contêiner (ADR 0010).
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma ./prisma
COPY prisma.config.ts tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npx prisma generate && npm run build

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/dist ./dist
COPY prisma ./prisma
COPY prisma.config.ts ./
USER node
EXPOSE 3000
# start-period cobre o tempo das migrations antes de a porta abrir
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT:-3000}/ >/dev/null || exit 1
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && exec node dist/main"]
