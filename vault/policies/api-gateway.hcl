# ===========================================
# Policy : api-gateway.hcl
# Objectif : accès lecture seule pour le api-gateway
# ===========================================

# Autoriser la lecture uniquement des secrets du api-gateway
path "secret/data/api-gateway/*" {
  capabilities = ["read"]
}

# Autoriser la liste des clés (utile si le service énumère ses secrets)
path "secret/metadata/api-gateway/*" {
  capabilities = ["list"]
}
