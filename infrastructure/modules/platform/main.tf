module "networking" {
  source = "../networking"

  name               = local.name
  vpc_cidr           = var.vpc_cidr
  availability_zones = var.availability_zones
  nat_gateway_mode   = var.nat_gateway_mode
  tags               = local.tags
}

module "security" {
  source = "../security"

  name           = local.name
  vpc_id         = module.networking.vpc_id
  vpc_cidr       = module.networking.vpc_cidr
  container_port = var.container_port
  tags           = local.tags
}

module "ecr" {
  source = "../ecr"

  name                 = local.name
  kms_key_arn          = module.security.data_kms_key_arn
  retain_tagged_images = var.ecr_retain_tagged_images
  tags                 = local.tags
}

module "s3" {
  source = "../s3"

  bucket_name                = var.asset_bucket_name
  kms_key_arn                = module.security.data_kms_key_arn
  allowed_origins            = [for alias in var.domain_aliases : "https://${alias}"]
  noncurrent_expiration_days = var.asset_noncurrent_expiration_days
  tags                       = local.tags
}

module "secrets" {
  source = "../secrets"

  name        = local.name
  kms_key_arn = module.security.secrets_kms_key_arn
  tags        = local.tags
}

module "rds" {
  source = "../rds"

  name                                = local.name
  subnet_ids                          = module.networking.private_db_subnet_ids
  security_group_id                   = module.security.rds_security_group_id
  kms_key_arn                         = module.security.data_kms_key_arn
  secrets_kms_key_arn                 = module.security.secrets_kms_key_arn
  instance_class                      = var.db_instance_class
  allocated_storage                   = var.db_allocated_storage
  max_allocated_storage               = var.db_max_allocated_storage
  multi_az                            = var.db_multi_az
  backup_retention_days               = var.db_backup_retention_days
  deletion_protection                 = var.db_deletion_protection
  skip_final_snapshot                 = var.db_skip_final_snapshot
  performance_insights_retention_days = var.db_performance_insights_retention_days
  tags                                = local.tags
}

module "iam" {
  source = "../iam"

  name                 = local.name
  ecr_repository_arn   = module.ecr.repository_arn
  s3_bucket_arn        = module.s3.bucket_arn
  secret_arns          = module.secrets.secret_arns
  data_kms_key_arn     = module.security.data_kms_key_arn
  secrets_kms_key_arn  = module.security.secrets_kms_key_arn
  ses_identity_arn     = var.ses_identity_arn
  github_oidc_subjects = var.github_oidc_subjects
  tags                 = local.tags
}

module "monitoring_logs" {
  source = "../monitoring"

  name                         = local.name
  create_application_log_group = true
  create_alarms                = false
  application_log_group_name   = local.application_log_group_name
  log_retention_days           = var.log_retention_days
  logs_kms_key_arn             = module.security.logs_kms_key_arn
  ecs_cluster_name             = local.ecs_cluster_name
  ecs_service_name             = local.ecs_service_name
  ecs_minimum_task_count       = var.ecs_min_count
  rds_identifier               = module.rds.identifier
  rds_allocated_storage_gib    = var.db_allocated_storage
  tags                         = local.tags
}

module "ecs" {
  source = "../ecs"

  name                           = local.name
  vpc_id                         = module.networking.vpc_id
  public_subnet_ids              = module.networking.public_subnet_ids
  private_subnet_ids             = module.networking.private_app_subnet_ids
  alb_security_group_id          = module.security.alb_security_group_id
  ecs_security_group_id          = module.security.ecs_security_group_id
  execution_role_arn             = module.iam.ecs_execution_role_arn
  task_role_arn                  = module.iam.ecs_application_role_arn
  migration_role_arn             = module.iam.migration_role_arn
  container_image                = var.container_image
  migration_container_image      = var.migration_container_image
  container_port                 = var.container_port
  cpu                            = var.ecs_cpu
  memory                         = var.ecs_memory
  desired_count                  = var.ecs_desired_count
  min_count                      = var.ecs_min_count
  max_count                      = var.ecs_max_count
  enable_service                 = var.enable_ecs_service
  alb_certificate_arn            = var.alb_certificate_arn
  origin_verify_header_value     = var.origin_verify_header_value
  enable_alb_deletion_protection = var.environment == "production"
  application_log_group_name     = module.monitoring_logs.application_log_group_name
  secret_arns                    = module.secrets.secret_arns
  storage_bucket_name            = module.s3.bucket_name
  storage_region                 = var.aws_region
  vnpay_payment_url              = var.vnpay_payment_url
  vnpay_query_url                = var.vnpay_query_url
  vnpay_return_url               = var.vnpay_return_url
  tags                           = local.tags

  depends_on = [module.monitoring_logs]
}

module "waf" {
  source = "../waf"

  providers = { aws = aws.us_east_1 }

  name                = local.name
  rate_rule_action    = var.waf_rate_rule_action
  baseline_rate_limit = var.waf_baseline_rate_limit
  auth_rate_limit     = var.waf_auth_rate_limit
  mutation_rate_limit = var.waf_mutation_rate_limit
  log_retention_days  = var.log_retention_days
  logs_kms_key_arn    = null
  tags                = local.tags
}

module "cloudfront" {
  source = "../cloudfront"

  name                       = local.name
  origin_domain_name         = var.alb_origin_domain_name
  origin_id                  = "${local.name}-alb"
  origin_verify_header_value = var.origin_verify_header_value
  web_acl_arn                = module.waf.web_acl_arn
  aliases                    = var.domain_aliases
  certificate_arn            = var.cloudfront_certificate_arn
  price_class                = var.cloudfront_price_class
  tags                       = local.tags
}

module "monitoring_alarms" {
  source = "../monitoring"

  name                         = local.name
  create_application_log_group = false
  create_alarms                = var.enable_ecs_service
  application_log_group_name   = local.application_log_group_name
  log_retention_days           = var.log_retention_days
  logs_kms_key_arn             = module.security.logs_kms_key_arn
  ecs_cluster_name             = module.ecs.cluster_name
  ecs_cluster_arn              = module.ecs.cluster_arn
  ecs_service_name             = module.ecs.service_name
  ecs_minimum_task_count       = var.ecs_min_count
  rds_identifier               = module.rds.identifier
  rds_allocated_storage_gib    = var.db_allocated_storage
  alb_arn_suffix               = module.ecs.alb_arn_suffix
  alarm_email                  = var.alarm_email
  tags                         = local.tags
}
