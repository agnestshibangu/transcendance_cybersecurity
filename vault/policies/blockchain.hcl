# ===========================================
# Policy : blockchain.hcl
# Objectif : accès lecture seule pour le blockchain
# ===========================================

# Autoriser la lecture uniquement des secrets du blockchain
path "secret/data/blockchain/*" {
  capabilities = ["read"]
}

# Autoriser la liste des clés (utile si le service énumère ses secrets)
path "secret/metadata/blockchain/*" {
  capabilities = ["list"]
}
