# Stride training diary

A private, offline-friendly training and rehabilitation diary PWA. Entries are stored in the browser on the device. There is no account, API, analytics, or cloud database. Use **Export backup** regularly to save a JSON copy somewhere safe; importing a backup replaces the current diary on that device.

Add the exercises and instructions from your physiotherapist in the Rehab view. The app records sessions and how they felt; it does not prescribe a progression or assess an injury.

## Run locally

Requires Node.js 20.19+ or 22.12+.

```sh
npm install
npm run dev
```

To build the static site:

```sh
npm run build
```

## Deploy to AWS with Terraform

The Terraform stack creates a private, encrypted S3 bucket and a CloudFront distribution with Origin Access Control, HTTPS redirect, and security headers. The S3 bucket is never public. It attaches the existing issued `*.mandla.tech` ACM certificate to CloudFront. CloudFront requires the viewer certificate to be in `us-east-1`; Terraform looks it up there. DNS remains with Zone.ee: after applying Terraform, add a CNAME for `stride` whose target is `terraform output -raw cloudfront_domain_name`. State is local by default; keep the state file private and back it up securely.

```sh
cd infra/terraform
terraform init
terraform plan
terraform apply
```

After Terraform is applied, run `terraform output -raw cloudfront_domain_name` from `infra/terraform` and use the returned CloudFront hostname as the DNS target. Add this record in Zone.ee's DNS management:

| Field | Value |
| --- | --- |
| Type | CNAME |
| Host/name | `stride` |
| Target | CloudFront hostname returned by Terraform |

Zone.ee documents CNAME as an available record type in its DNS manager. DNS changes can take time to propagate; its guide says 1–2 hours on nearby networks and up to 24 hours worldwide ([Zone.ee DNS record guide](https://www.zone.ee/help/en/kb/changing-dns-records-2/)).

AWS free usage is account- and date-dependent. This setup uses services that may have free allowances, but exceeding them can incur charges, and CloudFront usage is not a guarantee of $0. Check the current [AWS Free Tier](https://aws.amazon.com/free/) before deploying. The app works locally as a PWA without AWS.

## CI/CD deployment

GitHub Actions builds the PWA on pull requests. On pushes to `main` (and manual runs started from `main`), it assumes a short-lived production AWS role with GitHub OIDC, syncs the build to the app bucket, and invalidates CloudFront. It does not run Terraform; keep planning and applying infrastructure manually.

After the initial Terraform apply, add these values under the GitHub repository's **Settings → Secrets and variables → Actions**:

- Secret `AWS_DEPLOY_ROLE_ARN`: `terraform output -raw github_actions_deploy_role_arn`
- Variable `DEPLOY_BUCKET_NAME`: `terraform output -raw bucket_name`
- Variable `CLOUDFRONT_DISTRIBUTION_ID`: `terraform output -raw distribution_id`

The dedicated role is restricted to this repository's `main` branch and only has permission to upload/delete objects in the app bucket and create invalidations for this CloudFront distribution. The production account already has GitHub's OIDC provider registered. The workflow is in `.github/workflows/deploy.yml`.

## Data and security

- Diary entries remain in this browser's local storage and are not transmitted to AWS.
- Hosting uses private S3 origin access through CloudFront OAC; public S3 access is blocked.
- HTTPS is enforced and the response policy sets CSP, HSTS, frame, MIME, and referrer protections.
- Avoid entering highly sensitive medical information on a shared device. Use the browser's device lock and keep backups secure.
