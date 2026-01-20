#!/usr/bin/env sh
set -eu

FILE="/secrets/elk/elk.env"

# attendre que Vault ait écrit le fichier
while [ ! -s "$FILE" ]; do
  sleep 1
done

# exporter les variables
while IFS='=' read -r key value; do
  case "$key" in
    ''|\#*) continue ;;
    request_id|lease_id|created_time|deletion_time|mount_type) continue ;;
  esac
  export "$key=$value"
done < "$FILE"

exec "$@"
