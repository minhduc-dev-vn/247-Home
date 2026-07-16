provider "aws" {
  region = var.aws_region

  default_tags {
    tags = local.provider_tags
  }
}

provider "aws" {
  alias  = "us_east_1"
  region = var.edge_region

  default_tags {
    tags = local.provider_tags
  }
}
