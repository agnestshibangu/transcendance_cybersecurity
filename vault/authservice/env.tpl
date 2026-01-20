{{- with secret "secret/data/authservice" -}}
NODE_ENV="{{ .Data.data.NODE_ENV }}"
AUTH_SERVICE_URL="{{ .Data.data.AUTH_SERVICE_URL }}"
FRONTEND_URL="{{ .Data.data.FRONTEND_URL }}"
JWT_SECRET="{{ .Data.data.JWT_SECRET }}"
API_KEY="{{ .Data.data.API_KEY }}"
AUTHSERVICE_PORT="{{ .Data.data.AUTHSERVICE_PORT }}"
DATABASE_URL="{{ .Data.data.DATABASE_URL }}"
DBWRITER_URL="{{ .Data.data.DBWRITER_URL }}"
{{- end }}

