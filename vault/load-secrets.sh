#!/usr/bin/env bash
set -e

VAULT=${VAULT:-vault}

echo "TOKEN=$VAULT_TOKEN"

echo "Vault secret list"
$VAULT secrets list

$VAULT kv put secret/waf \
  dhparam="$(cat /tmp/dhparam-2048.pem)" \
  selfsigned_key="$(cat /tmp/selfsigned.key)" \
  selfsigned_cert="$(cat /tmp/selfsigned.crt)"

$VAULT kv get secret/waf 

# charger les vars d'environnement pour chaque service depuis le .env commun
# --------------------------------------------------------------------------

FILE_ENV="/tmp/env"

API_GATEWAY_VARS="AUTH_SERVICE_URL FRONTEND_URL DBWRITER_URL API_GATEWAY_PORT"
AUTHSERVICE_VARS="AUTHSERVICE_PORT DATABASE_URL JWT_SECRET DBWRITER_URL"
DBWRITER_VARS="DBWRITER_PORT DATABASE_URL"
ELK_VARS="ELASTIC_PASSWORD KIBANA_PASSWORD LOGSTASH_PASSWORD"

printf 'DEBUG ELK_VARS=<%q>\n' "$ELK_VARS"
for v in $ELK_VARS; do printf 'DEBUG token v=<%q>\n' "$v"; done

GLOBAL_IGNORE="NODE_ENV VAULT_ADDR"

declare -A api_gateway_map
declare -A authservice_map
declare -A dbwriter_map
declare -A elk_map


while IFS='=' read -r key value; do
    key="${key%$'\r'}"                 # ✅ enlève CR Windows sur la clé
    key="${key#"${key%%[![:space:]]*}"}"   # trim left
    key="${key%"${key##*[![:space:]]}"}"   # trim right
    value="${value%$'\r'}"             # enlève CR Windows si présent
    if [[ "$key" == *LOGSTASH* ]]; then
        printf 'DEBUG read key=<%q>\n' "$key"
        printf 'DEBUG read value=<%q>\n' "$value"
        printf 'DEBUG key bytes='; printf '%s' "$key" | od -An -tx1
        printf 'DEBUG ELK_VARS tokens:\n'
        for v in $ELK_VARS; do
            if [[ "$key" == "$v" ]]; then
                printf '  v=<%q> -> MATCH\n' "$v"
            else
                printf '  v=<%q> -> no\n' "$v"
            fi
        done
    fi
    [[ -z "$key" || "$key" == \#* ]] && continue

    for g in $GLOBAL_IGNORE; do
        if [[ "$key" == "$g" ]]; then
            continue 2
        fi
    done

    # api-gateway
    for v in $API_GATEWAY_VARS; do
        if [[ "$key" == "$v" ]]; then
            api_gateway_map[$key]="$value"
        fi
    done

    # authservice
    for v in $AUTHSERVICE_VARS; do
        if [[ "$key" == "$v" ]]; then
            authservice_map[$key]="$value"
        fi
    done

    # dbwriter
    for v in $DBWRITER_VARS; do
        if [[ "$key" == "$v" ]]; then
            dbwriter_map[$key]="$value"
        fi
    done

     # elk
    for v in $ELK_VARS; do
        if [[ "$key" == "$v" ]]; then
            elk_map[$key]="$value"
        fi
    done
done < "$FILE_ENV"
echo "DEBUG /tmp/env:"
grep -n '^LOGSTASH_PASSWORD=' "$FILE_ENV" || true

echo "DEBUG elk_map:"
declare -p elk_map || true
printf 'DEBUG elk_map[LOGSTASH_PASSWORD]=<%q>\n' "${elk_map[LOGSTASH_PASSWORD]:-}"

# Kibana:
# - kibana container attend ELASTICSEARCH_PASSWORD
# - notre elk-security-setup.sh attend KIBANA_PASSWORD
# => on force les deux à être identiques
if [[ -n "${elk_map[KIBANA_PASSWORD]:-}" && -z "${elk_map[ELASTICSEARCH_PASSWORD]:-}" ]]; then
  elk_map[ELASTICSEARCH_PASSWORD]="${elk_map[KIBANA_PASSWORD]}"
fi

if [[ -n "${elk_map[ELASTICSEARCH_PASSWORD]:-}" && -z "${elk_map[KIBANA_PASSWORD]:-}" ]]; then
  elk_map[KIBANA_PASSWORD]="${elk_map[ELASTICSEARCH_PASSWORD]}"
fi

# (optionnel mais recommandé) fail-fast si ça manque
if [[ -z "${elk_map[KIBANA_PASSWORD]:-}" ]]; then
  echo "ERROR: KIBANA_PASSWORD missing (check /tmp/env)"
  grep -n '^KIBANA_PASSWORD=' "$FILE_ENV" || true
  exit 1
fi
# Fallback: si le parsing via while a raté la clé, on lit directement dans le fichier
if [[ -z "${elk_map[LOGSTASH_PASSWORD]:-}" ]]; then
  elk_map[LOGSTASH_PASSWORD]="$(grep -m1 '^LOGSTASH_PASSWORD=' "$FILE_ENV" | cut -d= -f2- | tr -d '\r')"
fi

if [[ -z "${elk_map[LOGSTASH_PASSWORD]:-}" ]]; then
  echo "ERROR: LOGSTASH_PASSWORD missing (check /tmp/env)"
  grep -n '^LOGSTASH_PASSWORD=' "$FILE_ENV" || true
  exit 1
fi

# Ton logstash.conf utilise LOGSTASH_INTERNAL_PASSWORD (env)
elk_map[LOGSTASH_INTERNAL_PASSWORD]="${elk_map[LOGSTASH_PASSWORD]:-}"


build_args() {
    local -n map=$1
    local args=""
    for key in "${!map[@]}"; do
        args="$args $key=${map[$key]}"
    done
    echo "$args"
}

ARGS_API=$(build_args api_gateway_map)
ARGS_AUTH=$(build_args authservice_map)
ARGS_DBW=$(build_args dbwriter_map)
ARGS_ELK=$(build_args elk_map)


echo "→ API Gateway: $ARGS_API"
echo "→ AuthService: $ARGS_AUTH"
echo "→ DbWriter: $ARGS_DBW"
echo "→ ELK: $ARGS_ELK"


vault kv put secret/api-gateway $ARGS_API
vault kv put secret/authservice $ARGS_AUTH
vault kv put secret/dbwriter $ARGS_DBW
vault kv put secret/elk $ARGS_ELK


bash /vault/secrets-apigateway.sh
bash /vault/secrets-authservice.sh
bash /vault/secrets-dbwriter.sh
bash /vault/secrets-waf.sh
bash /vault/secrets-elk.sh

# bash /vault/test-script.sh
