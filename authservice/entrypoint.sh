#!/bin/sh
set -e

VAULT_SECRETS=/secrets
TMP_SECRETS=/tmp/secrets
mkdir -p "$TMP_SECRETS"

# Copier depuis le bon fichier
cp "$VAULT_SECRETS/authservice.env" "$TMP_SECRETS/authservice.env"
chmod 600 "$TMP_SECRETS/authservice.env"

while IFS='=' read -r key value; do
  [ -z "$key" ] && continue
  export "$key=$value"
done < "$TMP_SECRETS/authservice.env"

# Vérification
# echo "AUTH_SERVICE_URL=${AUTH_SERVICE_URL:-missing}"
# echo "FRONTEND_URL=${FRONTEND_URL:-missing}"
# echo "DBWRITER_URL=${DBWRITER_URL:-missing}"
# echo "API_GATEWAY_PORT=${API_GATEWAY_PORT:-missing}"

exec node dist/main.js
