output "app_url" {
  description = "HTTPS URL for the deployed app."
  value       = "https://${var.app_domain}"
}

output "cloudfront_domain_name" {
  description = "CNAME target for stride.mandla.tech in Zone.ee."
  value       = aws_cloudfront_distribution.app.domain_name
}

output "dns_cname_host" {
  description = "Host/name value to create in the external DNS provider."
  value       = "stride"
}

output "bucket_name" {
  description = "Private S3 bucket used for static app files."
  value       = aws_s3_bucket.app.id
}

output "distribution_id" {
  description = "CloudFront distribution ID, needed for cache invalidation."
  value       = aws_cloudfront_distribution.app.id
}

output "github_actions_deploy_role_arn" {
  description = "Add this as the AWS_DEPLOY_ROLE_ARN GitHub Actions secret."
  value       = aws_iam_role.github_deploy.arn
}

output "cognito_user_pool_id" {
  description = "Cognito user pool ID used by the frontend build."
  value       = aws_cognito_user_pool.app.id
}

output "cognito_client_id" {
  description = "Public Cognito app client ID used by the frontend build."
  value       = aws_cognito_user_pool_client.app.id
}

output "cognito_issuer" {
  description = "Cognito OIDC issuer URL."
  value       = "https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.app.id}"
}

output "cognito_hosted_ui_domain" {
  description = "Cognito hosted UI hostname for the frontend build."
  value       = "https://${aws_cognito_user_pool_domain.app.domain}.auth.${var.aws_region}.amazoncognito.com"
}

output "cognito_frontend_config" {
  description = "Values to configure the frontend build in GitHub Actions."
  value = {
    authority = "https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.app.id}"
    client_id = aws_cognito_user_pool_client.app.id
    hosted_ui = "https://${aws_cognito_user_pool_domain.app.domain}.auth.${var.aws_region}.amazoncognito.com"
  }
}

output "diary_api_url" {
  description = "Lambda Function URL for Cognito-authenticated diary synchronization."
  value       = aws_lambda_function_url.diary_sync.function_url
}

output "diary_table_name" {
  description = "DynamoDB table storing the user's synced diary."
  value       = aws_dynamodb_table.diary.name
}
