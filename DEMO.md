# Five-minute demonstration

1. Run `npm ci`, then `npm run dev`. Leave `VITE_MODE=demo` (the default). Open the printed URL and point out the **Local demonstration mode** message.
2. Continue as student. Search for “calculator”; try the found/category/location filters and open the scientific calculator.
3. Submit private evidence such as “There is a small star sticker underneath the battery cover.” The student cannot claim their own found report or submit a duplicate pending claim.
4. Open **My dashboard** and show the pending claim. Create a lost report and edit it while it is open.
5. Sign out, then enter administrator view. Open **Administration**, review the private evidence, enter “Student services, desk 2” and approve collection.
6. Show that the report is **claim approved**, not returned. A second approval for that item is blocked.
7. Sign out and enter the student view. The personal claim shows the collection location.
8. Return as administrator. After explaining that physical handover has occurred, click **Confirm physical handover**. The claim becomes completed and the report becomes returned.
9. Return as student and close the related lost report from the dashboard. Show a second claim rejection with a private reason if time permits.

The local demo shares seeded browser data across simulated sessions. It demonstrates behavior, not security. Real access control is implemented by Cognito, API Gateway, and Lambda in AWS mode. No cloud deployment is implied by this demonstration.
