import { Amplify } from "aws-amplify";
import {
  fetchAuthSession,
  getCurrentUser,
  signIn,
  signUp,
  confirmSignUp,
  signOut,
} from "aws-amplify/auth";
import {
  claimItem,
  closeReport,
  decide,
  editReport,
  reportInput,
  type State,
  type User,
} from "./domain";
import { seed } from "./seed";
export const demo = import.meta.env.VITE_MODE !== "aws";
export const domain = import.meta.env.VITE_CAMPUS_DOMAIN || "campus.edu";
if (!demo)
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: import.meta.env.VITE_USER_POOL_ID,
        userPoolClientId: import.meta.env.VITE_USER_POOL_CLIENT_ID,
      },
    },
  });
export async function session(): Promise<User | null> {
  if (demo)
    return JSON.parse(sessionStorage.getItem("campus-session") || "null");
  try {
    const u = await getCurrentUser();
    const s = await fetchAuthSession();
    return {
      id: u.userId,
      email: String(s.tokens?.idToken?.payload.email || ""),
      admin: (
        (s.tokens?.accessToken.payload["cognito:groups"] as string[]) || []
      ).includes("Administrators"),
    };
  } catch {
    return null;
  }
}
export async function auth(
  action: string,
  email: string,
  password: string,
  code: string,
) {
  if (action === "register")
    await signUp({
      username: email,
      password,
      options: { userAttributes: { email } },
    });
  else if (action === "verify")
    await confirmSignUp({ username: email, confirmationCode: code });
  else await signIn({ username: email, password });
}
export async function logout() {
  if (demo) sessionStorage.removeItem("campus-session");
  else await signOut();
}
export function demoLogin(admin: boolean) {
  sessionStorage.setItem(
    "campus-session",
    JSON.stringify({
      id: admin ? "admin" : "student",
      email: `${admin ? "admin" : "alex"}@${domain}`,
      admin,
    }),
  );
}
function read(): State {
  return JSON.parse(
    localStorage.getItem("campus-data-v1") || JSON.stringify(seed()),
  );
}
async function request(path: string, method = "GET", body?: unknown) {
  const s = await fetchAuthSession();
  const response = await fetch(`${import.meta.env.VITE_API_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${s.tokens?.accessToken.toString()}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await response.json();
  if (!response.ok) throw Error(result.message || "Request failed");
  return result;
}
export async function load(u: User): Promise<State> {
  if (demo) {
    const s = read();
    return {
      ...s,
      claims: s.claims.filter((c) => u.admin || c.claimantId === u.id),
    };
  }
  const reports = [];
  let cursor = "";
  do {
    const page = await request(
      `/reports${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
    );
    reports.push(...page.items);
    cursor = page.cursor;
  } while (cursor);
  const claims = [];
  cursor = "";
  do {
    const page = await request(
      `/claims${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
    );
    claims.push(...page.items);
    cursor = page.cursor;
  } while (cursor);
  return { reports, claims };
}
export async function mutate(u: User, action: string, p: any) {
  if (!demo) return request("/" + action, "POST", p);
  const s = read();
  const r = s.reports.find((r) => r.id === p.reportId);
  if (action === "reports") {
    const now = new Date().toISOString();
    s.reports.unshift({
      ...reportInput.parse(p),
      id: crypto.randomUUID(),
      reporterId: u.id,
      status: "open",
      version: 0,
      createdAt: now,
      updatedAt: now,
      photo: p.photo,
    });
  } else if (action === "edit") {
    if (!r) throw Error("Report missing");
    Object.assign(r, editReport(r, u, p));
  } else if (action === "close") {
    if (!r) throw Error("Report missing");
    Object.assign(r, closeReport(r, u));
  } else if (action === "claim") {
    if (!r) throw Error("Report missing");
    const old = s.claims.find(
      (c) => c.reportId === r.id && c.claimantId === u.id,
    );
    const c = claimItem(r, u, p.evidence, old);
    s.claims = s.claims.filter((x) => x.id !== c.id);
    s.claims.push(c);
  } else {
    const c = s.claims.find((c) => c.id === p.claimId);
    if (!c) throw Error("Claim missing");
    const report = s.reports.find((r) => r.id === c.reportId)!;
    const next = decide(report, c, u, p.action, p.reason, p.collection);
    Object.assign(report, next.report);
    Object.assign(c, next.claim);
  }
  localStorage.setItem("campus-data-v1", JSON.stringify(s));
}
export async function upload(
  file: File,
  u: User,
): Promise<{ photo?: string; photoKey?: string }> {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 5 * 1024 * 1024
  )
    throw Error("Use a JPG, PNG, or WebP up to 5 MB");
  if (demo)
    return {
      photo: await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result));
        r.onerror = rej;
        r.readAsDataURL(file);
      }),
    };
  const signed = await request("/uploads", "POST", {
    type: file.type,
    size: file.size,
  });
  const form = new FormData();
  Object.entries(signed.fields).forEach(([k, v]) => form.append(k, String(v)));
  form.append("file", file);
  if (!(await fetch(signed.url, { method: "POST", body: form })).ok)
    throw Error("Photo upload failed. Please retry.");
  return { photoKey: signed.key };
}
export async function photoUrl(reportId: string) {
  return request(`/photos/${reportId}`);
}
