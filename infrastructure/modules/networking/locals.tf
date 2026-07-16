locals {
  public_subnets = {
    for index, az in var.availability_zones : az => cidrsubnet(var.vpc_cidr, 4, index)
  }
  private_app_subnets = {
    for index, az in var.availability_zones : az => cidrsubnet(var.vpc_cidr, 4, index + 4)
  }
  private_db_subnets = {
    for index, az in var.availability_zones : az => cidrsubnet(var.vpc_cidr, 4, index + 8)
  }

  nat_keys = var.nat_gateway_mode == "none" ? [] : (
    var.nat_gateway_mode == "single" ? [var.availability_zones[0]] : var.availability_zones
  )
}
