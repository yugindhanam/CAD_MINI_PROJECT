import { test } from "node:test";
import assert from "node:assert/strict";
import {
  claimItem,
  closeReport,
  decide,
  editReport,
  type User,
} from "../src/domain";
import { seed } from "../src/seed";
const student: User = { id: "owner", email: "owner@campus.edu", admin: false };
const admin: User = { id: "admin", email: "admin@campus.edu", admin: true };
test("authorization blocks edits, self claims, and non-admin decisions", () => {
  const r = seed().reports[0];
  assert.throws(() => editReport(r, student, r));
  assert.throws(() =>
    claimItem(
      r,
      { ...student, id: r.reporterId },
      "My identifying details here",
    ),
  );
  const c = claimItem(r, student, "My identifying details here");
  assert.throws(() => decide(r, c, student, "approve", "", "Front desk"));
});
test("duplicates are rejected, rejected claims may be resubmitted", () => {
  const r = seed().reports[0];
  const c = claimItem(r, student, "Serial number and hidden mark");
  assert.throws(() => claimItem(r, student, "Other private evidence here", c));
  const rejected = decide(r, c, admin, "reject", "Serial number differs").claim;
  assert.equal(
    claimItem(r, student, "Correct serial number this time", rejected).status,
    "pending",
  );
});
test("approval reserves item; competing approval is rejected; handover completes", () => {
  const r = seed().reports[0];
  const c = claimItem(r, student, "Serial number and hidden mark");
  const rival = claimItem(
    r,
    { ...student, id: "rival" },
    "I also know identifying details",
  );
  const approved = decide(r, c, admin, "approve", "", "Student services");
  assert.equal(approved.report.status, "claim approved");
  assert.equal(approved.claim.status, "approved");
  assert.throws(() =>
    decide(approved.report, rival, admin, "approve", "", "Another desk"),
  );
  const done = decide(approved.report, approved.claim, admin, "complete");
  assert.equal(done.report.status, "returned");
  assert.equal(done.claim.status, "completed");
  assert.throws(() => decide(done.report, done.claim, admin, "complete"));
});
test("invalid transitions and missing decision details fail", () => {
  const r = seed().reports[0];
  const c = claimItem(r, student, "Serial number and hidden mark");
  assert.throws(() => decide(r, c, admin, "complete"));
  assert.throws(() => decide(r, c, admin, "approve"));
  assert.throws(() => decide(r, c, admin, "reject"));
  assert.throws(() => closeReport(r, { ...student, id: r.reporterId }));
  assert.equal(closeReport(r, admin).status, "closed");
  const lost = seed().reports[1];
  assert.throws(() => closeReport(lost, student));
  assert.equal(
    closeReport(lost, { ...student, id: lost.reporterId }).status,
    "closed",
  );
  assert.throws(() =>
    editReport(
      { ...lost, status: "closed" },
      { ...student, id: lost.reporterId },
      lost,
    ),
  );
});
