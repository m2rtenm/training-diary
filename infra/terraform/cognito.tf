resource "aws_cognito_user_pool" "app" {
  name                     = "${var.app_name}-users"
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]
  mfa_configuration        = "ON"

  software_token_mfa_configuration {
    enabled = true
  }

  admin_create_user_config {
    allow_admin_create_user_only = true
  }

  password_policy {
    minimum_length                   = 12
    require_lowercase                = true
    require_numbers                  = true
    require_symbols                  = true
    require_uppercase                = true
    temporary_password_validity_days = 1
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  user_attribute_update_settings {
    attributes_require_verification_before_update = ["email"]
  }

  lambda_config {
    pre_sign_up = aws_lambda_function.google_allowlist.arn
  }
}

resource "aws_cognito_user_pool_client" "app" {
  name                                 = "${var.app_name}-web"
  user_pool_id                         = aws_cognito_user_pool.app.id
  generate_secret                      = false
  enable_token_revocation              = true
  prevent_user_existence_errors        = "ENABLED"
  supported_identity_providers         = ["Google"]
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["openid", "email"]
  callback_urls                        = ["https://${var.app_domain}/auth/callback"]
  logout_urls                          = ["https://${var.app_domain}/"]
  # OAuth federation uses the hosted endpoints; don't expose local password auth flows.
  explicit_auth_flows    = ["ALLOW_REFRESH_TOKEN_AUTH"]
  access_token_validity  = 1
  id_token_validity      = 1
  refresh_token_validity = 1
  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }

  depends_on = [aws_cognito_identity_provider.google]
}

resource "aws_cognito_managed_login_branding" "app" {
  user_pool_id                = aws_cognito_user_pool.app.id
  client_id                   = aws_cognito_user_pool_client.app.id
  use_cognito_provided_values = true
}

resource "aws_cognito_user_pool_domain" "app" {
  domain       = var.cognito_domain_prefix
  user_pool_id = aws_cognito_user_pool.app.id
}
