variable "name" { type = string }
variable "ecr_repository_arn" { type = string }
variable "s3_bucket_arn" { type = string }
variable "secret_arns" { type = map(string) }
variable "data_kms_key_arn" { type = string }
variable "secrets_kms_key_arn" { type = string }
variable "ses_identity_arn" {
  type        = string
  description = "Verified SES identity ARN. Use an account-scoped placeholder until SES is approved."
}
variable "github_oidc_subjects" {
  type        = list(string)
  description = "Exact GitHub OIDC subject claims allowed to deploy."

  validation {
    condition = (
      length(var.github_oidc_subjects) > 0 &&
      alltrue([
        for subject in var.github_oidc_subjects :
        can(regex("^repo:[^:*?]+/[^:*?]+:environment:[^:*?]+$", subject))
      ])
    )
    error_message = "Each GitHub OIDC subject must be an exact repo:<owner>/<repository>:environment:<environment> value without wildcards."
  }
}
variable "github_oidc_thumbprints" {
  type        = list(string)
  description = "Reviewed GitHub OIDC CA thumbprints."
  default = [
    "6938fd4d98bab03faadb97b34396831e3780aea1",
    "1b511abead59c6ce207077c0bf0e0043b1382612",
  ]
}
variable "tags" { type = map(string) }
