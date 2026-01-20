#!/bin/sh
set -e

SECRETS_TMPFS=/secrets/waf
VAULT_SECRETS=/vault_secrets_waf

# Copier les fichiers depuis le volume Vault vers tmpfs
for f in selfsigned.crt selfsigned.key dhparam-2048.pem; do
    if [ -f "$VAULT_SECRETS/$f" ]; then
        cp "$VAULT_SECRETS/$f" "$SECRETS_TMPFS/$f"
        echo "✔ $f copied to $SECRETS_TMPFS/$f"
    else
        echo "⚠ $f not found in $VAULT_SECRETS"
    fi
done

# Vérifier que les fichiers existent
for f in selfsigned.crt selfsigned.key dhparam-2048.pem; do
    if [ -f "$SECRETS_TMPFS/$f" ]; then
        echo "✔ $f exists in $SECRETS_TMPFS"
    else
        echo "⚠ $f missing in $SECRETS_TMPFS"
    fi
done

exec /docker-entrypoint.sh nginx -g "daemon off;"
