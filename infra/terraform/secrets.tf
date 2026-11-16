# These Standard-tier SecureString values are read during plan/apply. Terraform
# state still contains the resolved Google secret, so protect the state file.
data "aws_ssm_parameter" "allowed_emails" {
  name            = "/training-diary/allowed_emails"
  with_decryption = true
}
