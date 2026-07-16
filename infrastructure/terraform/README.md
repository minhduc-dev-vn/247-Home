# Terraform toolchain

247 Home requires Terraform `>= 1.8, < 2.0`. Validation was performed with
Terraform 1.15.8 and AWS provider 6.54.x. This directory records the CLI
toolchain only; deployable roots are under `../environments`.

Do not store state, plans, credentials, or real `tfvars` in the repository.
