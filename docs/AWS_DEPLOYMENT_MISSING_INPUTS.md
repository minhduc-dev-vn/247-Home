# AWS Deployment Missing Inputs

Status: **OPEN CHECKLIST**  
Last reviewed: 2026-07-15

No value in this checklist may be invented. Secret values must be supplied only
through the approved secret manager and must never be added to this document.

| ID | Required input/evidence | Accountable owner | Current status | Blocks |
| --- | --- | --- | --- | --- |
| MI-01 | AWS Organizations structure and separate staging/production account IDs and aliases | Cloud owner | Missing | Backend, OIDC and all plans |
| MI-02 | Root MFA, Identity Center, security/billing contacts and break-glass evidence | Security/Cloud owner | Missing | Account approval |
| MI-03 | Budget amounts, alert recipients and MVP cost approval | Product/Finance | Missing | Cost approval |
| MI-04 | Unique state/log bucket names, lock table names and bootstrap principal ARNs per account | Platform | Missing | Remote backend |
| MI-05 | CloudFormation backend stack outputs and independent access/recovery test | Platform/Security | Missing | Terraform initialization |
| MI-06 | Canonical GitHub organization, repository numeric ID/name and protected environment reviewers | Repository owner | Missing; no authoritative remote is available in this checkout | OIDC trust |
| MI-07 | GitHub OIDC provider and exact staging/production `sub` claims verified in CloudTrail | Platform/Security | Missing | CI plan/publish roles |
| MI-08 | Root domain ownership, DNS provider, hosted-zone IDs and DNS change owners | Domain owner | Missing | HTTPS and routing |
| MI-09 | Customer/origin hostnames plus edge (`us-east-1`) and ALB-region ACM certificate ARNs | Domain/Security | Missing | CloudFront and ALB TLS |
| MI-10 | ECR repository outputs, immutable image digest and vulnerability-policy evidence | Release/Security | Missing | ECS release |
| MI-11 | Secret definition owners and real `AWSCURRENT` versions populated out of band | Security/Application owners | Missing | ECS enablement |
| MI-12 | RDS sizing, maintenance window, migration/runtime DB role owners and secret references | DBA/Product | Missing | Database bootstrap |
| MI-13 | Dedicated migration image/task implementation and a successful rehearsal on staging backup/restore | Release/DBA | Missing | Schema deployment |
| MI-14 | SES identity, production mail adapter decision and delivery/abuse controls | Application/Security | Missing | Production password reset |
| MI-15 | Evidence/product media storage ownership, retention and production product-image adapter decision | Product/Security | Missing | Production media readiness |
| MI-16 | Alarm/SNS recipients, on-call rota, incident channel and log retention approval | Operations/Security | Missing | Operational readiness |
| MI-17 | WAF baseline evidence, approved thresholds and count-to-block decision | Security | Missing | Production enforcement |
| MI-18 | Authorized Terraform plan reviewers and two-person apply/change procedure | Change authority | Missing | Any future apply |

## Handling rules

- Record non-secret identifiers in the approved protected configuration store.
- Store secret material only as secret-manager versions populated out of band.
- Attach evidence links or change IDs; do not paste tokens, passwords, keys,
  cookies, database URLs or origin-verification values.
- Close an item only after a second reviewer verifies it in the target account.
- A local placeholder, example ARN or successful offline validation is not
  evidence that an AWS prerequisite exists.

