variable "bucket_name" {
  type = string

  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$", var.bucket_name))
    error_message = "bucket_name must be a valid S3 bucket name."
  }
}
variable "kms_key_arn" { type = string }
variable "allowed_origins" {
  type    = list(string)
  default = []

  validation {
    condition     = alltrue([for origin in var.allowed_origins : can(regex("^https://", origin))])
    error_message = "S3 CORS origins must use HTTPS."
  }
}
variable "noncurrent_expiration_days" {
  type    = number
  default = 90
}
variable "tags" { type = map(string) }
