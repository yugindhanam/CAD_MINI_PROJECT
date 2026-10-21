# Deployed cloud environment

Deployment and live integration checks completed on **22 October 2026 (Asia/Kolkata)**.

| Setting                | Value                                                   |
| ---------------------- | ------------------------------------------------------- |
| Portal                 | https://main.d36jvrvas9xfi5.amplifyapp.com              |
| API                    | https://q1jp3c2qxj.execute-api.ap-south-1.amazonaws.com |
| AWS region             | Mumbai, `ap-south-1`                                    |
| CloudFormation stack   | `campus-find`                                           |
| Campus email domain    | `licet.ac.in`                                           |
| Amplify hosting branch | `main`                                                  |
| Application data       | DynamoDB and private S3; no browser demo seed data      |

The API requires a Cognito access token; opening its reports endpoint without signing in returns 401. The hosted frontend uses real Cognito authentication and has no simulated session buttons. Its database starts empty. Create your first report after registering and verifying a real college email.

## Completed checks

- Seven automated tests pass, including authorization, private access, exact administrator-group membership, invalid requests, CORS preflight handling, claim conflicts, status transitions, signup domain restrictions, and cloud configuration validation.
- TypeScript, demo build, and AWS-mode production build pass.
- SAM lint validation and Lambda builds pass. CloudFormation stack status is `UPDATE_COMPLETE`.
- Amplify deployment job 3 reached `SUCCEED`, and the hosted document returned HTTP 200.
- Live API/browser-origin preflight responds without requiring a login token, while data routes remain protected.
- Temporary users authenticated with real Cognito SRP sign-in. A temporary administrator was created only for the integration test.
- A real photo was uploaded to private S3, viewed using a short-lived signed URL, and denied when requested without its signature.
- Unauthorized edits, self-claims, duplicate pending claims, and non-admin decisions were blocked.
- Two simultaneous approvals resulted in one success and one conflict. Approval reserved the item; a separate handover action marked it returned. Rejection and closure of a related lost report also passed.
- Temporary test accounts, reports, claims, and photo were removed after the test.

## Remaining account setup and verification

Register and verify your real `@licet.ac.in` email on the portal. An authorized AWS operator can then add the intended administrator to the `Administrators` Cognito group; sign out and back in afterward. No real account was created with an invented password or automatically granted administration.

Real inbox delivery, password recovery email delivery, and interactive browser/responsive visual checks remain to be verified. The automation environment did not provide an available browser. These limits do not affect the successful live API and storage checks above.

## Update the application

Follow [CLOUD_DEPLOYMENT.md](CLOUD_DEPLOYMENT.md). Frontend deployments use Amplify's manual deployment API; a GitHub push runs project checks but does not automatically publish the website. Cloud identifiers in the frontend build are public configuration; AWS credentials and temporary test tokens are not committed.
