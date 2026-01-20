# ===========================================
# Policy : dbwriter.hcl
# Objectif : accès lecture seule pour le dbwriter
# ===========================================

# Autoriser la lecture uniquement des secrets du dbwriter
path "secret/data/dbwriter/*" {
  capabilities = ["read"]
}

# Autoriser la liste des clés (utile si le service énumère ses secrets)
path "secret/metadata/dbwriter/*" {
  capabilities = ["list"]
}
