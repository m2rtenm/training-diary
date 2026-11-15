provider "aws" {
  region  = var.aws_region
  profile = "prod"

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
  profile = "prod"

  default_tags {
    tags = {
      Application = "training-diary"
      ManagedBy   = "Terraform"
    }
  }
}

