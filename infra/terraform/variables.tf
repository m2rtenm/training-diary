variable "aws_region" {
  description = "AWS region for the private app bucket. CloudFront is global."
  type        = string
  default     = "eu-north-1"
}

variable "app_name" {
  description = "Short application name used in the globally unique bucket name."
  type        = string
  default     = "stride-diary"
}

variable "app_domain" {
  description = "Custom HTTPS hostname for the app."
  type        = string
  default     = "stride.mandla.tech"
}

variable "cognito_domain_prefix" {
  description = "Globally unique Cognito hosted UI prefix for the Stride sign-in page."
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$", var.cognito_domain_prefix))
    error_message = "Use a lowercase, globally unique prefix containing only letters, numbers, and interior hyphens."
  }
  default = "stride"
}

variable "lambda_sync_memory_mb" {
  description = "Memory allocated to the diary sync Lambda. Keep this small to stay within free usage quotas."
  type        = number
  default     = 128
}
