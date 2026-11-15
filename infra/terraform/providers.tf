provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile != "" ? var.aws_profile : null

  default_tags {
    tags = {
      Application = "training-diary"
      ManagedBy   = "Terraform"
    }
  }
}

# CloudFront only accepts ACM viewer certificates from us-east-1.
provider "aws" {
  alias   = "use1"
  region  = "us-east-1"
  profile = var.aws_profile != "" ? var.aws_profile : null

  default_tags {
    tags = {
      Application = "training-diary"
      ManagedBy   = "Terraform"
    }
  }
}

# Use this when DNS for mandla.tech is held in a separate AWS account.
provider "aws" {
  alias   = "route53"
  region  = var.aws_region
  profile = var.route53_aws_profile != null && var.route53_aws_profile != "" ? var.route53_aws_profile : (var.aws_profile != "" ? var.aws_profile : null)
}
