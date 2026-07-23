output "vpc_id" { value = module.networking.vpc_id }
output "ecr_repository_url" { value = module.ecr.repository_url }
output "asset_bucket_name" { value = module.s3.bucket_name }
output "rds_address" {
  value     = module.rds.address
  sensitive = true
}
output "secret_names" { value = module.secrets.secret_names }
output "ecs_cluster_name" { value = module.ecs.cluster_name }
output "ecs_service_name" { value = module.ecs.service_name }
output "task_definition_arn" { value = module.ecs.task_definition_arn }
output "migration_task_definition_arn" { value = module.ecs.migration_task_definition_arn }
output "private_app_subnet_ids" { value = module.networking.private_app_subnet_ids }
output "migration_security_group_id" { value = module.security.migration_security_group_id }
output "rds_identifier" { value = module.rds.identifier }
output "alb_dns_name" { value = module.ecs.alb_dns_name }
output "alb_zone_id" { value = module.ecs.alb_zone_id }
output "migration_role_arn" { value = module.iam.migration_role_arn }
output "github_actions_role_arn" { value = module.iam.github_actions_role_arn }
output "cloudfront_distribution_id" { value = module.cloudfront.distribution_id }
output "cloudfront_domain_name" { value = module.cloudfront.domain_name }
output "cloudfront_hosted_zone_id" { value = module.cloudfront.hosted_zone_id }
output "alarm_topic_arn" { value = module.monitoring_alarms.alarm_topic_arn }
