output "vpc_id" {
  value = aws_vpc.this.id
}

output "vpc_cidr" {
  value = aws_vpc.this.cidr_block
}

output "public_subnet_ids" {
  value = [for az in var.availability_zones : aws_subnet.public[az].id]
}

output "private_app_subnet_ids" {
  value = [for az in var.availability_zones : aws_subnet.private_app[az].id]
}

output "private_db_subnet_ids" {
  value = [for az in var.availability_zones : aws_subnet.private_db[az].id]
}

output "private_app_route_table_ids" {
  value = [for az in var.availability_zones : aws_route_table.private_app[az].id]
}
