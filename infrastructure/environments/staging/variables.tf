variable "aws_region" {
  type    = string
  default = "ap-southeast-1"

  validation {
    condition     = can(regex("^[a-z]{2}-[a-z]+-[0-9]+$", var.aws_region))
    error_message = "aws_region must be a valid AWS region name."
  }
}

variable "edge_region" {
  type    = string
  default = "us-east-1"

  validation {
    condition     = var.edge_region == "us-east-1"
    error_message = "CloudFront WAF and certificate resources must use us-east-1."
  }
}

variable "availability_zones" {
  type    = list(string)
  default = ["ap-southeast-1a", "ap-southeast-1b"]
}

variable "container_image" {
  type        = string
  description = "ECR image reference pinned by sha256 digest."
}

variable "alb_certificate_arn" {
  type        = string
  description = "Regional ACM certificate ARN for the ALB origin."
}

variable "alb_origin_domain_name" {
  type        = string
  description = "Project-owned staging origin hostname covered by the ALB certificate."
}

variable "cloudfront_certificate_arn" {
  type        = string
  description = "us-east-1 ACM certificate ARN for CloudFront."
}

variable "origin_verify_header_value" {
  type        = string
  sensitive   = true
  description = "High-entropy CloudFront-to-ALB origin verification value."
}

variable "github_oidc_subjects" {
  type        = list(string)
  description = "Exact GitHub OIDC subjects for the protected staging environment."
}

variable "ses_identity_arn" {
  type        = string
  description = "Verified SES identity ARN; no credential is stored in Terraform."
}

variable "alarm_email" {
  type        = string
  default     = null
  nullable    = true
  description = "Optional reviewed staging alarm recipient."
}

variable "enable_ecs_service" {
  type        = bool
  default     = false
  description = "Enable only after secret versions and a real image digest exist."
}

variable "additional_tags" {
  type    = map(string)
  default = {}
}
