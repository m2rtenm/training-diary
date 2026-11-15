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


