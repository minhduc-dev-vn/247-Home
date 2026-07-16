# Terraform Backend Setup

Status: **BOOTSTRAP CONFIGURATION READY, RESOURCES NOT CREATED**  
Date: 2026-07-15

## 1. Decision

Each AWS workload account receives its own Terraform backend:

- private versioned S3 state bucket;
- DynamoDB lock table with point-in-time recovery;
- customer-managed KMS key;
- private access-log bucket;
- bucket/resource policies scoped to one approved Terraform principal.

No environment may use local Terraform state. Staging and production do not
share buckets, tables, KMS keys or state keys.

## 2. Bootstrap strategy

Terraform cannot safely create the backend that stores its own state without a
temporary local or third-party state. The repository therefore uses the
CloudFormation template at
`infrastructure/backend/bootstrap/backend.template.yaml`. CloudFormation manages
the bootstrap stack state in AWS, so no local `.tfstate` is created.

The template is configuration only. It was not submitted to AWS.

## 3. Resources and controls

| Resource | Controls |
| --- | --- |
| State KMS key | Rotation, 30-day deletion window, retained on stack deletion, scoped principal use |
| State bucket | Block Public Access, bucket-owner enforcement, SSE-KMS, versioning, TLS-only policy, access logging, retained |
| Log bucket | Private, encrypted, versioned, lifecycle retention, service-principal write only |
| Lock table | `LockID` string key, on-demand billing, KMS, PITR, retained, scoped resource policy |

Both DynamoDB locking and S3 native lockfile are configured. DynamoDB remains
because it is an approved requirement; native lockfile provides a future
migration path after a separate review.

## 4. Required inputs

- [ ] Target account ID and approved account alias.
- [ ] Globally unique state bucket name.
- [ ] Globally unique access-log bucket name.
- [ ] Lock table name.
- [ ] Existing approved Identity Center/workload role ARN for bootstrap and state
      access.
- [ ] Change ticket, operator and second approver.

Use the parameter examples under `infrastructure/backend/bootstrap`. Replace
values outside Git.

## 5. Future bootstrap command

This command is documented but was not run:

```powershell
aws cloudformation deploy `
  --region ap-southeast-1 `
  --stack-name 247-home-staging-terraform-backend `
  --template-file infrastructure/backend/bootstrap/backend.template.yaml `
  --parameter-overrides file://<protected-staging-parameters.json> `
  --no-fail-on-empty-changeset
```

Before execution, verify `aws sts get-caller-identity` matches the intended
account and that the parameter file contains no placeholder.

## 6. Post-bootstrap verification

1. Record CloudFormation stack ID and outputs.
2. Verify both buckets reject public access and HTTP.
3. Verify state-bucket default encryption uses the expected KMS key.
4. Upload a non-sensitive canary through the approved role and verify access
   logging. Delete the canary afterward.
5. Verify S3 versioning and DynamoDB PITR are enabled.
6. Verify an unapproved role cannot read state, decrypt KMS or mutate locks.
7. Enable CloudTrail data events for the state bucket and KMS audit alerts.
8. Populate a protected backend configuration from the stack outputs.

Example backend initialization:

```powershell
terraform -chdir=infrastructure/environments/staging init `
  -backend-config=<protected-staging-backend-config> `
  -reconfigure
```

The backend file includes `bucket`, `key`, `region`, `encrypt`, `kms_key_id`,
`dynamodb_table` and `use_lockfile=true`.

## 7. Recovery and locking

- Never edit state objects manually.
- A stuck lock is investigated by run ID and CloudTrail before force-unlock.
- `terraform force-unlock` requires a ticket, two operators and proof that no
  active run owns the lock.
- Recover state by selecting a known S3 version, copying it to an isolated key
  and running read-only inspection before restoration.
- Deleting the stack retains KMS, buckets and table. Data deletion requires a
  separate retention and legal review.

## 8. Exit criteria

Backend is ready only after the stack exists in both accounts, all controls are
verified, approved roles can lock/read/write state, unauthorized roles are
denied, and both Terraform roots initialize against remote state without local
state residue.
