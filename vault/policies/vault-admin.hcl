# ===========================================
# Policy : vault-admin.hcl
# Objectif : accès lecture seule pour le vault-admin
# ===========================================

# Autoriser la lecture uniquement des secrets du vault-admin
path "secret/data/vault-admin/*" {
  capabilities = ["read"]
}

# Autoriser la liste des clés (utile si le service énumère ses secrets)
path "secret/metadata/vault-admin/*" {
  capabilities = ["list"]
}
