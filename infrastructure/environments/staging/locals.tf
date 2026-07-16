locals {
  environment = "staging"
  provider_tags = {
    Project     = "247-home"
    Environment = local.environment
    ManagedBy   = "Terraform"
  }

  vpc_cidr         = "10.47.0.0/16"
  asset_bucket     = "247-home-staging-assets"
  domain_aliases   = ["staging.247home.vn"]
  nat_gateway_mode = "single"

  ecs = {
    cpu           = 512
    memory        = 1024
    desired_count = 1
    min_count     = 1
    max_count     = 1
  }

  database = {
    instance_class            = "db.t4g.small"
    allocated_storage         = 30
    max_allocated_storage     = 100
    multi_az                  = false
    backup_retention_days     = 7
    deletion_protection       = true
    skip_final_snapshot       = false
    performance_insights_days = 7
  }
}
