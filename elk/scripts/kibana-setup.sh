#!/bin/sh
set -eu

KIBANA_URL="${KIBANA_URL:-http://kibana:5601}"
AUTH_USER="${KIBANA_USER:-elastic}"
AUTH_PASS="${ELASTIC_PASSWORD:?ELASTIC_PASSWORD is required}"
AUTH="${AUTH_USER}:${AUTH_PASS}"

DATA_VIEW_ID="docker-logs"
DATA_VIEW_TITLE="docker-logs-*"
DATA_VIEW_NAME="Docker logs"

echo "[kibana-setup] waiting for Kibana status=available..."
until curl -fsS -u "$AUTH" \
  "${KIBANA_URL}/api/status?v8format=true" \
  | grep -q '"level":"available"'
do
  sleep 2
done

echo "[kibana-setup] upserting data view '${DATA_VIEW_ID}'..."
curl -fsS -u "$AUTH" \
  -H "kbn-xsrf: true" \
  -H "Content-Type: application/json" \
  -X POST "${KIBANA_URL}/api/data_views/data_view" \
  -d "$(cat <<JSON
{
  "data_view": {
    "id": "${DATA_VIEW_ID}",
    "name": "${DATA_VIEW_NAME}",
    "title": "${DATA_VIEW_TITLE}",
    "allowNoIndex": true
  },
  "override": true
}
JSON
)"

echo "[kibana-setup] setting default data view..."
curl -fsS -u "$AUTH" \
  -H "kbn-xsrf: true" \
  -H "Content-Type: application/json" \
  -X POST "${KIBANA_URL}/api/data_views/default" \
  -d "{\"force\":true,\"data_view_id\":\"${DATA_VIEW_ID}\"}"

echo "[kibana-setup] setting Discover default columns..."
curl -fsS -u "$AUTH" \
  -H "kbn-xsrf: true" \
  -H "Content-Type: application/json" \
  -X POST "${KIBANA_URL}/api/kibana/settings" \
  -d "$(cat <<JSON
{
  "changes": {
    "defaultColumns": ["@timestamp", "host", "tag", "source_host", "message"],
    "doc_table:legacy": true
  }
}
JSON
)"

echo "[kibana-setup] verifying..."
curl -fsS -u "$AUTH" "${KIBANA_URL}/api/data_views/default" ; echo
curl -fsS -u "$AUTH" "${KIBANA_URL}/api/data_views" ; echo
curl -fsS -u "$AUTH" -H "kbn-xsrf: true" "${KIBANA_URL}/api/kibana/settings" | head -c 600 ; echo

echo "[kibana-setup] done"
