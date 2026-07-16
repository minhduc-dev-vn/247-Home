variable "name" { type = string }
variable "origin_domain_name" { type = string }
variable "origin_id" { type = string }
variable "origin_verify_header_value" {
  type      = string
  sensitive = true
}
variable "web_acl_arn" { type = string }
variable "aliases" {
  type = list(string)

  validation {
    condition     = length(var.aliases) > 0
    error_message = "At least one CloudFront alias is required."
  }
}
variable "certificate_arn" {
  type = string

  validation {
    condition     = can(regex("^arn:aws[a-z-]*:acm:us-east-1:", var.certificate_arn))
    error_message = "CloudFront certificate must be an ACM certificate in us-east-1."
  }
}
variable "price_class" {
  type    = string
  default = "PriceClass_200"

  validation {
    condition     = contains(["PriceClass_100", "PriceClass_200", "PriceClass_All"], var.price_class)
    error_message = "Invalid CloudFront price class."
  }
}
variable "tags" { type = map(string) }
