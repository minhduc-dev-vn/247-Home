locals {
  name                       = "${var.project_name}-${var.environment}"
  application_log_group_name = "/aws/247-home/${var.environment}/application"
  ecs_cluster_name           = "${local.name}-cluster"
  ecs_service_name           = "${local.name}-web"

  tags = merge(var.additional_tags, {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
    DataClass   = "confidential"
  })
}
