# ===========================================
# Policy : waf.hcl
# Objectif : accès lecture seule pour le WAF
# ===========================================

# Autoriser la lecture uniquement des secrets du WAF
path "secret/data/waf/*" {
  capabilities = ["read"]
}

# Autoriser la liste des clés (utile si le service énumère ses secrets)
path "secret/metadata/waf/*" {
  capabilities = ["list"]
}
