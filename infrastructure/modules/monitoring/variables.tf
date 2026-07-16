variable "name" { type = string }
variable "create_application_log_group" {
  type    = bool
  default = false
}
variable "create_alarms" {
  type    = bool
  default = false
}
variable "application_log_group_name" { type = string }
variable "log_retention_days" { type = number }
variable "logs_kms_key_arn" { type = string }
variable "ecs_cluster_name" { type = string }
variable "ecs_cluster_arn" {
  type    = string
  default = null
}
variable "ecs_service_name" { type = string }
variable "ecs_minimum_task_count" { type = number }
variable "rds_identifier" { type = string }
variable "rds_allocated_storage_gib" { type = number }
variable "alb_arn_suffix" {
  type    = string
  default = null
}
variable "alarm_email" {
  type        = string
  default     = null
  description = "Optional reviewed operations email. Subscription requires confirmation."
}
variable "tags" { type = map(string) }
