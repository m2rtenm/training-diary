data "archive_file" "google_allowlist" {
  type        = "zip"
  source_file = "${path.module}/lambda/google_allowlist/lambda_function.py"
  output_path = "${path.module}/lambda/google_allowlist.zip"
}

resource "aws_cloudwatch_log_group" "google_allowlist" {
  name              = "/aws/lambda/${var.app_name}-google-allowlist"
  retention_in_days = 14
}

resource "aws_iam_role" "google_allowlist" {
  name = "${var.app_name}-google-allowlist"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "google_allowlist_logs" {
  name = "${var.app_name}-google-allowlist-logs"
  role = aws_iam_role.google_allowlist.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["logs:CreateLogStream", "logs:PutLogEvents"]
      Resource = "${aws_cloudwatch_log_group.google_allowlist.arn}:*"
    }]
  })
}

resource "aws_lambda_function" "google_allowlist" {
  function_name    = "${var.app_name}-google-allowlist"
  role             = aws_iam_role.google_allowlist.arn
  runtime          = "python3.12"
  handler          = "lambda_function.handler"
  timeout          = 5
  memory_size      = 128
  filename         = data.archive_file.google_allowlist.output_path
  source_code_hash = data.archive_file.google_allowlist.output_base64sha256

  environment {
    variables = {
      ALLOWED_EMAILS = data.aws_ssm_parameter.allowed_emails.value
    }
  }
}

resource "aws_lambda_permission" "google_allowlist" {
  statement_id  = "AllowCognitoPreSignUp"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.google_allowlist.function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.app.arn
}
