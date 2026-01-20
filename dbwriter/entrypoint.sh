#!/bin/sh
set -e

VAULT_SECRETS=/secrets
TMP_SECRETS=/tmp/secrets
mkdir -p "$TMP_SECRETS"

# Copier depuis le bon fichier
cp "$VAULT_SECRETS/dbwriter.env" "$TMP_SECRETS/dbwriter.env"
chmod 600 "$TMP_SECRETS/dbwriter.env"

while IFS='=' read -r key value; do
  [ -z "$key" ] && continue
  export "$key=$value"
done < "$TMP_SECRETS/dbwriter.env"

# Vérification
echo "DBWRITER_PORT=${DBWRITER_PORT:-missing}"
echo "DATABASE_URL=${DATABASE_URL:-missing}"

exec node dist/index.js

