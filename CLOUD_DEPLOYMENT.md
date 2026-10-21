# Deploy Campus Find to AWS

The cloud environment uses Cognito for verified `@licet.ac.in` accounts, an API Gateway HTTP API with JWT scopes, Node.js Lambda functions, DynamoDB records, a private S3 photo bucket, and Amplify Hosting. The default deployment region is Mumbai, `ap-south-1`.

## Deploy the complete application

Install Node.js 24, AWS CLI, and AWS SAM CLI. Configure AWS credentials locally with permission to create the resources declared in `template.yaml`. No AWS access keys belong in a Vite environment file or in Git.

From PowerShell at the repository root:

```powershell
npm ci
./scripts/deploy-cloud.ps1 -CampusDomain licet.ac.in -StackName campus-find -Region ap-south-1
```

The script runs the tests, validates and builds the SAM template, deploys the stack, reads the actual stack outputs, builds the AWS frontend, and uploads the build to the stack's Amplify app. It waits for Amplify to finish, then verifies that the HTML and every referenced JavaScript/CSS asset return HTTP 200 with the correct content type. The deployment creates billable AWS resources.

The stack manages the Amplify app and `main` hosting branch. This uses Amplify's manual ZIP deployment API and does not require a GitHub personal access token. GitHub pushes run the included automated checks; they do not automatically redeploy the hosted app. To update only the frontend:

```powershell
./scripts/publish-frontend.ps1 -StackName campus-find -Region ap-south-1
```

The packaging helper explicitly writes forward slashes in ZIP entry names on Windows. Do not replace it with Windows PowerShell's `Compress-Archive`: backslash entries can be deployed as literal object names, leaving the root HTML accessible while its scripts/styles return 404 and the page stays blank. To recheck the hosted assets at any time:

```powershell
node scripts/verify-hosting.mjs https://main.d36jvrvas9xfi5.amplifyapp.com
```

To update backend code or infrastructure, rerun `deploy-cloud.ps1` with the same stack name and domain. Keep the existing stack name to preserve its data and identity resources.

## Local frontend against real AWS services

```powershell
./scripts/configure-cloud.ps1 -StackName campus-find -Region ap-south-1
npm run dev -- --mode aws
```

The configuration helper writes `.env.aws.local`, which Git ignores. It contains only public resource identifiers. `npm run build:cloud` uses this same AWS configuration and rejects missing settings; it cannot silently build the local demo. Plain `npm run dev` continues to use the separate demo mode unless `.env` explicitly selects AWS.

The cloud database starts empty. Seeded sample reports, localStorage demo evidence, and simulated administrator sessions are never imported into AWS. Register a real campus email on the hosted app, enter the Cognito verification code received in that inbox, then sign in. Password recovery and verification-code resend are available from the login page.

## Grant an administrator

After the intended administrator has registered and verified their email, an authorized AWS operator runs:

```powershell
aws cognito-idp admin-add-user-to-group --user-pool-id <UserPoolId stack output> --username <verified-campus-email> --group-name Administrators --region ap-south-1
```

Sign out and back in to refresh the group claim. Normal users have no endpoint or frontend control that can assign this group. Do not share administrator credentials or assign the role to an unverified account.

## Verify the live workflow

```powershell
npm run test:cloud -- campus-find ap-south-1
```

This opt-in integration test requires AWS operator credentials. It creates temporary synthetic campus accounts with notifications suppressed, signs in through real Cognito SRP authentication, uploads and views a real private S3 image, checks ownership/privacy restrictions, submits competing claims, verifies one approval succeeds, confirms handover, and closes a related lost report. A `finally` block removes the known temporary users, records, and object. Test passwords and tokens stay in memory and are not logged. It does not send verification emails or verify delivery to a real college inbox.

Also verify the browser workflow with a real verified campus account. Check the frontend URL and API URL from CloudFormation outputs. An unauthenticated `GET /reports` must return 401, and the S3 object URL without a signature must return 403. Claim evidence must appear only in the claimant's dashboard and administrator review.

API routes return 403 for forbidden actions, 404 for missing records, 409 for conditional conflicts, and a generic 500 for unexpected cloud failures. Lambda logs omit request bodies, tokens, and evidence. S3 view/upload links expire after 120 seconds. The API throttles traffic, and CORS allows only the stack's Amplify origin and the configured local development origin.

## Current limits

- Search still filters the fetched campus report feed in the browser; introduce dedicated search/indexes when the number of reports grows.
- List queries use eventually consistent DynamoDB indexes. Mutation responses immediately update the initiating user's UI with the committed result.
- MIME declarations and size are validated, but image content scanning and orphan-file cleanup are future work.
- Email verification and password reset use Cognito's configured email delivery. Delivery and account quotas must be checked with the real college mailbox.
- A Cognito group change applies after refreshing the login session. API Gateway validates signed JWTs without calling Cognito on every request, so a previously issued access token remains usable until it expires.
