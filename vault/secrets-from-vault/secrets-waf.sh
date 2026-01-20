#!/usr/bin/env bash
set -e

VAULT=${VAULT:-vault}
SECRETS_DIR=${SECRETS_DIR:-/secrets/waf}

echo "Using Vault at $VAULT"

# Crée le dossier des secrets si nécessaire
mkdir -p "$SECRETS_DIR"
chmod 700 "$SECRETS_DIR"

vault kv get -field=selfsigned_cert secret/waf > "$SECRETS_DIR/selfsigned.crt"
vault kv get -field=selfsigned_key  secret/waf > "$SECRETS_DIR/selfsigned.key"
vault kv get -field=dhparam         secret/waf > "$SECRETS_DIR/dhparam-2048.pem"

chown -R 101:101 "$SECRETS_DIR"
chmod 644 "$SECRETS_DIR/selfsigned.crt"
chmod 600 "$SECRETS_DIR/selfsigned.key"
chmod 644 "$SECRETS_DIR/dhparam-2048.pem"

echo "WAF certificates written successfully"
