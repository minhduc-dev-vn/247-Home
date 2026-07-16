# Domain and Certificate Plan

Status: **DESIGN READY; DOMAIN INPUTS MISSING**  
Owner: Platform and Security  
Last reviewed: 2026-07-15

## Purpose

This plan defines the DNS and TLS boundary for 247 Home without assuming domain
ownership or creating records and certificates. The root domain, DNS provider,
AWS account IDs and certificate ARNs remain required human inputs.

## Hostname model

Replace `<root-domain>` only after ownership and registrar access are verified.

| Environment | Customer hostname | CloudFront origin hostname | DNS target |
| --- | --- | --- | --- |
| Staging | `staging.<root-domain>` | `origin-staging.<root-domain>` | Customer hostname to CloudFront; origin hostname to the staging ALB |
| Production | `<root-domain>`, `www.<root-domain>` | `origin.<root-domain>` | Customer hostnames to CloudFront; origin hostname to the production ALB |

The origin hostnames are required because CloudFront validates the certificate
presented by the HTTPS origin. An ACM certificate cannot be issued for the AWS
owned `*.elb.amazonaws.com` name.

## Certificate model

Two certificate scopes are required per environment:

1. **Edge certificate:** ACM in `us-east-1`, covering only the customer-facing
   aliases used by CloudFront.
2. **Origin certificate:** ACM in the application region
   (`ap-southeast-1` in the current Terraform examples), covering the
   environment's project-owned origin hostname used by the ALB listener.

Use DNS validation. Keep validation records for automatic renewal. Certificate
private keys remain managed by ACM and must not be exported or placed in Git,
Terraform variables, CI logs or Secrets Manager.

## Provisioning sequence

1. Verify domain ownership, registrar lock, MFA and named DNS administrators.
2. Decide whether Route 53 is authoritative. If it is not, document the external
   DNS change and rollback owners.
3. Review CAA records and allow the Amazon CA before requesting certificates.
4. Request the edge certificate in `us-east-1` and the origin certificate in
   `ap-southeast-1`; add the ACM DNS validation records.
5. Record certificate ARNs in the protected environment input store, never in a
   committed real `.tfvars` file.
6. After an authorized foundation deployment, create the origin alias to the ALB
   using the Terraform `alb_dns_name` and `alb_zone_id` outputs.
7. Validate ALB TLS with the origin hostname, then deploy CloudFront with that
   origin name and the edge certificate.
8. Add customer aliases to CloudFront only after health, WAF, origin-header and
   direct-ALB denial tests pass.
9. Lower DNS TTL before cutover, monitor errors, then restore the approved TTL.

## Security and operations

- Restrict ALB ingress to the CloudFront origin-facing managed prefix list and
  require the secret origin-verification header already modeled in Terraform.
- Do not publish the origin-verification value in DNS, logs, plans or tickets.
- Keep the origin hostname out of customer links; it is not an authorization
  boundary and direct requests must still be denied by the listener rule.
- Enable Route 53 DNS query logging where approved and alert on ACM renewal
  failures and certificates with fewer than 30 days remaining.
- Use DNSSEC where the registrar and authoritative provider support the agreed
  operating procedure.
- Separate staging and production hosted zones/accounts when organization
  controls require it. Cross-account DNS changes need an explicit role and
  change record.

## Rollback

DNS rollback changes customer aliases back to the last validated distribution;
it does not delete certificates, hosted zones or the ALB. Retain previous DNS
targets until the rollback window closes. Certificate problems are forward-fixed
by issuing and validating a replacement certificate, then updating the approved
Terraform input.

## Missing inputs and exit criteria

The domain gate remains blocked until all of the following are recorded:

- verified root domain and registrar/DNS owner;
- customer and origin hostnames for staging and production;
- authoritative hosted-zone IDs or documented external DNS workflow;
- edge and origin certificate ARNs in the correct accounts and regions;
- DNS change approver, rollback owner and cutover window;
- successful TLS validation from CloudFront to the ALB origin.

