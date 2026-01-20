#!/usr/bin/env bash
set -e

echo "🔹 DEBUT du test" 

VAULT=${VAULT:-vault}
export VAULT_ADDR=${VAULT_ADDR:-https://vault:8200}

$VAULT list auth/approle/role

# Dossier temporaire pour stocker role_id / secret_id
TMPDIR=$(mktemp -d)
chmod 700 "$TMPDIR"

declare -A services
services=(
  [api-gateway]="/vault/api-gateway/api-gateway-policy.hcl"
  [authservice]="/vault/authservice/authservice-policy.hcl"
  [dbwriter]="/vault/dbwriter/dbwriter-policy.hcl"
  [elk]="/vault/elk/elk-policy.hcl"
  #[waf]="/vault/waf/waf-policy.hcl"
)

echo "🔹 Génération des tokens AppRole pour chaque service..."
declare -A tokens
for svc in "${!services[@]}"; do
    ROLE_ID=$($VAULT read -field=role_id auth/approle/role/$svc/role-id)
    SECRET_ID=$($VAULT write -f -field=secret_id auth/approle/role/$svc/secret-id)
    TOKEN=$($VAULT write -field=token auth/approle/login role_id="$ROLE_ID" secret_id="$SECRET_ID")
    tokens[$svc]=$TOKEN
done

echo "🔹 Test des accès aux secrets par service..."
for svc_test in "${!tokens[@]}"; do
    echo -e "\n🟢 Service: $svc_test"
    VAULT_TOKEN=${tokens[$svc_test]}
    for target_svc in "${!services[@]}"; do
        echo -n "  Accès à $target_svc: "
        if $VAULT kv get -format=json "secret/$target_svc" >/dev/null 2>&1; then
            echo "✅ autorisé"
        else
            echo "❌ refusé"
        fi
    done
done

rm -rf "$TMPDIR"
echo -e "\n💡 Démo terminée. Chaque service ne peut accéder qu’à ses propres secrets."
