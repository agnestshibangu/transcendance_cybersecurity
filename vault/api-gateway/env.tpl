{{- with secret "secret/data/api-gateway" -}}
NODE_ENV="{{ .Data.data.NODE_ENV }}"
API_GATEWAY_PORT="{{ .Data.data.API_GATEWAY_PORT }}"
AUTH_SERVICE_URL="{{ .Data.data.AUTH_SERVICE_URL }}"
FRONTEND_URL="{{ .Data.data.FRONTEND_URL }}"
DBWRITER_URL="{{ .Data.data.DBWRITER_URL }}"
JWT_SECRET="{{ .Data.data.JWT_SECRET }}"
WAF_HTTP_PORT="{{ .Data.data.WAF_HTTP_PORT }}"
WAF_HTTPS_PORT="{{ .Data.data.WAF_HTTPS_PORT }}"
API_KEY="{{ .Data.data.API_KEY }}"
{{- end }}

