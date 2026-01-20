#!/usr/bin/env bash
set -euo pipefail

CERTS_DIR="config/certs"
CA_CRT="${CERTS_DIR}/ca/ca.crt"

echo "[elk-setup] start"

if [ ! -f "${CA_CRT}" ]; then
  echo "[elk-setup] Generating CA + certs…"

  bin/elasticsearch-certutil ca --silent --pem -out "${CERTS_DIR}/ca.zip"
  unzip -o "${CERTS_DIR}/ca.zip" -d "${CERTS_DIR}"

  bin/elasticsearch-certutil cert --silent --pem \
    --in config/instances.yml \
    --ca-cert "${CERTS_DIR}/ca/ca.crt" \
    --ca-key  "${CERTS_DIR}/ca/ca.key" \
    -out "${CERTS_DIR}/certs.zip"

  unzip -o "${CERTS_DIR}/certs.zip" -d "${CERTS_DIR}"
  chown -R 1000:0 "${CERTS_DIR}/ca" "${CERTS_DIR}/elasticsearch" "${CERTS_DIR}/kibana" "${CERTS_DIR}/logstash"
fi

echo "[elk-setup] Waiting for Elasticsearch (HTTPS)…"
until curl -s --cacert "${CA_CRT}" https://elasticsearch:9200 >/dev/null; do
  sleep 2
done

echo "[elk-setup] Setting kibana_system password…"
curl -s -X POST --cacert "${CA_CRT}" -u "elastic:${ELASTIC_PASSWORD}" \
  "https://elasticsearch:9200/_security/user/kibana_system/_password" \
  -H "Content-Type: application/json" \
  -d "{\"password\":\"${KIBANA_PASSWORD}\"}" >/dev/null

echo "[elk-setup] Creating logstash_internal user + role…"
curl -s -X POST --cacert "${CA_CRT}" -u "elastic:${ELASTIC_PASSWORD}" \
  "https://elasticsearch:9200/_security/role/logstash_write_role" \
  -H "Content-Type: application/json" \
  -d '{"cluster":["monitor","manage_index_templates"],"indices":[{"names":["docker-logs-*"],"privileges":["write","create","create_index"]}]}' >/dev/null

curl -s -X POST --cacert "${CA_CRT}" -u "elastic:${ELASTIC_PASSWORD}" \
  "https://elasticsearch:9200/_security/user/logstash_internal" \
  -H "Content-Type: application/json" \
  -d "{\"password\":\"${LOGSTASH_PASSWORD}\",\"roles\":[\"logstash_write_role\"]}" >/dev/null

echo "[elk-setup] done"
