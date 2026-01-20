# ===========================================
# Policy : authservice.hcl
# Objectif : accès lecture seule pour le authservice
# ===========================================

# Autoriser la lecture uniquement des secrets du authservice
path "secret/data/authservice/*" {
  capabilities = ["read"]
}

# Autoriser la liste des clés (utile si le service énumère ses secrets)
path "secret/metadata/authservice/*" {
  capabilities = ["list"]
}
