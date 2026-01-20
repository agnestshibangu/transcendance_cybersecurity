# Étape 1 : Build stage (compilation TypeScript)
FROM node:20-alpine AS builder

# Installer outils nécessaires pour compiler les dépendances natives
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copier fichiers de dépendances
COPY package*.json ./
COPY tsconfig.json ./

RUN echo "=== BUILD DOCKERFILE AUTHSERVICE ==="

# Installer toutes les dépendances (y compris dev)
RUN npm ci

RUN node -p "require('fs').existsSync('node_modules/@types/bcryptjs/index.d.ts')"
RUN ls -la node_modules/@types || true

# Copier le code source
COPY src ./src

# Compiler TypeScript → JavaScript (dist/)
RUN npx tsc

# Étape 2 : Runtime (production)
FROM node:20-alpine AS runner
WORKDIR /app

# Copier uniquement les fichiers nécessaires
COPY package*.json ./
RUN npm ci --omit=dev

# Copier le code compilé depuis le builder
COPY --from=builder /app/dist ./dist

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 3000

# Créer le dossier pour la base SQLite (monté en volume)
RUN mkdir -p /app/data

# Utiliser l'entrypoint qui charge les secrets
ENTRYPOINT ["/entrypoint.sh"]
