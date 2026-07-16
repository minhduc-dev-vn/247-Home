output "ecr_repository_url" { value = module.platform.ecr_repository_url }
output "asset_bucket_name" { value = module.platform.asset_bucket_name }
output "secret_names" { value = module.platform.secret_names }
output "ecs_cluster_name" { value = module.platform.ecs_cluster_name }
output "ecs_service_name" { value = module.platform.ecs_service_name }
output "task_definition_arn" { value = module.platform.task_definition_arn }
output "alb_dns_name" { value = module.platform.alb_dns_name }
output "alb_zone_id" { value = module.platform.alb_zone_id }
output "migration_role_arn" { value = module.platform.migration_role_arn }
output "github_actions_role_arn" { value = module.platform.github_actions_role_arn }
output "cloudfront_distribution_id" { value = module.platform.cloudfront_distribution_id }
output "cloudfront_domain_name" { value = module.platform.cloudfront_domain_name }
output "cloudfront_hosted_zone_id" { value = module.platform.cloudfront_hosted_zone_id }
output "rds_address" {
  value     = module.platform.rds_address
  sensitive = true
}
