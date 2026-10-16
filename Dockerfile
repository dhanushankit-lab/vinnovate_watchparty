FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY shared/package*.json ./shared/
COPY server/package*.json ./server/
COPY client/package*.json ./client/

RUN npm install

COPY shared ./shared
COPY server ./server
COPY client ./client

RUN npm run build --workspace=shared
RUN npm run build --workspace=server
RUN npm run build --workspace=client

FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/shared/package*.json ./shared/
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/server/package*.json ./server/
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/src/catalog ./server/dist/catalog
COPY --from=builder /app/client/dist ./client/dist

RUN npm install --omit=dev

EXPOSE 4000

CMD ["node", "server/dist/index.js"]
