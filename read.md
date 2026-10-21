# Campus Lost and Found Portal

A web application that helps students and staff report lost belongings, list found items, and return them to their rightful owners.

> Original planning document. The implementation is now available in this repository. See [README.md](README.md) for current setup instructions, features, verification status, and AWS deployment steps.

## Objective

Provide one organized place for campus lost and found reports, making it easier to search for belongings and verify ownership before returning an item.

## Users

| Role | Responsibilities |
| --- | --- |
| Student / Staff | Report items, browse listings, submit claims, and track their reports. |
| Administrator | Review reports, verify claims, coordinate collection, and close resolved cases. |

## Core Features

- **Login:** Register and sign in using a campus email account.
- **Report an item:** Create a lost or found report with a title, category, description, date, location, and optional photo.
- **Browse and search:** Search by keyword and filter by report type, category, location, or status.
- **Claim an item:** Submit private identifying details for a found item.
- **Track progress:** View personal reports and claim decisions.
- **Admin dashboard:** Manage reports, review claims, and confirm item returns.

## Basic Workflow

1. **Sign in:** A student or staff member logs in to the portal.
2. **Report:** The user posts a lost item or an item they have found.
3. **Search:** Other users browse listings and search for matching belongings.
4. **Submit a claim:** An owner identifies a found item and provides ownership details privately.
5. **Verify:** The administrator checks the claim and requests additional details if needed.
6. **Collect:** After approval, the owner collects the item at a designated campus location.
7. **Close:** The administrator confirms the handover and marks the report as returned. Any related lost report can also be closed.

### Claim Decisions

| Decision | Next step |
| --- | --- |
| Pending | Administrator reviews ownership details. |
| Approved | Arrange collection; approval alone does not confirm a return. |
| Rejected | Record a reason privately; the item remains available for valid claims. |

### Report Status

- **Open:** The item is still missing or a found item is awaiting a verified owner.
- **Claim approved:** A found item has an approved claimant and is awaiting collection.
- **Returned:** The handover is complete and the report is closed.
- **Closed:** A lost report is resolved, withdrawn, or linked to a completed return.

## Main Pages

| Page | Purpose |
| --- | --- |
| Login / Register | Access the portal. |
| Home / Listings | Browse recent lost and found reports. |
| Report Item | Submit a lost or found report. |
| Item Details | View a report and submit a claim for a found item. |
| My Dashboard | View personal reports and claims. |
| Admin Dashboard | Review reports, decide claims, and record handovers. |

## Proposed Technology Stack

The cloud provider will be selected before implementation. Use one provider for the first version.

| Component | Proposed approach |
| --- | --- |
| Frontend | React with HTML, CSS, and JavaScript |
| Backend | Serverless functions exposed through an API |
| Database | Managed database for users, reports, and claims |
| Image storage | Cloud object storage |
| Authentication | Managed authentication with campus email verification |
| Hosting | Managed frontend hosting |

### Architecture

The frontend sends authenticated requests to the backend API. Serverless functions validate requests and read or update the database. Item photos are kept in object storage, while their references are stored with the reports. Administrative actions require an admin role.

## Basic Data Structure

| Entity | Key information |
| --- | --- |
| User | User ID, name, campus email, role |
| Item Report | Report ID, reporter ID, lost/found type, title, category, public description, location, date, photo reference, status |
| Claim | Claim ID, found report ID, claimant ID, private ownership details, decision, review notes, timestamps |

## Privacy and Validation

- Verify campus email ownership before allowing reports or claims.
- Keep contact information and ownership evidence private.
- Ask finders to withhold unique identifying details from public listings so owners can use them as proof.
- Allow users to edit only their own reports; restrict claim decisions and return confirmation to administrators.
- Validate uploaded image types and sizes on the backend.
- Prevent users from claiming their own found reports and allow only one approved claim per item at a time.

## Development Plan

1. Design the pages and define the data fields.
2. Implement authentication and user roles.
3. Build report creation, image upload, listings, and search.
4. Add claim submission and administrative review.
5. Add collection confirmation and report status updates.
6. Test the complete workflow and deploy the application.

## Basic Demo Scenario

A student finds a calculator in the library and posts a found report. Its owner searches for calculators, opens the listing, and submits a private identifying detail. The administrator verifies the claim, approves collection, and records the return after handover.

## Future Enhancements

- Email notifications for claim decisions.
- Suggested matches between lost and found reports.
- Automatic image thumbnail generation.
- Campus map locations and QR codes for collection references.

## Expected Outcome

A simple campus portal that organizes lost and found reports, helps users locate their belongings, and supports verified returns.
