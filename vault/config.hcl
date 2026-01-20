# Vault écoute uniquement sur le réseau Docker interne
listener "tcp" {
  # Écoute sur toutes les interfaces internes du conteneur
  address       = "0.0.0.0:8200"

  # ⚠️ HTTPS désactivé pour simplifier les tests internes
  # (à activer plus tard avec un certificat interne si besoin)
  tls_disable   = 1
}

# Stockage persistant (backend de données)
storage "file" {
  path = "/vault/file"
}

# Adresse de l'API, vue depuis les autres conteneurs Docker
api_addr = "http://vault:8200"

# Adresse du cluster (utile si tu déploies plusieurs instances)
cluster_addr = "http://vault:8201"

# Niveau de log
log_level = "info"
