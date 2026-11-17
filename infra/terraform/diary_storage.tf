resource "aws_dynamodb_table" "diary" {
  name         = var.app_name
  billing_mode = "PROVISIONED"
  hash_key     = "user_id"

  read_capacity  = 25
  write_capacity = 25

  attribute {
    name = "user_id"
    type = "S"
  }

  server_side_encryption { enabled = true }

  point_in_time_recovery { enabled = false }

  lifecycle { prevent_destroy = true }
}

resource "aws_iam_role" "diary_sync" {
  name = "${var.app_name}-sync"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "diary_sync" {
  name = "${var.app_name}-sync-data-access"
  role = aws_iam_role.diary_sync.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["dynamodb:GetItem", "dynamodb:PutItem"]
      Resource = aws_dynamodb_table.diary.arn
    }]
  })
}

resource "aws_cloudwatch_log_group" "diary_sync" {
  name              = "/aws/lambda/${var.app_name}-sync"
  retention_in_days = 7
}

resource "aws_iam_role_policy" "diary_sync_logs" {
  name = "${var.app_name}-sync-logs"
  role = aws_iam_role.diary_sync.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["logs:CreateLogStream", "logs:PutLogEvents"]
      Resource = "${aws_cloudwatch_log_group.diary_sync.arn}:*"
    }]
  })
}

data "archive_file" "diary_sync" {
  type        = "zip"
  source_file = "${path.module}/lambda/diary_sync/lambda_function.py"
  output_path = "${path.module}/lambda/diary_sync.zip"
}

resource "aws_lambda_function" "diary_sync" {
  function_name    = "${var.app_name}-sync"
  role             = aws_iam_role.diary_sync.arn
  runtime          = "python3.13"
  handler          = "lambda_function.handler"
  filename         = data.archive_file.diary_sync.output_path
  source_code_hash = data.archive_file.diary_sync.output_base64sha256
  memory_size      = var.lambda_sync_memory_mb
  timeout          = 10
  environment {
    variables = {
      TABLE_NAME        = aws_dynamodb_table.diary.name
      COGNITO_ISS       = "https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.app.id}"
      COGNITO_CLIENT_ID = aws_cognito_user_pool_client.app.id
      APP_ORIGIN        = "https://${var.app_domain}"
      MAX_DIARY_BYTES   = "2097152"
      MAX_STORED_BYTES  = "20000"
    }
  }

  depends_on = [aws_iam_role_policy.diary_sync, aws_iam_role_policy.diary_sync_logs]
}

resource "aws_lambda_function_url" "diary_sync" {
  function_name      = aws_lambda_function.diary_sync.function_name
  authorization_type = "NONE"

  cors {
    allow_origins = ["https://${var.app_domain}"]
    allow_methods = ["GET", "PUT"]
    allow_headers = ["authorization", "content-type"]
    max_age       = 300
  }
}

resource "aws_lambda_permission" "diary_sync_url" {
  statement_id           = "AllowPublicFunctionUrlInvocation"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.diary_sync.function_name
  principal              = "*"
  function_url_auth_type = "NONE"
}

resource "aws_lambda_permission" "diary_sync_url_invoke" {
  statement_id             = "AllowPublicFunctionUrlInvokeAction"
  action                   = "lambda:InvokeFunction"
  function_name            = aws_lambda_function.diary_sync.function_name
  principal                = "*"
  invoked_via_function_url = true
}
