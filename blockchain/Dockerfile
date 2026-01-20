# Utilise Node 20 pour ESM + Hardhat 3
FROM node:22-alpine

WORKDIR /app/content

# Copier package.json et package-lock.json pour installer les dépendances
COPY package*.json /app/
#RUN npm ci
RUN npm ci --legacy-peer-deps

# Copier le reste du code Hardhat
COPY ./content .

# Compilation avec la version locale
RUN /app/node_modules/.bin/hardhat compile

# Lancer le node Hardhat
CMD ["/app/node_modules/.bin/hardhat", "node"]
