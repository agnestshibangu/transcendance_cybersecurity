#!/usr/bin/env sh
set -eu

CA_CRT="/certs/ca/ca.crt"

: "${ELASTIC_PASSWORD:?ELASTIC_PASSWORD is required}"
: "${KIBANA_PASSWORD:?KIBANA_PASSWORD is required}"
: "${LOGSTASH_PASSWORD:?LOGSTASH_PASSWORD is required}"

echo "[elk-security] waiting for Elasticsearch (HTTPS)…"
until curl -fsS --cacert "${CA_CRT}" -u "elastic:${ELASTIC_PASSWORD}" \
  https://elasticsearch:9200/_security/_authenticate >/dev/null; do
  sleep 2
done

echo "[elk-security] setting kibana_system password…"
curl -fsS -X POST --cacert "${CA_CRT}" -u "elastic:${ELASTIC_PASSWORD}" \
  "https://elasticsearch:9200/_security/user/kibana_system/_password" \
  -H "Content-Type: application/json" \
  -d "{\"password\":\"${KIBANA_PASSWORD}\"}" >/dev/null

echo "[elk-security] creating logstash_internal user + role…"
curl -fsS -X POST --cacert "${CA_CRT}" -u "elastic:${ELASTIC_PASSWORD}" \
  "https://elasticsearch:9200/_security/role/logstash_write_role" \
  -H "Content-Type: application/json" \
  -d '{"cluster":["monitor","manage_index_templates"],"indices":[{"names":["docker-logs-*"],"privileges":["write","create","create_index"]}]}' >/dev/null

curl -fsS -X POST --cacert "${CA_CRT}" -u "elastic:${ELASTIC_PASSWORD}" \
  "https://elasticsearch:9200/_security/user/logstash_internal" \
  -H "Content-Type: application/json" \
  -d "{\"password\":\"${LOGSTASH_PASSWORD}\",\"roles\":[\"logstash_write_role\"]}" >/dev/null

echo "[elk-security] done"
