output "ecs_execution_role_arn" { value = aws_iam_role.ecs_execution.arn }
output "ecs_application_role_arn" { value = aws_iam_role.ecs_application.arn }
output "migration_role_arn" { value = aws_iam_role.migration.arn }
output "github_actions_role_arn" { value = aws_iam_role.github_actions.arn }
output "github_oidc_provider_arn" { value = aws_iam_openid_connect_provider.github.arn }
