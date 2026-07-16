# AWS Account Setup

Status: **STRATEGY DEFINED, EXECUTION BLOCKED**  
Region: `ap-southeast-1`  
Date: 2026-07-15

## 1. Account structure

247 Home requires two isolated workload accounts. Sharing one account is not an
approved fallback.

| Account | Purpose | Customer data | Default access |
| --- | --- | --- | --- |
| Staging | Restricted validation with synthetic data | Prohibited | Platform engineers and QA |
| Production | Customer-serving workload | Allowed under approved controls | Read-only by default; deploy through protected automation |

The preferred organization layout is:

```text
AWS Organizations management account
|-- Security / log archive account
|-- 247 Home Staging account
`-- 247 Home Production account
```

If the organization does not yet have central security/logging accounts, that
gap requires CTO/Security acceptance. It does not justify combining staging and
production.

## 2. Missing account inputs

- [ ] AWS Organizations management owner and contact.
- [ ] Staging 12-digit account ID.
- [ ] Production 12-digit account ID.
- [ ] Unique account aliases.
- [ ] Root account email and phone owned by the company, not an individual.
- [ ] Billing owner and monthly budget thresholds.
- [ ] IAM Identity Center instance/region and identity source.
- [ ] Security/log archive account IDs, if available.
- [ ] Approved break-glass custodians.

No placeholder in this document may be submitted to AWS.

## 3. Root account protection

For each workload account:

1. Use a unique company-managed mailbox with monitored recovery paths.
2. Store the root password in the approved enterprise password vault.
3. Register at least two phishing-resistant hardware MFA devices held by
   separate custodians.
4. Do not create root access keys. Verify the root access-key count is zero.
5. Complete alternate security, operations and billing contacts.
6. Enable root-user activity alerts through organization CloudTrail/EventBridge.
7. Test the break-glass process, then keep root use limited to tasks that require
   it.

Root sign-in evidence and MFA serials are sensitive and must not enter Git.

## 4. Access model

Use IAM Identity Center for people and OIDC for GitHub Actions. Do not create IAM
users for routine administration or deployment.

| Permission set / role | Staging | Production | Notes |
| --- | --- | --- | --- |
| `SecurityAudit` | Read | Read | Security team; no mutation |
| `BillingReadOnly` | Read | Read | Finance/CTO |
| `PlatformAdministrator` | Admin under change control | Not assigned persistently | Staging foundation only |
| `ProductionReadOnly` | N/A | Read | Operators and incident triage |
| `ProductionBreakGlass` | N/A | Time-bound elevated | MFA, ticket, approval and session logging |
| GitHub release role | Protected staging environment | Protected production environment | OIDC only; exact `aud`/`sub` |

Permission sets use maximum one-hour sessions unless an incident procedure
approves less. Production write access requires just-in-time assignment and a
change record.

## 5. Organization security baseline

- Enable organization CloudTrail with log-file validation into the log archive
  account.
- Enable GuardDuty, Security Hub and AWS Config organization-wide in the approved
  regions.
- Enable IAM Access Analyzer at organization scope.
- Block public S3 access at account level.
- Enable EBS encryption by default and approved KMS key policies.
- Require IMDSv2 for any future EC2 resource. The current architecture uses
  Fargate and creates no EC2 application instances.
- Define SCPs that deny disabling CloudTrail/GuardDuty/Config, leaving the
  organization, use of unapproved regions and creation of public RDS instances.
- Allow `us-east-1` only for CloudFront/ACM/WAF global-service requirements.
- Record approved exceptions rather than weakening the SCP globally.

## 6. Billing baseline

Create account budgets before workload deployment:

| Alert | Staging | Production |
| --- | --- | --- |
| Forecast 50% | Platform owner | Platform + product owner |
| Actual 80% | Platform + billing | Platform + CTO/finance |
| Forecast/actual 100% | Platform + CTO | Platform + CTO/finance/security |

Enable Cost Anomaly Detection and mandatory cost-allocation tags: `Project`,
`Environment`, `Owner`, `CostCenter`, `ManagedBy` and `DataClass`.

## 7. Verification evidence

The account owner must record outside Git:

- `aws sts get-caller-identity` output for the approved session;
- account alias and region allowlist;
- root MFA and zero-root-access-key checks;
- Identity Center assignments and permission-set review;
- CloudTrail, GuardDuty, Security Hub, Config and Access Analyzer status;
- budget IDs and alert recipients;
- SCP evaluation for staging and production.

## 8. Exit criteria

Account foundation is ready only when both account IDs exist, root controls and
billing alerts are verified, Identity Center access works, the security baseline
is delegated, and no person needs a long-lived AWS access key.
