data "aws_acm_certificate" "wildcard" {
  provider    = aws.use1
  domain      = "*.mandla.tech"
  statuses    = ["ISSUED"]
  most_recent = true
}
