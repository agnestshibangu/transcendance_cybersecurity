# Étape unique : build du frontend
FROM node:20-alpine AS builder

WORKDIR /app/frontend

# Copier les fichiers de dépendances
COPY package*.json ./
RUN npm install

# Copier le code source
COPY . .

# Build tailwind
RUN npm run build
# compile TS to js
RUN npx tsc
# Copier le fichier HTML dans le dossier dist
RUN mkdir -p dist && cp src/index.html dist/index.html

# Copier les assets statiques (images, sons, favicons, etc.)
RUN cp -R public dist