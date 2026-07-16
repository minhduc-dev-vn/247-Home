variable "name" { type = string }
variable "kms_key_arn" { type = string }
variable "retain_tagged_images" {
  type    = number
  default = 30

  validation {
    condition     = var.retain_tagged_images >= 2 && var.retain_tagged_images <= 500
    error_message = "retain_tagged_images must be between 2 and 500."
  }
}
variable "untagged_expiration_days" {
  type    = number
  default = 7
}
variable "tags" { type = map(string) }
