variable "name" {
  type        = string
  description = "Resource name prefix."

  validation {
    condition     = can(regex("^[a-z0-9-]{3,40}$", var.name))
    error_message = "name must contain only lowercase letters, digits, and hyphens."
  }
}

variable "vpc_cidr" {
  type        = string
  description = "IPv4 CIDR for the environment VPC."

  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "vpc_cidr must be a valid IPv4 CIDR."
  }
}

variable "availability_zones" {
  type        = list(string)
  description = "At least two AZs in the selected AWS region."

  validation {
    condition     = length(var.availability_zones) >= 2 && length(var.availability_zones) <= 3 && length(distinct(var.availability_zones)) == length(var.availability_zones)
    error_message = "Provide two or three distinct availability zones."
  }
}

variable "nat_gateway_mode" {
  type        = string
  description = "NAT topology: none, single, or per_az."
  default     = "none"

  validation {
    condition     = contains(["none", "single", "per_az"], var.nat_gateway_mode)
    error_message = "nat_gateway_mode must be none, single, or per_az."
  }
}

variable "tags" {
  type        = map(string)
  description = "Tags applied to all resources."
  default     = {}
}
