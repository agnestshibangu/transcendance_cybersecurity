exit_after_auth = false
pid_file = "/vault/pidfile"

auto_auth {
  method "approle" {
    mount_path = "auth/approle"
    config = {
      role_id_file_path = "/vault/creds/role_id"
      secret_id_file_path = "/vault/creds/secret_id"
    }
  }

  sink "file" {
    config = {
      path = "/vault/creds/.vault-token"
    }
  }
}

template {
  source      = "/vault/templates/env.tpl"
  destination = "/secrets/authservice.env"
}
