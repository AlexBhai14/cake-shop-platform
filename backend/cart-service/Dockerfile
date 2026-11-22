# ---- Stage 1: build ----
FROM node:26-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate && npm run build

# ---- Stage 2: run ----
FROM node:26-alpine
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json
EXPOSE 3004
# Apply pending migrations, then start the service
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
