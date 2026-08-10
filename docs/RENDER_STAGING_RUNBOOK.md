# Render Staging Runbook

## Scope

This runbook is for one-instance public Render staging used to validate the
247 Home application. It is not a production deployment profile. Production
continues to require the CloudFront/WAF contract in
`docs/decisions/ADR-002-production-rate-limiting.md`.

## Why This Profile Exists

Render runs Node.js applications with `NODE_ENV=production`. The application
therefore rejects a default Render service because it cannot prove the AWS
CloudFront/WAF ingress contract. The explicit staging profile permits the
existing in-memory limiter only when the service is deliberately held to one
instance and Render is the runtime.

Render documents that public web-service traffic passes through its edge and
that applications should use `X-Forwarded-For` for client IP addresses. The
staging profile accepts that header only when `RENDER=true` and
`TRUSTED_PROXY_PROVIDER=render`.

## Render Service Settings

Create a **Web Service**, not a static site. The current deployment artifact is
the repository `Dockerfile`.

| Setting | Value |
| --- | --- |
| Language | `Docker` |
| Dockerfile path | `./Dockerfile` |
| Docker command | Leave blank to use the image `CMD` |
| Health check path | `/api/health` |
| Instances | Exactly one; disable autoscaling |

Set `PORT=10000`, or remove a manually configured `PORT` and allow Render to
supply its default. Never set it to `5432`; that port belongs only inside the
PostgreSQL connection URL. The Docker health check reads the runtime `PORT`.

The runtime image deliberately excludes migration tooling. Run
`pnpm db:migrate` from a trusted operator environment against the intended
staging database before deploying an application revision. Do not place a
non-functional `pnpm db:migrate` command in the Docker service's pre-deploy
field.

## Required Environment Variables

Set secret values in Render's secret environment variable UI, not source code:

```text
DATABASE_URL=<Render PostgreSQL external or private connection URL>
NEXTAUTH_SECRET=<at least 32 random characters>
NEXTAUTH_URL=https://<service>.onrender.com
APP_ORIGIN=https://<service>.onrender.com
AUTH_SECURE_COOKIES=true
DEPLOYMENT_ENV=staging
RENDER_STAGING_SINGLE_INSTANCE=true
TRUST_PROXY_HEADERS=true
TRUSTED_PROXY_PROVIDER=render
RATE_LIMIT_BACKEND=memory
PORT=10000
```

`RENDER=true` is supplied by Render and must not be set locally to bypass this
profile. If a custom domain is used, replace both URL values with that single
canonical HTTPS origin before testing registration.

Render also supplies `RENDER_EXTERNAL_URL`. The mutation origin allowlist
accepts that platform-provided URL when `RENDER=true`, so the default
`onrender.com` address continues to work while a custom `APP_ORIGIN` is being
configured. Arbitrary forwarded host headers are never trusted.

The non-secret variables are also available in
`render.staging.env.example`. In **Environment**, use **Add from .env** to
import that file's contents, then add `DATABASE_URL`, `NEXTAUTH_SECRET`,
`NEXTAUTH_URL`, and `APP_ORIGIN` separately. Choose **Save, rebuild, and
deploy**. Existing dashboard variables override imported or Blueprint values,
so remove stale values such as `PORT=3000`,
`TRUSTED_PROXY_PROVIDER=cloudfront`, or `RATE_LIMIT_BACKEND=waf`.

If deployment fails with `Invalid Render staging contract`, the log now lists
every missing or incorrect non-secret setting. Correct those exact values
instead of disabling runtime validation.

## Database and Demo Data

Run only against the intended staging database:

```text
SEED_TARGET=staging
STAGING_SEED_CONFIRM=247HOME_RENDER_STAGING
STAGING_DEMO_PASSWORD=<strong operator-provided secret>
```

Then run the one-off Render command `pnpm db:seed:staging`. Never run a reset,
truncate, or local-demo seed against the staging database.

## Registration Verification

1. Open `/api/health`; it must return `200`. Confirm `data.revision` matches
   the first 12 characters of the commit selected in the Render deploy.
2. Open `/register` from `APP_ORIGIN` or the Render-provided external URL.
3. Create one new email account and confirm the API returns `201`.
4. Confirm the browser receives a secure Auth.js session cookie after sign-in.
5. Check Render logs for the application request ID and the corresponding
   Render request trace. Do not log passwords, cookies or database URLs.
6. If registration returns `500`, copy only the `Mã hỗ trợ` request ID shown
   by the form and find the matching `application.error` event. Its
   `errorCode` is safe to share; never copy the error stack or environment.

## Limits and Escalation

- This profile is deliberately limited to one instance. Scaling it invalidates
  the memory rate-limit guarantee and must be blocked until Render Key Value or
  another reviewed shared rate-limit store is implemented.
- It is for staging/demo validation, not production traffic or production
  payment processing.
- A missing or mismatched origin returns `403` for registration mutations. Set
  `NEXTAUTH_URL` and `APP_ORIGIN` to the exact browser-visible HTTPS origin.
- System roles are installed by migration
  `20260726120000_identity_role_reference_data`; registration does not depend
  on running the development/demo seed. Registration also repairs a missing
  `CUSTOMER` role transactionally, but this is not a substitute for applying
  migrations.
- If `429` occurs, inspect the Render request trace and wait for the relevant
  rate-limit window; do not disable the limiter.
