# Staging Secret Setup

## Approved binding

Use the deployment platform secret manager or a dedicated managed vault. A
committed `.env`, Docker build argument, image layer, CI artifact, command-line
value or Playwright trace is not an approved secret source.

Required runtime bindings:

| Name | Secret | Consumer |
|---|---:|---|
| `DATABASE_URL` | Yes | Application runtime role |
| `NEXTAUTH_SECRET` | Yes | Application runtime |
| `NEXTAUTH_URL` | No | Final HTTPS origin |
| `APP_ORIGIN` | No | Final HTTPS origin |
| `EVIDENCE_STORAGE_PROVIDER` | No | Must be `s3` |
| `STORAGE_BUCKET` | Sensitive config | Runtime |
| `STORAGE_REGION` | No | Runtime |
| `STORAGE_ENDPOINT` | No | Runtime when provider requires it |
| `STORAGE_ACCESS_KEY` | Yes | Runtime, unless workload identity is used |
| `STORAGE_SECRET_KEY` | Yes | Runtime, unless workload identity is used |
| `TRUST_PROXY_HEADERS` | No | Enable only after ingress validation |

Migration and deploy-hook credentials are separate protected GitHub
Environment secrets described in `STAGING_CI_CD.md`.

## Controls

- Encrypt at rest and in transit; audit every read/change.
- Grant CI, runtime and human operators only their required secret versions.
- Deny staging secrets to pull-request workflows and developers by default.
- Rotate database, Auth and storage credentials independently.
- Never print environment values; scan image/config/log output for canaries.
- Rotating `NEXTAUTH_SECRET` invalidates sessions and requires a tester notice.

## Validation evidence

Record secret reference/version identifiers, access-policy review, successful
runtime injection, negative old-credential test, rotation timestamp and log/
artifact canary scans. Never record values.

No approved vault or platform secret binding is available in this checkout.

