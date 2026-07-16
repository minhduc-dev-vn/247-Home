locals {
  environment = "production"
  provider_tags = {
    Project     = "247-home"
    Environment = local.environment
    ManagedBy   = "Terraform"
  }

  vpc_cidr         = "10.48.0.0/16"
  asset_bucket     = "247-home-production-assets"
  domain_aliases   = ["247home.vn", "www.247home.vn"]
  nat_gateway_mode = "per_az"

  ecs = {
    cpu           = 512
    memory        = 1024
    desired_count = 2
    min_count     = 2
    max_count     = 6
  }

  database = {
    instance_class            = "db.t4g.small"
    allocated_storage         = 50
    max_allocated_storage     = 500
    multi_az                  = true
    backup_retention_days     = 35
    deletion_protection       = true
    skip_final_snapshot       = false
    performance_insights_days = 731
  }
}
