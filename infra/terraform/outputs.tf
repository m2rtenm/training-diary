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
