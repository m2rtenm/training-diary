variable "aws_region" {
  description = "AWS region for the private app bucket. CloudFront is global."
  type        = string
  default     = "eu-north-1"
}

variable "aws_profile" {
  description = "Optional AWS CLI profile for the app account."
  type        = string
  default     = ""
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

variable "hosted_zone_name" {
  description = "Existing public Route 53 hosted zone that contains the app domain."
  type        = string
  default     = "mandla.tech"
}

variable "route53_aws_profile" {
  description = "Optional AWS CLI profile for the account that owns the Route 53 zone, if separate from the app account."
  type        = string
  default     = null
  nullable    = true
}
