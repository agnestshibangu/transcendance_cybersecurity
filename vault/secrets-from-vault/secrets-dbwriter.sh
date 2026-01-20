#!/usr/bin/env bash
set -e

VAULT=${VAULT:-vault}
SECRETS_DIR=${SECRETS_DIR:-/secrets/dbwriter}
export VAULT_ADDR=${VAULT_ADDR:-http://vault:8200}

echo "Using Vault at $VAULT"

# Crée le dossier des secrets si nécessaire
mkdir -p "$SECRETS_DIR"
chmod 700 "$SECRETS_DIR"

echo "Configuring AppRole for DB writer..."

# Écrire la politique pour DB writer
$VAULT policy write dbwriter /vault/dbwriter/dbwriter-policy.hcl

# Activer AppRole si non actif
$VAULT auth list | grep -q approle || $VAULT auth enable approle

# Créer le rôle AppRole
$VAULT write auth/approle/role/dbwriter \
    token_policies="dbwriter" \
    token_ttl=30m \
    token_max_ttl=60m

# Récupérer role_id
$VAULT read -format=json auth/approle/role/dbwriter/role-id \
    | jq -r '.data.role_id' > "$SECRETS_DIR/role_id"

# Récupérer secret_id
$VAULT write -format=json -f auth/approle/role/dbwriter/secret-id \
    | jq -r '.data.secret_id' > "$SECRETS_DIR/secret_id"

chmod 600 "$SECRETS_DIR"/role_id "$SECRETS_DIR"/secret_id

echo "Logging in to Vault using AppRole to get a temporary token..."

ROLE_ID=$(cat "$SECRETS_DIR/role_id")
SECRET_ID=$(cat "$SECRETS_DIR/secret_id")

VAULT_TOKEN=$($VAULT write -field=token auth/approle/login role_id="$ROLE_ID" secret_id="$SECRET_ID")

# Fonction KV v2 pour lire les secrets et créer un fichier .env
write_env_file() {
    SERVICE="$1"
    PATH_IN_VAULT="$2"
    OUT_FILE="$SECRETS_DIR/$SERVICE.env"
    echo "Retrieving secrets for $SERVICE..."

    # KV v2 lecture avec jq
    $VAULT kv get -format=json "$PATH_IN_VAULT" \
        | jq -r '.data.data | to_entries[] | "\(.key)=\(.value)"' > "$OUT_FILE"

    chmod 600 "$OUT_FILE"
    echo "Secrets for $SERVICE written to $OUT_FILE"
}

# Nettoyer les anciens fichiers .env
rm -f "$SECRETS_DIR"/*.env

# Lecture KV v2 avec chemin standard (sans /data/)
write_env_file "dbwriter" "secret/dbwriter"

echo "All secrets written to $SECRETS_DIR"
