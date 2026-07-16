variable "name" { type = string }
variable "subnet_ids" { type = list(string) }
variable "security_group_id" { type = string }
variable "kms_key_arn" { type = string }
variable "secrets_kms_key_arn" { type = string }
variable "instance_class" { type = string }
variable "allocated_storage" { type = number }
variable "max_allocated_storage" { type = number }
variable "multi_az" { type = bool }
variable "backup_retention_days" { type = number }
variable "deletion_protection" { type = bool }
variable "skip_final_snapshot" { type = bool }
variable "performance_insights_retention_days" {
  type    = number
  default = 7

  validation {
    condition     = contains([7, 731], var.performance_insights_retention_days)
    error_message = "Performance Insights retention must be 7 or 731 days."
  }
}
variable "tags" { type = map(string) }
