FROM node:20-alpine AS builder
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./

RUN echo "=== BUILD DOCKERFILE DBWRITER ==="

RUN npm ci

COPY src ./src

RUN npm run build

RUN npm prune --omit=dev

FROM node:20-alpine AS runner

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules

COPY package*.json ./

COPY --from=builder /app/dist ./dist

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 4000

RUN mkdir -p /app/data

ENTRYPOINT ["/entrypoint.sh"]
