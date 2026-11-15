data "aws_route53_zone" "public" {
  provider     = aws.route53
  name         = var.hosted_zone_name
  private_zone = false
}

resource "aws_route53_record" "app_ipv4" {
  provider = aws.route53
  zone_id  = data.aws_route53_zone.public.zone_id
  name     = var.app_domain
  type     = "A"

  alias {
    name                   = aws_cloudfront_distribution.app.domain_name
    zone_id                = aws_cloudfront_distribution.app.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "app_ipv6" {
  provider = aws.route53
  zone_id  = data.aws_route53_zone.public.zone_id
  name     = var.app_domain
  type     = "AAAA"

  alias {
    name                   = aws_cloudfront_distribution.app.domain_name
    zone_id                = aws_cloudfront_distribution.app.hosted_zone_id
    evaluate_target_health = false
  }
}
