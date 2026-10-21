import { z } from "zod";
export class DomainError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
  ) {
    super(message);
    this.name = "DomainError";
  }
}
export const categories = [
  "electronics",
  "ID cards",
  "books",
  "bags",
  "keys",
  "accessories",
  "others",
] as const;
export const reportInput = z.object({
  title: z.string().trim().min(3).max(100),
  type: z.enum(["lost", "found"]),
  category: z.enum(categories),
  description: z.string().trim().min(10).max(2000),
  location: z.string().trim().min(2).max(100),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine(
      (v) =>
        !isNaN(Date.parse(v)) && v <= new Date().toISOString().slice(0, 10),
      "Use a valid date, today or earlier",
    ),
});
export type User = { id: string; email: string; admin: boolean };
export type Report = z.infer<typeof reportInput> & {
  id: string;
  reporterId: string;
  status: "open" | "claim approved" | "returned" | "closed";
  createdAt: string;
  updatedAt: string;
  photoKey?: string;
  photo?: string;
  version: number;
};
export type Claim = {
  id: string;
  reportId: string;
  claimantId: string;
  evidence: string;
  status: "pending" | "approved" | "rejected" | "completed";
  reason?: string;
  collection?: string;
  createdAt: string;
  updatedAt: string;
  version: number;
};
export type State = { reports: Report[]; claims: Claim[] };
export function requireAdmin(u: User) {
  if (!u.admin) throw new DomainError("Administrator access required", 403);
}
export function editReport(r: Report, u: User, input: unknown): Report {
  if (r.reporterId !== u.id || r.status !== "open")
    throw new DomainError("Only the owner can edit an open report", 403);
  const parsed = reportInput.parse(input);
  if (parsed.type !== r.type)
    throw new DomainError("Report type cannot be changed after publication");
  return {
    ...r,
    ...parsed,
    updatedAt: new Date().toISOString(),
    version: r.version + 1,
  };
}
export function claimItem(
  r: Report,
  u: User,
  evidence: string,
  existing?: Claim,
): Claim {
  if (r.type !== "found" || r.status !== "open" || r.reporterId === u.id)
    throw new DomainError("This item cannot be claimed");
  if (
    existing &&
    ["pending", "approved", "completed"].includes(existing.status)
  )
    throw new DomainError("You already have an active claim");
  if (
    typeof evidence !== "string" ||
    evidence.trim().length < 15 ||
    evidence.length > 3000
  )
    throw new DomainError(
      "Provide 15–3000 characters of private identifying details",
    );
  const now = new Date().toISOString();
  return {
    id: `${r.id}:${u.id}`,
    reportId: r.id,
    claimantId: u.id,
    evidence: evidence.trim(),
    status: "pending",
    createdAt: now,
    updatedAt: now,
    version: (existing?.version ?? -1) + 1,
  };
}
export function decide(
  r: Report,
  c: Claim,
  u: User,
  action: string,
  reason = "",
  collection = "",
): { report: Report; claim: Claim } {
  requireAdmin(u);
  if (
    typeof reason !== "string" ||
    reason.length > 1000 ||
    typeof collection !== "string" ||
    collection.length > 200
  )
    throw new DomainError("Invalid decision details");
  const now = new Date().toISOString();
  if (action === "complete") {
    if (c.status !== "approved" || r.status !== "claim approved")
      throw new DomainError("Only an approved claim can be handed over");
    return {
      report: {
        ...r,
        status: "returned",
        updatedAt: now,
        version: r.version + 1,
      },
      claim: {
        ...c,
        status: "completed",
        updatedAt: now,
        version: c.version + 1,
      },
    };
  }
  if (c.status !== "pending" || (action !== "reject" && r.status !== "open"))
    throw new DomainError("Claim or item is no longer available", 409);
  if (action === "approve" && collection.trim().length < 3)
    throw new DomainError("Specify a collection location");
  if (action === "reject" && reason.trim().length < 3)
    throw new DomainError("Provide a rejection reason");
  if (!["approve", "reject"].includes(action))
    throw new DomainError("Invalid action");
  return {
    report: {
      ...r,
      status: action === "approve" ? "claim approved" : r.status,
      updatedAt: now,
      version: r.version + 1,
    },
    claim: {
      ...c,
      status: action === "approve" ? "approved" : "rejected",
      reason: action === "reject" ? reason : undefined,
      collection: action === "approve" ? collection : undefined,
      updatedAt: now,
      version: c.version + 1,
    },
  };
}
export function closeReport(r: Report, u: User): Report {
  if (!u.admin && r.reporterId !== u.id)
    throw new DomainError("Not authorized", 403);
  if ((r.type !== "lost" && !u.admin) || r.status !== "open")
    throw new DomainError(
      "Only open lost reports or administrator-moderated open reports can be closed",
    );
  return {
    ...r,
    status: "closed",
    updatedAt: new Date().toISOString(),
    version: r.version + 1,
  };
}
