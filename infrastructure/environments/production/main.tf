module "platform" {
  source = "../../modules/platform"

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }

  environment                            = local.environment
  aws_region                             = var.aws_region
  availability_zones                     = var.availability_zones
  vpc_cidr                               = local.vpc_cidr
  nat_gateway_mode                       = local.nat_gateway_mode
  container_image                        = var.container_image
  ecs_cpu                                = local.ecs.cpu
  ecs_memory                             = local.ecs.memory
  ecs_desired_count                      = local.ecs.desired_count
  ecs_min_count                          = local.ecs.min_count
  ecs_max_count                          = local.ecs.max_count
  enable_ecs_service                     = var.enable_ecs_service
  alb_certificate_arn                    = var.alb_certificate_arn
  alb_origin_domain_name                 = var.alb_origin_domain_name
  cloudfront_certificate_arn             = var.cloudfront_certificate_arn
  origin_verify_header_value             = var.origin_verify_header_value
  domain_aliases                         = local.domain_aliases
  cloudfront_price_class                 = "PriceClass_200"
  waf_rate_rule_action                   = "count"
  waf_baseline_rate_limit                = 2000
  waf_auth_rate_limit                    = 100
  asset_bucket_name                      = local.asset_bucket
  asset_noncurrent_expiration_days       = 365
  ecr_retain_tagged_images               = 100
  db_instance_class                      = local.database.instance_class
  db_allocated_storage                   = local.database.allocated_storage
  db_max_allocated_storage               = local.database.max_allocated_storage
  db_multi_az                            = local.database.multi_az
  db_backup_retention_days               = local.database.backup_retention_days
  db_deletion_protection                 = local.database.deletion_protection
  db_skip_final_snapshot                 = local.database.skip_final_snapshot
  db_performance_insights_retention_days = local.database.performance_insights_days
  log_retention_days                     = 90
  github_oidc_subjects                   = var.github_oidc_subjects
  ses_identity_arn                       = var.ses_identity_arn
  alarm_email                            = var.alarm_email
  additional_tags                        = var.additional_tags
}
