variable "name" { type = string }
variable "rate_rule_action" {
  type    = string
  default = "count"

  validation {
    condition     = contains(["count", "block"], var.rate_rule_action)
    error_message = "rate_rule_action must be count or block."
  }
}
variable "baseline_rate_limit" {
  type    = number
  default = 2000

  validation {
    condition     = var.baseline_rate_limit >= 10
    error_message = "baseline_rate_limit must be at least 10 requests per evaluation window."
  }
}
variable "auth_rate_limit" {
  type    = number
  default = 100

  validation {
    condition     = var.auth_rate_limit >= 10
    error_message = "auth_rate_limit must be at least 10 requests per evaluation window."
  }
}
variable "mutation_rate_limit" {
  type    = number
  default = 600

  validation {
    condition     = var.mutation_rate_limit >= 10
    error_message = "mutation_rate_limit must be at least 10 requests per evaluation window."
  }
}
variable "log_retention_days" {
  type    = number
  default = 30
}
variable "logs_kms_key_arn" {
  type        = string
  default     = null
  description = "Optional us-east-1 KMS key ARN for WAF logs. Service-managed encryption is used when null."
}
variable "tags" { type = map(string) }
