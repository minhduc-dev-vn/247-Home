variable "name" { type = string }
variable "vpc_id" { type = string }
variable "public_subnet_ids" { type = list(string) }
variable "private_subnet_ids" { type = list(string) }
variable "alb_security_group_id" { type = string }
variable "ecs_security_group_id" { type = string }
variable "execution_role_arn" { type = string }
variable "task_role_arn" { type = string }
variable "container_image" {
  type        = string
  description = "Immutable ECR image reference including sha256 digest."

  validation {
    condition     = can(regex("^[^[:space:]]+@sha256:[0-9a-f]{64}$", var.container_image))
    error_message = "container_image must be an immutable image@sha256:digest reference."
  }
}
variable "container_port" { type = number }
variable "cpu" { type = number }
variable "memory" { type = number }
variable "desired_count" { type = number }
variable "min_count" { type = number }
variable "max_count" { type = number }
variable "enable_service" { type = bool }
variable "alb_certificate_arn" {
  type = string

  validation {
    condition     = can(regex("^arn:aws[a-z-]*:acm:", var.alb_certificate_arn))
    error_message = "alb_certificate_arn must be a regional ACM certificate ARN."
  }
}
variable "origin_verify_header_value" {
  type        = string
  sensitive   = true
  description = "High-entropy value CloudFront presents to the ALB origin."

  validation {
    condition     = length(var.origin_verify_header_value) >= 32
    error_message = "origin_verify_header_value must contain at least 32 characters."
  }
}
variable "enable_alb_deletion_protection" { type = bool }
variable "application_log_group_name" { type = string }
variable "secret_arns" { type = map(string) }
variable "storage_bucket_name" { type = string }
variable "storage_region" { type = string }
variable "tags" { type = map(string) }
