{{- with secret "secret/waf" -}}
DHPARAM="{{ .Data.data.dhparam }}"
SELFSIGNED_KEY="{{ .Data.data.selfsigned_key }}"
SELFSIGNED_CERT="{{ .Data.data.selfsigned_cert }}"
{{- end }}
