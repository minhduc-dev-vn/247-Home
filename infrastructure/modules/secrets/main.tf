resource "aws_secretsmanager_secret" "this" {
  for_each = local.definitions

  name                    = "${var.name}/${each.value}"
  description             = "247 Home ${each.key} definition; value populated outside Terraform"
  kms_key_id              = var.kms_key_arn
  recovery_window_in_days = var.recovery_window_in_days
  tags                    = merge(var.tags, { SecretContract = each.key })
}
