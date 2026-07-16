# Remote state bootstrap

The environment roots declare an empty S3 backend. The backend bucket and
DynamoDB lock table are account-level bootstrap resources and deliberately are
not managed by the same state they protect.

Create them once through the independently reviewed CloudFormation template in
`bootstrap/backend.template.yaml`. CloudFormation is used so the backend
bootstrap does not create a local Terraform state file. The stack provides:

- S3 versioning, Block Public Access, SSE-KMS, access logging and deletion
  protection;
- a DynamoDB table with string partition key `LockID` and point-in-time recovery;
- least-privilege state access for the approved Terraform execution role;
- separate bucket/table or at least separate account and key for each
  environment.

The retained KMS key, state bucket, access-log bucket and lock table are not
deleted as rollback. Use a reviewed forward-fix and recover a prior state object
version when required. Commands and the missing real inputs are documented in
`docs/TERRAFORM_BACKEND_SETUP.md`.

Copy the appropriate example outside Git, replace placeholders, then initialize:

```powershell
terraform init -backend-config=<protected-backend-config>
```

Validation uses `terraform init -backend=false` and creates no AWS resources.
