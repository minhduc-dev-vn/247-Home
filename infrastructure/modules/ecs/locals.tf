locals {
  cluster_name = "${var.name}-cluster"
  service_name = "${var.name}-web"

  runtime_environment = [
    { name = "NODE_ENV", value = "production" },
    { name = "HOSTNAME", value = "0.0.0.0" },
    { name = "PORT", value = tostring(var.container_port) },
    { name = "TZ", value = "UTC" },
    { name = "TRUST_PROXY_HEADERS", value = "true" },
    { name = "EVIDENCE_STORAGE_PROVIDER", value = "s3" },
    { name = "STORAGE_BUCKET", value = var.storage_bucket_name },
    { name = "STORAGE_REGION", value = var.storage_region },
    { name = "STORAGE_FORCE_PATH_STYLE", value = "false" },
  ]

  runtime_secrets = [
    { name = "DATABASE_URL", valueFrom = var.secret_arns["DATABASE_URL"] },
    { name = "NEXTAUTH_SECRET", valueFrom = var.secret_arns["AUTH_SECRET"] },
    { name = "NEXTAUTH_URL", valueFrom = var.secret_arns["AUTH_URL"] },
    { name = "APP_ORIGIN", valueFrom = var.secret_arns["APP_ORIGIN"] },
  ]
}
