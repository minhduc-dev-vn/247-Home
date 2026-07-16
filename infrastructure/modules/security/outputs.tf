output "data_kms_key_arn" { value = aws_kms_key.data.arn }
output "secrets_kms_key_arn" { value = aws_kms_key.secrets.arn }
output "logs_kms_key_arn" { value = aws_kms_key.logs.arn }
output "alb_security_group_id" { value = aws_security_group.alb.id }
output "ecs_security_group_id" { value = aws_security_group.ecs.id }
output "migration_security_group_id" { value = aws_security_group.migration.id }
output "rds_security_group_id" { value = aws_security_group.rds.id }
