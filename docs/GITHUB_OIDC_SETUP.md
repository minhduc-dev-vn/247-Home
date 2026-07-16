# GitHub OIDC Setup

Status: **CONTRACT READY, EXTERNAL BINDING MISSING**  
Date: 2026-07-15

## 1. Authentication flow

```text
Protected GitHub environment
  -> GitHub OIDC token
  -> AWS STS AssumeRoleWithWebIdentity
  -> short-lived staging or production release role
```

`AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` are prohibited in repository,
organization and environment secrets.

## 2. Required GitHub inputs

- [ ] Approved GitHub organization and repository.
- [ ] Repository numeric ID and owner numeric ID.
- [ ] GitHub remote configured for this checkout.
- [ ] Protected `staging` and `production` environments.
- [ ] Environment reviewers and deployment branch/tag rules.
- [ ] Actual OIDC `sub` claim format for this repository.
- [ ] Staging and production AWS release role ARNs.

The current checkout has no verified remote. No repository name or subject claim
may be invented.

## 3. Token contract

Required claims:

| Claim | Required value |
| --- | --- |
| `iss` | `https://token.actions.githubusercontent.com` |
| `aud` | `sts.amazonaws.com` |
| `sub` | Exact protected-environment subject for the approved repository |

GitHub may issue immutable subjects containing owner/repository IDs. Capture a
real token claim in a non-production diagnostic workflow, redact unrelated
claims, then configure the exact value in Terraform. Do not use a wildcard owner
or repository.

Conceptual trust condition:

```json
{
  "StringEquals": {
    "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
  },
  "StringEquals": {
    "token.actions.githubusercontent.com:sub": "repo:<verified-repository-identity>:environment:<environment>"
  }
}
```

The generated Terraform trust policy uses `StringEquals`, and input validation
rejects wildcard characters. It is authoritative only after real values are
supplied and verified against an issued token.

## 4. GitHub environment protection

Production requires:

- at least one reviewer who did not author the release change;
- no self-approval where GitHub plan supports it;
- deployment restricted to protected immutable release tags;
- environment secrets/variables unavailable to pull requests;
- concurrency set to prevent overlapping production deployments;
- workflow files protected by CODEOWNERS for Platform and Security;
- `id-token: write` granted only to jobs that assume AWS roles.

Staging may use a smaller reviewer set but still requires immutable tags and no
untrusted pull-request credentials.

## 5. AWS role permissions

The repository IAM module creates separate roles per account. The release role
is limited to:

- ECR login and push to the environment repository;
- reviewed ECS task definition/service operations;
- running the approved migration task in the environment cluster;
- passing only execution/application/migration task roles to ECS;
- creating and describing pre-migration RDS snapshots.

Terraform provisioning requires a separate, just-in-time infrastructure role.
Do not expand the release role to account administrator.

## 6. Workflow pattern

```yaml
permissions:
  contents: read
  id-token: write

environment: staging
```

The future workflow uses a SHA-pinned version of
`aws-actions/configure-aws-credentials`, supplies the approved role ARN and
region, and verifies `aws sts get-caller-identity` before any mutation. Action
version changes require supply-chain review.

## 7. Negative verification

- Pull-request jobs cannot request the deployment role.
- A token for staging cannot assume production.
- A token from another repository/owner cannot assume either role.
- A token with the wrong audience is denied.
- An unprotected branch/tag is denied.
- CloudTrail records successful and denied STS attempts without logging the
  token.

## 8. Exit criteria

OIDC is ready only after the real repository/immutable subjects are bound,
protected environments are enforced, role-policy simulation and negative tests
pass in both accounts, and static AWS credential secrets are confirmed absent.
