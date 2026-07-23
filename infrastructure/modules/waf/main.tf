resource "aws_wafv2_web_acl" "this" {
  name        = "${var.name}-edge"
  description = "247 Home CloudFront protection; managed rules start in count mode"
  scope       = "CLOUDFRONT"

  default_action {
    allow {}
  }

  rule {
    name     = "aws-common-rule-set"
    priority = 10

    override_action {
      count {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.name}-common-rules"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "aws-known-bad-inputs"
    priority = 20

    override_action {
      count {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.name}-known-bad-inputs"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "baseline-rate-limit"
    priority = 30

    action {
      dynamic "count" {
        for_each = var.rate_rule_action == "count" ? [1] : []
        content {}
      }
      dynamic "block" {
        for_each = var.rate_rule_action == "block" ? [1] : []
        content {
          custom_response {
            response_code = 429
            response_header {
              name  = "Retry-After"
              value = "300"
            }
          }
        }
      }
    }

    statement {
      rate_based_statement {
        aggregate_key_type    = "IP"
        evaluation_window_sec = 300
        limit                 = var.baseline_rate_limit
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.name}-baseline-rate"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "authentication-rate-limit"
    priority = 40

    action {
      dynamic "count" {
        for_each = var.rate_rule_action == "count" ? [1] : []
        content {}
      }
      dynamic "block" {
        for_each = var.rate_rule_action == "block" ? [1] : []
        content {
          custom_response {
            response_code = 429
            response_header {
              name  = "Retry-After"
              value = "300"
            }
          }
        }
      }
    }

    statement {
      rate_based_statement {
        aggregate_key_type    = "IP"
        evaluation_window_sec = 300
        limit                 = var.auth_rate_limit

        scope_down_statement {
          or_statement {
            statement {
              byte_match_statement {
                field_to_match {
                  uri_path {}
                }
                positional_constraint = "STARTS_WITH"
                search_string         = "/api/auth/"

                text_transformation {
                  priority = 0
                  type     = "NONE"
                }
              }
            }

            statement {
              byte_match_statement {
                field_to_match {
                  uri_path {}
                }
                positional_constraint = "STARTS_WITH"
                search_string         = "/api/v1/auth/"

                text_transformation {
                  priority = 0
                  type     = "NONE"
                }
              }
            }
          }
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.name}-auth-rate"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "api-mutation-rate-limit"
    priority = 50

    action {
      dynamic "count" {
        for_each = var.rate_rule_action == "count" ? [1] : []
        content {}
      }
      dynamic "block" {
        for_each = var.rate_rule_action == "block" ? [1] : []
        content {
          custom_response {
            response_code = 429
            response_header {
              name  = "Retry-After"
              value = "300"
            }
          }
        }
      }
    }

    statement {
      rate_based_statement {
        aggregate_key_type    = "IP"
        evaluation_window_sec = 300
        limit                 = var.mutation_rate_limit

        scope_down_statement {
          and_statement {
            statement {
              byte_match_statement {
                field_to_match {
                  uri_path {}
                }
                positional_constraint = "STARTS_WITH"
                search_string         = "/api/v1/"

                text_transformation {
                  priority = 0
                  type     = "NONE"
                }
              }
            }

            statement {
              not_statement {
                statement {
                  byte_match_statement {
                    field_to_match {
                      uri_path {}
                    }
                    positional_constraint = "EXACTLY"
                    search_string         = "/api/v1/payment/webhook"

                    text_transformation {
                      priority = 0
                      type     = "NONE"
                    }
                  }
                }
              }
            }

            statement {
              or_statement {
                dynamic "statement" {
                  for_each = toset(["POST", "PUT", "PATCH", "DELETE"])
                  content {
                    byte_match_statement {
                      field_to_match {
                        method {}
                      }
                      positional_constraint = "EXACTLY"
                      search_string         = statement.value

                      text_transformation {
                        priority = 0
                        type     = "NONE"
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.name}-api-mutation-rate"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${var.name}-edge-web-acl"
    sampled_requests_enabled   = true
  }

  tags = var.tags
}

resource "aws_cloudwatch_log_group" "waf" {
  name              = "aws-waf-logs-${var.name}"
  retention_in_days = var.log_retention_days
  kms_key_id        = var.logs_kms_key_arn
  tags              = var.tags
}

resource "aws_wafv2_web_acl_logging_configuration" "this" {
  log_destination_configs = [aws_cloudwatch_log_group.waf.arn]
  resource_arn            = aws_wafv2_web_acl.this.arn

  redacted_fields {
    single_header { name = "authorization" }
  }

  redacted_fields {
    single_header { name = "cookie" }
  }
}
