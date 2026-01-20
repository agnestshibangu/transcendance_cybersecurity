#!/usr/bin/env bash
set -euo pipefail

CERTS_DIR="config/certs"
CA_CRT="${CERTS_DIR}/ca/ca.crt"

echo "[elk-certs] start"

if [ ! -f "${CA_CRT}" ]; then
  echo "[elk-certs] Generating CA + certs…"

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

echo "[elk-certs] certs ready"
