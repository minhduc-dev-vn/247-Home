variable "project_name" {
  type    = string
  default = "247-home"
}
variable "environment" {
  type = string

  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment must be staging or production."
  }
}
variable "aws_region" { type = string }
variable "availability_zones" { type = list(string) }
variable "vpc_cidr" { type = string }
variable "nat_gateway_mode" { type = string }
variable "container_image" { type = string }
variable "container_port" {
  type    = number
  default = 3000
}
variable "ecs_cpu" { type = number }
variable "ecs_memory" { type = number }
variable "ecs_desired_count" { type = number }
variable "ecs_min_count" { type = number }
variable "ecs_max_count" { type = number }
variable "enable_ecs_service" { type = bool }
variable "alb_certificate_arn" { type = string }
variable "alb_origin_domain_name" {
  type        = string
  description = "Project-owned DNS name for the HTTPS ALB origin."

  validation {
    condition     = can(regex("^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$", var.alb_origin_domain_name))
    error_message = "alb_origin_domain_name must be a lowercase DNS hostname."
  }
}
variable "cloudfront_certificate_arn" { type = string }
variable "origin_verify_header_value" {
  type      = string
  sensitive = true
}
variable "domain_aliases" { type = list(string) }
variable "cloudfront_price_class" { type = string }
variable "waf_rate_rule_action" { type = string }
variable "waf_baseline_rate_limit" { type = number }
variable "waf_auth_rate_limit" { type = number }
variable "asset_bucket_name" { type = string }
variable "asset_noncurrent_expiration_days" { type = number }
variable "ecr_retain_tagged_images" { type = number }
variable "db_instance_class" { type = string }
variable "db_allocated_storage" { type = number }
variable "db_max_allocated_storage" { type = number }
variable "db_multi_az" { type = bool }
variable "db_backup_retention_days" { type = number }
variable "db_deletion_protection" { type = bool }
variable "db_skip_final_snapshot" { type = bool }
variable "db_performance_insights_retention_days" { type = number }
variable "log_retention_days" { type = number }
variable "github_oidc_subjects" { type = list(string) }
variable "ses_identity_arn" { type = string }
variable "alarm_email" {
  type    = string
  default = null
}
variable "additional_tags" {
  type    = map(string)
  default = {}
}
