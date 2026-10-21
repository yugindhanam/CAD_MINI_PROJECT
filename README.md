# Campus Find — Campus Lost and Found Portal

A React + TypeScript college cloud computing project, with an explicitly labeled browser-local demo and a separate AWS implementation. The original proposal is preserved in [read.md](read.md).

## Project status

The cloud application is deployed in AWS Mumbai (`ap-south-1`): **[Open Campus Find](https://main.d36jvrvas9xfi5.amplifyapp.com)**. Registration requires a verified `@licet.ac.in` email. The separate browser-local demo remains available for presentations.

- Verified: TypeScript checks, demo and cloud production builds, seven automated tests, SAM template validation/build, CloudFormation deployment, and successful Amplify publication.
- The tests cover ownership restrictions, private claim access, administrator authorization, competing approval transactions using a mocked DynamoDB client, status transitions, and campus email domain validation.
- Verified against real AWS: Cognito SRP authentication, private S3 upload/view, ownership restrictions, private claims, duplicate prevention, concurrent approval conflicts, rejection, handover, and related lost report closure. Temporary test users and data were removed.
- Not yet verified: browser interaction and responsive visual checks, and verification/reset email delivery to a real college inbox. The first real administrator must register, verify their email, and be added to the Cognito administrator group by an authorized operator.

Cloud deployment now has a dedicated guide: [CLOUD_DEPLOYMENT.md](CLOUD_DEPLOYMENT.md). It covers the `@licet.ac.in` campus domain, Mumbai region, complete SAM/Amplify deployment, real Cognito sign-in, and live integration tests. AWS builds reject missing settings instead of falling back to demo sessions.

See [DEPLOYMENT.md](DEPLOYMENT.md) for the deployed environment and completed checks. The cloud database starts empty; the local demo seed data is not used by the hosted application.

## Repository structure

```text
src/                   React pages, styles, demo seed data, and API adapter
backend/               Lambda API, signup validation, shared workflow rules
tests/                 Authorization, privacy, workflow, and signup tests
scripts/               Cloud deployment, configuration, and live integration tests
template.yaml          AWS SAM infrastructure
amplify.yml            Amplify frontend build settings
.env.example           Demo and AWS configuration without secrets
DEMO.md                Step-by-step demonstration guide
read.md                Original project proposal
```

## Run locally

Use Node.js 24 LTS and npm.

```powershell
npm ci
Copy-Item .env.example .env
npm run dev
```

Open the Local URL printed by Vite. The default is `http://127.0.0.1:5173`. Choose **Continue as student** or **Explore administrator view**. Sample reports are seeded automatically. No AWS credentials are needed. Demo reports and evidence persist in this browser's localStorage; the simulated session uses sessionStorage. This is a teaching demonstration, **not authentication or production security**. Do not enter real private information in demo mode. Sign out to change roles. To reset, remove `campus-data-v1` from browser localStorage.

```powershell
npm test
npm run build
```

## What is included

- Login, campus email registration and verification in AWS mode; explicit simulated student/admin sessions in demo mode.
- Responsive navy, white, and teal home, searchable listings, create/edit reports, item details, personal dashboard, and administration.
- Report filters for keyword, category, location, lost/found, and status. Load-more UI, loading, empty, success, and error messages.
- Private ownership claims, rejection reasons, approval with a collection location, and separate physical handover confirmation.
- Admin report review and closure; owners can close resolved lost reports, including reports related to a returned item.
- Optional image upload; private S3 storage and short-lived viewing URLs in AWS mode. Demo photos are local data URLs.

## Architecture

```text
Amplify Hosting → React/Vite frontend
                       ↓ Cognito access JWT
              API Gateway HTTP API
                       ↓ verified identity
                 Node.js 24 Lambda
                   ↙          ↘
              DynamoDB      Private S3
```

`backend/domain.ts` contains shared validation and workflow rules, re-exported by `src/domain.ts` for the frontend. `src/api.ts` explicitly selects the demo adapter or authenticated AWS adapter. The AWS Lambda never accepts demo sessions, user IDs, or roles from request bodies. API Gateway verifies Cognito JWTs; ownership comes from `sub`, and administration comes from the IAM-managed Cognito `Administrators` group. A pre-signup Lambda enforces the configured campus email domain, and Cognito verifies email before login. The browser has no AWS credentials.

## AWS deployment

For the automated complete deployment, use:

```powershell
./scripts/deploy-cloud.ps1 -CampusDomain licet.ac.in -StackName campus-find -Region ap-south-1
```

See [CLOUD_DEPLOYMENT.md](CLOUD_DEPLOYMENT.md) for prerequisites and the live test command. The stack includes an Amplify app and hosting branch; the deployment script publishes a ZIP build without requiring a GitHub token. The manual SAM commands below remain available for backend-only work.

Prerequisites: AWS account, configured AWS CLI credentials, SAM CLI, Node.js 24, npm, and permission to create IAM, Cognito, Lambda, API Gateway, DynamoDB, S3, and Amplify resources. Resources incur AWS costs. Reuse the existing `campus-find` stack to update the deployed environment.

```powershell
npm ci
# SAM's esbuild builder needs the executable on PATH.
$env:PATH = "$PWD\node_modules\.bin;$env:PATH"
sam validate --lint
sam build
sam deploy --guided
```

Choose a stack name and AWS region. Set `CampusDomain` to the college domain and `FrontendOrigin` to the exact frontend origin (no trailing slash). For local AWS-mode development use `http://127.0.0.1:5173`. Accept the IAM capability when prompted by SAM. Keep the stack outputs.

Set `.env` for local AWS development, or these build environment variables in Amplify:

```dotenv
VITE_MODE=aws
VITE_CAMPUS_DOMAIN=yourcollege.edu
VITE_API_URL=<ApiUrl output, no trailing slash>
VITE_USER_POOL_ID=<UserPoolId output>
VITE_USER_POOL_CLIENT_ID=<UserPoolClientId output>
```

Restart Vite or rebuild after changing environment variables. A build with `VITE_MODE=aws` does not expose simulated login buttons. Never put AWS secret keys in frontend environment variables.

Register a campus account, verify the emailed code, then log in. Passwords require at least 12 characters with uppercase, lowercase, numbers, and symbols. An AWS operator grants administration:

```powershell
aws cognito-idp admin-add-user-to-group --user-pool-id <UserPoolId> --username <verified-campus-email> --group-name Administrators
```

Sign out and back in after granting the group to refresh tokens. Users cannot self-assign groups. Do not grant Cognito administrative IAM permissions to the frontend or normal campus users.

The SAM stack creates its own Amplify app and `main` branch, automatically allowing that origin in API and S3 CORS. Use `publish-frontend.ps1` to deploy frontend updates. Alternatively, a separate Git-connected Amplify app can use the included `amplify.yml`; configure its build environment variables and pass its exact origin as `FrontendOrigin` when deploying SAM. The current UI uses in-app navigation. Deployment URLs must come from actual AWS outputs.

## API and data design

All routes require a valid Cognito token in `Authorization: Bearer <access-token>`.

| Route                 | Purpose                                                           |
| --------------------- | ----------------------------------------------------------------- |
| GET /reports?cursor=… | Campus report feed, 24 records per page                           |
| POST /reports         | Validate and create an owned open report                          |
| POST /edit            | Owner-only open report editing, immutable report type             |
| POST /close           | Owner closes an open lost report; admin moderates any open report |
| GET /claims?cursor=…  | Own private claims, or all claims for administrators              |
| POST /claim           | Private ownership evidence with reportId                          |
| POST /decision        | Admin claimId + action: approve, reject, complete                 |
| POST /uploads         | Create 120-second presigned POST with type and size               |
| GET /photos/:reportId | Authenticated 120-second photo viewing URL                        |

One on-demand DynamoDB table stores `pk=REPORT#<id>` or `CLAIM#<reportId>:<claimantId>`, `sk=DATA`, and a typed `data` document. The deterministic claim key prevents duplicate active claims from the same person. Rejected claims can be resubmitted at the same key; the initial implementation retains the current decision rather than an audit history.

`ByKind` partitions by REPORT or CLAIM and sorts by `createdAt#id` for descending campus feeds/admin review. `ByOwner` partitions by Cognito subject and sorts by `kind#createdAt#id` for private own-claim queries. Personal reports are filtered from the campus feed in this initial version. Both APIs return opaque base64url last-evaluated-key cursors. GSI reads are eventually consistent, so a new report/decision can take a moment to appear; refresh if needed. Individual workflow reads are strongly consistent.

Search and filters currently run in the browser after fetching all report pages. This is convenient for a small college demonstration but scales linearly with campus reports and is not full-text search. At larger scale, add query-specific indexes and a dedicated search service. No public API includes claimant evidence, contact addresses, rejection reasons, or admin collection instructions: claim reads are restricted to the claimant or an administrator. Report documents contain a Cognito subject (pseudonymous reporter ID), not an email address.

## Workflow and concurrency

- Reports start `open`. Owners may edit only their own open reports.
- Found reports accept claims from other users only. Existing pending, approved, or completed claims block duplicates.
- Admin approval atomically changes a pending claim to `approved` and its open report to `claim approved`; a collection location is required.
- Rejection requires a private reason and preserves the report's current status. Rejecting another pending claim does not release an item already reserved for collection.
- Handover atomically changes an approved claim to `completed` and its reserved report to `returned`.
- An owner/admin can close an open lost report after a related return. Admins can close inappropriate open listings. Reserved/returned reports cannot be edited or closed through this route.

Every transactional mutation checks the previous version number. Two approvals that read the same open report cannot both commit: DynamoDB allows one transaction and rejects the other with HTTP 409. Claim submission also condition-checks the report version/status to avoid races with closure or approval. The domain tests cover authorization, duplicate claims, conflicting approvals and valid/invalid transitions; live DynamoDB integration and simultaneous-request checks require a deployed stack.

## Photos and privacy

Only JPEG, PNG, and WebP up to 5 MiB are accepted. S3 presigned POST policies enforce the MIME declaration and byte range, with random keys scoped to the uploader. Report creation checks object existence, uploader prefix, size, and content type. Bucket public access is blocked and encryption is enabled. Viewing requires a signed-in campus session; the signed URL expires after 120 seconds. Failed uploads stop publication and show an error for retry. Editing text preserves the original photo.

MIME validation is not malware scanning or image-byte decoding; add those before a public production launch. A file uploaded without a completed report can remain orphaned; add a cleanup job for production. Campus viewers see public descriptions and photos, so keep contact details and unique proof out of these fields. The application has no public contact field. Demo evidence is stored in the browser and has no privacy guarantee.

## Demo guide

See [DEMO.md](DEMO.md). Future work: automatic matching, email notifications, image thumbnails, a decision audit trail, and scalable search.

Official implementation references: [Lambda Node.js runtimes](https://docs.aws.amazon.com/lambda/latest/dg/lambda-nodejs.html), [S3 POST policies](https://docs.aws.amazon.com/AmazonS3/latest/developerguide/sigv4-HTTPPOSTConstructPolicy.html), and [Vite setup](https://vite.dev/guide/).
